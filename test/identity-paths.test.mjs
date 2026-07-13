import test from "node:test";
import assert from "node:assert/strict";
import { IDENTITY } from "../src/identity.mjs";
import { userPaths } from "../src/paths.mjs";

const forbidden = new RegExp(["ki", "mi"].join(""), "i");

test("canonical identity is WebCat", () => {
  assert.equal(IDENTITY.productName, "WebCat");
  assert.equal(IDENTITY.command, "webcat");
  assert.equal(IDENTITY.logFile, "webcat.log");
  assert.equal(IDENTITY.projectDirectory, ".webcat");
  assert.equal(IDENTITY.environment.home, "WEBCAT_HOME");
});

test("Linux paths use XDG WebCat locations", () => {
  const paths = userPaths({ platform: "linux", home: "/home/tester", env: {} });
  assert.equal(paths.config, "/home/tester/.config/webcat");
  assert.equal(paths.state, "/home/tester/.local/state/webcat");
  assert.equal(paths.log, "/home/tester/.local/state/webcat/logs/webcat.log");
  assert.equal(forbidden.test(JSON.stringify(paths)), false);
});

test("macOS paths use WebCat application directories", () => {
  const paths = userPaths({ platform: "darwin", home: "/Users/tester", env: {} });
  assert.match(paths.config, /Application Support\/WebCat$/);
  assert.match(paths.log, /Library\/Logs\/WebCat\/webcat\.log$/);
  assert.equal(forbidden.test(JSON.stringify(paths)), false);
});

test("Windows paths use WebCat directories", () => {
  const paths = userPaths({
    platform: "win32",
    home: "C:\\Users\\tester",
    env: { APPDATA: "C:\\Users\\tester\\AppData\\Roaming", LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local" }
  });
  assert.match(paths.config, /WebCat$/);
  assert.match(paths.log, /WebCat.*Logs.*webcat\.log$/);
  assert.equal(forbidden.test(JSON.stringify(paths)), false);
});

test("WEBCAT_HOME controls an isolated runtime tree", () => {
  const paths = userPaths({ platform: "linux", home: "/home/tester", env: { WEBCAT_HOME: "/tmp/webcat-home" } });
  assert.equal(paths.config, "/tmp/webcat-home/config");
  assert.equal(paths.log, "/tmp/webcat-home/state/logs/webcat.log");
});
