import { estimateTokens } from "../utils/token-counter.js";
import { generateId } from "../utils/hash.js";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("chunker");

export interface Chunk {
  chunkId: string;
  documentId: string;
  text: string;
  index: number;
  tokenCount: number;
}

const SENTENCE_TERMINATORS = /(?<=[.!?])\s+/;
const PARAGRAPH_SEPARATOR = /\n\s*\n/;

export function chunkText(
  text: string,
  documentId: string,
  maxTokens?: number,
  overlapTokens?: number,
): Chunk[] {
  const maxTok = maxTokens || config.maxChunkTokens;
  const overlap = overlapTokens || config.chunkOverlapTokens;

  if (estimateTokens(text) <= maxTok) {
    return [
      {
        chunkId: generateId("chunk"),
        documentId,
        text,
        index: 0,
        tokenCount: estimateTokens(text),
      },
    ];
  }

  // Split by paragraphs first, then sentences
  const paragraphs = text.split(PARAGRAPH_SEPARATOR).filter((p) => p.trim().length > 0);
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    // If single paragraph exceeds max, split by sentences
    if (paragraphTokens > maxTok) {
      // Flush current chunk
      if (currentChunk.trim()) {
        chunks.push(createChunk(currentChunk.trim(), documentId, chunkIndex++));
        currentChunk = getOverlapText(currentChunk, overlap);
      }

      const sentenceChunks = splitBySentences(paragraph, documentId, maxTok, overlap, chunkIndex);
      chunks.push(...sentenceChunks);
      chunkIndex += sentenceChunks.length;
      currentChunk = getOverlapText(sentenceChunks[sentenceChunks.length - 1]?.text || "", overlap);
      continue;
    }

    // Check if adding this paragraph would exceed max
    const combined = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
    if (estimateTokens(combined) > maxTok) {
      if (currentChunk.trim()) {
        chunks.push(createChunk(currentChunk.trim(), documentId, chunkIndex++));
        currentChunk = getOverlapText(currentChunk, overlap);
      }
      currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
    } else {
      currentChunk = combined;
    }
  }

  // Flush remaining
  if (currentChunk.trim()) {
    chunks.push(createChunk(currentChunk.trim(), documentId, chunkIndex));
  }

  logger.info("Chunked text", { documentId, chunks: chunks.length, totalTokens: estimateTokens(text) });
  return chunks;
}

function splitBySentences(
  text: string,
  documentId: string,
  maxTokens: number,
  overlapTokens: number,
  startIndex: number,
): Chunk[] {
  const sentences = text.split(SENTENCE_TERMINATORS).filter((s) => s.trim().length > 0);
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let chunkIndex = startIndex;

  for (const sentence of sentences) {
    const combined = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    if (estimateTokens(combined) > maxTokens && currentChunk.trim()) {
      chunks.push(createChunk(currentChunk.trim(), documentId, chunkIndex++));
      currentChunk = getOverlapText(currentChunk, overlapTokens) + " " + sentence;
    } else {
      currentChunk = combined;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(createChunk(currentChunk.trim(), documentId, chunkIndex));
  }

  return chunks;
}

function createChunk(text: string, documentId: string, index: number): Chunk {
  return {
    chunkId: generateId("chunk"),
    documentId,
    text,
    index,
    tokenCount: estimateTokens(text),
  };
}

function getOverlapText(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0) return "";
  const words = text.split(/\s+/);
  // Approximate: 1 token ≈ 0.75 words
  const overlapWords = Math.ceil(overlapTokens * 0.75);
  return words.slice(-overlapWords).join(" ");
}
