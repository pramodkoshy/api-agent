import type { ChartRecommendation, StructuredData } from "@/types/query-result";

/** Infer the best chart type from an array of data objects. */
export function inferChartType(
  data: Record<string, unknown>[],
): ChartRecommendation | null {
  if (!data.length) return null;

  const keys = Object.keys(data[0]);
  const numericKeys = keys.filter((k) =>
    data.every((row) => typeof row[k] === "number"),
  );
  const stringKeys = keys.filter((k) =>
    data.some((row) => typeof row[k] === "string"),
  );

  if (numericKeys.length === 0) return null;

  // Pie: 1 string label + 1 numeric value, small dataset
  if (
    stringKeys.length >= 1 &&
    numericKeys.length === 1 &&
    data.length <= 10
  ) {
    return { type: "pie", xKey: stringKeys[0], yKeys: numericKeys };
  }

  // Line: many rows (looks like a series)
  if (data.length > 8 && stringKeys.length >= 1) {
    return {
      type: "line",
      xKey: stringKeys[0],
      yKeys: numericKeys.slice(0, 3),
    };
  }

  // Bar: default for categorical + numeric
  if (stringKeys.length >= 1) {
    return {
      type: "bar",
      xKey: stringKeys[0],
      yKeys: numericKeys.slice(0, 3),
    };
  }

  return null;
}

/**
 * Try to extract structured data from an agent message.
 * Looks for JSON code blocks with our expected shape.
 */
export function parseAgentResponse(content: string): StructuredData | null {
  // Try ```json blocks first
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed.data) && parsed.data.length > 0) {
        return {
          type: parsed.type || "table",
          data: parsed.data,
          columns: parsed.columns,
          chartConfig: parsed.chartConfig || inferChartType(parsed.data) || undefined,
        };
      }
      // Bare array inside a wrapper
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          type: "table",
          data: parsed,
          chartConfig: inferChartType(parsed) || undefined,
        };
      }
    } catch {
      /* not valid JSON */
    }
  }

  // Try to find a bare JSON array in the message
  const arrayMatch = content.match(/\[[\s\S]*?\{[\s\S]*?\}[\s\S]*?\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
        return {
          type: "table",
          data: parsed,
          chartConfig: inferChartType(parsed) || undefined,
        };
      }
    } catch {
      /* not valid JSON */
    }
  }

  return null;
}
