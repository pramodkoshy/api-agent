import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable, generateColumns } from "../data-table";

// Mock radix-ui
jest.mock("radix-ui", () => {
  const React = require("react");
  return {
    Slot: {
      Root: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <span ref={ref} {...props}>{children}</span>
      )),
    },
  };
});

describe("generateColumns", () => {
  it("returns empty array for empty data", () => {
    expect(generateColumns([])).toEqual([]);
  });

  it("generates columns from data keys", () => {
    const data = [{ id: 1, name: "Alice", age: 30 }];
    const columns = generateColumns(data) as any[];
    expect(columns).toHaveLength(3);
    expect(columns[0].accessorKey).toBe("id");
    expect(columns[1].accessorKey).toBe("name");
    expect(columns[2].accessorKey).toBe("age");
  });

  it("uses first row keys for column definitions", () => {
    const data = [
      { x: 1, y: 2 },
      { x: 3, y: 4, z: 5 }, // extra key ignored
    ];
    const columns = generateColumns(data);
    expect(columns).toHaveLength(2);
  });
});

describe("DataTable", () => {
  const sampleData = [
    { id: 1, name: "Alice", age: 30 },
    { id: 2, name: "Bob", age: 25 },
    { id: 3, name: "Charlie", age: 35 },
  ];

  it("renders table with data", () => {
    render(<DataTable data={sampleData} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("renders row count", () => {
    render(<DataTable data={sampleData} />);
    expect(screen.getByText("3 row(s)")).toBeInTheDocument();
  });

  it("renders 'No results' for empty data", () => {
    render(<DataTable data={[]} />);
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  it("renders filter input", () => {
    render(<DataTable data={sampleData} />);
    expect(
      screen.getByPlaceholderText("Filter results...")
    ).toBeInTheDocument();
  });

  it("filters data based on global filter", async () => {
    const user = userEvent.setup();
    render(<DataTable data={sampleData} />);

    const filterInput = screen.getByPlaceholderText("Filter results...");
    await user.type(filterInput, "Alice");

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(screen.getByText("1 row(s)")).toBeInTheDocument();
  });

  it("renders numeric values with locale formatting", () => {
    const data = [{ value: 1000000 }];
    render(<DataTable data={data} />);
    expect(screen.getByText("1,000,000")).toBeInTheDocument();
  });

  it("renders null values as dash", () => {
    const data = [{ value: null }];
    render(<DataTable data={data} />);
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders boolean values as Yes/No", () => {
    const data = [
      { active: true },
      { active: false },
    ];
    render(<DataTable data={data} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("renders object values as JSON", () => {
    const data = [{ nested: { key: "val" } }];
    render(<DataTable data={data} />);
    expect(screen.getByText('{"key":"val"}')).toBeInTheDocument();
  });

  it("renders pagination controls", () => {
    render(<DataTable data={sampleData} />);
    // Should show page info
    expect(screen.getByText(/1 \//)).toBeInTheDocument();
  });

  it("handles column sorting header rendering", () => {
    render(<DataTable data={sampleData} />);
    // Column headers should be rendered with capitalized names
    const nameButton = screen.getByText("Name");
    expect(nameButton).toBeInTheDocument();
  });
});
