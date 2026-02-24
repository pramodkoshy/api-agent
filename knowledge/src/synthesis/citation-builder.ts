import type { ScoredChunk } from "../storage/interfaces.js";

export interface Citation {
  source: string;
  url?: string;
  text: string;
  chunkId: string;
  score: number;
}

export function buildCitations(
  chunks: ScoredChunk[],
  documentMap: Map<string, { source: string; url: string }>,
): Citation[] {
  return chunks.map((chunk) => {
    const docInfo = documentMap.get(chunk.documentId);
    return {
      source: docInfo?.source || String(chunk.metadata.source || "unknown"),
      url: docInfo?.url,
      text: chunk.text.slice(0, 200) + (chunk.text.length > 200 ? "..." : ""),
      chunkId: chunk.chunkId,
      score: chunk.score,
    };
  });
}

export function formatCitationsForPrompt(citations: Citation[]): string {
  return citations
    .map(
      (c, i) =>
        `[Source ${i + 1}] (${c.source}${c.url ? `, ${c.url}` : ""})\n${c.text}`,
    )
    .join("\n\n");
}
