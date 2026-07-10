/**
 * MCP tool name sanitization and qualification.
 *
 * Tool names from MCP servers are untrusted input. They are sanitized before
 * display, logging, indexing, or prompt insertion.
 */

const MCP_PREFIX = 'mcp__';
const MCP_SEPARATOR = '__';
const MAX_QUALIFIED_LENGTH = 64;

/**
 * Sanitize a name part (server name or tool name) replacing any character
 * outside the safe ASCII set with `_`, then collapsing runs of `_`.
 */
export function sanitizeMcpNamePart(part: string): string {
  return part
    .replaceAll(/[^a-zA-Z0-9_-]/g, '_')
    .replaceAll(/_+/g, '_');
}

/**
 * Check if a tool name is a qualified MCP tool name.
 */
export function isMcpToolName(name: string): boolean {
  return name.startsWith(MCP_PREFIX);
}

/**
 * Produce the qualified MCP tool name: mcp__<server>__<tool>
 * If the result exceeds MAX_QUALIFIED_LENGTH, a deterministic hash suffix
 * replaces the tail.
 */
export function qualifyMcpToolName(serverName: string, toolName: string): string {
  const full = `${MCP_PREFIX}${sanitizeMcpNamePart(serverName)}${MCP_SEPARATOR}${sanitizeMcpNamePart(toolName)}`;
  if (full.length <= MAX_QUALIFIED_LENGTH) return full;

  const hash = stableHash8(full);
  const head = full.slice(0, MAX_QUALIFIED_LENGTH - hash.length - 1);
  return `${head}_${hash}`;
}

/**
 * Sanitize a tool description from an MCP server.
 * Strip control characters, limit length.
 */
export function sanitizeMcpDescription(description: string, maxLength = 500): string {
  return description
    .replaceAll(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, maxLength)
    .trim();
}

/**
 * Sanitize a tool name for display. Trim prefix, decode underscores.
 */
export function displayMcpToolName(qualifiedName: string): string {
  if (!qualifiedName.startsWith(MCP_PREFIX)) return qualifiedName;
  const rest = qualifiedName.slice(MCP_PREFIX.length);
  const sepIdx = rest.indexOf(MCP_SEPARATOR);
  if (sepIdx < 0) return rest;
  const server = rest.slice(0, sepIdx);
  const tool = rest.slice(sepIdx + MCP_SEPARATOR.length);
  return `${server} › ${tool.replaceAll('_', ' ')}`;
}

// ── Private Helpers ───────────────────────────────────────────────

function stableHash8(input: string): string {
  // 32-bit FNV-1a for disambiguation
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.codePointAt(i)!;
    hash = Math.trunc(Math.imul(hash, 0x01000193));
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
