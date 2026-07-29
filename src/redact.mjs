const SENSITIVE_KEYS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "apikey",
  "password",
  "passwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "client_secret"
]);

const INLINE_PATTERNS = [
  // Raw HTTP header lines. Burp and other proxies hand back whole request/response strings,
  // so key-based object redaction never sees these.
  /^([ \t]*(?:cookie|set-cookie|authorization|proxy-authorization|x-api-key|api-key|x-auth-token|x-csrf-token|x-xsrf-token)[ \t]*:[ \t]*)[^\r\n]+/gim,
  // Any auth scheme, not just Bearer.
  /((?:bearer|basic|digest|negotiate|token)\s+)[a-z0-9._~+\/-]{8,}=*/gi,
  // Bare JWTs anywhere in a body or fragment of text.
  /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]+/gi,
  /((?:api[_-]?key|token|password|passwd|secret|session[_-]?id)\s*[=:]\s*)[^\s,;&"']+/gi,
  /([?&](?:token|api_key|apikey|access_token|refresh_token|id_token|key|session|sig|signature)=)[^&#\s]+/gi,
  // Sensitive fields inside a JSON string. MCP servers commonly return payloads as
  // { content: [{ type: "text", text: "<json>" }] }, so the real response is a JSON-encoded
  // string: neither key-based redaction nor the header-line pattern above can see it.
  // Backslash-escaped encoding (\"key\":\"value\"), terminating at the escaped closing quote.
  /(\\"(?:set-cookie|cookie|authorization|proxy-authorization|x-api-key|api[_-]?key|apikey|password|passwd|secret|client_secret|token|access_token|refresh_token|id_token|session[_-]?id)\\"\s*:\s*\\")(?:(?!\\").)*/gi,
  // Plain encoding ("key":"value"), terminating at the first unescaped quote.
  /(["'](?:set-cookie|cookie|authorization|proxy-authorization|x-api-key|api[_-]?key|apikey|password|passwd|secret|client_secret|token|access_token|refresh_token|id_token|session[_-]?id)["']\s*:\s*["'])(?:[^"'\\]|\\.)*/gi
];

// Patterns whose match has no capture group to preserve are replaced wholesale.
const WHOLE_MATCH_PATTERNS = new Set([2]);

export function redact(value, seen = new WeakSet()) {
  if (typeof value === "string") return redactText(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = isSensitiveKey(key) ? "[REDACTED]" : redact(entry, seen);
  }
  return output;
}

export function redactText(input) {
  let output = String(input);
  INLINE_PATTERNS.forEach((pattern, index) => {
    output = output.replace(pattern, WHOLE_MATCH_PATTERNS.has(index) ? "[REDACTED]" : "$1[REDACTED]");
  });
  return output;
}

export function isSensitiveKey(key) {
  return SENSITIVE_KEYS.has(String(key).toLowerCase());
}
