import { inferChartType, parseAgentResponse } from "../data-inference";

describe("inferChartType", () => {
  it("returns null for empty data", () => {
    expect(inferChartType([])).toBeNull();
  });

  it("returns null when no numeric keys exist", () => {
    const data = [
      { name: "Alice", city: "NYC" },
      { name: "Bob", city: "LA" },
    ];
    expect(inferChartType(data)).toBeNull();
  });

  it("returns pie chart for small dataset with 1 string + 1 numeric key", () => {
    const data = [
      { category: "A", value: 10 },
      { category: "B", value: 20 },
      { category: "C", value: 30 },
    ];
    const result = inferChartType(data);
    expect(result).toEqual({
      type: "pie",
      xKey: "category",
      yKeys: ["value"],
    });
  });

  it("returns pie for exactly 10 rows", () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      name: `item_${i}`,
      count: i * 5,
    }));
    const result = inferChartType(data);
    expect(result).toEqual({
      type: "pie",
      xKey: "name",
      yKeys: ["count"],
    });
  });

  it("returns line chart for large dataset (> 8 rows) with string + numeric", () => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      date: `2024-0${i + 1}`,
      revenue: i * 100,
      cost: i * 50,
    }));
    const result = inferChartType(data);
    expect(result).toEqual({
      type: "line",
      xKey: "date",
      yKeys: ["revenue", "cost"],
    });
  });

  it("limits yKeys to 3 for line chart", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      month: `M${i}`,
      a: i,
      b: i * 2,
      c: i * 3,
      d: i * 4,
    }));
    const result = inferChartType(data);
    expect(result?.yKeys.length).toBeLessThanOrEqual(3);
  });

  it("returns bar chart for medium-sized categorical data", () => {
    const data = [
      { product: "Laptop", sales: 100, returns: 5 },
      { product: "Phone", sales: 200, returns: 10 },
      { product: "Tablet", sales: 150, returns: 7 },
    ];
    const result = inferChartType(data);
    // 3 rows, 1 string, 2 numeric => pie when numericKeys === 1, but here 2 numeric => bar
    expect(result).toEqual({
      type: "bar",
      xKey: "product",
      yKeys: ["sales", "returns"],
    });
  });

  it("returns null when all keys are numeric but no string key", () => {
    const data = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ];
    const result = inferChartType(data);
    expect(result).toBeNull();
  });

  it("handles mixed types across rows", () => {
    const data = [
      { name: "A", value: 10 },
      { name: "B", value: "not a number" },
    ];
    // value is not numeric for all rows
    const result = inferChartType(data);
    expect(result).toBeNull();
  });
});

describe("parseAgentResponse", () => {
  it("returns null for empty string", () => {
    expect(parseAgentResponse("")).toBeNull();
  });

  it("returns null for plain text", () => {
    expect(parseAgentResponse("Hello world, no data here")).toBeNull();
  });

  it("parses JSON code block with data array", () => {
    const content = 'Some text\n```json\n{"type":"table","data":[{"id":1,"name":"Test"}]}\n```\nMore text';
    const result = parseAgentResponse(content);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("table");
    expect(result!.data).toEqual([{ id: 1, name: "Test" }]);
  });

  it("parses JSON code block with chart config", () => {
    const content =
      '```json\n{"type":"chart","data":[{"x":"A","y":10},{"x":"B","y":20}],"chartConfig":{"type":"bar","xKey":"x","yKeys":["y"]}}\n```';
    const result = parseAgentResponse(content);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("chart");
    expect(result!.chartConfig).toEqual({
      type: "bar",
      xKey: "x",
      yKeys: ["y"],
    });
  });

  it("parses bare JSON array inside wrapper", () => {
    const content =
      '```json\n[{"name":"Alice","age":30},{"name":"Bob","age":25}]\n```';
    const result = parseAgentResponse(content);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("table");
    expect(result!.data).toHaveLength(2);
  });

  it("parses bare JSON array in message (no code block)", () => {
    const content =
      'Here are the results: [{"city":"NYC","pop":8000000},{"city":"LA","pop":4000000}]';
    const result = parseAgentResponse(content);
    expect(result).not.toBeNull();
    expect(result!.data).toHaveLength(2);
    expect(result!.data[0]).toHaveProperty("city");
  });

  it("returns null for invalid JSON in code block", () => {
    const content = "```json\n{invalid json}\n```";
    const result = parseAgentResponse(content);
    expect(result).toBeNull();
  });

  it("returns null for empty data array in code block", () => {
    const content = '```json\n{"data":[]}\n```';
    const result = parseAgentResponse(content);
    expect(result).toBeNull();
  });

  it("auto-infers chart config when not provided", () => {
    const content =
      '```json\n{"data":[{"category":"A","value":10},{"category":"B","value":20},{"category":"C","value":30}]}\n```';
    const result = parseAgentResponse(content);
    expect(result).not.toBeNull();
    expect(result!.chartConfig).toBeDefined();
    expect(result!.chartConfig!.type).toBe("pie");
  });

  it("preserves columns when provided", () => {
    const content =
      '```json\n{"data":[{"id":1}],"columns":["id"]}\n```';
    const result = parseAgentResponse(content);
    expect(result).not.toBeNull();
    expect(result!.columns).toEqual(["id"]);
  });

  it("returns null for array of primitives", () => {
    const content = "Here: [1, 2, 3]";
    const result = parseAgentResponse(content);
    expect(result).toBeNull();
  });
});
