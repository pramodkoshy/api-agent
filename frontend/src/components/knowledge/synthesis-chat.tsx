"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SynthesisResult {
  answer: string;
  citations: Array<{ source: string; url?: string; text: string; score: number }>;
  entities: Array<{ name: string; type: string; relation?: string }>;
  graphData: {
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ from: string; to: string; label: string }>;
  };
  confidence: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  synthesisResult?: SynthesisResult;
}

interface SynthesisChatProps {
  onResult: (result: SynthesisResult) => void;
}

export function SynthesisChat({ onResult }: SynthesisChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const query = input.trim();
    setInput("");

    const userMessage: Message = { role: "user", content: query };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch("/api/knowledge/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, topK: 10 }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const result: SynthesisResult = await res.json();
      onResult(result);

      const assistantMessage: Message = {
        role: "assistant",
        content: result.answer,
        synthesisResult: result,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Query failed"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-muted-foreground text-center mt-8">
            Ask questions about your knowledge base
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm ${
              msg.role === "user"
                ? "bg-primary/10 rounded-lg p-2"
                : "border rounded-lg p-2"
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground mb-1">
              {msg.role === "user" ? "You" : "Knowledge Agent"}
            </div>
            <div className="whitespace-pre-wrap">{msg.content}</div>
            {msg.synthesisResult && (
              <div className="mt-1 text-xs text-muted-foreground">
                {msg.synthesisResult.citations.length} sources &middot;{" "}
                {Math.round(msg.synthesisResult.confidence * 100)}% confidence
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-sm text-muted-foreground animate-pulse p-2">
            Searching knowledge base and synthesizing answer...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t p-2 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your knowledge base..."
          className="text-sm"
          disabled={loading}
        />
        <Button type="submit" size="sm" disabled={loading || !input.trim()}>
          Ask
        </Button>
      </form>
    </div>
  );
}
