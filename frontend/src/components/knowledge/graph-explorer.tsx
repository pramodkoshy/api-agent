"use client";

import { useEffect, useRef } from "react";

interface GraphData {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ from: string; to: string; label: string }>;
}

const COLOR_MAP: Record<string, string> = {
  Person: "#6366f1",
  Organization: "#22c55e",
  Location: "#f59e0b",
  Event: "#ef4444",
  Product: "#3b82f6",
  Technology: "#8b5cf6",
  Topic: "#ec4899",
  Document: "#64748b",
  Concept: "#14b8a6",
};

export function GraphExplorer({ data }: { data: GraphData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data.nodes.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const width = canvas.width;
    const height = canvas.height;

    // Simple force-directed layout
    const positions = new Map<string, { x: number; y: number }>();
    const nodeRadius = 20;

    // Initialize positions in a circle
    data.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / data.nodes.length;
      const radius = Math.min(width, height) * 0.35;
      positions.set(node.id, {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
      });
    });

    // Simple force simulation (50 iterations)
    for (let iter = 0; iter < 50; iter++) {
      // Repulsion between all nodes
      for (let i = 0; i < data.nodes.length; i++) {
        for (let j = i + 1; j < data.nodes.length; j++) {
          const p1 = positions.get(data.nodes[i].id)!;
          const p2 = positions.get(data.nodes[j].id)!;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 5000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          p1.x -= fx;
          p1.y -= fy;
          p2.x += fx;
          p2.y += fy;
        }
      }

      // Attraction along edges
      for (const edge of data.edges) {
        const p1 = positions.get(edge.from);
        const p2 = positions.get(edge.to);
        if (!p1 || !p2) continue;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = (dist - 100) * 0.01;
        const fx = (dx / Math.max(dist, 1)) * force;
        const fy = (dy / Math.max(dist, 1)) * force;
        p1.x += fx;
        p1.y += fy;
        p2.x -= fx;
        p2.y -= fy;
      }

      // Keep within bounds
      for (const pos of positions.values()) {
        pos.x = Math.max(nodeRadius, Math.min(width - nodeRadius, pos.x));
        pos.y = Math.max(nodeRadius, Math.min(height - nodeRadius, pos.y));
      }
    }

    // Draw
    ctx.clearRect(0, 0, width, height);

    // Draw edges
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    for (const edge of data.edges) {
      const p1 = positions.get(edge.from);
      const p2 = positions.get(edge.to);
      if (!p1 || !p2) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Edge label
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.fillStyle = "#64748b";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(edge.label, midX, midY - 4);
    }

    // Draw nodes
    for (const node of data.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const color = COLOR_MAP[node.type] || "#94a3b8";

      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Node label
      ctx.fillStyle = "#0f172a";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const label = node.label.length > 12 ? node.label.slice(0, 11) + "..." : node.label;
      ctx.fillText(label, pos.x, pos.y + nodeRadius + 14);
    }

    // Legend
    const types = [...new Set(data.nodes.map((n) => n.type))];
    ctx.font = "10px sans-serif";
    types.forEach((type, i) => {
      const x = 10;
      const y = 16 + i * 18;
      ctx.beginPath();
      ctx.arc(x + 6, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = COLOR_MAP[type] || "#94a3b8";
      ctx.fill();
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(type, x + 16, y);
    });
  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-[500px] border rounded-lg relative">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
