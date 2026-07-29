// Supports both '--opt value' and '--opt=value'. Silently ignoring the '=' form previously made
// `scope-check --operation=active` evaluate as passive and report on the wrong risk class.
export function flag(args, name) {
  const inline = args.find((value) => typeof value === "string" && value.startsWith(`${name}=`));
  if (inline !== undefined) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function hasFlag(args, name) {
  return args.includes(name) || args.some((value) => typeof value === "string" && value.startsWith(`${name}=`));
}

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

// Rejects mistyped options instead of ignoring them, so an unrecognized flag can never be
// read as "the operator did not ask for anything".
export function assertKnownOptions(args, allowed) {
  const known = new Set([...allowed, "--json", "--help"]);
  const unknown = args
    .filter((value) => typeof value === "string" && value.startsWith("--"))
    .map((value) => value.split("=")[0])
    .filter((value) => !known.has(value));
  if (unknown.length) throw new Error(`Unknown option ${unknown[0]}. Run webcat --help.`);
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
// Shell-like splitting. Quotes are only treated as quoting when they open a token, so a JSON
// payload such as --args {"a":1} keeps its inner double quotes intact.
export function tokenize(value) {
  const tokens = []; let current = ""; let quote; let escaped = false; let started = false;
  for (const char of value) {
    if (escaped) { current += char; escaped = false; started = true; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (quote) { if (char === quote) quote = undefined; else current += char; continue; }
    if ((char === '"' || char === "'") && !started) { quote = char; started = true; continue; }
    if (/\s/.test(char)) {
      if (started) { tokens.push(current); current = ""; started = false; }
      continue;
    }
    current += char;
    started = true;
  }
  if (quote) throw new Error("Unterminated quote");
  if (started) tokens.push(current);
  return tokens;
}

