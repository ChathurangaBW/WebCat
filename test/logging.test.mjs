import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Logger } from "../src/logger.mjs";
import { userPaths } from "../src/paths.mjs";

const forbidden = new RegExp(["ki", "mi"].join(""), "i");

test("logger creates only WebCat-branded paths and redacts secrets", async () => {
  const temp = await mkdtemp(join(tmpdir(), "webcat-log-test-"));
  try {
    const paths = userPaths({ platform: "linux", home: temp, env: { WEBCAT_HOME: join(temp, "runtime") } });
    const logger = new Logger({ paths, level: "debug" });
    await logger.info("test event", { authorization: "Bearer secret-value", password: "do-not-store", nested: { token: "abc" } });
    const content = await readFile(paths.log, "utf8");
    assert.match(content, /"product":"WebCat"/);
    assert.doesNotMatch(content, /secret-value|do-not-store|"abc"/);
    assert.match(content, /\[REDACTED]/);
    const mode = (await stat(paths.log)).mode & 0o777;
    assert.equal(mode, 0o600);
    const pathsFound = await walk(temp);
    assert.equal(pathsFound.some((value) => forbidden.test(value)), false);
    assert.equal(pathsFound.some((value) => value.endsWith("webcat.log")), true);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

async function walk(root, prefix = "") {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    output.push(rel);
    if (entry.isDirectory()) output.push(...await walk(join(root, entry.name), rel));
  }
  return output;
}
