"use client";

import { useEffect, useState } from "react";

interface Stats {
  documents: number;
  entities: number;
  graphNodes: number;
  graphRelationships: number;
  vectors: number;
  ingestionJobs: number;
}

export function KnowledgeStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/knowledge/status/stats");
        if (res.ok) {
          setStats(await res.json());
          setError(null);
        } else {
          setError("Unable to load stats");
        }
      } catch {
        setError("Knowledge worker unavailable");
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="text-xs text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!stats) {
    return <div className="text-xs text-muted-foreground">Loading stats...</div>;
  }

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
      <span>Documents: <strong className="text-foreground">{stats.documents.toLocaleString()}</strong></span>
      <span>Entities: <strong className="text-foreground">{stats.entities.toLocaleString()}</strong></span>
      <span>Graph Nodes: <strong className="text-foreground">{stats.graphNodes.toLocaleString()}</strong></span>
      <span>Relations: <strong className="text-foreground">{stats.graphRelationships.toLocaleString()}</strong></span>
      <span>Vectors: <strong className="text-foreground">{stats.vectors.toLocaleString()}</strong></span>
    </div>
  );
}
