type TransitionIdentity = {
  transitionId: string;
  routeId: string;
  fromObjectId: string;
  toObjectId: string;
  fromGlobalIndex: number;
  toGlobalIndex: number;
};

/** Internal seam for deterministic duplicate checks after transition resolution. */
export function assertUniqueTransitionCollection(
  transitions: readonly TransitionIdentity[],
): void {
  const ids = new Set<string>();
  const tuples = new Set<string>();
  for (const transition of transitions) {
    if (ids.has(transition.transitionId)) {
      throw new Error(`duplicate transition ID: ${transition.transitionId}`);
    }
    ids.add(transition.transitionId);
    const tuple = [
      transition.routeId,
      transition.fromObjectId,
      transition.toObjectId,
      transition.fromGlobalIndex,
      transition.toGlobalIndex,
    ].join("/");
    if (tuples.has(tuple)) {
      throw new Error(`duplicate transition tuple: ${tuple}`);
    }
    tuples.add(tuple);
  }
}
