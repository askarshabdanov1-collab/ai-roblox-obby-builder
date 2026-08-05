import { describe, expect, it } from "vitest";

import {
  G2E_PROVENANCE_SCHEMA_VERSION,
  G2E_REPOSITORY_COMMIT_ENV,
  G2eProvenanceError,
  renderG2eBuildProvenance,
  resolveG2eRepositoryCommit,
} from "../g2e-build-provenance.js";

const GIT_COMMIT = "1379849686525d88c71245626e0360a00f1d48a9";
const RELEASE_COMMIT = "25868cd60e33648f963f3cec60aa2ef348810c87";
const HISTORICAL_COMMIT = "9a92540aad3183342096501f268eb1f966d640bf";

describe("G2e artifact build provenance", () => {
  it("accepts a valid Git-derived commit", () => {
    expect(
      resolveG2eRepositoryCommit({ readGitHead: () => `${GIT_COMMIT}\n` }),
    ).toEqual({ repositoryCommit: GIT_COMMIT, source: "git" });
  });

  it("gives an explicit release override precedence over Git", () => {
    expect(
      resolveG2eRepositoryCommit({
        override: RELEASE_COMMIT,
        readGitHead: () => GIT_COMMIT,
      }),
    ).toEqual({ repositoryCommit: RELEASE_COMMIT, source: "environment" });
  });

  it("rejects malformed, padded, and uppercase overrides", () => {
    for (const override of [
      "abc",
      ` ${GIT_COMMIT}`,
      `${GIT_COMMIT}\n`,
      GIT_COMMIT.toUpperCase(),
    ]) {
      expect(() => resolveG2eRepositoryCommit({ override })).toThrow(
        G2eProvenanceError,
      );
      try {
        resolveG2eRepositoryCommit({ override });
      } catch (error) {
        expect(error).toMatchObject({
          code: "g2e-provenance-invalid-override",
          field: G2E_REPOSITORY_COMMIT_ENV,
        });
      }
    }
  });

  it("fails closed when Git metadata and an override are unavailable", () => {
    expect(() =>
      resolveG2eRepositoryCommit({
        readGitHead: () => {
          throw new Error("git unavailable");
        },
      }),
    ).toThrow(
      expect.objectContaining({ code: "g2e-provenance-git-unavailable" }),
    );
  });

  it("renders identical bytes for identical provenance", () => {
    expect(renderG2eBuildProvenance(GIT_COMMIT)).toBe(
      renderG2eBuildProvenance(GIT_COMMIT),
    );
  });

  it("changes generated output when provenance changes", () => {
    expect(renderG2eBuildProvenance(GIT_COMMIT)).not.toBe(
      renderG2eBuildProvenance(RELEASE_COMMIT),
    );
  });

  it("emits only the schema and reviewed commit without local metadata", () => {
    const output = renderG2eBuildProvenance(GIT_COMMIT);
    expect(output).toContain(G2E_PROVENANCE_SCHEMA_VERSION);
    expect(output).toContain(GIT_COMMIT);
    expect(output).not.toMatch(
      /[A-Z]:\\|Users[\\/]|username|branch|timestamp/i,
    );
  });

  it("never falls back to the historical stale commit", () => {
    const output = renderG2eBuildProvenance(GIT_COMMIT);
    expect(output).not.toContain(HISTORICAL_COMMIT);
  });
});
