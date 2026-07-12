import { WEB_SECURITY_PROFILES, profileByName, type AgentProfile } from "@webcat/agent-profiles";
import {
  WorkflowMachine,
  loadSkills,
  writeReport,
  type AppConfig,
  type Engagement,
  type EngagementStore,
  type SessionRecord
} from "@webcat/core";
import type { McpManager } from "@webcat/mcp-gateway";
import { AgentRunner, type AgentRunResult } from "./agent.js";
import { ChatCompletionsProvider } from "./provider.js";

export interface SwarmRunResult {
  session: SessionRecord;
  agents: AgentRunResult[];
  reportPaths: string[];
}

export class SwarmOrchestrator {
  public constructor(
    private readonly config: AppConfig,
    private readonly engagement: Engagement,
    private readonly mcp: McpManager,
    private readonly store: EngagementStore
  ) {}

  private selectProfiles(objective: string): AgentProfile[] {
    const lower = objective.toLowerCase();
    const names = new Set(WEB_SECURITY_PROFILES.filter((profile) => profile.alwaysRun).map((profile) => profile.name));
    if (/auth|login|logout|session|token|cookie|password|account/.test(lower)) names.add("auth-session-analyst");
    if (/access|idor|authorization|tenant|role|permission|object/.test(lower)) names.add("access-control-analyst");
    if (/inject|xss|sql|command|template|header|path traversal|xxe/.test(lower)) names.add("injection-analyst");
    if (/browser|client|dom|javascript|csp|cors/.test(lower)) names.add("client-side-analyst");
    if (/ssrf|upload|parser|file|webhook|integration|server/.test(lower)) names.add("server-side-analyst");
    if (/business|workflow|price|coupon|race|limit|state/.test(lower)) names.add("business-logic-analyst");
    if (/scope|boundary|authorization reference/.test(lower)) names.add("scope-guardian");
    return [...names]
      .filter((name) => name !== "webcat-orchestrator")
      .map((name) => profileByName(name))
      .filter((profile): profile is AgentProfile => Boolean(profile));
  }

  private async runWithRetry(
    runner: AgentRunner,
    profile: AgentProfile,
    task: string,
    signal: AbortSignal | undefined,
    onEvent: (text: string) => void
  ): Promise<AgentRunResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.swarm.maxRetries; attempt += 1) {
      try {
        return await runner.run(profile, task, signal);
      } catch (error) {
        lastError = error;
        if (attempt < this.config.swarm.maxRetries) onEvent(`retrying ${profile.name} (${attempt + 1}/${this.config.swarm.maxRetries})`);
      }
    }
    throw lastError;
  }

  public async run(
    objective: string,
    onEvent: (text: string) => void = () => {},
    signal?: AbortSignal,
    existingSession?: SessionRecord
  ): Promise<SwarmRunResult> {
    if (!objective.trim()) throw new Error("objective is required");
    const session = existingSession ?? await this.store.createSession(objective);
    const workflow = new WorkflowMachine(session.state === "FAILED" || session.state === "PAUSED" ? "NEW" : session.state);
    const results: AgentRunResult[] = [];
    const reportPaths: string[] = [];

    const updateSession = async (state = workflow.state, patch: Partial<SessionRecord> = {}): Promise<void> => {
      session.state = state;
      Object.assign(session, patch);
      await this.store.saveSession(session);
      await this.store.saveState(state, { sessionId: session.id, objective });
    };

    try {
      if (workflow.state === "NEW") {
        workflow.transition(this.engagement.authorizationConfirmed || this.engagement.mode === "observe"
          ? "SCOPE_READY"
          : "AUTHORIZATION_REQUIRED");
      }
      await updateSession();
      if (workflow.state === "AUTHORIZATION_REQUIRED") {
        workflow.transition("BLOCKED");
        await updateSession(workflow.state, { error: "authorization is required before active testing" });
        throw new Error("authorization is required before active testing");
      }

      workflow.transition("MCP_DISCOVERY");
      await updateSession();
      onEvent("discovering MCP capabilities");
      await this.mcp.discover(undefined, true);

      workflow.transition("PASSIVE_MAPPING");
      const profiles = this.selectProfiles(objective);
      session.selectedProfiles = profiles.map((profile) => profile.name);
      await updateSession();

      const provider = new ChatCompletionsProvider(this.config.provider);
      if (!provider.configured()) {
        throw new Error(`model provider is not configured; set ${this.config.provider.apiKeyEnv}`);
      }
      const skills = await loadSkills(process.cwd());
      const runner = new AgentRunner(provider, this.mcp, this.engagement, this.store, this.config.swarm.maxAgentTurns, skills);
      const orchestrator = profileByName("webcat-orchestrator")!;
      onEvent("planning engagement lanes");
      results.push(await this.runWithRetry(
        runner,
        orchestrator,
        `Create an evidence-oriented phase plan for this objective: ${objective}. Identify non-overlapping lanes, controls, stopping conditions, and expected artifacts. Do not perform active testing in this planning turn.`,
        signal,
        onEvent
      ));

      let index = 0;
      const workerCount = Math.max(1, Math.min(this.config.swarm.maxConcurrency, profiles.length || 1));
      const workers = Array.from({ length: workerCount }, async () => {
        while (index < profiles.length) {
          const profile = profiles[index++]!;
          onEvent(`starting ${profile.name}`);
          try {
            const result = await this.runWithRetry(
              runner,
              profile,
              `${objective}\nYour assigned lane: ${profile.purpose}. Do not duplicate other lanes. Record evidence and hypotheses before submitting any candidate finding. Engagement mode is ${this.engagement.mode}; the runtime will block operations that are not permitted.`,
              signal,
              onEvent
            );
            results.push(result);
            onEvent(`completed ${profile.name}`);
          } catch (error) {
            onEvent(`failed ${profile.name}: ${error instanceof Error ? error.message : String(error)}`);
            await this.store.appendAudit("agent.run", profile.name, "failed", {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      });
      await Promise.all(workers);

      workflow.transition("ATTACK_SURFACE_READY");
      await updateSession();
      workflow.transition("HYPOTHESIS_GENERATION");
      await updateSession();

      const candidates = (await this.store.listFindings()).filter((finding) => finding.status === "candidate");
      if (candidates.length) {
        workflow.transition("ACTIVE_VALIDATION");
        await updateSession();
        const validator = profileByName("finding-validator")!;
        for (const candidate of candidates) {
          onEvent(`validating ${candidate.id}`);
          results.push(await this.runWithRetry(
            runner,
            validator,
            `Independently validate, reject, or request more evidence for this candidate. Use a negative control and record new evidence before changing status. Candidate JSON: ${JSON.stringify(candidate)}`,
            signal,
            onEvent
          ));
        }
      } else {
        workflow.transition("FINDING_REVIEW");
        await updateSession();
      }

      if (workflow.state === "ACTIVE_VALIDATION") workflow.transition("FINDING_REVIEW");
      await updateSession();
      const reviewed = await this.store.listFindings();
      const highImpact = reviewed.filter((finding) => finding.status === "validated" && ["high", "critical"].includes(finding.severity));
      if (highImpact.length) {
        const critic = profileByName("security-critic")!;
        for (const finding of highImpact) {
          onEvent(`critic review ${finding.id}`);
          results.push(await this.runWithRetry(
            runner,
            critic,
            `Adversarially review this validated high-impact finding. Attempt to disprove it, identify duplicates or severity inflation, and set its final status. Finding JSON: ${JSON.stringify(finding)}`,
            signal,
            onEvent
          ));
        }
      }

      workflow.transition("REPORT_READY");
      await updateSession();
      const findings = await this.store.listFindings();
      const hypotheses = await this.store.listHypotheses();
      reportPaths.push(await writeReport(this.store.root, this.engagement, findings, hypotheses, "markdown"));
      reportPaths.push(await writeReport(this.store.root, this.engagement, findings, hypotheses, "json"));
      workflow.transition("COMPLETED");
      await updateSession(workflow.state, { completedAt: new Date().toISOString(), reportPaths, error: undefined });
      return { session, agents: results, reportPaths };
    } catch (error) {
      if (workflow.canTransition("FAILED")) workflow.transition("FAILED");
      session.error = error instanceof Error ? error.message : String(error);
      await updateSession(workflow.state, { error: session.error });
      throw error;
    }
  }

  public async resume(
    sessionId = "current",
    onEvent: (text: string) => void = () => {},
    signal?: AbortSignal
  ): Promise<SwarmRunResult> {
    const session = await this.store.loadSession(sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    if (session.state === "COMPLETED") throw new Error(`session is already completed: ${session.id}`);
    session.state = "NEW";
    session.error = undefined;
    return this.run(session.objective, onEvent, signal, session);
  }
}
