import { describe, test, expect } from "bun:test";
import { normalizeContent } from "../../src/ingestion/normalizer";

describe("normalizeContent", () => {
  test("normalizes HTML content", () => {
    const result = normalizeContent(
      "<p>Hello   world</p>  <p>Test</p>",
      "text/html",
      "Test Page",
    );
    expect(result.contentType).toBe("html");
    expect(result.title).toBe("Test Page");
    expect(result.text).not.toContain("  ");
  });

  test("normalizes JSON content", () => {
    const result = normalizeContent(
      '{"key":"value","nested":{"a":1}}',
      "application/json",
      "JSON Doc",
    );
    expect(result.contentType).toBe("json");
    expect(result.text).toContain('"key": "value"');
  });

  test("normalizes XML content", () => {
    const result = normalizeContent(
      "<?xml version='1.0'?><root><item>Test</item></root>",
      "application/xml",
      "XML Doc",
    );
    expect(result.contentType).toBe("xml");
    expect(result.text).toContain("Test");
    expect(result.text).not.toContain("<item>");
  });

  test("normalizes plain text", () => {
    const result = normalizeContent(
      "Hello\r\n\r\n\r\nWorld\t\tTest",
      "text/plain",
      "Text Doc",
    );
    expect(result.contentType).toBe("text");
    expect(result.text).not.toContain("\r");
    expect(result.text).not.toContain("\t");
  });

  test("detects JSON from content when mime type is generic", () => {
    const result = normalizeContent(
      '{"data": [1, 2, 3]}',
      "text/plain",
      "Data",
    );
    expect(result.contentType).toBe("json");
  });

  test("detects RSS content", () => {
    const result = normalizeContent(
      '<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title></channel></rss>',
      "application/xml",
      "Feed",
    );
    expect(result.contentType).toBe("rss");
  });
});
