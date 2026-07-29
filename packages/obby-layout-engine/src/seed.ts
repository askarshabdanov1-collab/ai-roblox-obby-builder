import { createHash } from "node:crypto";

import {
  compareUnicodeScalars,
  evaluatorCanonicalStringify,
} from "@obby/canonical-json";

import { LayoutEngineError } from "./types.js";

export const LAYOUT_SEED_DERIVATION_VERSION = "g1b-layout-domain-v1" as const;

export function deriveLayoutDomainSeed(
  seedIdentity: string,
  layoutConfigurationHash: string,
  mechanicLayoutDefinitionHashes: readonly unknown[],
  domain: string,
): number {
  if (
    typeof seedIdentity !== "string" ||
    typeof layoutConfigurationHash !== "string" ||
    typeof domain !== "string" ||
    !Array.isArray(mechanicLayoutDefinitionHashes) ||
    !mechanicLayoutDefinitionHashes.every(
      (hash: unknown): hash is string => typeof hash === "string",
    )
  )
    throw new LayoutEngineError(
      "validation",
      "layout seed derivation requires string identities and a definition hash set",
    );
  const definitionHashes = [...mechanicLayoutDefinitionHashes]
    .map((hash) => hash.normalize("NFC"))
    .sort(compareUnicodeScalars);
  if (new Set(definitionHashes).size !== definitionHashes.length)
    throw new LayoutEngineError(
      "validation",
      "layout seed definition hashes must be unique",
    );
  const preimage = evaluatorCanonicalStringify({
    derivationVersion: LAYOUT_SEED_DERIVATION_VERSION,
    fieldCount: 4,
    seedIdentity: seedIdentity.normalize("NFC"),
    layoutConfigurationHash: layoutConfigurationHash.normalize("NFC"),
    mechanicLayoutDefinitionHashes: definitionHashes,
    domainNamespace: domain.normalize("NFC"),
  });
  return createHash("sha256").update(preimage, "utf8").digest().readUInt32BE(0);
}
