import type { IRawStore } from "../storage/interfaces.js";
import { generateId } from "../utils/hash.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("raw-store");

export interface StoredDocument {
  id: string;
  storagePath: string;
  contentType: string;
}

export async function storeRawDocument(
  content: string,
  contentType: string,
  rawStore: IRawStore,
): Promise<StoredDocument> {
  const id = generateId("doc");

  const extension = getExtension(contentType);
  const key = `${id}${extension}`;

  const path = await rawStore.upload(key, Buffer.from(content, "utf-8"), contentType);

  logger.info("Stored raw document", { id, path, size: content.length });

  return { id, storagePath: path, contentType };
}

function getExtension(contentType: string): string {
  if (contentType.includes("html")) return ".html";
  if (contentType.includes("json")) return ".json";
  if (contentType.includes("xml") || contentType.includes("rss")) return ".xml";
  if (contentType.includes("pdf")) return ".pdf";
  return ".txt";
}
