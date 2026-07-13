export const IDENTITY = Object.freeze({
  productName: "WebCat",
  command: "webcat",
  processName: "webcat",
  projectDirectory: ".webcat",
  configurationFile: "config.toml",
  engagementFile: "engagement.json",
  mcpFile: "mcp.json",
  logFile: "webcat.log",
  version: "1.1.0",
  environment: Object.freeze({
    home: "WEBCAT_HOME",
    configHome: "WEBCAT_CONFIG_HOME",
    logLevel: "WEBCAT_LOG_LEVEL",
    logFile: "WEBCAT_LOG_FILE",
    disableUpdateCheck: "WEBCAT_DISABLE_UPDATE_CHECK"
  })
});

export function banner() {
  return `${IDENTITY.productName} ${IDENTITY.version} — authorized web application security swarm`;
}
