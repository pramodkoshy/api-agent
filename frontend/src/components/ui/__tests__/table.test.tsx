import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "../table";

describe("Table Components", () => {
  it("renders a complete table", () => {
    render(
      <Table>
        <TableCaption>A list of items</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Item 1</TableCell>
            <TableCell>100</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>100</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );

    expect(screen.getByText("A list of items")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  describe("Table", () => {
    it("renders with data-slot", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Test</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );
      expect(screen.getByRole("table")).toHaveAttribute("data-slot", "table");
    });

    it("wraps in overflow container", () => {
      const { container } = render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Test</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveAttribute("data-slot", "table-container");
    });
  });

  describe("TableHeader", () => {
    it("renders thead with data-slot", () => {
      render(
        <table>
          <TableHeader data-testid="thead">
            <tr>
              <th>Header</th>
            </tr>
          </TableHeader>
        </table>
      );
      expect(screen.getByTestId("thead")).toHaveAttribute(
        "data-slot",
        "table-header"
      );
    });
  });

  describe("TableBody", () => {
    it("renders tbody with data-slot", () => {
      render(
        <table>
          <TableBody data-testid="tbody">
            <tr>
              <td>Cell</td>
            </tr>
          </TableBody>
        </table>
      );
      expect(screen.getByTestId("tbody")).toHaveAttribute(
        "data-slot",
        "table-body"
      );
    });
  });

  describe("TableRow", () => {
    it("renders tr with data-slot", () => {
      render(
        <table>
          <tbody>
            <TableRow data-testid="row">
              <td>Cell</td>
            </TableRow>
          </tbody>
        </table>
      );
      expect(screen.getByTestId("row")).toHaveAttribute(
        "data-slot",
        "table-row"
      );
    });
  });

  describe("TableHead", () => {
    it("renders th with data-slot", () => {
      render(
        <table>
          <thead>
            <tr>
              <TableHead>Header</TableHead>
            </tr>
          </thead>
        </table>
      );
      expect(screen.getByText("Header")).toHaveAttribute(
        "data-slot",
        "table-head"
      );
    });
  });

  describe("TableCell", () => {
    it("renders td with data-slot", () => {
      render(
        <table>
          <tbody>
            <tr>
              <TableCell>Cell</TableCell>
            </tr>
          </tbody>
        </table>
      );
      expect(screen.getByText("Cell")).toHaveAttribute(
        "data-slot",
        "table-cell"
      );
    });
  });

  describe("TableCaption", () => {
    it("renders caption with data-slot", () => {
      render(
        <table>
          <TableCaption>Caption</TableCaption>
          <tbody>
            <tr>
              <td>Cell</td>
            </tr>
          </tbody>
        </table>
      );
      expect(screen.getByText("Caption")).toHaveAttribute(
        "data-slot",
        "table-caption"
      );
    });
  });
});
