import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseSimpleToml, parseSimpleYaml } from "./parsers.js";
import type { AppConfig, Engagement } from "./types.js";

export const DEFAULT_CONFIG: AppConfig = {
  provider: {
    type: "chat-completions",
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKeyEnv: "WEBCAT_MODEL_API_KEY",
    apiKeyRequired: false,
    model: "local-security-model",
    timeoutMs: 120_000,
    maxTokens: 4096,
    temperature: 0.1
  },
  swarm: { maxConcurrency: 4, maxAgentTurns: 10, maxRetries: 2 },
  security: {
    redactSecrets: true,
    maxEvidenceBytes: 1_048_576,
    requireApprovalForActive: false,
    filterOutOfScopeMcpOutput: true
  }
};

export const DEFAULT_ENGAGEMENT: Engagement = {
  id: "unconfigured",
  name: "Unconfigured engagement",
  authorizationConfirmed: false,
  mode: "observe",
  allow: [],
  deny: [],
  maxRequestsPerSecond: 2,
  maxParallelRequests: 4,
  allowHighRisk: false,
  allowDestructive: false
};

async function readMaybe(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return undefined;
  }
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch ?? base;
  const output: Record<string, unknown> = {
    ...((base && typeof base === "object" && !Array.isArray(base) ? base : {}) as Record<string, unknown>)
  };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    output[key] = value && typeof value === "object" && !Array.isArray(value)
      ? deepMerge(output[key], value)
      : value;
  }
  return output;
}

function positiveInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

export function webcatHome(): string {
  return process.env.WEBCAT_HOME || path.join(os.homedir(), ".webcat");
}

export async function loadAppConfig(cwd = process.cwd()): Promise<AppConfig> {
  let config = structuredClone(DEFAULT_CONFIG) as AppConfig;
  for (const file of [path.join(webcatHome(), "config.toml"), path.join(cwd, ".webcat", "config.toml")]) {
    const text = await readMaybe(file);
    if (text) config = deepMerge(config, parseSimpleToml(text)) as AppConfig;
  }
  if (process.env.WEBCAT_MODEL) config.provider.model = process.env.WEBCAT_MODEL;
  if (process.env.WEBCAT_BASE_URL) config.provider.baseUrl = process.env.WEBCAT_BASE_URL;
  if (process.env.WEBCAT_API_KEY_ENV) config.provider.apiKeyEnv = process.env.WEBCAT_API_KEY_ENV;
  config.provider.timeoutMs = positiveInteger(config.provider.timeoutMs, DEFAULT_CONFIG.provider.timeoutMs);
  config.provider.maxTokens = positiveInteger(config.provider.maxTokens, DEFAULT_CONFIG.provider.maxTokens);
  config.provider.temperature = Math.max(0, Math.min(2, Number(config.provider.temperature ?? 0.1)));
  config.swarm.maxConcurrency = positiveInteger(config.swarm.maxConcurrency, 4);
  config.swarm.maxAgentTurns = positiveInteger(config.swarm.maxAgentTurns, 10);
  config.swarm.maxRetries = Math.max(0, Math.floor(Number(config.swarm.maxRetries ?? 2)));
  config.security.maxEvidenceBytes = positiveInteger(config.security.maxEvidenceBytes, 1_048_576);
  return config;
}

export async function loadEngagement(cwd = process.cwd()): Promise<Engagement> {
  for (const file of [
    path.join(cwd, ".webcat", "engagement.yaml"),
    path.join(cwd, ".webcat", "engagement.yml"),
    path.join(cwd, ".webcat", "engagement.json")
  ]) {
    const text = await readMaybe(file);
    if (!text) continue;
    const parsed = file.endsWith(".json") ? JSON.parse(text) as Record<string, unknown> : parseSimpleYaml(text);
    const engagement = deepMerge(DEFAULT_ENGAGEMENT, parsed.engagement ?? parsed) as Engagement;
    validateEngagement(engagement);
    return engagement;
  }
  return structuredClone(DEFAULT_ENGAGEMENT);
}

export function validateEngagement(engagement: Engagement): void {
  if (!engagement.id || !engagement.name) throw new Error("engagement id and name are required");
  if (!(["observe", "manual", "authorized-auto"] as const).includes(engagement.mode)) {
    throw new Error(`invalid engagement mode: ${engagement.mode}`);
  }
  if (!Array.isArray(engagement.allow) || !Array.isArray(engagement.deny)) {
    throw new Error("engagement allow and deny must be arrays");
  }
  for (const rule of [...engagement.allow, ...engagement.deny]) {
    if (!rule.id || !rule.host) throw new Error("every scope rule requires id and host");
  }
  if (engagement.authorizationConfirmed && !engagement.authorizationReference) {
    throw new Error("authorizationReference is required when authorizationConfirmed is true");
  }
  if (engagement.mode !== "observe" && !engagement.authorizationConfirmed) {
    throw new Error("manual and authorized-auto modes require authorizationConfirmed: true");
  }
}
