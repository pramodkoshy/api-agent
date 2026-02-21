"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { AutoChart } from "@/components/charts/auto-chart";
import type { StructuredData } from "@/types/query-result";
import { TableIcon, BarChart3 } from "lucide-react";

interface DataDisplayProps {
  result: StructuredData;
}

export function DataDisplay({ result }: DataDisplayProps) {
  const hasChart = result.chartConfig && result.type !== "table";
  const defaultTab = result.type === "chart" ? "chart" : "table";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {result.data.length} row(s) returned
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasChart ? (
          <Tabs defaultValue={defaultTab}>
            <TabsList className="mb-2">
              <TabsTrigger value="table" className="gap-1.5">
                <TableIcon className="h-3.5 w-3.5" />
                Table
              </TabsTrigger>
              <TabsTrigger value="chart" className="gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Chart
              </TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              <DataTable data={result.data} />
            </TabsContent>
            <TabsContent value="chart">
              {result.chartConfig && (
                <AutoChart data={result.data} config={result.chartConfig} />
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <DataTable data={result.data} />
        )}
      </CardContent>
    </Card>
  );
}
