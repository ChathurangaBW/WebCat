export type CapabilityRisk = "read" | "active" | "high" | "destructive";

export interface CapabilityDefinition {
  name: string;
  risk: CapabilityRisk;
  aliases: readonly RegExp[];
}

export const capabilityCatalog: readonly CapabilityDefinition[] = [
  {
    name: "proxy.history.list",
    risk: "read",
    aliases: [/list.*requests/i, /proxy.*history/i, /http.*history/i],
  },
  {
    name: "proxy.history.read",
    risk: "read",
    aliases: [/get.*request/i, /get.*response/i, /read.*request/i],
  },
  {
    name: "proxy.request.replay",
    risk: "active",
    aliases: [/send.*request/i, /replay/i, /repeat/i],
  },
  {
    name: "proxy.response.diff",
    risk: "read",
    aliases: [/diff.*response/i, /compare.*response/i],
  },
  {
    name: "scanner.passive.run",
    risk: "read",
    aliases: [/passive.*scan/i],
  },
  {
    name: "scanner.active.run",
    risk: "high",
    aliases: [/active.*scan/i, /automate.*run/i],
  },
  {
    name: "proxy.intercept.modify",
    risk: "high",
    aliases: [/intercept.*modify/i, /tamper/i],
  },
  {
    name: "project.delete",
    risk: "destructive",
    aliases: [/delete.*project/i, /remove.*project/i],
  },
] as const;

export function resolveCapability(toolName: string): CapabilityDefinition | undefined {
  return capabilityCatalog.find((capability) =>
    capability.aliases.some((alias) => alias.test(toolName)),
  );
}
