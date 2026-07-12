function scalar(value: string): unknown {
  const normalized = value.trim();
  if (!normalized) return "";
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (normalized === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);
  if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
    return normalized.slice(1, -1);
  }
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    const inner = normalized.slice(1, -1).trim();
    return inner ? inner.split(",").map((item) => scalar(item)) : [];
  }
  return normalized;
}

export function parseSimpleToml(text: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let current: Record<string, unknown> = root;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (!line) continue;
    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) {
      current = root;
      for (const part of section[1]!.split(".")) {
        const existing = current[part];
        if (!existing || typeof existing !== "object" || Array.isArray(existing)) current[part] = {};
        current = current[part] as Record<string, unknown>;
      }
      continue;
    }
    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    current[match[1]!.trim()] = scalar(match[2]!);
  }
  return root;
}

export function parseSimpleYaml(text: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; value: Record<string, unknown> | unknown[] }> = [{ indent: -1, value: root }];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]!;
    if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
    const indent = raw.match(/^\s*/)?.[0].length ?? 0;
    const line = raw.trim();
    while (stack.length > 1 && indent <= stack.at(-1)!.indent) stack.pop();
    const parent = stack.at(-1)!.value;

    if (line.startsWith("- ")) {
      if (!Array.isArray(parent)) throw new Error(`invalid YAML list at line ${index + 1}`);
      const body = line.slice(2);
      const pair = body.match(/^([^:]+):\s*(.*)$/);
      if (!pair) {
        parent.push(scalar(body));
        continue;
      }
      const object: Record<string, unknown> = {};
      const key = pair[1]!.trim();
      const rest = pair[2]!;
      object[key] = rest ? scalar(rest) : {};
      parent.push(object);
      stack.push({ indent, value: object });
      continue;
    }

    if (Array.isArray(parent)) throw new Error(`invalid YAML mapping at line ${index + 1}`);
    const pair = line.match(/^([^:]+):\s*(.*)$/);
    if (!pair) continue;
    const key = pair[1]!.trim();
    const rest = pair[2]!;
    if (rest) {
      parent[key] = scalar(rest);
      continue;
    }
    const next = lines.slice(index + 1).find((candidate) => candidate.trim() && !candidate.trimStart().startsWith("#"));
    const value: Record<string, unknown> | unknown[] = next?.trim().startsWith("-") ? [] : {};
    parent[key] = value;
    stack.push({ indent, value });
  }
  return root;
}
