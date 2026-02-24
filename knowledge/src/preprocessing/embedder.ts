import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

const logger = createLogger("embedder");

const BATCH_SIZE = 100;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await withRetry(
      () => callEmbeddingApi(batch),
      { maxRetries: 2 },
      `embed batch ${i / BATCH_SIZE + 1}`,
    );
    allEmbeddings.push(...batchEmbeddings);
  }

  logger.info("Generated embeddings", { count: allEmbeddings.length, dimensions: allEmbeddings[0]?.length });
  return allEmbeddings;
}

export async function embedText(text: string): Promise<number[]> {
  const results = await embedTexts([text]);
  return results[0];
}

async function callEmbeddingApi(texts: string[]): Promise<number[][]> {
  const baseUrl = config.openaiBaseUrl || "https://api.openai.com/v1";

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.embeddingModel,
      input: texts,
      dimensions: config.embeddingDimensions,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  // Sort by index to maintain order
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
