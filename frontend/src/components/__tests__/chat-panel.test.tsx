import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ChatPanel } from "../chat-panel";

// Mock CopilotKit
jest.mock("@copilotkit/react-core", () => ({
  useCopilotChat: jest.fn().mockReturnValue({
    visibleMessages: [],
    isLoading: false,
  }),
}));

jest.mock("@copilotkit/react-ui", () => ({
  CopilotChat: ({ labels, className }: any) => (
    <div data-testid="copilot-chat" className={className}>
      <span>{labels?.title}</span>
      <span>{labels?.initial}</span>
      <span>{labels?.placeholder}</span>
    </div>
  ),
}));

import { useCopilotChat } from "@copilotkit/react-core";

describe("ChatPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows placeholder when not connected", () => {
    render(<ChatPanel isConnected={false} />);
    expect(
      screen.getByText("Connect to an API to start chatting")
    ).toBeInTheDocument();
  });

  it("renders CopilotChat when connected", () => {
    render(<ChatPanel isConnected={true} />);
    expect(screen.getByTestId("copilot-chat")).toBeInTheDocument();
  });

  it("displays chat title when connected", () => {
    render(<ChatPanel isConnected={true} />);
    expect(screen.getByText("API Agent")).toBeInTheDocument();
  });

  it("displays initial message when connected", () => {
    render(<ChatPanel isConnected={true} />);
    expect(
      screen.getByText(/Ask a question about your API/)
    ).toBeInTheDocument();
  });

  it("calls onDataReceived when assistant message arrives", () => {
    const mockOnDataReceived = jest.fn();
    const mockMessages = [
      {
        role: "assistant",
        content: '```json\n{"data":[{"id":1}]}\n```',
      },
    ];

    (useCopilotChat as jest.Mock).mockReturnValue({
      visibleMessages: mockMessages,
      isLoading: false,
    });

    render(
      <ChatPanel isConnected={true} onDataReceived={mockOnDataReceived} />
    );

    expect(mockOnDataReceived).toHaveBeenCalledWith(
      '```json\n{"data":[{"id":1}]}\n```'
    );
  });

  it("does not call onDataReceived while loading", () => {
    const mockOnDataReceived = jest.fn();
    (useCopilotChat as jest.Mock).mockReturnValue({
      visibleMessages: [{ role: "assistant", content: "data" }],
      isLoading: true,
    });

    render(
      <ChatPanel isConnected={true} onDataReceived={mockOnDataReceived} />
    );

    expect(mockOnDataReceived).not.toHaveBeenCalled();
  });

  it("does not call onDataReceived for user messages", () => {
    const mockOnDataReceived = jest.fn();
    (useCopilotChat as jest.Mock).mockReturnValue({
      visibleMessages: [{ role: "user", content: "hello" }],
      isLoading: false,
    });

    render(
      <ChatPanel isConnected={true} onDataReceived={mockOnDataReceived} />
    );

    expect(mockOnDataReceived).not.toHaveBeenCalled();
  });

  it("does not call onDataReceived when no messages", () => {
    const mockOnDataReceived = jest.fn();
    (useCopilotChat as jest.Mock).mockReturnValue({
      visibleMessages: [],
      isLoading: false,
    });

    render(
      <ChatPanel isConnected={true} onDataReceived={mockOnDataReceived} />
    );

    expect(mockOnDataReceived).not.toHaveBeenCalled();
  });
});
