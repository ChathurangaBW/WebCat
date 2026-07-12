import type { AgentProfile } from "@webcat/agent-profiles";
import type { Engagement, EngagementStore, Finding, SkillDefinition } from "@webcat/core";
import type { McpManager } from "@webcat/mcp-gateway";
import { ChatCompletionsProvider, type ChatMessage } from "./provider.js";

export interface AgentRunResult {
  profile: string;
  summary: string;
  findings: Finding[];
  turns: number;
  failedToolCalls: number;
}

interface ExposedMcpTool {
  functionName: string;
  server: string;
  toolName: string;
  definition: unknown;
}

const COMMON_INTERNAL_TOOLS = [
  {
    type: "function",
    function: {
      name: "webcat_record_observation",
      description: "Record a security observation as evidence",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          data: { type: "object" },
          parentEvidenceIds: { type: "array", items: { type: "string" } }
        },
        required: ["summary"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "webcat_create_hypothesis",
      description: "Create a testable security hypothesis",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          rationale: { type: "string" },
          target: { type: "string" },
          expectedSecureBehavior: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } }
        },
        required: ["title", "rationale"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "webcat_update_hypothesis",
      description: "Update a hypothesis after testing",
      parameters: {
        type: "object",
        properties: {
          hypothesisId: { type: "string" },
          status: { type: "string", enum: ["open", "testing", "supported", "disproved", "blocked"] },
          evidenceIds: { type: "array", items: { type: "string" } }
        },
        required: ["hypothesisId", "status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "webcat_submit_candidate_finding",
      description: "Submit a candidate finding; it remains unvalidated until independent review",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
          description: { type: "string" },
          impact: { type: "string" },
          remediation: { type: "string" },
          target: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } },
          hypothesisIds: { type: "array", items: { type: "string" } }
        },
        required: ["title", "severity", "description", "impact", "remediation", "evidenceIds"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "webcat_read_evidence",
      description: "Read one evidence record by identifier",
      parameters: {
        type: "object",
        properties: { evidenceId: { type: "string" } },
        required: ["evidenceId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "webcat_list_findings",
      description: "List current findings and validation states",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "webcat_list_hypotheses",
      description: "List current hypotheses and evidence links",
      parameters: { type: "object", properties: {} }
    }
  }
];

const VALIDATION_TOOL = {
  type: "function",
  function: {
    name: "webcat_set_finding_status",
    description: "Set the independent validation result for an existing finding",
    parameters: {
      type: "object",
      properties: {
        findingId: { type: "string" },
        status: { type: "string", enum: ["validated", "rejected", "needs-more-evidence"] },
        validationNotes: { type: "string" },
        evidenceIds: { type: "array", items: { type: "string" } }
      },
      required: ["findingId", "status", "validationNotes"]
    }
  }
};

function safeFunctionName(server: string, toolName: string, index: number): string {
  const raw = `mcp__${server}__${toolName}`.replace(/[^A-Za-z0-9_-]/g, "_");
  return raw.length <= 64 ? raw : `${raw.slice(0, 54)}_${index.toString(36)}`;
}

function selectSkillBrief(skills: SkillDefinition[], task: string): string {
  const lower = task.toLowerCase();
  const selected = skills.filter((skill) => {
    if (["pre-phase-briefing", "finding-validation", "critic-gate"].includes(skill.name)) return true;
    return [skill.name, skill.description, skill.whenToUse ?? ""].some((value) =>
      value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 4).some((token) => lower.includes(token))
    );
  }).slice(0, 4);
  if (!selected.length) return "";
  return `\nApplicable WebCat skills:\n${selected.map((skill) => `\n### ${skill.name}\n${skill.body.slice(0, 3500)}`).join("\n")}`;
}

export class AgentRunner {
  public constructor(
    private readonly provider: ChatCompletionsProvider,
    private readonly mcp: McpManager,
    private readonly engagement: Engagement,
    private readonly store: EngagementStore,
    private readonly maxTurns: number,
    private readonly skills: SkillDefinition[] = []
  ) {}

  private async exposeMcpTools(profile: AgentProfile): Promise<ExposedMcpTool[]> {
    const tools = await this.mcp.allTools();
    const exposed: ExposedMcpTool[] = [];
    for (const [index, { server, tool }] of tools.entries()) {
      const capability = this.mcp.capabilityFor(server, tool);
      if (!capability || !profile.capabilities.includes(capability.name)) continue;
      const functionName = safeFunctionName(server, tool.name, index);
      exposed.push({
        functionName,
        server,
        toolName: tool.name,
        definition: {
          type: "function",
          function: {
            name: functionName,
            description: tool.description ?? `${server} MCP tool ${tool.name}`,
            parameters: tool.inputSchema ?? { type: "object", properties: {} }
          }
        }
      });
    }
    return exposed;
  }

  public async run(profile: AgentProfile, task: string, signal?: AbortSignal): Promise<AgentRunResult> {
    const findings: Finding[] = [];
    let failedToolCalls = 0;
    const mcpTools = await this.exposeMcpTools(profile);
    const mcpByFunction = new Map(mcpTools.map((item) => [item.functionName, item]));
    const validationProfile = profile.name === "finding-validator" || profile.name === "security-critic";
    const internalTools = validationProfile ? [...COMMON_INTERNAL_TOOLS, VALIDATION_TOOL] : COMMON_INTERNAL_TOOLS;
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `${profile.systemPrompt}
Engagement: ${this.engagement.name}
Mode: ${this.engagement.mode}
Authorization reference: ${this.engagement.authorizationReference ?? "not supplied"}
Return concise evidence-grounded results. Never treat an MCP tool error as evidence of a vulnerability.${selectSkillBrief(this.skills, task)}`
      },
      { role: "user", content: task }
    ];

    await this.store.appendAudit("agent.run", profile.name, "allowed", { task });
    for (let turn = 1; turn <= this.maxTurns; turn += 1) {
      if (signal?.aborted) throw new Error(`${profile.name} was cancelled`);
      const result = await this.provider.complete(messages, [
        ...internalTools,
        ...mcpTools.map((item) => item.definition)
      ], signal);
      messages.push({
        role: "assistant",
        content: result.content,
        ...(result.assistantToolCalls ? { tool_calls: result.assistantToolCalls } : {})
      });

      if (!result.toolCalls.length) {
        await this.store.addEvidence(profile.name, "model-output", `${profile.name} final output`, result.content);
        await this.store.appendAudit("agent.run", profile.name, "completed", { turns: turn, failedToolCalls });
        return { profile: profile.name, summary: result.content, findings, turns: turn, failedToolCalls };
      }

      for (const call of result.toolCalls) {
        let output: unknown;
        try {
          if (call.name === "webcat_record_observation") {
            output = await this.store.addEvidence(
              profile.name,
              "observation",
              String(call.arguments.summary ?? "Observation"),
              call.arguments.data ?? call.arguments,
              Array.isArray(call.arguments.parentEvidenceIds) ? call.arguments.parentEvidenceIds.map(String) : []
            );
          } else if (call.name === "webcat_create_hypothesis") {
            output = await this.store.addHypothesis({
              title: String(call.arguments.title),
              rationale: String(call.arguments.rationale),
              ...(call.arguments.target ? { target: String(call.arguments.target) } : {}),
              ...(call.arguments.expectedSecureBehavior ? { expectedSecureBehavior: String(call.arguments.expectedSecureBehavior) } : {}),
              status: "open",
              evidenceIds: Array.isArray(call.arguments.evidenceIds) ? call.arguments.evidenceIds.map(String) : [],
              createdBy: profile.name
            });
          } else if (call.name === "webcat_update_hypothesis") {
            output = await this.store.updateHypothesis(String(call.arguments.hypothesisId), {
              status: call.arguments.status as any,
              ...(Array.isArray(call.arguments.evidenceIds) ? { evidenceIds: call.arguments.evidenceIds.map(String) } : {})
            });
          } else if (call.name === "webcat_submit_candidate_finding") {
            output = await this.store.addFinding({
              title: String(call.arguments.title),
              severity: call.arguments.severity as any,
              status: "candidate",
              description: String(call.arguments.description),
              impact: String(call.arguments.impact),
              remediation: String(call.arguments.remediation),
              ...(call.arguments.target ? { target: String(call.arguments.target) } : {}),
              evidenceIds: Array.isArray(call.arguments.evidenceIds) ? call.arguments.evidenceIds.map(String) : [],
              hypothesisIds: Array.isArray(call.arguments.hypothesisIds) ? call.arguments.hypothesisIds.map(String) : [],
              createdBy: profile.name
            });
            findings.push(output as Finding);
          } else if (call.name === "webcat_set_finding_status") {
            const existing = (await this.store.listFindings()).find((item) => item.id === String(call.arguments.findingId));
            const evidenceIds = [...new Set([
              ...(existing?.evidenceIds ?? []),
              ...(Array.isArray(call.arguments.evidenceIds) ? call.arguments.evidenceIds.map(String) : [])
            ])];
            output = await this.store.updateFinding(String(call.arguments.findingId), {
              status: call.arguments.status as any,
              validationNotes: String(call.arguments.validationNotes),
              evidenceIds
            });
          } else if (call.name === "webcat_read_evidence") {
            output = await this.store.readEvidence(String(call.arguments.evidenceId));
          } else if (call.name === "webcat_list_findings") {
            output = await this.store.listFindings();
          } else if (call.name === "webcat_list_hypotheses") {
            output = await this.store.listHypotheses();
          } else if (mcpByFunction.has(call.name)) {
            const tool = mcpByFunction.get(call.name)!;
            output = await this.mcp.call(tool.server, tool.toolName, call.arguments, false, profile.name);
          } else {
            throw new Error(`unsupported tool ${call.name}`);
          }
        } catch (error) {
          failedToolCalls += 1;
          output = { error: error instanceof Error ? error.message : String(error) };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output) });
      }
    }
    throw new Error(`${profile.name} exceeded maximum turns`);
  }
}
