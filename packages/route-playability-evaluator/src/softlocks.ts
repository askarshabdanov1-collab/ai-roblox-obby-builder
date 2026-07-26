import { WorkBudget } from "./limits.js";
import type { RouteGraph } from "./types.js";

export type StructuralSoftlockCandidate = {
  candidateId: string;
  subjectObjectId: string;
  candidateKind:
    | "checkpoint-without-outgoing-path"
    | "route-object-without-outgoing-transition";
  state: "structural-softlock-candidate";
};

export function detectStructuralSoftlockCandidates(
  graph: RouteGraph,
  work = new WorkBudget(200_000),
): StructuralSoftlockCandidate[] {
  const outgoing = new Set(graph.edges.map((edge) => edge.fromObjectId));
  return graph.nodes
    .filter((node) => {
      work.use();
      return (
        node.objectId !== graph.finishObjectId && !outgoing.has(node.objectId)
      );
    })
    .map((node) => ({
      candidateId: `softlock.${graph.routeId}.${node.routeIndex}`,
      subjectObjectId: node.objectId,
      candidateKind:
        node.role === "checkpoint"
          ? ("checkpoint-without-outgoing-path" as const)
          : ("route-object-without-outgoing-transition" as const),
      state: "structural-softlock-candidate" as const,
    }))
    .toSorted((a, b) => a.candidateId.localeCompare(b.candidateId));
}
