import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";
import type { ScoredChunk } from "../storage/interfaces.js";

const logger = createLogger("summarizer");

/**
 * Two-level summarization:
 * Level 1: Per-source summaries (parallel)
 * Level 2: Cross-source synthesis (sequential)
 */
export async function twoLevelSummarize(
  chunks: ScoredChunk[],
  query: string,
): Promise<string> {
  const baseUrl = config.openaiBaseUrl || "https://api.openai.com/v1";

  // Group chunks by source
  const bySource = new Map<string, ScoredChunk[]>();
  for (const chunk of chunks) {
    const source = String(chunk.metadata.source || "unknown");
    const existing = bySource.get(source) || [];
    existing.push(chunk);
    bySource.set(source, existing);
  }

  // Level 1: Summarize each source in parallel
  const sourceSummaries = await Promise.all(
    Array.from(bySource.entries()).map(async ([source, sourceChunks]) => {
      const text = sourceChunks.map((c) => c.text).join("\n\n");
      const summary = await summarizeText(
        baseUrl,
        text,
        `Summarize the following content from ${source} relevant to: "${query}". Be concise (max 500 tokens).`,
      );
      return { source, summary };
    }),
  );

  // Level 2: Cross-source synthesis
  const combinedInput = sourceSummaries
    .map((s) => `[${s.source}]: ${s.summary}`)
    .join("\n\n");

  const finalSynthesis = await summarizeText(
    baseUrl,
    combinedInput,
    `Given summaries from multiple sources about "${query}", synthesize a comprehensive answer. Cite sources inline. Highlight any conflicting information.`,
  );

  logger.info("Two-level summarization complete", {
    sources: sourceSummaries.length,
  });

  return finalSynthesis;
}

async function summarizeText(
  baseUrl: string,
  text: string,
  instruction: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.knowledgeModel,
      messages: [
        { role: "system", content: instruction },
        { role: "user", content: text.slice(0, 12000) },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Summarization API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content || "";
}
