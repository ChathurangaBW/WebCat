export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printRows(rows: Array<Record<string, unknown>>, columns: string[]): void {
  if (!rows.length) {
    console.log("No records.");
    return;
  }
  const widths = columns.map((column) => Math.max(
    column.length,
    ...rows.map((row) => String(row[column] ?? "").length)
  ));
  const render = (row: Record<string, unknown>): string => columns.map((column, index) =>
    String(row[column] ?? "").padEnd(widths[index]!)
  ).join("  ");
  console.log(render(Object.fromEntries(columns.map((column) => [column, column.toUpperCase()]))));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) console.log(render(row));
}

export function truncate(value: unknown, length = 72): string {
  const text = String(value ?? "").replace(/\s+/g, " ");
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}
