export interface ChartRecommendation {
  type: "bar" | "line" | "area" | "pie";
  xKey: string;
  yKeys: string[];
}

export interface StructuredData {
  type: "table" | "chart" | "both";
  data: Record<string, unknown>[];
  columns?: string[];
  chartConfig?: ChartRecommendation;
}
