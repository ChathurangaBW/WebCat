import test from "node:test"; import assert from "node:assert/strict"; import { ScopeEngine } from "./scope.js"; import type { Engagement } from "./types.js";
const engagement:Engagement={id:"e",name:"e",authorizationConfirmed:true,mode:"manual",allow:[{id:"a",scheme:"https",host:"app.test",pathPrefix:"/api"}],deny:[{id:"d",host:"app.test",pathPrefix:"/api/admin"}],maxRequestsPerSecond:2,maxParallelRequests:2,allowHighRisk:false,allowDestructive:false};
test("allows scoped URL",()=>assert.equal(new ScopeEngine(engagement).evaluate("https://app.test/api/users","active").allowed,true));
test("denies excluded URL",()=>assert.equal(new ScopeEngine(engagement).evaluate("https://app.test/api/admin/reset","active").allowed,false));
test("denies unscoped URL",()=>assert.equal(new ScopeEngine(engagement).evaluate("https://evil.test/api","active").allowed,false));
