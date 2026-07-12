import fs from "node:fs/promises";
import path from "node:path";
import type { Engagement, Finding, FindingSeverity, Hypothesis } from "./types.js";

export interface ReportBundle {
  generatedAt: string;
  engagement: Pick<Engagement, "id" | "name" | "authorizationReference" | "mode">;
  findings: Finding[];
  hypotheses: Hypothesis[];
  summary: {
    validated: number;
    candidate: number;
    rejected: number;
    needsMoreEvidence: number;
    bySeverity: Record<FindingSeverity, number>;
  };
}

export function createReportBundle(engagement: Engagement, findings: Finding[], hypotheses: Hypothesis[]): ReportBundle {
  const validated = findings.filter((item) => item.status === "validated");
  const bySeverity: Record<FindingSeverity, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const finding of validated) bySeverity[finding.severity] += 1;
  return {
    generatedAt: new Date().toISOString(),
    engagement: {
      id: engagement.id,
      name: engagement.name,
      ...(engagement.authorizationReference ? { authorizationReference: engagement.authorizationReference } : {}),
      mode: engagement.mode
    },
    findings,
    hypotheses,
    summary: {
      validated: validated.length,
      candidate: findings.filter((item) => item.status === "candidate").length,
      rejected: findings.filter((item) => item.status === "rejected").length,
      needsMoreEvidence: findings.filter((item) => item.status === "needs-more-evidence").length,
      bySeverity
    }
  };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderMarkdownReport(bundle: ReportBundle): string {
  const validated = bundle.findings.filter((finding) => finding.status === "validated");
  const rows = validated.map((finding) =>
    `| ${finding.severity.toUpperCase()} | ${escapeCell(finding.title)} | ${escapeCell(finding.target ?? "-")} |`
  ).join("\n") || "| - | No validated findings | - |";

  const details = validated.map((finding, index) => `## ${index + 1}. ${finding.title}

**Severity:** ${finding.severity.toUpperCase()}

**Target:** ${finding.target ?? "Not specified"}

**Validation:** ${finding.validationNotes ?? "Independently validated"}

### Description
${finding.description}

### Impact
${finding.impact}

### Evidence
${finding.evidenceIds.map((id) => `- ${id}`).join("\n") || "- None recorded"}

### Remediation
${finding.remediation}`).join("\n\n");

  const openHypotheses = bundle.hypotheses.filter((item) => ["open", "testing", "blocked"].includes(item.status));
  const limitations = openHypotheses.length
    ? openHypotheses.map((item) => `- ${item.title}: ${item.status}`).join("\n")
    : "- No unresolved hypotheses were recorded.";

  return `# WebCat Security Assessment

**Engagement:** ${bundle.engagement.name}

**Authorization reference:** ${bundle.engagement.authorizationReference ?? "Not recorded"}

**Mode:** ${bundle.engagement.mode}

**Generated:** ${bundle.generatedAt}

## Executive Summary

WebCat recorded ${bundle.summary.validated} validated finding(s), ${bundle.summary.candidate} candidate(s), ${bundle.summary.rejected} rejected candidate(s), and ${bundle.summary.needsMoreEvidence} item(s) requiring more evidence. Only validated findings are presented as confirmed security issues.

## Findings Summary

| Severity | Title | Target |
|---|---|---|
${rows}

${details || "No validated findings were recorded."}

## Unresolved Hypotheses and Coverage Limitations

${limitations}

## Assessment Limitations

Results are constrained by the configured scope, available traffic, connected MCP capabilities, model output quality, operator approvals, and evidence collected during this engagement.
`;
}

export async function writeReport(
  root: string,
  engagement: Engagement,
  findings: Finding[],
  hypotheses: Hypothesis[] = [],
  format: "markdown" | "json" = "markdown"
): Promise<string> {
  const directory = path.join(root, "reports");
  await fs.mkdir(directory, { recursive: true });
  const bundle = createReportBundle(engagement, findings, hypotheses);
  const file = path.join(directory, format === "json" ? "report.json" : "report.md");
  const body = format === "json" ? JSON.stringify(bundle, null, 2) : renderMarkdownReport(bundle);
  await fs.writeFile(file, body, { mode: 0o600 });
  return file;
}
