import type { RiskClassification } from '@webcat/shared';
import type { McpToolDefinition } from './types.js';

/**
 * Classify the risk of an MCP tool based on its name, description, and input schema.
 */
export function classifyToolRisk(
  tool: McpToolDefinition,
  overrides: Partial<RiskClassification> = {},
): RiskClassification {
  const base: RiskClassification = {
    readsData: true,  // Most tools read data by default
    writesData: false,
    sendsNetwork: false,
    executesCommands: false,
    deletesData: false,
    isDestructive: false,
    requiresApproval: false,
  };

  const desc = tool.description.toLowerCase();
  const name = tool.name.toLowerCase();

  // Network-sending tools
  if (
    /\b(send|request|replay|forward|navigate|fetch|post|put|patch|delete)\b/.test(name) ||
    /\b(sends?|replays?|forwards?|issues?)\s+(a\s+)?(request|http)/.test(desc)
  ) {
    base.sendsNetwork = true;
    base.requiresApproval = true;
    base.maxRate = 60;
  }

  // Write/modify tools
  if (
    /\b(create|edit|update|write|modify|set|add|insert|upsert|patch)\b/.test(name) ||
    /\b(creates?|edits?|updates?|writes?|modifies?|sets?)\b/.test(desc)
  ) {
    base.writesData = true;
  }

  // Delete tools
  if (
    /\b(delete|remove|drop|clear|purge|destroy)\b/.test(name) ||
    /\b(deletes?|removes?|drops?|clears?|purges?|destroys?)\b/.test(desc)
  ) {
    base.deletesData = true;
    base.isDestructive = true;
    base.requiresApproval = true;
  }

  // Command execution tools
  if (
    /\b(exec|execute|run|spawn|shell|command|script)\b/.test(name) ||
    /\b(executes?|runs?|spawns?)\s+(a\s+)?(command|process|script|shell)/.test(desc)
  ) {
    base.executesCommands = true;
    base.requiresApproval = true;
  }

  // Fuzzing/automation tools
  if (
    /\b(fuzz|automate|intrude|scan|attack|brute|spray)\b/.test(name) ||
    /\b(fuzz(ing|es)?|automates?|intrud(es?|ing)|scans?|attacks?|brute.?force)\b/.test(desc)
  ) {
    base.sendsNetwork = true;
    base.writesData = true;
    base.requiresApproval = true;
    base.maxRate = 10;
    base.maxConcurrent = 1;
  }

  // Read-only proxy history tools
  if (
    /\b(list|get|read|view|show|display|fetch|query|search)\b/.test(name) &&
    !base.writesData && !base.deletesData && !base.sendsNetwork
  ) {
    base.requiresApproval = false;
  }

  // Apply overrides
  return { ...base, ...overrides };
}
