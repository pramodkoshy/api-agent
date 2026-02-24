import { z } from "zod";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";
import { buildCitations, formatCitationsForPrompt, type Citation } from "./citation-builder.js";
import type { ScoredChunk } from "../storage/interfaces.js";

const logger = createLogger("synthesizer");

export interface SynthesisInput {
  query: string;
  chunks: ScoredChunk[];
  graphContext?: {
    entities: Array<{ id: string; name: string; type: string }>;
    relationships: Array<{ source: string; target: string; type: string; context?: string }>;
  };
  documentMap: Map<string, { source: string; url: string }>;
}

export interface SynthesisResult {
  answer: string;
  citations: Citation[];
  entities: Array<{ name: string; type: string; relation?: string }>;
  confidence: number;
}

export async function synthesize(input: SynthesisInput): Promise<SynthesisResult> {
  const baseUrl = config.openaiBaseUrl || "https://api.openai.com/v1";
  const citations = buildCitations(input.chunks, input.documentMap);
  const citationText = formatCitationsForPrompt(citations);

  let graphContext = "";
  if (input.graphContext?.entities.length) {
    graphContext = `\n\nKnowledge Graph Context:\nEntities: ${input.graphContext.entities.map((e) => `${e.name} (${e.type})`).join(", ")}`;
    if (input.graphContext.relationships.length) {
      graphContext += `\nRelationships: ${input.graphContext.relationships.map((r) => `${r.source} -[${r.type}]-> ${r.target}`).join(", ")}`;
    }
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.knowledgeModel,
        messages: [
          {
            role: "system",
            content: `You are a knowledge synthesis agent. Given source materials and a question, synthesize a comprehensive answer.

Rules:
1. Use inline citations like [Source 1], [Source 2] to reference specific sources
2. If sources conflict, acknowledge the conflict
3. Only state facts supported by the provided sources
4. Rate your confidence (0-1) based on source quality and coverage
5. List key entities mentioned in your answer

Return a JSON object with:
- "answer": your synthesized answer with inline [Source N] citations
- "entities": array of {name, type, relation} for key entities
- "confidence": number between 0 and 1

Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Question: ${input.query}\n\nSources:\n${citationText}${graphContext}`,
          },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`Synthesis API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("Empty synthesis response");

    const parsed = JSON.parse(content) as {
      answer: string;
      entities: Array<{ name: string; type: string; relation?: string }>;
      confidence: number;
    };

    logger.info("Synthesis complete", {
      query: input.query.slice(0, 100),
      citations: citations.length,
      confidence: parsed.confidence,
    });

    return {
      answer: parsed.answer,
      citations,
      entities: parsed.entities || [],
      confidence: parsed.confidence || 0.5,
    };
  } catch (error) {
    logger.error("Synthesis failed", { error: String(error) });
    return {
      answer: "Unable to synthesize an answer from the available sources.",
      citations,
      entities: [],
      confidence: 0,
    };
  }
}
