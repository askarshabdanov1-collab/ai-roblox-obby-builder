import type { RouteEvaluationIssue, RouteEvaluationLimits } from "./types.js";

export const DEFAULT_ROUTE_EVALUATION_LIMITS: Readonly<RouteEvaluationLimits> =
  Object.freeze({
    maxRoutes: 1,
    maxNodes: 10_000,
    maxTransitions: 10_000,
    maxCheckpoints: 1_000,
    maxHazards: 1_000,
    maxEvidenceRecords: 50_000,
    maxTraversalWork: 200_000,
  });

export class RouteEvaluationError extends Error {
  public constructor(
    public readonly code: string,
    public readonly issues: readonly RouteEvaluationIssue[],
  ) {
    super(
      `${code}: ${issues.map((issue) => `${issue.subject}: ${issue.message}`).join("; ")}`,
    );
    this.name = "RouteEvaluationError";
  }
}

export function resolveRouteLimits(
  overrides: Partial<RouteEvaluationLimits> | undefined,
): RouteEvaluationLimits {
  const limits = { ...DEFAULT_ROUTE_EVALUATION_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RouteEvaluationError("invalid-limit", [
        {
          code: "invalid-limit",
          subject: name,
          message: "limits must be non-negative safe integers",
        },
      ]);
    }
  }
  return limits;
}

export function rejectBudget(
  code: string,
  actual: number,
  maximum: number,
): never {
  throw new RouteEvaluationError(code, [
    {
      code,
      subject: "scene",
      message: `${actual} exceeds deterministic budget ${maximum}`,
    },
  ]);
}

export class WorkBudget {
  private work = 0;

  public constructor(private readonly maximum: number) {}

  public use(units = 1): void {
    this.work += units;
    if (this.work > this.maximum) {
      rejectBudget("maximum-traversal-work", this.work, this.maximum);
    }
  }
}
