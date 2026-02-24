"use client";

interface Citation {
  source: string;
  url?: string;
  text: string;
  score: number;
}

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export function CitationCard({ citation, index }: CitationCardProps) {
  return (
    <div className="rounded-md border p-3 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-muted rounded px-1.5 py-0.5">
            Source {index}
          </span>
          <span className="text-sm font-medium">{citation.source}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {Math.round(citation.score * 100)}% match
        </span>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-3">{citation.text}</p>
      {citation.url && (
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          {citation.url}
        </a>
      )}
    </div>
  );
}
