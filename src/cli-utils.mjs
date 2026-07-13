export function flag(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }
export function positionals(args, optionsWithValues = []) {
  const values = new Set(optionsWithValues);
  const output = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (values.has(value)) { index += 1; continue; }
    if (value.startsWith("--")) continue;
    output.push(value);
  }
  return output;
}
export async function exists(path) { try { await access(path, constants.F_OK); return true; } catch { return false; } }
export function printJson(value) { console.log(JSON.stringify(value, null, 2)); }
export function printTable(rows) {
  if (!rows.length) { console.log("No records."); return; }
  const normalized = rows.map((row) => flatten(row));
  const columns = [...new Set(normalized.flatMap((row) => Object.keys(row)))];
  const widths = columns.map((column) => Math.min(64, Math.max(column.length, ...normalized.map((row) => String(row[column] ?? "").length))));
  console.log(columns.map((column, index) => column.padEnd(widths[index])).join("  "));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of normalized) console.log(columns.map((column, index) => truncate(String(row[column] ?? ""), widths[index]).padEnd(widths[index])).join("  "));
}
export function flatten(value) { return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, typeof entry === "object" && entry !== null ? JSON.stringify(entry) : entry])); }
export function truncate(value, width) { return value.length <= width ? value : `${value.slice(0, Math.max(0, width - 1))}…`; }
export function tokenize(value) {
  const tokens = []; let current = ""; let quote; let escaped = false;
  for (const char of value) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (quote) { if (char === quote) quote = undefined; else current += char; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (/\s/.test(char)) { if (current) { tokens.push(current); current = ""; } } else current += char;
  }
  if (quote) throw new Error("Unterminated quote");
  if (current) tokens.push(current);
  return tokens;
}

