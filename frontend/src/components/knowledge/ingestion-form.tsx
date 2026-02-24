"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface IngestionFormProps {
  onIngestionStarted: (jobId: string) => void;
}

export function IngestionForm({ onIngestionStarted }: IngestionFormProps) {
  const [urls, setUrls] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urls.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const urlList = urls
        .split(/[,\n]/)
        .map((u) => u.trim())
        .filter(Boolean);

      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: urlList,
          crawlDepth: 1,
          tags: tagList,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      onIngestionStarted(data.jobId);
      setUrls("");
      setTags("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div>
        <Label htmlFor="urls" className="text-xs">URLs to Ingest</Label>
        <Input
          id="urls"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="https://example.com, https://other.com"
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Comma or newline separated URLs
        </p>
      </div>

      <div>
        <Label htmlFor="tags" className="text-xs">Tags (optional)</Label>
        <Input
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="technology, news"
          className="text-sm"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" size="sm" disabled={loading || !urls.trim()}>
        {loading ? "Ingesting..." : "Ingest"}
      </Button>
    </form>
  );
}
