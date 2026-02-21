import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { Badge, badgeVariants } from "../badge";

// Mock radix-ui Slot
jest.mock("radix-ui", () => {
  const React = require("react");
  return {
    Slot: {
      Root: React.forwardRef(({ children, ...props }: any, ref: any) =>
        React.cloneElement(React.Children.only(children), { ...props, ref })
      ),
    },
  };
});

describe("Badge", () => {
  it("renders with default variant", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge).toHaveAttribute("data-variant", "default");
  });

  it("renders with outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText("Outline")).toHaveAttribute(
      "data-variant",
      "outline"
    );
  });

  it("renders with secondary variant", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    expect(screen.getByText("Secondary")).toHaveAttribute(
      "data-variant",
      "secondary"
    );
  });

  it("renders with destructive variant", () => {
    render(<Badge variant="destructive">Error</Badge>);
    expect(screen.getByText("Error")).toHaveAttribute(
      "data-variant",
      "destructive"
    );
  });

  it("renders as span by default", () => {
    render(<Badge>Test</Badge>);
    expect(screen.getByText("Test").tagName).toBe("SPAN");
  });

  it("applies custom className", () => {
    render(<Badge className="custom-class">Custom</Badge>);
    expect(screen.getByText("Custom")).toHaveClass("custom-class");
  });

  it("renders as child when asChild", () => {
    render(
      <Badge asChild>
        <a href="/test">Link Badge</a>
      </Badge>
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("data-slot", "badge");
  });

  it("has all variant options", () => {
    const variants = [
      "default",
      "secondary",
      "destructive",
      "outline",
      "ghost",
      "link",
    ];
    variants.forEach((variant) => {
      const result = badgeVariants({ variant: variant as any });
      expect(typeof result).toBe("string");
    });
  });
});
