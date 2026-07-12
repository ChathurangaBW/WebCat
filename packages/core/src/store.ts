import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { redactValue } from "./redaction.js";
import type { ApprovalRecord, AuditRecord, EvidenceRecord, Finding, Hypothesis, SessionRecord, WorkflowState } from "./types.js";

const makeId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString("hex")}`;

export class EngagementStore {
  public readonly root: string;
  public constructor(cwd = process.cwd(), private readonly redactSecrets = true, private readonly maxEvidenceBytes = 1_048_576) {
    this.root = path.join(cwd, ".webcat");
  }

  public async init(): Promise<void> {
    for (const directory of ["state", "evidence", "reports"]) await fs.mkdir(path.join(this.root, directory), { recursive: true });
  }

  private sanitize(value: unknown): unknown { return this.redactSecrets ? redactValue(value) : value; }

  private async appendJsonl(file: string, value: unknown): Promise<void> {
    await this.init();
    await fs.appendFile(path.join(this.root, file), `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  private async readJsonl<T>(file: string): Promise<T[]> {
    try {
      const text = await fs.readFile(path.join(this.root, file), "utf8");
      return text.split(/\r?\n/).filter(Boolean).map((line: string) => JSON.parse(line) as T);
    } catch { return []; }
  }

  private async replaceJsonl(file: string, values: unknown[]): Promise<void> {
    await this.init();
    const target = path.join(this.root, file);
    const temporary = `${target}.${process.pid}.tmp`;
    await fs.writeFile(temporary, values.map((value) => JSON.stringify(value)).join("\n") + (values.length ? "\n" : ""), { mode: 0o600 });
    await fs.rename(temporary, target);
  }

  public async appendAudit(action: string, actor: string, status: AuditRecord["status"], details: Record<string, unknown>): Promise<AuditRecord> {
    const record: AuditRecord = { id: makeId("aud"), timestamp: new Date().toISOString(), action, actor, status, details: this.sanitize(details) as Record<string, unknown> };
    await this.appendJsonl("audit.jsonl", record);
    return record;
  }

  public async listAudit(): Promise<AuditRecord[]> { return this.readJsonl<AuditRecord>("audit.jsonl"); }

  public async addEvidence(agent: string, kind: EvidenceRecord["kind"], summary: string, data: unknown): Promise<EvidenceRecord> {
    await this.init();
    const sanitized = this.sanitize(data);
    let body = JSON.stringify(sanitized);
    if (Buffer.byteLength(body) > this.maxEvidenceBytes) {
      body = JSON.stringify({ truncated: true, originalBytes: Buffer.byteLength(body), preview: body.slice(0, this.maxEvidenceBytes) });
    }
    const normalizedData = JSON.parse(body) as unknown;
    const record: EvidenceRecord = {
      id: makeId("ev"), timestamp: new Date().toISOString(), agent, kind, summary: String(this.sanitize(summary)), data: normalizedData,
      sha256: crypto.createHash("sha256").update(body).digest("hex"), byteLength: Buffer.byteLength(body)
    };
    await fs.writeFile(path.join(this.root, "evidence", `${record.id}.json`), JSON.stringify(record, null, 2), { mode: 0o600 });
    await this.appendJsonl("evidence.jsonl", { id: record.id, timestamp: record.timestamp, agent, kind, summary: record.summary, sha256: record.sha256, byteLength: record.byteLength });
    return record;
  }

  public async listEvidence(): Promise<Array<Omit<EvidenceRecord, "data">>> { return this.readJsonl<Array<Omit<EvidenceRecord, "data">>[number]>("evidence.jsonl"); }

  public async readEvidence(id: string): Promise<EvidenceRecord> {
    const file = path.join(this.root, "evidence", `${path.basename(id)}.json`);
    return JSON.parse(await fs.readFile(file, "utf8")) as EvidenceRecord;
  }

  public async addHypothesis(input: Omit<Hypothesis, "id" | "createdAt" | "updatedAt">): Promise<Hypothesis> {
    const now = new Date().toISOString();
    const record: Hypothesis = { ...input, id: makeId("hyp"), createdAt: now, updatedAt: now };
    await this.appendJsonl("hypotheses.jsonl", record);
    return record;
  }

  public async listHypotheses(): Promise<Hypothesis[]> { return this.readJsonl<Hypothesis>("hypotheses.jsonl"); }

  public async updateHypothesis(id: string, patch: Partial<Hypothesis>): Promise<Hypothesis> {
    const values = await this.listHypotheses();
    const index = values.findIndex((item) => item.id === id);
    if (index < 0) throw new Error(`hypothesis not found: ${id}`);
    values[index] = { ...values[index]!, ...patch, id, updatedAt: new Date().toISOString() };
    await this.replaceJsonl("hypotheses.jsonl", values);
    return values[index]!;
  }

  public async addFinding(input: Omit<Finding, "id" | "createdAt" | "updatedAt">): Promise<Finding> {
    const now = new Date().toISOString();
    const record: Finding = { ...input, id: makeId("find"), createdAt: now, updatedAt: now };
    await this.appendJsonl("findings.jsonl", record);
    return record;
  }

  public async listFindings(): Promise<Finding[]> { return this.readJsonl<Finding>("findings.jsonl"); }

  public async updateFinding(id: string, patch: Partial<Finding>): Promise<Finding> {
    const values = await this.listFindings();
    const index = values.findIndex((item) => item.id === id);
    if (index < 0) throw new Error(`finding not found: ${id}`);
    values[index] = { ...values[index]!, ...patch, id, updatedAt: new Date().toISOString() };
    await this.replaceJsonl("findings.jsonl", values);
    return values[index]!;
  }

  public async addApproval(input: Omit<ApprovalRecord, "id" | "createdAt">): Promise<ApprovalRecord> {
    const record: ApprovalRecord = { ...input, id: makeId("apr"), createdAt: new Date().toISOString() };
    await this.appendJsonl("approvals.jsonl", record);
    await this.appendAudit("approval.grant", input.createdBy, "completed", { approval: record });
    return record;
  }

  public async listApprovals(): Promise<ApprovalRecord[]> {
    const values = await this.readJsonl<ApprovalRecord>("approvals.jsonl");
    const now = Date.now();
    return values.map((value) => value.status === "active" && new Date(value.expiresAt).getTime() <= now ? { ...value, status: "expired" } : value);
  }

  public async revokeApproval(id: string): Promise<ApprovalRecord> {
    const values = await this.listApprovals();
    const index = values.findIndex((item) => item.id === id);
    if (index < 0) throw new Error(`approval not found: ${id}`);
    values[index] = { ...values[index]!, status: "revoked", revokedAt: new Date().toISOString() };
    await this.replaceJsonl("approvals.jsonl", values);
    await this.appendAudit("approval.revoke", "operator", "completed", { approvalId: id });
    return values[index]!;
  }

  public async saveSession(session: SessionRecord): Promise<void> {
    await this.init();
    await fs.writeFile(path.join(this.root, "state", `${session.id}.json`), JSON.stringify(session, null, 2), { mode: 0o600 });
    await fs.writeFile(path.join(this.root, "state", "current.json"), JSON.stringify(session, null, 2), { mode: 0o600 });
  }

  public async createSession(objective: string): Promise<SessionRecord> {
    const now = new Date().toISOString();
    const session: SessionRecord = { id: makeId("session"), objective, state: "NEW", startedAt: now, updatedAt: now, selectedProfiles: [] };
    await this.saveSession(session);
    return session;
  }

  public async loadSession(id = "current"): Promise<SessionRecord | undefined> {
    try { return JSON.parse(await fs.readFile(path.join(this.root, "state", `${path.basename(id)}.json`), "utf8")) as SessionRecord; } catch { return undefined; }
  }

  public async listSessions(): Promise<SessionRecord[]> {
    await this.init();
    const output: SessionRecord[] = [];
    for (const entry of await fs.readdir(path.join(this.root, "state"))) {
      if (!entry.endsWith(".json") || entry === "current.json") continue;
      try { output.push(JSON.parse(await fs.readFile(path.join(this.root, "state", entry), "utf8")) as SessionRecord); } catch {}
    }
    return output.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public async saveState(state: WorkflowState, extra: Record<string, unknown> = {}): Promise<void> {
    await this.init();
    await fs.writeFile(path.join(this.root, "state", "workflow.json"), JSON.stringify({ state, updatedAt: new Date().toISOString(), ...this.sanitize(extra) as object }, null, 2), { mode: 0o600 });
  }
}
