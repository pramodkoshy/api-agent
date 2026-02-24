"use client";

import { useState } from "react";
import { KnowledgeStats } from "./knowledge-stats";
import { IngestionForm } from "./ingestion-form";
import { IngestionStatus } from "./ingestion-status";
import { GraphExplorer } from "./graph-explorer";
import { SynthesisChat } from "./synthesis-chat";
import { CitationCard } from "./citation-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GraphData {
  nodes: Array<{ id: string; label: string; type: string }>;
  edges: Array<{ from: string; to: string; label: string }>;
}

interface Citation {
  source: string;
  url?: string;
  text: string;
  score: number;
}

interface SynthesisResult {
  answer: string;
  citations: Citation[];
  entities: Array<{ name: string; type: string; relation?: string }>;
  graphData: GraphData;
  confidence: number;
}

export function KnowledgePage() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  const handleIngestionStarted = (jobId: string) => {
    setCurrentJobId(jobId);
  };

  const handleSynthesisResult = (result: SynthesisResult) => {
    setSynthesisResult(result);
    if (result.graphData?.nodes?.length > 0) {
      setGraphData(result.graphData);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b">
        <KnowledgeStats />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Ingestion + Chat */}
        <div className="flex flex-col w-full lg:w-[420px] border-b lg:border-b-0 lg:border-r overflow-hidden min-h-0">
          <div className="p-3 border-b space-y-3">
            <IngestionForm onIngestionStarted={handleIngestionStarted} />
            {currentJobId && <IngestionStatus jobId={currentJobId} />}
          </div>
          <div className="flex-1 overflow-hidden min-h-[250px]">
            <SynthesisChat onResult={handleSynthesisResult} />
          </div>
        </div>

        {/* Right: Results */}
        <main className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
          {synthesisResult ? (
            <Tabs defaultValue="synthesis" className="w-full">
              <TabsList>
                <TabsTrigger value="synthesis">Synthesis</TabsTrigger>
                <TabsTrigger value="graph">Graph</TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
              </TabsList>

              <TabsContent value="synthesis" className="space-y-3">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">Answer</span>
                    <span className="text-xs text-muted-foreground">
                      Confidence: {Math.round(synthesisResult.confidence * 100)}%
                    </span>
                  </div>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {synthesisResult.answer}
                  </div>
                  {synthesisResult.entities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {synthesisResult.entities.map((e, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                        >
                          {e.name}
                          <span className="ml-1 text-muted-foreground">({e.type})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="graph">
                {graphData && graphData.nodes.length > 0 ? (
                  <GraphExplorer data={graphData} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No graph data available for this query
                  </p>
                )}
              </TabsContent>

              <TabsContent value="sources" className="space-y-2">
                {synthesisResult.citations.map((citation, i) => (
                  <CitationCard key={i} citation={citation} index={i + 1} />
                ))}
                {synthesisResult.citations.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No sources found
                  </p>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <div className="text-center space-y-1">
                <p className="text-sm">
                  Ingest content and ask questions to see synthesized answers
                </p>
                <p className="text-xs opacity-60">
                  Results include citations, entity graphs, and confidence scores
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
