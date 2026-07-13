import { readFile } from "node:fs/promises";
import { IDENTITY } from "./identity.mjs";
import { projectPaths, userPaths } from "./paths.mjs";
import { parseToml } from "./toml.mjs";
import { resolveBurpPreset } from "./burp.mjs";

export const DEFAULT_CONFIG = Object.freeze({
  model: Object.freeze({ provider: "mock", baseUrl: "http://127.0.0.1:11434/v1", apiKeyEnv: "WEBCAT_MODEL_API_KEY", model: "webcat-local", timeoutMs: 120000 }),
  swarm: Object.freeze({ maxConcurrency: 3, maxAgentTurns: 6, maxToolCallsPerAgent: 8 }),
  logging: Object.freeze({ level: "info" }),
  evidence: Object.freeze({ maxBodyBytes: 262144 })
});

export async function loadConfig(cwd = process.cwd(), options = {}) {
  const users = options.userPaths ?? userPaths(options);
  const project = projectPaths(cwd);
  const userConfig = await readTomlIfPresent(users.userConfig);
  const projectConfig = await readTomlIfPresent(project.config);
  return validateConfig(deepMerge(deepMerge(structuredClone(DEFAULT_CONFIG), userConfig), projectConfig));
}

export async function loadEngagement(cwd = process.cwd()) {
  const path = projectPaths(cwd).engagement;
  const value = await readJson(path, `Missing ${IDENTITY.projectDirectory}/${IDENTITY.engagementFile}. Run webcat init.`);
  validateEngagement(value);
  return value;
}

export async function loadMcpConfig(cwd = process.cwd(), options = {}) {
  const users = options.userPaths ?? userPaths(options);
  const project = projectPaths(cwd);
  const user = await readJsonOptional(users.userMcp, { schemaVersion: 1, servers: {} });
  const local = await readJsonOptional(project.mcp, { schemaVersion: 1, servers: {} });
  const merged = { schemaVersion: 1, servers: { ...(user.servers ?? {}), ...(local.servers ?? {}) } };
  const presetResolved = {
    schemaVersion: 1,
    servers: Object.fromEntries(Object.entries(merged.servers).map(([name, server]) => [name, resolveBurpPreset(server)]))
  };
  const interpolated = interpolate(presetResolved, options.env ?? process.env);
  validateMcpConfig(interpolated);
  return interpolated;
}

async function readTomlIfPresent(path) { try { return parseToml(await readFile(path, "utf8")); } catch (error) { if (error?.code === "ENOENT") return {}; throw new Error(`Invalid configuration ${path}: ${error.message}`); } }
async function readJson(path, missingMessage) { try { return JSON.parse(await readFile(path, "utf8")); } catch (error) { if (error?.code === "ENOENT") throw new Error(missingMessage); throw new Error(`Invalid JSON ${path}: ${error.message}`); } }
async function readJsonOptional(path, fallback) { try { return JSON.parse(await readFile(path, "utf8")); } catch (error) { if (error?.code === "ENOENT") return fallback; throw new Error(`Invalid JSON ${path}: ${error.message}`); } }

function deepMerge(base, override) { if (!isObject(override)) return base; for (const [key, value] of Object.entries(override)) { if (isObject(value) && isObject(base[key])) base[key] = deepMerge({ ...base[key] }, value); else base[key] = value; } return base; }

function validateConfig(config) {
  if (!isObject(config.model) || !["mock", "openai-compatible"].includes(config.model.provider)) throw new Error("model.provider must be mock or openai-compatible");
  positive(config.model.timeoutMs, "model.timeoutMs");
  positive(config.swarm.maxConcurrency, "swarm.maxConcurrency");
  positive(config.swarm.maxAgentTurns, "swarm.maxAgentTurns");
  positive(config.swarm.maxToolCallsPerAgent, "swarm.maxToolCallsPerAgent");
  positive(config.evidence.maxBodyBytes, "evidence.maxBodyBytes");
  return config;
}

function validateEngagement(value) {
  if (!isObject(value)) throw new Error("Engagement must be an object");
  for (const key of ["id", "name", "authorizedBy", "authorizationReference", "startsAt", "expiresAt", "mode"]) if (typeof value[key] !== "string" || !value[key].trim()) throw new Error(`Engagement ${key} is required`);
  if (!["observe", "manual", "authorized-auto"].includes(value.mode)) throw new Error("Invalid engagement mode");
  if (!Array.isArray(value.allow) || value.allow.length === 0) throw new Error("Engagement allow rules are required");
  if (!Array.isArray(value.deny)) value.deny = [];
  if (!isObject(value.rateLimit)) value.rateLimit = { requestsPerMinute: 30, maxParallel: 2 };
  if (!isObject(value.riskPolicy)) value.riskPolicy = { allowHighRisk: false, allowDestructive: false, approvalTtlMinutes: 20 };
}

function validateMcpConfig(value) {
  if (!isObject(value) || !isObject(value.servers)) throw new Error("MCP configuration requires a servers object");
  for (const [name, server] of Object.entries(value.servers)) {
    if (!isObject(server)) throw new Error(`MCP server ${name} must be an object`);
    if (!["stdio", "http", "sse"].includes(server.transport)) throw new Error(`MCP server ${name} has invalid transport`);
    if (server.transport === "stdio" && typeof server.command !== "string") throw new Error(`MCP server ${name} requires command`);
    if ((server.transport === "http" || server.transport === "sse") && typeof server.url !== "string") throw new Error(`MCP server ${name} requires url`);
    if (server.enabledTools && !Array.isArray(server.enabledTools)) throw new Error(`MCP server ${name} enabledTools must be an array`);
    if (server.disabledTools && !Array.isArray(server.disabledTools)) throw new Error(`MCP server ${name} disabledTools must be an array`);
    if (server.capabilityMap && !isObject(server.capabilityMap)) throw new Error(`MCP server ${name} capabilityMap must be an object`);
    if (server.protocolVersion !== undefined && typeof server.protocolVersion !== "string") throw new Error(`MCP server ${name} protocolVersion must be a string`);
    if (server.timeoutMs !== undefined) positive(server.timeoutMs, `MCP server ${name} timeoutMs`);
  }
}

function interpolate(value, env) { if (typeof value === "string") return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) => env[key] ?? ""); if (Array.isArray(value)) return value.map((entry) => interpolate(entry, env)); if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, interpolate(entry, env)])); return value; }
function positive(value, name) { if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`); }
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
