import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "../textarea";

describe("Textarea", () => {
  it("renders with data-slot", () => {
    render(<Textarea data-testid="textarea" />);
    expect(screen.getByTestId("textarea")).toHaveAttribute(
      "data-slot",
      "textarea"
    );
  });

  it("renders with placeholder", () => {
    render(<Textarea placeholder="Enter text..." />);
    expect(screen.getByPlaceholderText("Enter text...")).toBeInTheDocument();
  });

  it("handles text input", async () => {
    const user = userEvent.setup();
    render(<Textarea data-testid="textarea" />);

    const textarea = screen.getByTestId("textarea");
    await user.type(textarea, "hello world");
    expect(textarea).toHaveValue("hello world");
  });

  it("applies custom className", () => {
    render(<Textarea className="custom" data-testid="textarea" />);
    expect(screen.getByTestId("textarea")).toHaveClass("custom");
  });

  it("renders disabled state", () => {
    render(<Textarea disabled data-testid="textarea" />);
    expect(screen.getByTestId("textarea")).toBeDisabled();
  });

  it("handles onChange", async () => {
    const handleChange = jest.fn();
    const user = userEvent.setup();
    render(<Textarea onChange={handleChange} data-testid="textarea" />);

    await user.type(screen.getByTestId("textarea"), "a");
    expect(handleChange).toHaveBeenCalled();
  });
});
