import { profileByName, type AgentProfile } from "@webcat/agent-profiles";
import { WorkflowMachine, loadSkills, writeReport, type AppConfig, type Engagement, type EngagementStore, type SessionRecord } from "@webcat/core";
import type { McpManager } from "@webcat/mcp-gateway";
import { AgentRunner, type AgentRunResult } from "./agent.js";
import { ChatCompletionsProvider } from "./provider.js";

export interface SwarmRunOptions { resumeSessionId?: string; }

export class SwarmOrchestrator {
  public constructor(private readonly config: AppConfig, private readonly engagement: Engagement, private readonly mcp: McpManager, private readonly store: EngagementStore) {}

  public selectProfiles(objective: string): AgentProfile[] {
    const lower = objective.toLowerCase();
    const names = new Set(["recon-mapper", "traffic-analyst", "api-analyst"]);
    if (/auth|login|session|token|cookie|mfa|password/.test(lower)) names.add("auth-session-analyst");
    if (/access|idor|authorization|tenant|role|permission/.test(lower)) names.add("access-control-analyst");
    if (/inject|xss|sql|command|template|input|parser/.test(lower)) names.add("injection-analyst");
    if (/browser|dom|client|csp|frame/.test(lower)) names.add("client-side-analyst");
    if (/ssrf|server-side|upload|file|xml|deserialize/.test(lower)) names.add("server-side-analyst");
    if (/business|workflow|price|coupon|race|state/.test(lower)) names.add("business-logic-analyst");
    const selected = [...names].map((name) => profileByName(name)).filter((profile): profile is AgentProfile => Boolean(profile));
    return this.engagement.mode === "observe" ? selected.filter((profile) => !profile.active) : selected;
  }

  public async run(objective: string, onEvent: (text: string) => void = () => {}, options: SwarmRunOptions = {}): Promise<AgentRunResult[]> {
    let session = options.resumeSessionId ? await this.store.loadSession(options.resumeSessionId) : undefined;
    session ??= await this.store.createSession(objective);
    const workflow = new WorkflowMachine(session.state === "FAILED" || session.state === "PAUSED" ? "PAUSED" : "NEW");
    const update = async (state: SessionRecord["state"], patch: Partial<SessionRecord> = {}): Promise<void> => {
      session = { ...session!, ...patch, state, updatedAt: new Date().toISOString() };
      await this.store.saveSession(session);
      await this.store.saveState(state, { sessionId: session.id, objective });
    };

    try {
      if (!this.engagement.authorizationConfirmed && this.engagement.mode !== "observe") {
        if (workflow.state === "NEW") workflow.transition("AUTHORIZATION_REQUIRED");
        await update("AUTHORIZATION_REQUIRED");
        throw new Error("authorization is not confirmed");
      }
      if (workflow.state === "NEW") workflow.transition("SCOPE_READY");
      else if (workflow.state === "PAUSED") workflow.transition("SCOPE_READY");
      await update("SCOPE_READY");

      workflow.transition("MCP_DISCOVERY");
      await update("MCP_DISCOVERY");
      onEvent("discovering MCP capabilities");
      await this.mcp.discover(undefined, true);

      workflow.transition("PASSIVE_MAPPING");
      const profiles = this.selectProfiles(objective);
      await update("PASSIVE_MAPPING", { selectedProfiles: profiles.map((profile) => profile.name) });
      const provider = new ChatCompletionsProvider(this.config.provider, this.config.swarm.maxRetries);
      if (!provider.configured()) throw new Error("model provider base URL and model are required");
      if (!provider.hasCredential()) onEvent(`warning: ${this.config.provider.apiKeyEnv} is not set; continuing for endpoints that do not require authentication`);
      const runner = new AgentRunner(provider, this.mcp, this.engagement, this.store, await loadSkills(), this.config.swarm.maxAgentTurns);
      const results: AgentRunResult[] = [];

      const orchestrator = profileByName("webcat-orchestrator")!;
      onEvent("planning engagement lanes");
      results.push(await runner.run(orchestrator, `Create an evidence-oriented plan for this objective: ${objective}. Define non-overlapping lanes, scope assumptions, controls, stop conditions, and expected artifacts. Do not perform active testing in this planning turn.`));

      let index = 0;
      const workerCount = Math.max(1, Math.min(this.config.swarm.maxConcurrency, profiles.length || 1));
      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (index < profiles.length) {
          const profile = profiles[index++]!;
          onEvent(`starting ${profile.name}`);
          try {
            const result = await runner.run(profile, `${objective}\n\nYour isolated lane: ${profile.purpose}. Record observations and hypotheses before candidate findings. Do not duplicate other lanes. Stop when evidence is sufficient or the lane is blocked.`);
            results.push(result);
            await this.store.appendAudit("agent.run", profile.name, "completed", { turns: result.turns, findingIds: result.findingIds, hypothesisIds: result.hypothesisIds });
            onEvent(`completed ${profile.name}`);
          } catch (error) {
            await this.store.appendAudit("agent.run", profile.name, "failed", { error: String(error) });
            onEvent(`failed ${profile.name}: ${String(error)}`);
          }
        }
      }));

      workflow.transition("ATTACK_SURFACE_READY");
      await update("ATTACK_SURFACE_READY");
      workflow.transition("HYPOTHESIS_GENERATION");
      await update("HYPOTHESIS_GENERATION");
      workflow.transition("ACTIVE_VALIDATION");
      await update("ACTIVE_VALIDATION");

      const candidates = (await this.store.listFindings()).filter((finding) => finding.status === "candidate");
      if (candidates.length) {
        const validator = profileByName("finding-validator")!;
        for (const candidate of candidates) {
          onEvent(`validating ${candidate.id}`);
          results.push(await runner.run(validator, `Independently validate, reject, or request more evidence for this candidate. Use a negative control and record validation evidence. Candidate JSON: ${JSON.stringify(candidate)}`));
        }
      }

      workflow.transition("FINDING_REVIEW");
      await update("FINDING_REVIEW");
      const highImpact = (await this.store.listFindings()).filter((finding) => finding.status === "validated" && (finding.severity === "high" || finding.severity === "critical"));
      if (highImpact.length) {
        const critic = profileByName("security-critic")!;
        for (const finding of highImpact) {
          onEvent(`critic review ${finding.id}`);
          results.push(await runner.run(critic, `Adversarially review this high-impact finding. Attempt to disprove it, check scope and severity, then set its final status. Finding JSON: ${JSON.stringify(finding)}`));
        }
      }

      const curator = profileByName("evidence-curator")!;
      results.push(await runner.run(curator, `Review the engagement evidence index, hypotheses, and findings for missing links, unsupported conclusions, and sensitive-data handling. Record quality observations only. Objective: ${objective}`));

      workflow.transition("REPORT_READY");
      await update("REPORT_READY");
      const reportPath = await writeReport(this.store.root, this.engagement, await this.store.listFindings(), await this.store.listHypotheses());
      workflow.transition("COMPLETED");
      await update("COMPLETED", { reportPath, completedAt: new Date().toISOString() });
      onEvent(`report written: ${reportPath}`);
      return results;
    } catch (error) {
      session = { ...session, state: "FAILED", updatedAt: new Date().toISOString(), error: String(error) };
      await this.store.saveSession(session);
      await this.store.appendAudit("swarm.run", "webcat-orchestrator", "failed", { sessionId: session.id, objective, error: String(error) });
      throw error;
    }
  }
}
