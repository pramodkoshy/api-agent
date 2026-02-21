import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";

describe("Input", () => {
  it("renders with data-slot", () => {
    render(<Input data-testid="input" />);
    expect(screen.getByTestId("input")).toHaveAttribute("data-slot", "input");
  });

  it("renders with type", () => {
    render(<Input type="password" data-testid="input" />);
    expect(screen.getByTestId("input")).toHaveAttribute("type", "password");
  });

  it("renders with placeholder", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("handles text input", async () => {
    const user = userEvent.setup();
    render(<Input data-testid="input" />);

    const input = screen.getByTestId("input");
    await user.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  it("handles onChange event", async () => {
    const handleChange = jest.fn();
    const user = userEvent.setup();
    render(<Input onChange={handleChange} data-testid="input" />);

    await user.type(screen.getByTestId("input"), "a");
    expect(handleChange).toHaveBeenCalled();
  });

  it("applies custom className", () => {
    render(<Input className="custom" data-testid="input" />);
    expect(screen.getByTestId("input")).toHaveClass("custom");
  });

  it("renders disabled state", () => {
    render(<Input disabled data-testid="input" />);
    expect(screen.getByTestId("input")).toBeDisabled();
  });

  it("renders with value", () => {
    render(
      <Input value="preset" onChange={() => {}} data-testid="input" />
    );
    expect(screen.getByTestId("input")).toHaveValue("preset");
  });
});
