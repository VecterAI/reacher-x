import type { ArtifactReference, BenchmarkEntity, Evidence } from "./types";

export const MAX_EVIDENCE_SEARCHES_PER_ENTITY = 2;

export interface EvidenceCache {
  read(cacheKey: string): Promise<readonly Evidence[] | null>;
  write(
    cacheKey: string,
    evidence: readonly Evidence[]
  ): Promise<ArtifactReference>;
}

export interface EvidenceProvider {
  // Shared cached evidence, independent of which tool found the entity.
  collect(
    entity: BenchmarkEntity,
    referenceDate: string
  ): Promise<{
    evidence: readonly Evidence[];
    searchesUsed: 0 | 1 | 2;
    receipt: ArtifactReference;
  }>;
}
