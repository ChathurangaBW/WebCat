import { describe, expect, it } from "vitest";
import { resolveCapability } from "./index.js";

describe("resolveCapability", () => {
  it("normalizes vendor-specific replay tools", () => {
    expect(resolveCapability("caido_send_request")?.name).toBe("proxy.request.replay");
    expect(resolveCapability("burp_replay_request")?.name).toBe("proxy.request.replay");
  });

  it("returns undefined for unknown tools", () => {
    expect(resolveCapability("untrusted_magic_tool")).toBeUndefined();
  });
});
