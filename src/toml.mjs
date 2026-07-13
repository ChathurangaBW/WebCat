export function parseToml(text) {
  const root = {};
  let current = root;
  const lines = String(text).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = stripComment(lines[index]).trim();
    if (!raw) continue;
    const section = raw.match(/^\[([A-Za-z0-9_.-]+)]$/);
    if (section) {
      current = root;
      for (const segment of section[1].split(".")) {
        if (!Object.hasOwn(current, segment)) current[segment] = {};
        if (!isPlainObject(current[segment])) throw new Error(`Invalid TOML section at line ${index + 1}`);
        current = current[segment];
      }
      continue;
    }
    const assignment = raw.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!assignment) throw new Error(`Invalid TOML assignment at line ${index + 1}`);
    current[assignment[1]] = parseValue(assignment[2], index + 1);
  }
  return root;
}

function stripComment(line) {
  let quote;
  let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\" && quote === '"') { escaped = true; continue; }
    if (char === '"' || char === "'") {
      if (!quote) quote = char;
      else if (quote === char) quote = undefined;
      continue;
    }
    if (char === "#" && !quote) return line.slice(0, i);
  }
  return line;
}

function parseValue(raw, line) {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith("[") && value.endsWith("]")) return parseArray(value.slice(1, -1), line);
  throw new Error(`Unsupported TOML value at line ${line}`);
}

function parseArray(body, line) {
  const values = [];
  let current = "";
  let quote;
  let escaped = false;
  for (const char of body) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === "\\" && quote === '"') { current += char; escaped = true; continue; }
    if (char === '"' || char === "'") {
      current += char;
      if (!quote) quote = char;
      else if (quote === char) quote = undefined;
      continue;
    }
    if (char === "," && !quote) {
      if (current.trim()) values.push(parseValue(current.trim(), line));
      current = "";
    } else current += char;
  }
  if (quote) throw new Error(`Unterminated TOML string at line ${line}`);
  if (current.trim()) values.push(parseValue(current.trim(), line));
  return values;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
