import type { EngagementStore } from "./store.js";
import type { ApprovalRecord, RiskClass } from "./types.js";

export interface ApprovalQuery {
  risk: RiskClass;
  server?: string;
  tool?: string;
  target?: string;
}

function wildcardMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i").test(value);
}

export class ApprovalService {
  public constructor(private readonly store: EngagementStore) {}

  public async grant(input: Omit<ApprovalRecord, "id" | "createdAt" | "status">): Promise<ApprovalRecord> {
    if (new Date(input.expiresAt).getTime() <= Date.now()) throw new Error("approval expiry must be in the future");
    return this.store.addApproval({ ...input, status: "active" });
  }

  public async revoke(id: string): Promise<ApprovalRecord> {
    return this.store.revokeApproval(id);
  }

  public async findValid(query: ApprovalQuery): Promise<ApprovalRecord | undefined> {
    const approvals = await this.store.listApprovals();
    const now = Date.now();
    return approvals.find((approval) => {
      if (approval.status !== "active" || new Date(approval.expiresAt).getTime() <= now) return false;
      if (approval.risk && approval.risk !== query.risk) return false;
      if (approval.server && approval.server !== query.server) return false;
      if (approval.tool && approval.tool !== query.tool) return false;
      if (approval.targetPattern && (!query.target || !wildcardMatch(approval.targetPattern, query.target))) return false;
      return true;
    });
  }
}

export function parseDuration(value: string): number {
  const match = value.trim().match(/^(\d+)(s|m|h|d)$/i);
  if (!match) throw new Error("duration must use s, m, h, or d, for example 30m");
  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * (multiplier ?? 0);
}
