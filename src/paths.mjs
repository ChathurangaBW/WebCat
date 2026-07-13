import { homedir as defaultHomedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { IDENTITY } from "./identity.mjs";

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function absolute(value, fallbackBase) {
  if (!value) return undefined;
  return isAbsolute(value) ? value : resolve(fallbackBase, value);
}

export function userPaths(options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const home = options.home ?? defaultHomedir();
  const explicitRoot = absolute(clean(env[IDENTITY.environment.home]), home);
  const explicitConfig = absolute(clean(env[IDENTITY.environment.configHome]), home);
  const explicitLog = absolute(clean(env[IDENTITY.environment.logFile]), home);

  if (explicitRoot) {
    const config = explicitConfig ?? join(explicitRoot, "config");
    const state = join(explicitRoot, "state");
    const cache = join(explicitRoot, "cache");
    const data = join(explicitRoot, "data");
    const log = explicitLog ?? join(state, "logs", IDENTITY.logFile);
    return finalize({ root: explicitRoot, config, state, cache, data, log });
  }

  if (platform === "win32") {
    const roaming = clean(env.APPDATA) ?? join(home, "AppData", "Roaming");
    const local = clean(env.LOCALAPPDATA) ?? join(home, "AppData", "Local");
    const config = explicitConfig ?? join(roaming, IDENTITY.productName);
    const state = join(local, IDENTITY.productName);
    const cache = join(local, IDENTITY.productName, "Cache");
    const data = join(local, IDENTITY.productName, "Data");
    const log = explicitLog ?? join(local, IDENTITY.productName, "Logs", IDENTITY.logFile);
    return finalize({ root: state, config, state, cache, data, log });
  }

  if (platform === "darwin") {
    const support = join(home, "Library", "Application Support", IDENTITY.productName);
    const config = explicitConfig ?? support;
    const state = support;
    const cache = join(home, "Library", "Caches", IDENTITY.productName);
    const data = support;
    const log = explicitLog ?? join(home, "Library", "Logs", IDENTITY.productName, IDENTITY.logFile);
    return finalize({ root: state, config, state, cache, data, log });
  }

  const configBase = clean(env.XDG_CONFIG_HOME) ?? join(home, ".config");
  const stateBase = clean(env.XDG_STATE_HOME) ?? join(home, ".local", "state");
  const cacheBase = clean(env.XDG_CACHE_HOME) ?? join(home, ".cache");
  const dataBase = clean(env.XDG_DATA_HOME) ?? join(home, ".local", "share");
  const config = explicitConfig ?? join(configBase, IDENTITY.command);
  const state = join(stateBase, IDENTITY.command);
  const cache = join(cacheBase, IDENTITY.command);
  const data = join(dataBase, IDENTITY.command);
  const log = explicitLog ?? join(state, "logs", IDENTITY.logFile);
  return finalize({ root: state, config, state, cache, data, log });
}

function finalize(paths) {
  return Object.freeze({
    ...paths,
    userConfig: join(paths.config, IDENTITY.configurationFile),
    userMcp: join(paths.config, IDENTITY.mcpFile),
    logDirectory: dirname(paths.log)
  });
}

export function projectPaths(cwd = process.cwd()) {
  const root = resolve(cwd);
  const project = join(root, IDENTITY.projectDirectory);
  return Object.freeze({
    root,
    project,
    config: join(project, IDENTITY.configurationFile),
    engagement: join(project, IDENTITY.engagementFile),
    mcp: join(project, IDENTITY.mcpFile),
    state: join(project, "state"),
    sessions: join(project, "state", "sessions"),
    evidence: join(project, "evidence"),
    reports: join(project, "reports"),
    audit: join(project, "audit.jsonl"),
    approvals: join(project, "approvals.json"),
    findings: join(project, "findings.json"),
    hypotheses: join(project, "hypotheses.json")
  });
}
