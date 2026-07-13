import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function writeReport(options) {
  const { session, findings, hypotheses, evidence, directory, format = "markdown" } = options;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (format === "json") {
    const path = join(directory, `${session.id}.json`);
    await writeFile(path, `${JSON.stringify({ session, findings, hypotheses, evidence }, null, 2)}\n`, { mode: 0o600 });
    return path;
  }
  const lines = [
    `# WebCat assessment report`,
    "",
    `- Session: \`${session.id}\``,
    `- Objective: ${session.objective}`,
    `- State: ${session.state}`,
    `- Generated: ${new Date().toISOString()}`,
    "",
    "## Validated findings",
    ""
  ];
  const validated = findings.filter((item) => item.status === "validated");
  if (validated.length === 0) lines.push("No validated findings were recorded.", "");
  for (const finding of validated) {
    lines.push(`### ${finding.title}`, "", `- Severity: ${finding.severity}`, `- Confidence: ${finding.confidence}`, `- Evidence: ${(finding.evidenceIds ?? []).join(", ") || "none"}`, "", finding.impact || "Impact not supplied.", "", `Remediation: ${finding.remediation || "Not supplied."}`, "");
  }
  lines.push("## Candidate hypotheses", "");
  for (const hypothesis of hypotheses) lines.push(`- ${hypothesis.title} (${hypothesis.status}, confidence ${hypothesis.confidence})`);
  lines.push("", "## Evidence integrity", "", ...evidence.map((item) => `- ${item.id}: ${item.valid ? "valid" : "invalid"}`), "");
  const path = join(directory, `${session.id}.md`);
  await writeFile(path, `${lines.join("\n")}\n`, { mode: 0o600 });
  return path;
}
