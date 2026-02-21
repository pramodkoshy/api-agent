import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { AutoChart } from "../auto-chart";
import type { ChartRecommendation } from "@/types/query-result";

// Mock recharts to avoid rendering issues in test environment
jest.mock("recharts", () => {
  const React = require("react");
  return {
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    BarChart: ({ children, data }: any) => (
      <div data-testid="bar-chart" data-rows={data?.length}>
        {children}
      </div>
    ),
    LineChart: ({ children, data }: any) => (
      <div data-testid="line-chart" data-rows={data?.length}>
        {children}
      </div>
    ),
    AreaChart: ({ children, data }: any) => (
      <div data-testid="area-chart" data-rows={data?.length}>
        {children}
      </div>
    ),
    PieChart: ({ children }: any) => (
      <div data-testid="pie-chart">{children}</div>
    ),
    Bar: ({ dataKey }: any) => <div data-testid={`bar-${dataKey}`} />,
    Line: ({ dataKey }: any) => <div data-testid={`line-${dataKey}`} />,
    Area: ({ dataKey }: any) => <div data-testid={`area-${dataKey}`} />,
    Pie: ({ children, dataKey }: any) => (
      <div data-testid={`pie-${dataKey}`}>{children}</div>
    ),
    Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />,
    XAxis: ({ dataKey }: any) => <div data-testid={`xaxis-${dataKey}`} />,
    YAxis: () => <div data-testid="yaxis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
  };
});

// Mock the chart UI components
jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children, ...props }: any) => (
    <div data-testid="chart-container" {...props}>
      {children}
    </div>
  ),
  ChartTooltip: () => <div data-testid="chart-tooltip" />,
  ChartTooltipContent: () => <div data-testid="chart-tooltip-content" />,
  ChartLegend: () => <div data-testid="chart-legend" />,
  ChartLegendContent: () => <div data-testid="chart-legend-content" />,
}));

describe("AutoChart", () => {
  const sampleData = [
    { category: "A", value: 10 },
    { category: "B", value: 20 },
    { category: "C", value: 30 },
  ];

  it("renders bar chart", () => {
    const config: ChartRecommendation = {
      type: "bar",
      xKey: "category",
      yKeys: ["value"],
    };
    render(<AutoChart data={sampleData} config={config} />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("bar-value")).toBeInTheDocument();
  });

  it("renders line chart", () => {
    const config: ChartRecommendation = {
      type: "line",
      xKey: "category",
      yKeys: ["value"],
    };
    render(<AutoChart data={sampleData} config={config} />);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    expect(screen.getByTestId("line-value")).toBeInTheDocument();
  });

  it("renders area chart", () => {
    const config: ChartRecommendation = {
      type: "area",
      xKey: "category",
      yKeys: ["value"],
    };
    render(<AutoChart data={sampleData} config={config} />);
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getByTestId("area-value")).toBeInTheDocument();
  });

  it("renders pie chart", () => {
    const config: ChartRecommendation = {
      type: "pie",
      xKey: "category",
      yKeys: ["value"],
    };
    render(<AutoChart data={sampleData} config={config} />);
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    expect(screen.getByTestId("pie-value")).toBeInTheDocument();
  });

  it("renders multiple y-keys for bar chart", () => {
    const data = [
      { month: "Jan", sales: 100, returns: 10 },
      { month: "Feb", sales: 150, returns: 15 },
    ];
    const config: ChartRecommendation = {
      type: "bar",
      xKey: "month",
      yKeys: ["sales", "returns"],
    };
    render(<AutoChart data={data} config={config} />);
    expect(screen.getByTestId("bar-sales")).toBeInTheDocument();
    expect(screen.getByTestId("bar-returns")).toBeInTheDocument();
  });

  it("renders pie chart cells for each data point", () => {
    const config: ChartRecommendation = {
      type: "pie",
      xKey: "category",
      yKeys: ["value"],
    };
    render(<AutoChart data={sampleData} config={config} />);
    const cells = screen.getAllByTestId("cell");
    expect(cells).toHaveLength(3);
  });

  it("renders chart container with config", () => {
    const config: ChartRecommendation = {
      type: "bar",
      xKey: "category",
      yKeys: ["value"],
    };
    render(<AutoChart data={sampleData} config={config} />);
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
  });

  it("returns null for unknown chart type", () => {
    const config = {
      type: "unknown" as any,
      xKey: "category",
      yKeys: ["value"],
    };
    const { container } = render(
      <AutoChart data={sampleData} config={config} />
    );
    expect(container.innerHTML).toBe("");
  });
});
