function scalar(value: string): unknown {
  const v = value.trim();
  if (!v) return "";
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1,-1);
  if (v.startsWith("[") && v.endsWith("]")) { const inner = v.slice(1,-1).trim(); return inner ? inner.split(",").map(x => scalar(x)) : []; }
  return v;
}

export function parseSimpleToml(text: string): any {
  const root: any = {}; let current = root;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").trim(); if (!line) continue;
    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) { current = root; for (const part of section[1]!.split(".")) current = current[part] ??= {}; continue; }
    const match = line.match(/^([^=]+)=(.*)$/); if (!match) continue;
    current[match[1]!.trim()] = scalar(match[2]!);
  }
  return root;
}

export function parseSimpleYaml(text: string): any {
  const root: any = {}; const stack: Array<{indent:number; value:any}> = [{indent:-1,value:root}];
  const lines = text.split(/\r?\n/);
  for (let i=0;i<lines.length;i++) {
    const raw = lines[i]!; if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
    const indent = raw.match(/^\s*/)?.[0].length ?? 0; const line = raw.trim();
    while (stack.length > 1 && indent <= stack.at(-1)!.indent) stack.pop();
    const parent = stack.at(-1)!.value;
    if (line.startsWith("- ")) {
      if (!Array.isArray(parent)) throw new Error(`invalid YAML list at line ${i+1}`);
      const body = line.slice(2); const kv = body.match(/^([^:]+):\s*(.*)$/);
      if (kv) { const obj:any={}; obj[kv[1]!.trim()] = kv[2] ? scalar(kv[2]) : {}; parent.push(obj); stack.push({indent,value:obj}); }
      else parent.push(scalar(body));
      continue;
    }
    const kv = line.match(/^([^:]+):\s*(.*)$/); if (!kv) continue;
    const key=kv[1]!.trim(), rest=kv[2]!;
    if (rest) parent[key]=scalar(rest);
    else {
      const next = lines.slice(i+1).find(x => x.trim() && !x.trimStart().startsWith("#"));
      const value = next && next.trim().startsWith("-") ? [] : {};
      parent[key]=value; stack.push({indent,value});
    }
  }
  return root;
}
