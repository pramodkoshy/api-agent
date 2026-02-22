import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { DataDisplay } from "../data-display";
import type { StructuredData } from "@/types/query-result";

// Mock child components
jest.mock("@/components/data-table/data-table", () => ({
  DataTable: ({ data }: any) => (
    <div data-testid="data-table">DataTable ({data.length} rows)</div>
  ),
}));

jest.mock("@/components/charts/auto-chart", () => ({
  AutoChart: ({ data, config }: any) => (
    <div data-testid="auto-chart">
      AutoChart ({config.type}, {data.length} rows)
    </div>
  ),
}));

// Mock radix-ui tabs
jest.mock("radix-ui", () => {
  const React = require("react");
  return {
    Tabs: {
      Root: ({ children, defaultValue, ...props }: any) => (
        <div data-slot="tabs" data-default-value={defaultValue} {...props}>
          {children}
        </div>
      ),
      List: ({ children, ...props }: any) => (
        <div data-slot="tabs-list" role="tablist" {...props}>
          {children}
        </div>
      ),
      Trigger: ({ children, value, ...props }: any) => (
        <button data-slot="tabs-trigger" role="tab" data-value={value} {...props}>
          {children}
        </button>
      ),
      Content: ({ children, value, ...props }: any) => (
        <div data-slot="tabs-content" data-value={value} {...props}>
          {children}
        </div>
      ),
    },
    Slot: {
      Root: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <span ref={ref} {...props}>{children}</span>
      )),
    },
  };
});

describe("DataDisplay", () => {
  it("renders row count", () => {
    const result: StructuredData = {
      type: "table",
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
    };

    render(<DataDisplay result={result} />);
    expect(screen.getByText("3 row(s) returned")).toBeInTheDocument();
  });

  it("renders only DataTable when type is table", () => {
    const result: StructuredData = {
      type: "table",
      data: [{ id: 1, name: "Test" }],
    };

    render(<DataDisplay result={result} />);
    expect(screen.getByTestId("data-table")).toBeInTheDocument();
    expect(screen.queryByTestId("auto-chart")).not.toBeInTheDocument();
  });

  it("renders tabs with table and chart when type is both", () => {
    const result: StructuredData = {
      type: "both",
      data: [{ x: "A", y: 10 }],
      chartConfig: { type: "bar", xKey: "x", yKeys: ["y"] },
    };

    render(<DataDisplay result={result} />);
    expect(screen.getByText("Table")).toBeInTheDocument();
    expect(screen.getByText("Chart")).toBeInTheDocument();
    expect(screen.getByTestId("data-table")).toBeInTheDocument();
    expect(screen.getByTestId("auto-chart")).toBeInTheDocument();
  });

  it("renders tabs when type is chart with chartConfig", () => {
    const result: StructuredData = {
      type: "chart",
      data: [{ x: "A", y: 10 }],
      chartConfig: { type: "line", xKey: "x", yKeys: ["y"] },
    };

    render(<DataDisplay result={result} />);
    expect(screen.getByText("Chart")).toBeInTheDocument();
    expect(screen.getByTestId("auto-chart")).toBeInTheDocument();
  });

  it("renders only table when type is table even with chartConfig", () => {
    const result: StructuredData = {
      type: "table",
      data: [{ x: "A", y: 10 }],
      chartConfig: { type: "bar", xKey: "x", yKeys: ["y"] },
    };

    render(<DataDisplay result={result} />);
    expect(screen.getByTestId("data-table")).toBeInTheDocument();
    // hasChart is false because type === "table"
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("renders single row correctly", () => {
    const result: StructuredData = {
      type: "table",
      data: [{ id: 1 }],
    };

    render(<DataDisplay result={result} />);
    expect(screen.getByText("1 row(s) returned")).toBeInTheDocument();
  });

  it("renders zero rows", () => {
    const result: StructuredData = {
      type: "table",
      data: [],
    };

    render(<DataDisplay result={result} />);
    expect(screen.getByText("0 row(s) returned")).toBeInTheDocument();
  });
});
