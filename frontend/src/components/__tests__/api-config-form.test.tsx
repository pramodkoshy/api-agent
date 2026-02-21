import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiConfigForm } from "../api-config-form";

// Mock radix-ui Select components since they rely on portal
jest.mock("radix-ui", () => {
  const React = require("react");
  return {
    Slot: {
      Root: React.forwardRef(({ children, ...props }: any, ref: any) =>
        React.cloneElement(React.Children.only(children), { ...props, ref })
      ),
    },
    Select: {
      Root: ({ children, value, onValueChange, ...props }: any) => (
        <div data-slot="select" {...props}>
          {React.Children.map(children, (child: any) =>
            child
              ? React.cloneElement(child, { value, onValueChange })
              : null
          )}
        </div>
      ),
      Trigger: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <button ref={ref} data-slot="select-trigger" {...props}>
          {children}
        </button>
      )),
      Value: ({ placeholder, ...props }: any) => (
        <span data-slot="select-value" {...props}>{props.value || placeholder}</span>
      ),
      Content: ({ children }: any) => <div>{children}</div>,
      Item: ({ children, value, ...props }: any) => (
        <option value={value} {...props}>
          {children}
        </option>
      ),
      ItemText: ({ children }: any) => <span>{children}</span>,
      ItemIndicator: ({ children }: any) => <span>{children}</span>,
      Icon: ({ children }: any) => <span>{children}</span>,
      Portal: ({ children }: any) => <>{children}</>,
      Viewport: ({ children }: any) => <div>{children}</div>,
      ScrollUpButton: () => null,
      ScrollDownButton: () => null,
    },
    Label: {
      Root: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <label ref={ref} {...props}>{children}</label>
      )),
    },
  };
});

describe("ApiConfigForm", () => {
  const mockOnConnect = jest.fn();
  const mockOnDisconnect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders connection form", () => {
    render(
      <ApiConfigForm
        onConnect={mockOnConnect}
        isConnected={false}
        onDisconnect={mockOnDisconnect}
      />
    );

    expect(screen.getByText("API Connection")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/example\.com/)).toBeInTheDocument();
  });

  it("shows 'Add Another API' title when connected", () => {
    render(
      <ApiConfigForm
        onConnect={mockOnConnect}
        isConnected={true}
        onDisconnect={mockOnDisconnect}
      />
    );

    expect(screen.getByText("Add Another API")).toBeInTheDocument();
  });

  it("renders connect button when not connected", () => {
    render(
      <ApiConfigForm
        onConnect={mockOnConnect}
        isConnected={false}
        onDisconnect={mockOnDisconnect}
      />
    );

    expect(screen.getByText("Connect")).toBeInTheDocument();
  });

  it("renders add API button when connected", () => {
    render(
      <ApiConfigForm
        onConnect={mockOnConnect}
        isConnected={true}
        onDisconnect={mockOnDisconnect}
      />
    );

    expect(screen.getByText("Add API")).toBeInTheDocument();
  });

  it("disables submit button when URL is empty", () => {
    render(
      <ApiConfigForm
        onConnect={mockOnConnect}
        isConnected={false}
        onDisconnect={mockOnDisconnect}
      />
    );

    const submitButton = screen.getByText("Connect");
    expect(submitButton.closest("button")).toBeDisabled();
  });

  it("enables submit button when URL is filled", async () => {
    const user = userEvent.setup();
    render(
      <ApiConfigForm
        onConnect={mockOnConnect}
        isConnected={false}
        onDisconnect={mockOnDisconnect}
      />
    );

    const urlInput = screen.getByPlaceholderText(/example\.com/);
    await user.type(urlInput, "https://api.example.com/graphql");

    const submitButton = screen.getByText("Connect");
    expect(submitButton.closest("button")).not.toBeDisabled();
  });

  it("calls onConnect with correct config on submit", async () => {
    const user = userEvent.setup();
    render(
      <ApiConfigForm
        onConnect={mockOnConnect}
        isConnected={false}
        onDisconnect={mockOnDisconnect}
      />
    );

    const urlInput = screen.getByPlaceholderText(/example\.com/);
    await user.type(urlInput, "https://api.example.com/graphql");

    const submitButton = screen.getByText("Connect");
    await user.click(submitButton);

    expect(mockOnConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: "https://api.example.com/graphql",
        apiType: "graphql",
      })
    );
  });

  it("clears form after submit", async () => {
    const user = userEvent.setup();
    render(
      <ApiConfigForm
        onConnect={mockOnConnect}
        isConnected={false}
        onDisconnect={mockOnDisconnect}
      />
    );

    const urlInput = screen.getByPlaceholderText(/example\.com/) as HTMLInputElement;
    await user.type(urlInput, "https://api.example.com/graphql");
    await user.click(screen.getByText("Connect"));

    expect(urlInput.value).toBe("");
  });

  it("renders auth header input", () => {
    render(
      <ApiConfigForm
        onConnect={mockOnConnect}
        isConnected={false}
        onDisconnect={mockOnDisconnect}
      />
    );

    expect(
      screen.getByPlaceholderText(/Bearer your-token-here/)
    ).toBeInTheDocument();
  });

  it("toggles advanced settings", async () => {
    const user = userEvent.setup();
    render(
      <ApiConfigForm
        onConnect={mockOnConnect}
        isConnected={false}
        onDisconnect={mockOnDisconnect}
      />
    );

    // Advanced settings should be hidden initially
    expect(screen.queryByLabelText("API Name")).not.toBeInTheDocument();

    // Click "More" button
    await user.click(screen.getByText("More"));

    // Advanced settings should be visible
    expect(screen.getByPlaceholderText("my-api")).toBeInTheDocument();
  });

  it("includes auth header in config when provided", async () => {
    const user = userEvent.setup();
    render(
      <ApiConfigForm
        onConnect={mockOnConnect}
        isConnected={false}
        onDisconnect={mockOnDisconnect}
      />
    );

    await user.type(
      screen.getByPlaceholderText(/example\.com/),
      "https://api.example.com/graphql"
    );
    await user.type(
      screen.getByPlaceholderText(/Bearer your-token-here/),
      "Bearer mytoken"
    );
    await user.click(screen.getByText("Connect"));

    expect(mockOnConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        authHeader: "Bearer mytoken",
      })
    );
  });
});
