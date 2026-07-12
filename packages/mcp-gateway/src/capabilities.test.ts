import test from "node:test"; import assert from "node:assert/strict"; import { resolveCapability } from "./capabilities.js";
test("maps Caido replay",()=>assert.equal(resolveCapability("caido_send_request")?.name,"proxy.request.replay"));
test("uses annotations",()=>assert.equal(resolveCapability("vendor_unknown",{readOnlyHint:true})?.risk,"read"));
