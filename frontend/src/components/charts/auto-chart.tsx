"use client";

import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import type { ChartRecommendation } from "@/types/query-result";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface AutoChartProps {
  data: Record<string, unknown>[];
  config: ChartRecommendation;
}

export function AutoChart({ data, config }: AutoChartProps) {
  const chartConfig: ChartConfig = Object.fromEntries(
    config.yKeys.map((key, i) => [
      key,
      {
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        color: COLORS[i % COLORS.length],
      },
    ]),
  );

  switch (config.type) {
    case "bar":
      return (
        <ChartContainer config={chartConfig} className="min-h-[200px] sm:min-h-[300px] w-full">
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={config.xKey} tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {config.yKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={COLORS[i % COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ChartContainer>
      );

    case "line":
      return (
        <ChartContainer config={chartConfig} className="min-h-[200px] sm:min-h-[300px] w-full">
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={config.xKey} tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {config.yKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      );

    case "area":
      return (
        <ChartContainer config={chartConfig} className="min-h-[200px] sm:min-h-[300px] w-full">
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={config.xKey} tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {config.yKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                fill={COLORS[i % COLORS.length]}
                stroke={COLORS[i % COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      );

    case "pie":
      return (
        <ChartContainer config={chartConfig} className="min-h-[200px] sm:min-h-[300px] w-full">
          <PieChart accessibilityLayer>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie
              data={data}
              dataKey={config.yKeys[0]}
              nameKey={config.xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent />} />
          </PieChart>
        </ChartContainer>
      );

    default:
      return null;
  }
}
