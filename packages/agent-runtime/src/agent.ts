import type { AgentProfile } from "@webcat/agent-profiles";
import type { Engagement, EngagementStore, SkillDefinition } from "@webcat/core";
import type { McpManager, McpTool } from "@webcat/mcp-gateway";
import { resolveCapability } from "@webcat/mcp-gateway";
import { ChatCompletionsProvider, type ChatMessage } from "./provider.js";

export interface AgentRunResult {
  profile: string;
  summary: string;
  findingIds: string[];
  hypothesisIds: string[];
  evidenceIds: string[];
  turns: number;
  failedToolCalls: number;
}

const INTERNAL_TOOLS = [
  { type: "function", function: { name: "webcat_record_observation", description: "Persist an evidence-grounded security observation", parameters: { type: "object", properties: { summary: { type: "string" }, data: { type: "object" } }, required: ["summary"] } } },
  { type: "function", function: { name: "webcat_create_hypothesis", description: "Create a testable security hypothesis", parameters: { type: "object", properties: { title: { type: "string" }, rationale: { type: "string" }, target: { type: "string" }, expectedSecureBehavior: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["title", "rationale"] } } },
  { type: "function", function: { name: "webcat_update_hypothesis", description: "Update a hypothesis after testing", parameters: { type: "object", properties: { hypothesisId: { type: "string" }, status: { type: "string", enum: ["open", "testing", "supported", "disproved", "blocked"] }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["hypothesisId", "status"] } } },
  { type: "function", function: { name: "webcat_submit_candidate_finding", description: "Submit a candidate finding. It remains unvalidated until independent review.", parameters: { type: "object", properties: { title: { type: "string" }, severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] }, description: { type: "string" }, impact: { type: "string" }, remediation: { type: "string" }, target: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } }, hypothesisIds: { type: "array", items: { type: "string" } } }, required: ["title", "severity", "description", "impact", "remediation"] } } },
  { type: "function", function: { name: "webcat_list_current_state", description: "Read current hypotheses and findings", parameters: { type: "object", properties: {} } } }
];

const REVIEW_TOOL = { type: "function", function: { name: "webcat_set_finding_status", description: "Set the independent validation result for an existing finding", parameters: { type: "object", properties: { findingId: { type: "string" }, status: { type: "string", enum: ["validated", "rejected", "needs-more-evidence"] }, validationNotes: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } } }, required: ["findingId", "status", "validationNotes"] } } };

function safeToolName(server: string, tool: string): string {
  return `mcp__${server.replace(/[^a-zA-Z0-9_]/g, "_")}__${tool.replace(/[^a-zA-Z0-9_]/g, "_")}`.slice(0, 64);
}

export class AgentRunner {
  public constructor(
    private readonly provider: ChatCompletionsProvider,
    private readonly mcp: McpManager,
    private readonly engagement: Engagement,
    private readonly store: EngagementStore,
    private readonly skills: SkillDefinition[],
    private readonly maxTurns: number
  ) {}

  public async run(profile: AgentProfile, task: string): Promise<AgentRunResult> {
    const findingIds: string[] = [];
    const hypothesisIds: string[] = [];
    const evidenceIds: string[] = [];
    let failedToolCalls = 0;
    const tools = await this.mcp.allTools();
    const toolMap = new Map<string, { server: string; tool: McpTool }>();
    const exposed = tools.filter(({ tool }) => {
      const capability = resolveCapability(tool.name, tool.annotations);
      return capability && profile.capabilities.includes(capability.name);
    }).map(({ server, tool }) => {
      const name = safeToolName(server, tool.name);
      toolMap.set(name, { server, tool });
      return { type: "function", function: { name, description: tool.description ?? `${server} MCP tool`, parameters: tool.inputSchema ?? { type: "object", properties: {} } } };
    });

    const reviewProfile = profile.name === "finding-validator" || profile.name === "security-critic";
    const skillText = this.skills.filter((skill) => profile.lanes.some((lane) => skill.name.includes(lane)) || ["pre-phase-briefing", "finding-validation", "critic-gate"].includes(skill.name)).map((skill) => `### ${skill.name}\n${skill.body}`).join("\n\n").slice(0, 12_000);
    const messages: ChatMessage[] = [
      { role: "system", content: `${profile.systemPrompt}\n\nEngagement: ${this.engagement.name}\nMode: ${this.engagement.mode}\nAuthorization reference: ${this.engagement.authorizationReference ?? "not supplied"}\n\nApplicable WebCat skills:\n${skillText || "No additional skills loaded."}\n\nUse tools for evidence and state. Return a concise evidence-grounded final summary.` },
      { role: "user", content: task }
    ];
    const availableTools = [...INTERNAL_TOOLS, ...(reviewProfile ? [REVIEW_TOOL] : []), ...exposed];

    for (let turn = 1; turn <= this.maxTurns; turn += 1) {
      const result = await this.provider.complete(messages, availableTools);
      messages.push({ role: "assistant", content: result.content, ...(result.raw?.choices?.[0]?.message?.tool_calls ? { tool_calls: result.raw.choices[0].message.tool_calls } : {}) });
      if (!result.toolCalls.length) {
        const evidence = await this.store.addEvidence(profile.name, "model-output", `${profile.name} final output`, result.content);
        evidenceIds.push(evidence.id);
        return { profile: profile.name, summary: result.content, findingIds, hypothesisIds, evidenceIds, turns: turn, failedToolCalls };
      }

      for (const call of result.toolCalls) {
        let output: unknown;
        try {
          output = await this.executeTool(profile, call.name, call.arguments, toolMap, findingIds, hypothesisIds, evidenceIds);
        } catch (error) {
          failedToolCalls += 1;
          output = { error: String(error) };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output) });
      }
    }
    throw new Error(`${profile.name} exceeded maximum turns`);
  }

  private async executeTool(
    profile: AgentProfile,
    name: string,
    args: Record<string, unknown>,
    toolMap: Map<string, { server: string; tool: McpTool }>,
    findingIds: string[],
    hypothesisIds: string[],
    evidenceIds: string[]
  ): Promise<unknown> {
    if (name === "webcat_record_observation") {
      const evidence = await this.store.addEvidence(profile.name, "observation", String(args.summary ?? "Observation"), args.data ?? args);
      evidenceIds.push(evidence.id);
      return evidence;
    }
    if (name === "webcat_create_hypothesis") {
      const hypothesis = await this.store.addHypothesis({
        title: String(args.title), rationale: String(args.rationale), status: "open", createdBy: profile.name,
        evidenceIds: Array.isArray(args.evidenceIds) ? args.evidenceIds.map(String) : [],
        ...(args.target ? { target: String(args.target) } : {}),
        ...(args.expectedSecureBehavior ? { expectedSecureBehavior: String(args.expectedSecureBehavior) } : {})
      });
      hypothesisIds.push(hypothesis.id);
      return hypothesis;
    }
    if (name === "webcat_update_hypothesis") {
      return this.store.updateHypothesis(String(args.hypothesisId), {
        status: args.status as any,
        ...(Array.isArray(args.evidenceIds) ? { evidenceIds: args.evidenceIds.map(String) } : {})
      });
    }
    if (name === "webcat_submit_candidate_finding") {
      const finding = await this.store.addFinding({
        title: String(args.title), severity: args.severity as any, status: "candidate", description: String(args.description), impact: String(args.impact), remediation: String(args.remediation),
        evidenceIds: Array.isArray(args.evidenceIds) ? args.evidenceIds.map(String) : [], hypothesisIds: Array.isArray(args.hypothesisIds) ? args.hypothesisIds.map(String) : [], createdBy: profile.name,
        ...(args.target ? { target: String(args.target) } : {})
      });
      findingIds.push(finding.id);
      return finding;
    }
    if (name === "webcat_set_finding_status") {
      return this.store.updateFinding(String(args.findingId), {
        status: args.status as any,
        validationNotes: String(args.validationNotes),
        ...(Array.isArray(args.evidenceIds) ? { evidenceIds: args.evidenceIds.map(String) } : {})
      });
    }
    if (name === "webcat_list_current_state") return { hypotheses: await this.store.listHypotheses(), findings: await this.store.listFindings() };
    const external = toolMap.get(name);
    if (external) return this.mcp.call(external.server, external.tool.name, args, false, profile.name);
    throw new Error(`unsupported tool ${name}`);
  }
}
