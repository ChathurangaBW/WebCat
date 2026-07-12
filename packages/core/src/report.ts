import fs from "node:fs/promises";
import path from "node:path";
import type { Engagement, Finding, Hypothesis } from "./types.js";

export interface ReportBundle {
  generatedAt: string;
  engagement: Pick<Engagement, "id" | "name" | "authorizationReference" | "mode">;
  findings: Finding[];
  hypotheses: Hypothesis[];
  summary: { validated: number; candidate: number; rejected: number; needsMoreEvidence: number };
}

export function createReportBundle(engagement: Engagement, findings: Finding[], hypotheses: Hypothesis[]): ReportBundle {
  return {
    generatedAt: new Date().toISOString(),
    engagement: { id: engagement.id, name: engagement.name, ...(engagement.authorizationReference ? { authorizationReference: engagement.authorizationReference } : {}), mode: engagement.mode },
    findings,
    hypotheses,
    summary: {
      validated: findings.filter((item) => item.status === "validated").length,
      candidate: findings.filter((item) => item.status === "candidate").length,
      rejected: findings.filter((item) => item.status === "rejected").length,
      needsMoreEvidence: findings.filter((item) => item.status === "needs-more-evidence").length
    }
  };
}

export function renderMarkdownReport(bundle: ReportBundle): string {
  const validated = bundle.findings.filter((finding) => finding.status === "validated");
  const rows = validated.map((finding) => `| ${finding.severity.toUpperCase()} | ${finding.title.replace(/\|/g, "\\|")} | ${finding.target ?? "-"} |`).join("\n") || "| - | No validated findings | - |";
  const details = validated.map((finding, index) => `## ${index + 1}. ${finding.title}\n\n**Severity:** ${finding.severity.toUpperCase()}\n\n**Target:** ${finding.target ?? "Not specified"}\n\n**Validation:** ${finding.validationNotes ?? "Independently validated"}\n\n### Description\n${finding.description}\n\n### Impact\n${finding.impact}\n\n### Evidence\n${finding.evidenceIds.map((id) => `- ${id}`).join("\n") || "- None recorded"}\n\n### Remediation\n${finding.remediation}`).join("\n\n");
  return `# WebCat Security Assessment\n\n**Engagement:** ${bundle.engagement.name}\n\n**Authorization reference:** ${bundle.engagement.authorizationReference ?? "Not recorded"}\n\n**Generated:** ${bundle.generatedAt}\n\n## Executive Summary\n\nWebCat recorded ${bundle.summary.validated} validated finding(s), ${bundle.summary.candidate} candidate(s), ${bundle.summary.rejected} rejected candidate(s), and ${bundle.summary.needsMoreEvidence} item(s) requiring more evidence. Only validated findings are included below.\n\n## Findings Summary\n\n| Severity | Title | Target |\n|---|---|---|\n${rows}\n\n${details}\n\n## Assessment Limitations\n\nResults are constrained by the configured scope, available traffic, connected MCP capabilities, model output quality, operator approvals, and evidence collected during this engagement.\n`;
}

export async function writeReport(root: string, engagement: Engagement, findings: Finding[], hypotheses: Hypothesis[] = [], format: "markdown" | "json" = "markdown"): Promise<string> {
  const directory = path.join(root, "reports");
  await fs.mkdir(directory, { recursive: true });
  const bundle = createReportBundle(engagement, findings, hypotheses);
  const file = path.join(directory, format === "json" ? "report.json" : "report.md");
  await fs.writeFile(file, format === "json" ? JSON.stringify(bundle, null, 2) : renderMarkdownReport(bundle), { mode: 0o600 });
  return file;
}
