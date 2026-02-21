/**
 * Tests for Mastra MongoDB storage tools.
 */

// Mock MongoDB
const mockSaveDataset = jest.fn();
const mockListDatasets = jest.fn();
const mockGetDatasetByName = jest.fn();
const mockDeleteDataset = jest.fn();

jest.mock("@/lib/mongodb", () => ({
  saveDataset: (...args: any[]) => mockSaveDataset(...args),
  listDatasets: (...args: any[]) => mockListDatasets(...args),
  getDatasetByName: (...args: any[]) => mockGetDatasetByName(...args),
  deleteDataset: (...args: any[]) => mockDeleteDataset(...args),
}));

jest.mock("@mastra/core/tools", () => ({
  createTool: (config: any) => ({
    ...config,
    execute: config.execute,
  }),
}));

jest.mock("zod", () => {
  const mockZodChain: any = {
    describe: () => mockZodChain,
    optional: () => mockZodChain,
  };
  return {
    z: {
      object: (shape: any) => ({ shape, parse: (v: any) => v }),
      string: () => mockZodChain,
      number: () => mockZodChain,
      boolean: () => mockZodChain,
      array: () => mockZodChain,
      record: () => mockZodChain,
      unknown: () => mockZodChain,
      enum: () => mockZodChain,
    },
  };
});

import {
  saveResultsTool,
  listDatasetsTool,
  retrieveDatasetTool,
  combineDatasetsTool,
  deleteDatasetTool,
  storageTools,
} from "../tools";

// Helper to call tool.execute with mocked createTool shape (bypasses Mastra's type constraints)
const exec = (tool: any, input: any): Promise<any> => tool.execute(input);

describe("storageTools", () => {
  it("exports all five tools", () => {
    expect(storageTools).toHaveProperty("save_results");
    expect(storageTools).toHaveProperty("list_datasets");
    expect(storageTools).toHaveProperty("retrieve_dataset");
    expect(storageTools).toHaveProperty("combine_datasets");
    expect(storageTools).toHaveProperty("delete_dataset");
  });
});

describe("saveResultsTool", () => {
  beforeEach(() => jest.clearAllMocks());

  it("saves dataset and returns success", async () => {
    mockSaveDataset.mockResolvedValue("id123");

    const result = await exec(saveResultsTool,{
      name: "test_ds",
      sourceApi: "https://api.com",
      apiType: "graphql",
      query: "list users",
      data: [{ id: 1, name: "Alice" }],
      tags: ["test"],
    });

    expect(result.success).toBe(true);
    expect(result.datasetId).toBe("id123");
    expect(result.message).toContain("Saved 1 rows");
    expect(mockSaveDataset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "test_ds",
        columns: ["id", "name"],
        rowCount: 1,
      })
    );
  });

  it("handles save errors", async () => {
    mockSaveDataset.mockRejectedValue(new Error("DB error"));

    const result = await exec(saveResultsTool,{
      name: "test_ds",
      sourceApi: "https://api.com",
      apiType: "graphql",
      query: "list users",
      data: [{ id: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Failed to save");
  });

  it("handles empty data array", async () => {
    mockSaveDataset.mockResolvedValue("id456");

    const result = await exec(saveResultsTool,{
      name: "empty_ds",
      sourceApi: "https://api.com",
      apiType: "rest",
      query: "nothing",
      data: [],
    });

    expect(result.success).toBe(true);
    expect(mockSaveDataset).toHaveBeenCalledWith(
      expect.objectContaining({ columns: [], rowCount: 0 })
    );
  });
});

describe("listDatasetsTool", () => {
  it("returns list of datasets", async () => {
    mockListDatasets.mockResolvedValue([
      {
        name: "ds1",
        sourceApi: "api1",
        apiType: "graphql",
        query: "q1",
        columns: ["id"],
        rowCount: 5,
        createdAt: new Date("2024-01-01"),
        tags: ["tag1"],
      },
    ]);

    const result = await exec(listDatasetsTool,{});

    expect(result.datasets).toHaveLength(1);
    expect(result.datasets[0].name).toBe("ds1");
    expect(result.datasets[0].createdAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("handles createdAt without toISOString", async () => {
    mockListDatasets.mockResolvedValue([
      {
        name: "ds1",
        sourceApi: "api1",
        apiType: "graphql",
        query: "q1",
        columns: [],
        rowCount: 0,
        createdAt: "2024-01-01",
        tags: [],
      },
    ]);

    const result = await exec(listDatasetsTool,{});
    expect(result.datasets[0].createdAt).toBe("2024-01-01");
  });
});

describe("retrieveDatasetTool", () => {
  it("returns dataset when found", async () => {
    mockGetDatasetByName.mockResolvedValue({
      name: "ds1",
      data: [{ id: 1 }],
      columns: ["id"],
      rowCount: 1,
      sourceApi: "api1",
      query: "q1",
    });

    const result = await exec(retrieveDatasetTool,{ name: "ds1" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1 }]);
  });

  it("returns failure when not found", async () => {
    mockGetDatasetByName.mockResolvedValue(null);

    const result = await exec(retrieveDatasetTool,{ name: "missing" });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});

describe("combineDatasetsTool", () => {
  beforeEach(() => jest.clearAllMocks());

  it("combines datasets with union strategy", async () => {
    mockGetDatasetByName
      .mockResolvedValueOnce({
        name: "ds1",
        data: [{ id: 1 }],
        sourceApi: "api1",
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        name: "ds2",
        data: [{ id: 2 }],
        sourceApi: "api2",
        rowCount: 1,
      });
    mockSaveDataset.mockResolvedValue("combined_id");

    const result = await exec(combineDatasetsTool,{
      dataset1: "ds1",
      dataset2: "ds2",
      outputName: "combined",
      strategy: "union",
    });

    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(2);
  });

  it("combines datasets with join strategy", async () => {
    mockGetDatasetByName
      .mockResolvedValueOnce({
        name: "ds1",
        data: [
          { id: "1", name: "Alice" },
          { id: "2", name: "Bob" },
        ],
        sourceApi: "api1",
        rowCount: 2,
      })
      .mockResolvedValueOnce({
        name: "ds2",
        data: [
          { id: "1", score: 100 },
          { id: "3", score: 200 },
        ],
        sourceApi: "api2",
        rowCount: 2,
      });
    mockSaveDataset.mockResolvedValue("joined_id");

    const result = await exec(combineDatasetsTool,{
      dataset1: "ds1",
      dataset2: "ds2",
      outputName: "joined",
      strategy: "join",
      joinKey: "id",
    });

    expect(result.success).toBe(true);
    expect(result.rowCount).toBe(1); // Only id=1 matches
  });

  it("requires joinKey for join strategy", async () => {
    mockGetDatasetByName
      .mockResolvedValueOnce({ name: "ds1", data: [] })
      .mockResolvedValueOnce({ name: "ds2", data: [] });

    const result = await exec(combineDatasetsTool,{
      dataset1: "ds1",
      dataset2: "ds2",
      outputName: "combined",
      strategy: "join",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("joinKey is required");
  });

  it("returns failure when dataset1 not found", async () => {
    mockGetDatasetByName.mockResolvedValueOnce(null);

    const result = await exec(combineDatasetsTool,{
      dataset1: "missing",
      dataset2: "ds2",
      outputName: "combined",
      strategy: "union",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("missing");
  });

  it("returns failure when dataset2 not found", async () => {
    mockGetDatasetByName
      .mockResolvedValueOnce({ name: "ds1", data: [] })
      .mockResolvedValueOnce(null);

    const result = await exec(combineDatasetsTool,{
      dataset1: "ds1",
      dataset2: "missing",
      outputName: "combined",
      strategy: "union",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("missing");
  });
});

describe("deleteDatasetTool", () => {
  it("deletes existing dataset", async () => {
    mockDeleteDataset.mockResolvedValue(true);

    const result = await exec(deleteDatasetTool,{ name: "ds1" });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Deleted "ds1"');
  });

  it("returns failure when dataset not found", async () => {
    mockDeleteDataset.mockResolvedValue(false);

    const result = await exec(deleteDatasetTool,{ name: "missing" });

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});
