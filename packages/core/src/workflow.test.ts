import test from "node:test";
import assert from "node:assert/strict";
import { WorkflowMachine } from "./workflow.js";

test("workflow accepts defined transitions and rejects drift", () => {
  const workflow = new WorkflowMachine();
  workflow.transition("SCOPE_READY");
  workflow.transition("MCP_DISCOVERY");
  assert.equal(workflow.state, "MCP_DISCOVERY");
  assert.throws(() => workflow.transition("COMPLETED"), /invalid workflow transition/);
});
