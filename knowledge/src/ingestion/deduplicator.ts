import type { IMetadataStore } from "../storage/interfaces.js";
import { contentHash } from "../utils/hash.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("deduplicator");

export interface DeduplicationResult {
  isDuplicate: boolean;
  contentHash: string;
  existingDocumentId?: string;
}

export async function checkDuplicate(
  content: string,
  metadataStore: IMetadataStore,
): Promise<DeduplicationResult> {
  const hash = contentHash(content);
  const isDuplicate = await metadataStore.checkDuplicate(hash);

  if (isDuplicate) {
    logger.info("Duplicate content detected", { hash });
  }

  return {
    isDuplicate,
    contentHash: hash,
  };
}

export function computeContentHash(content: string): string {
  return contentHash(content);
}
