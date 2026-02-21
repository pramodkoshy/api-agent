/**
 * Mastra tools for:
 * 1. Querying APIs via the Agoda MCP service (dynamic per-session)
 * 2. Saving/retrieving/combining results in MongoDB
 */
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  saveDataset,
  listDatasets,
  getDatasetByName,
  deleteDataset,
} from "@/lib/mongodb";

// ---------- MongoDB Tools ----------

export const saveResultsTool = createTool({
  id: "save_results",
  description:
    "Save API query results to the local MongoDB store for later retrieval, combination, or charting. " +
    "Provide a descriptive name, the source API info, the original query, and the data rows.",
  inputSchema: z.object({
    name: z.string().describe("A short descriptive name for this dataset (e.g. 'bangkok_hotels', 'user_orders')"),
    sourceApi: z.string().describe("The API URL or name this data came from"),
    apiType: z.string().describe("'graphql' or 'rest'"),
    query: z.string().describe("The original natural language query that produced this data"),
    data: z.array(z.record(z.unknown())).describe("Array of data row objects"),
    tags: z.array(z.string()).optional().describe("Optional tags for organization"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    datasetId: z.string().optional(),
    message: z.string(),
  }),
  execute: async (input) => {
    try {
      const columns = input.data.length > 0 ? Object.keys(input.data[0]) : [];
      const id = await saveDataset({
        name: input.name,
        sourceApi: input.sourceApi,
        apiType: input.apiType,
        query: input.query,
        data: input.data,
        columns,
        rowCount: input.data.length,
        tags: input.tags || [],
      });
      return {
        success: true,
        datasetId: id,
        message: `Saved ${input.data.length} rows as "${input.name}" (ID: ${id})`,
      };
    } catch (error) {
      return { success: false, message: `Failed to save: ${error}` };
    }
  },
});

export const listDatasetsTool = createTool({
  id: "list_datasets",
  description:
    "List all datasets stored in the local MongoDB store. " +
    "Shows name, source API, query, row count, columns, and creation date. Does not return actual data rows.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    datasets: z.array(z.object({
      name: z.string(),
      sourceApi: z.string(),
      apiType: z.string(),
      query: z.string(),
      columns: z.array(z.string()),
      rowCount: z.number(),
      createdAt: z.string(),
      tags: z.array(z.string()),
    })),
  }),
  execute: async () => {
    const datasets = await listDatasets();
    return {
      datasets: datasets.map((d) => ({
        name: d.name,
        sourceApi: d.sourceApi,
        apiType: d.apiType,
        query: d.query,
        columns: d.columns,
        rowCount: d.rowCount,
        createdAt: d.createdAt?.toISOString?.() || String(d.createdAt),
        tags: d.tags || [],
      })),
    };
  },
});

export const retrieveDatasetTool = createTool({
  id: "retrieve_dataset",
  description:
    "Retrieve a stored dataset from MongoDB by name. Returns all data rows. " +
    "Use this to access previously saved results for charting, combining, or further analysis.",
  inputSchema: z.object({
    name: z.string().describe("Name of the dataset to retrieve"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.array(z.record(z.unknown())).optional(),
    columns: z.array(z.string()).optional(),
    rowCount: z.number().optional(),
    sourceApi: z.string().optional(),
    query: z.string().optional(),
    message: z.string().optional(),
  }),
  execute: async (input) => {
    const dataset = await getDatasetByName(input.name);
    if (!dataset) {
      return { success: false, message: `Dataset "${input.name}" not found` };
    }
    return {
      success: true,
      data: dataset.data,
      columns: dataset.columns,
      rowCount: dataset.rowCount,
      sourceApi: dataset.sourceApi,
      query: dataset.query,
    };
  },
});

export const combineDatasetsTool = createTool({
  id: "combine_datasets",
  description:
    "Combine two stored datasets from MongoDB into a new dataset. " +
    "Supports 'union' (append rows) or 'join' (merge on a common key) strategies. " +
    "The combined result is saved as a new dataset.",
  inputSchema: z.object({
    dataset1: z.string().describe("Name of the first dataset"),
    dataset2: z.string().describe("Name of the second dataset"),
    outputName: z.string().describe("Name for the combined output dataset"),
    strategy: z.enum(["union", "join"]).describe("How to combine: 'union' appends rows, 'join' merges on joinKey"),
    joinKey: z.string().optional().describe("Column name to join on (required if strategy is 'join')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    datasetId: z.string().optional(),
    rowCount: z.number().optional(),
    columns: z.array(z.string()).optional(),
    message: z.string(),
  }),
  execute: async (input) => {
    const ds1 = await getDatasetByName(input.dataset1);
    const ds2 = await getDatasetByName(input.dataset2);
    if (!ds1) return { success: false, message: `Dataset "${input.dataset1}" not found` };
    if (!ds2) return { success: false, message: `Dataset "${input.dataset2}" not found` };

    let combined: Record<string, unknown>[];

    if (input.strategy === "union") {
      combined = [...ds1.data, ...ds2.data];
    } else {
      const key = input.joinKey;
      if (!key) return { success: false, message: "joinKey is required for 'join' strategy" };

      const lookup = new Map<string, Record<string, unknown>>();
      for (const row of ds2.data) {
        const k = String(row[key] ?? "");
        lookup.set(k, row);
      }
      combined = ds1.data
        .filter((row) => lookup.has(String(row[key] ?? "")))
        .map((row) => ({
          ...row,
          ...lookup.get(String(row[key] ?? "")),
        }));
    }

    const columns = combined.length > 0 ? Object.keys(combined[0]) : [];
    const id = await saveDataset({
      name: input.outputName,
      sourceApi: `${ds1.sourceApi} + ${ds2.sourceApi}`,
      apiType: "combined",
      query: `Combined "${input.dataset1}" and "${input.dataset2}" via ${input.strategy}`,
      data: combined,
      columns,
      rowCount: combined.length,
      tags: ["combined"],
    });

    return {
      success: true,
      datasetId: id,
      rowCount: combined.length,
      columns,
      message: `Combined ${ds1.rowCount} + ${ds2.rowCount} rows → ${combined.length} rows as "${input.outputName}"`,
    };
  },
});

export const deleteDatasetTool = createTool({
  id: "delete_dataset",
  description: "Delete a stored dataset from MongoDB by name.",
  inputSchema: z.object({
    name: z.string().describe("Name of the dataset to delete"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (input) => {
    const deleted = await deleteDataset(input.name);
    return {
      success: deleted,
      message: deleted ? `Deleted "${input.name}"` : `Dataset "${input.name}" not found`,
    };
  },
});

/** All MongoDB storage tools. */
export const storageTools = {
  save_results: saveResultsTool,
  list_datasets: listDatasetsTool,
  retrieve_dataset: retrieveDatasetTool,
  combine_datasets: combineDatasetsTool,
  delete_dataset: deleteDatasetTool,
};
