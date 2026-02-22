import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "../card";

describe("Card Components", () => {
  describe("Card", () => {
    it("renders with data-slot", () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId("card");
      expect(card).toHaveAttribute("data-slot", "card");
    });

    it("applies custom className", () => {
      render(
        <Card className="custom-class" data-testid="card">
          Content
        </Card>
      );
      expect(screen.getByTestId("card")).toHaveClass("custom-class");
    });
  });

  describe("CardHeader", () => {
    it("renders with data-slot", () => {
      render(<CardHeader data-testid="header">Header</CardHeader>);
      expect(screen.getByTestId("header")).toHaveAttribute(
        "data-slot",
        "card-header"
      );
    });
  });

  describe("CardTitle", () => {
    it("renders title text", () => {
      render(<CardTitle>My Title</CardTitle>);
      expect(screen.getByText("My Title")).toBeInTheDocument();
      expect(screen.getByText("My Title")).toHaveAttribute(
        "data-slot",
        "card-title"
      );
    });
  });

  describe("CardDescription", () => {
    it("renders description text", () => {
      render(<CardDescription>A description</CardDescription>);
      expect(screen.getByText("A description")).toBeInTheDocument();
      expect(screen.getByText("A description")).toHaveAttribute(
        "data-slot",
        "card-description"
      );
    });
  });

  describe("CardContent", () => {
    it("renders content with data-slot", () => {
      render(<CardContent data-testid="content">Body</CardContent>);
      expect(screen.getByTestId("content")).toHaveAttribute(
        "data-slot",
        "card-content"
      );
    });
  });

  describe("CardFooter", () => {
    it("renders footer with data-slot", () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      expect(screen.getByTestId("footer")).toHaveAttribute(
        "data-slot",
        "card-footer"
      );
    });
  });

  describe("CardAction", () => {
    it("renders action with data-slot", () => {
      render(<CardAction data-testid="action">Action</CardAction>);
      expect(screen.getByTestId("action")).toHaveAttribute(
        "data-slot",
        "card-action"
      );
    });
  });

  describe("Full Card composition", () => {
    it("renders a complete card", () => {
      render(
        <Card data-testid="full-card">
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content body</CardContent>
          <CardFooter>Footer content</CardFooter>
        </Card>
      );

      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("Content body")).toBeInTheDocument();
      expect(screen.getByText("Footer content")).toBeInTheDocument();
    });
  });
});
