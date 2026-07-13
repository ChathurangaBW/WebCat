import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { riskAtLeast } from "./scope.mjs";

export class ApprovalStore {
  constructor(path) { this.path = path; }

  async list(now = new Date()) {
    const values = await this.#read();
    return values.filter((item) => !item.revokedAt && new Date(item.expiresAt) > now);
  }

  async grant(input, now = new Date()) {
    const ttlMinutes = Number(input.ttlMinutes ?? 20);
    if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0 || ttlMinutes > 1440) throw new Error("Approval TTL must be between 1 and 1440 minutes");
    const approval = {
      id: `approval_${randomUUID()}`,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
      risk: input.risk,
      reason: String(input.reason ?? "").trim(),
      server: input.server ?? "*",
      tool: input.tool ?? "*",
      target: input.target ?? "*"
    };
    if (!approval.reason) throw new Error("Approval reason is required");
    const values = await this.#read();
    values.push(approval);
    await this.#write(values);
    return approval;
  }

  async revoke(id, now = new Date()) {
    const values = await this.#read();
    const approval = values.find((item) => item.id === id);
    if (!approval) throw new Error(`Approval ${id} not found`);
    approval.revokedAt = now.toISOString();
    await this.#write(values);
    return approval;
  }

  async permits(input, now = new Date()) {
    const values = await this.list(now);
    return values.some((approval) =>
      riskAtLeast(approval.risk, input.risk) &&
      wildcard(approval.server, input.server) &&
      wildcard(approval.tool, input.tool) &&
      wildcard(approval.target, input.target)
    );
  }

  async #read() {
    try { return JSON.parse(await readFile(this.path, "utf8")); }
    catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  }

  async #write(value) {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    await writeFile(this.path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  }
}

function wildcard(pattern, value) {
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) return String(value).startsWith(pattern.slice(0, -1));
  return pattern === value;
}
