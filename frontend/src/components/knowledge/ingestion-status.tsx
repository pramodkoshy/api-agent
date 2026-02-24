"use client";

import { useEffect, useState } from "react";

interface Job {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: {
    total: number;
    processed: number;
    failed: number;
  };
  error?: string;
}

interface IngestionStatusProps {
  jobId: string;
}

export function IngestionStatus({ jobId }: IngestionStatusProps) {
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/knowledge/ingest/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          setJob(data);

          // Stop polling when done
          if (data.status === "completed" || data.status === "failed") {
            clearInterval(interval);
          }
        }
      } catch {
        // Ignore fetch errors during polling
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  if (!job) return null;

  const statusColors: Record<string, string> = {
    queued: "text-yellow-500",
    running: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
  };

  const progress = job.progress.total > 0
    ? Math.round((job.progress.processed / job.progress.total) * 100)
    : 0;

  return (
    <div className="rounded-md border p-2 text-xs space-y-1">
      <div className="flex items-center justify-between">
        <span>Job: {job.id}</span>
        <span className={statusColors[job.status] || ""}>
          {job.status.toUpperCase()}
        </span>
      </div>
      {job.status === "running" && (
        <div className="space-y-1">
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-muted-foreground">
            {job.progress.processed}/{job.progress.total} processed
            {job.progress.failed > 0 && `, ${job.progress.failed} failed`}
          </span>
        </div>
      )}
      {job.error && <p className="text-destructive">{job.error}</p>}
    </div>
  );
}
