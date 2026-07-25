import { ContractValidationError } from "../validation.js";

export type ResolvedEvidenceNode = {
  identity: string;
  parentIdentities: readonly string[];
};

/** Internal seam for already-resolved identities; public content hashes are verified first. */
export function assertAcyclicResolvedEvidenceGraph(
  nodes: readonly ResolvedEvidenceNode[],
): void {
  const parentsByIdentity = new Map(
    nodes
      .toSorted((left, right) => left.identity.localeCompare(right.identity))
      .map((node) => [node.identity, node.parentIdentities.toSorted()]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (identity: string): void => {
    if (visiting.has(identity)) {
      throw new ContractValidationError("EvidenceGraph", [
        {
          kind: "semantic",
          code: "evidence-cycle",
          path: "/parentEvidenceHashes",
          message: `evidence graph contains a cycle at ${identity}`,
        },
      ]);
    }
    if (visited.has(identity)) return;
    visiting.add(identity);
    for (const parent of parentsByIdentity.get(identity) ?? []) visit(parent);
    visiting.delete(identity);
    visited.add(identity);
  };
  for (const identity of [...parentsByIdentity.keys()].toSorted()) {
    visit(identity);
  }
}
