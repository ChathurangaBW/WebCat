/**
 * Central redaction service for WebCat.
 *
 * Redacts sensitive headers, tokens, and credentials from HTTP traffic,
 * logs, prompts, and outputs before they reach the model or persistent storage.
 */

// ── Sensitive Header Names ─────────────────────────────────────────

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-csrf-token',
  'x-xsrf-token',
  'x-auth-token',
  'x-access-token',
  'x-refresh-token',
  'x-session-id',
  'x-forwarded-for',
]);

// ── Sensitive Parameter Names ─────────────────────────────────────

const SENSITIVE_PARAM_NAMES = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'access_token',
  'access-token',
  'refresh_token',
  'refresh-token',
  'client_secret',
  'client-secret',
  'private_key',
  'private-key',
  'ssh_key',
  'ssh-key',
  'credential',
  'credentials',
  'authorization',
  'sessionid',
  'csrf',
  'xsrf',
  '_csrf',
  '_token',
  'authenticity_token',
  'accesstoken',
  'refreshtoken',
  'clientsecret',
  'apikey',
  'privatekey',
  'sshkey',
  'bearer',
  'jwt',
]);

// ── Sensitive Value Patterns ──────────────────────────────────────

const SENSITIVE_PATTERNS: RegExp[] = [
  // AWS Access Key ID
  /AKIA[0-9A-Z]{16}/g,
  // Generic API key patterns (bearer tokens, JWT-like)
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  // Basic auth
  /Basic\s+[A-Za-z0-9+/=]+/gi,
  // Private key headers
  /-----BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----/g,
  // Generic tokens (long alphanumeric strings that look like tokens)
  /\b[a-zA-Z0-9_-]{32,}\b/g,
];

// ── Public API ────────────────────────────────────────────────────

export interface RedactionOptions {
  /**
   * Allow sensitive headers to pass through unredacted.
   * Only set for authorized replay of captured authenticated requests.
   */
  allowSensitiveHeaders?: boolean;
  /**
   * Additional header names to treat as sensitive.
   */
  extraSensitiveHeaders?: string[];
  /**
   * Additional patterns to redact.
   */
  extraPatterns?: RegExp[];
}

/**
 * Redact sensitive header values in a raw HTTP message.
 * Preserves the request/status line, non-sensitive headers, and body byte-for-byte.
 */
export function redactRawHttpHeaders(raw: string, options: RedactionOptions = {}): string {
  if (!raw || options.allowSensitiveHeaders) return raw;

  const lines = raw.split('\n');
  const result: string[] = [];
  let headersDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (i === 0) {
      // Request/status line — never redacted
      result.push(line);
      continue;
    }

    if (!headersDone) {
      const trimmed = line.trim();
      if (trimmed === '') {
        headersDone = true;
        result.push(line);
        continue;
      }

      result.push(redactHeaderLine(line, options));
    } else {
      // Body — left intact
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Redact a single header line. If the header name matches a sensitive header,
 * the value is replaced with [REDACTED].
 */
function redactHeaderLine(line: string, options: RedactionOptions = {}): string {
  const colonIdx = line.indexOf(':');
  if (colonIdx <= 0) return line;

  const name = line.slice(0, colonIdx).trim().toLowerCase();
  const sensitiveSet = new Set(SENSITIVE_HEADERS);
  if (options.extraSensitiveHeaders) {
    for (const h of options.extraSensitiveHeaders) {
      sensitiveSet.add(h.toLowerCase());
    }
  }

  if (sensitiveSet.has(name)) {
    return line.slice(0, colonIdx + 1) + ' [REDACTED]';
  }
  return line;
}

/**
 * Redact sensitive values from a JSON object (e.g., request/response parameters).
 * Recursively walks the object and replaces values for sensitive keys.
 */
export function redactJsonObject(obj: unknown, options: RedactionOptions = {}): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactJsonObject(item, options));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactJsonObject(value, options);
      }
    }
    return result;
  }

  if (typeof obj === 'string') {
    return redactString(obj, options);
  }

  return obj;
}

/**
 * Redact sensitive patterns from a plain string.
 */
export function redactString(text: string, options: RedactionOptions = {}): string {
  let result = text;
  const patterns = [...SENSITIVE_PATTERNS, ...(options.extraPatterns ?? [])];

  for (const pattern of patterns) {
    result = result.replace(pattern, (match) => {
      // Keep the prefix if there is one
      const prefixMatch = match.match(/^(Bearer|Basic)\s+/i);
      if (prefixMatch) {
        return prefixMatch[0] + '[REDACTED]';
      }
      return '[REDACTED]';
    });
  }

  return result;
}

/**
 * Check if an object key name indicates a sensitive value.
 */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE_PARAM_NAMES.has(lower) || SENSITIVE_PARAM_NAMES.has(key.toLowerCase());
}

/**
 * Redact cookies from a Cookie or Set-Cookie header value.
 * Preserves cookie metadata (names, flags) but redacts values.
 */
export function redactCookieHeader(headerValue: string): string {
  const parts = headerValue.split(';').map((part) => part.trim());
  const result: string[] = [];

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const name = part.slice(0, eqIdx).trim().toLowerCase();
      // Cookie attributes (Secure, HttpOnly, SameSite, etc.) have no value
      const attrNames = new Set([
        'secure', 'httponly', 'samesite', 'path', 'domain',
        'expires', 'max-age', 'maxage', 'partitioned',
      ]);
      if (attrNames.has(name)) {
        result.push(part);
      } else {
        result.push(part.slice(0, eqIdx) + '=[REDACTED]');
      }
    } else {
      result.push(part);
    }
  }

  return result.join('; ');
}

/**
 * Redact sensitive data from a headers object (key-value pairs).
 */
export function redactHeaders(
  headers: Record<string, string>,
  options: RedactionOptions = {},
): Record<string, string> {
  const result: Record<string, string> = {};
  const sensitiveSet = new Set(SENSITIVE_HEADERS);
  if (options.extraSensitiveHeaders) {
    for (const h of options.extraSensitiveHeaders) {
      sensitiveSet.add(h.toLowerCase());
    }
  }

  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveSet.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (key.toLowerCase() === 'set-cookie') {
      result[key] = redactCookieHeader(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
