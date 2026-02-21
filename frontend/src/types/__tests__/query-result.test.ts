import type { ChartRecommendation, StructuredData } from "../query-result";

describe("ChartRecommendation type", () => {
  it("accepts bar chart recommendation", () => {
    const rec: ChartRecommendation = {
      type: "bar",
      xKey: "category",
      yKeys: ["value"],
    };
    expect(rec.type).toBe("bar");
    expect(rec.xKey).toBe("category");
    expect(rec.yKeys).toEqual(["value"]);
  });

  it("accepts line chart recommendation", () => {
    const rec: ChartRecommendation = {
      type: "line",
      xKey: "date",
      yKeys: ["revenue", "cost"],
    };
    expect(rec.type).toBe("line");
  });

  it("accepts area chart recommendation", () => {
    const rec: ChartRecommendation = {
      type: "area",
      xKey: "time",
      yKeys: ["temp"],
    };
    expect(rec.type).toBe("area");
  });

  it("accepts pie chart recommendation", () => {
    const rec: ChartRecommendation = {
      type: "pie",
      xKey: "name",
      yKeys: ["count"],
    };
    expect(rec.type).toBe("pie");
  });

  it("supports multiple yKeys", () => {
    const rec: ChartRecommendation = {
      type: "bar",
      xKey: "month",
      yKeys: ["sales", "returns", "profit"],
    };
    expect(rec.yKeys).toHaveLength(3);
  });
});

describe("StructuredData type", () => {
  it("accepts table type with data", () => {
    const sd: StructuredData = {
      type: "table",
      data: [{ id: 1, name: "Alice" }],
    };
    expect(sd.type).toBe("table");
    expect(sd.data).toHaveLength(1);
  });

  it("accepts chart type with chartConfig", () => {
    const sd: StructuredData = {
      type: "chart",
      data: [{ x: "A", y: 10 }],
      chartConfig: { type: "bar", xKey: "x", yKeys: ["y"] },
    };
    expect(sd.type).toBe("chart");
    expect(sd.chartConfig).toBeDefined();
  });

  it("accepts both type", () => {
    const sd: StructuredData = {
      type: "both",
      data: [{ x: "A", y: 10 }],
      columns: ["x", "y"],
      chartConfig: { type: "line", xKey: "x", yKeys: ["y"] },
    };
    expect(sd.type).toBe("both");
    expect(sd.columns).toEqual(["x", "y"]);
  });

  it("optional fields default to undefined", () => {
    const sd: StructuredData = {
      type: "table",
      data: [],
    };
    expect(sd.columns).toBeUndefined();
    expect(sd.chartConfig).toBeUndefined();
  });
});
