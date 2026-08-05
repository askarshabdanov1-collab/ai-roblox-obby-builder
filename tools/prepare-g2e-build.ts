import { mkdir } from "node:fs/promises";

import {
  G2E_PROVENANCE_OUTPUT,
  G2E_REPOSITORY_COMMIT_ENV,
  G2eProvenanceError,
  resolveG2eRepositoryCommit,
  writeG2eBuildProvenance,
} from "./g2e-build-provenance.js";

try {
  await mkdir("build", { recursive: true });
  const override = process.env[G2E_REPOSITORY_COMMIT_ENV];
  const resolution = resolveG2eRepositoryCommit(
    override === undefined ? undefined : { override },
  );
  await writeG2eBuildProvenance(
    G2E_PROVENANCE_OUTPUT,
    resolution.repositoryCommit,
  );
  console.log(
    `[G2e provenance] repositoryCommit=${resolution.repositoryCommit} source=${resolution.source}`,
  );
} catch (error) {
  if (error instanceof G2eProvenanceError) {
    console.error(
      `[G2e provenance error] code=${error.code} field=${error.field} message=${error.message}`,
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
}
