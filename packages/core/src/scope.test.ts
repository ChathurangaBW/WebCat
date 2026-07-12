import { describe, expect, it } from "vitest";
import { ScopeEngine, type Engagement } from "./index.js";

const engagement: Engagement = {
  id: "eng-1",
  name: "test",
  authorizationConfirmed: true,
  mode: "manual",
  allow: [{ id: "app", scheme: "https", host: "*.example.test", pathPrefix: "/api" }],
  deny: [{ id: "reset", scheme: "https", host: "admin.example.test", pathPrefix: "/api/reset" }],
};

describe("ScopeEngine", () => {
  it("allows a matching target", () => {
    expect(new ScopeEngine(engagement).evaluate("https://app.example.test/api/users", "active").allowed).toBe(true);
  });

  it("applies deny rules before allow rules", () => {
    const result = new ScopeEngine(engagement).evaluate("https://admin.example.test/api/reset/all", "active");
    expect(result.allowed).toBe(false);
    expect(result.matchedRuleId).toBe("reset");
  });

  it("denies unknown targets", () => {
    expect(new ScopeEngine(engagement).evaluate("https://example.org/api/users", "active").allowed).toBe(false);
  });
});
