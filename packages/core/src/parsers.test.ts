import test from "node:test";
import assert from "node:assert/strict";
import { parseSimpleToml, parseSimpleYaml } from "./parsers.js";

test("parses WebCat TOML and YAML structures", () => {
  assert.deepEqual(parseSimpleToml('[swarm]\nmaxConcurrency = 4\n'), { swarm: { maxConcurrency: 4 } });
  const parsed = parseSimpleYaml('engagement:\n  allow:\n    - id: primary\n      host: app.test\n');
  assert.equal(parsed.engagement.allow[0].host, "app.test");
  assert.deepEqual(parseSimpleYaml("deny: []\n").deny, []);
});
