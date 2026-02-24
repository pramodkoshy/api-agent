import { createLogger } from "../utils/logger.js";

const logger = createLogger("normalizer");

export interface NormalizedContent {
  text: string;
  title: string;
  contentType: "html" | "text" | "json" | "xml" | "rss";
}

export function normalizeContent(
  rawContent: string,
  contentType: string,
  title: string,
): NormalizedContent {
  const type = detectContentType(contentType, rawContent);

  switch (type) {
    case "html":
      return { text: normalizeHtml(rawContent), title, contentType: "html" };
    case "json":
      return { text: normalizeJson(rawContent), title, contentType: "json" };
    case "xml":
    case "rss":
      return { text: normalizeXml(rawContent), title, contentType: type };
    default:
      return { text: normalizeText(rawContent), title, contentType: "text" };
  }
}

function detectContentType(
  mimeType: string,
  content: string,
): "html" | "text" | "json" | "xml" | "rss" {
  if (mimeType.includes("html") || mimeType.includes("xhtml")) return "html";
  if (mimeType.includes("json")) return "json";
  if (mimeType.includes("xml") || mimeType.includes("rss")) {
    if (content.includes("<rss") || content.includes("<feed")) return "rss";
    return "xml";
  }
  // Heuristic detection
  const trimmed = content.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) return "xml";
  return "text";
}

function normalizeHtml(content: string): string {
  // Content has already been processed by cheerio in crawler
  // Further cleanup
  return content
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function normalizeJson(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}

function normalizeXml(content: string): string {
  // Strip XML tags, keep text content
  return content
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeText(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
