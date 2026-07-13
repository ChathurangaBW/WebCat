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
  /(bearer\s+)[a-z0-9._~+\/-]+=*/gi,
  /((?:api[_-]?key|token|password|secret)\s*[=:]\s*)[^\s,;]+/gi,
  /([?&](?:token|api_key|access_token|key)=)[^&#\s]+/gi
];

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
  for (const pattern of INLINE_PATTERNS) output = output.replace(pattern, "$1[REDACTED]");
  return output;
}

export function isSensitiveKey(key) {
  return SENSITIVE_KEYS.has(String(key).toLowerCase());
}
