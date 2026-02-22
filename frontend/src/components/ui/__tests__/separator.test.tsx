import "@testing-library/jest-dom";
import React from "react";
import { render } from "@testing-library/react";
import { Separator } from "../separator";

// Mock radix-ui
jest.mock("radix-ui", () => ({
  Separator: {
    Root: ({ orientation, decorative, ...props }: any) => (
      <div
        role="separator"
        data-orientation={orientation}
        aria-hidden={decorative}
        {...props}
      />
    ),
  },
}));

describe("Separator", () => {
  it("renders with data-slot", () => {
    const { container } = render(<Separator />);
    const sep = container.querySelector('[data-slot="separator"]');
    expect(sep).toBeInTheDocument();
  });

  it("renders horizontal by default", () => {
    const { container } = render(<Separator />);
    const sep = container.querySelector('[data-slot="separator"]');
    expect(sep).toHaveAttribute("data-orientation", "horizontal");
  });

  it("renders vertical orientation", () => {
    const { container } = render(<Separator orientation="vertical" />);
    const sep = container.querySelector('[data-slot="separator"]');
    expect(sep).toHaveAttribute("data-orientation", "vertical");
  });

  it("is decorative by default", () => {
    const { container } = render(<Separator />);
    const sep = container.querySelector('[data-slot="separator"]');
    expect(sep).toHaveAttribute("aria-hidden", "true");
  });

  it("applies custom className", () => {
    const { container } = render(<Separator className="my-class" />);
    const sep = container.querySelector('[data-slot="separator"]');
    expect(sep).toHaveClass("my-class");
  });
});
