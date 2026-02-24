import * as cheerio from "cheerio";
import { createLogger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

const logger = createLogger("crawler");

export interface CrawlResult {
  url: string;
  content: string;
  contentType: string;
  title: string;
  links: string[];
  statusCode: number;
}

export async function crawlUrl(url: string): Promise<CrawlResult> {
  return withRetry(
    async () => {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "KnowledgeWorker/1.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      const contentType = response.headers.get("content-type") || "text/html";
      const rawContent = await response.text();

      if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
        return parseHtml(url, rawContent, contentType, response.status);
      }

      // For JSON/XML, return as-is
      return {
        url,
        content: rawContent,
        contentType,
        title: new URL(url).hostname,
        links: [],
        statusCode: response.status,
      };
    },
    { maxRetries: 3 },
    `crawl ${url}`,
  );
}

function parseHtml(url: string, html: string, contentType: string, statusCode: number): CrawlResult {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $("script, style, nav, footer, header, aside, .sidebar, .menu, .nav, .ad, .advertisement").remove();

  const title = $("title").text().trim()
    || $('meta[property="og:title"]').attr("content")?.trim()
    || $("h1").first().text().trim()
    || new URL(url).hostname;

  // Extract main content
  const mainContent =
    $("main").text() ||
    $("article").text() ||
    $('[role="main"]').text() ||
    $(".content").text() ||
    $("body").text();

  const content = mainContent
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  // Extract links for crawl depth > 0
  const baseUrl = new URL(url);
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    try {
      const href = $(el).attr("href");
      if (!href) return;
      const absolute = new URL(href, baseUrl).href;
      // Only same-domain links, no fragments/anchors
      if (new URL(absolute).hostname === baseUrl.hostname && !absolute.includes("#")) {
        links.push(absolute);
      }
    } catch {
      // Invalid URL, skip
    }
  });

  return {
    url,
    content,
    contentType,
    title,
    links: [...new Set(links)],
    statusCode,
  };
}

export async function crawlMultiple(
  urls: string[],
  depth: number = 0,
  maxPages: number = 50,
): Promise<CrawlResult[]> {
  const visited = new Set<string>();
  const results: CrawlResult[] = [];
  let queue = [...urls];

  for (let currentDepth = 0; currentDepth <= depth && queue.length > 0; currentDepth++) {
    const nextQueue: string[] = [];

    for (const url of queue) {
      if (visited.has(url) || results.length >= maxPages) continue;
      visited.add(url);

      try {
        const result = await crawlUrl(url);
        results.push(result);
        logger.info("Crawled page", { url, contentLength: result.content.length, depth: currentDepth });

        if (currentDepth < depth) {
          nextQueue.push(...result.links.filter((link) => !visited.has(link)));
        }
      } catch (error) {
        logger.error("Failed to crawl", { url, error: String(error) });
      }
    }

    queue = nextQueue;
  }

  logger.info("Crawl complete", { totalPages: results.length, depth });
  return results;
}
