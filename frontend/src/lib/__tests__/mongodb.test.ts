/**
 * Tests for MongoDB utility functions.
 * We mock the mongodb module to verify correct behavior.
 */

const mockInsertOne = jest.fn();
const mockFind = jest.fn();
const mockFindOne = jest.fn();
const mockDeleteOne = jest.fn();

const mockCollection = jest.fn().mockReturnValue({
  insertOne: mockInsertOne,
  find: mockFind,
  findOne: mockFindOne,
  deleteOne: mockDeleteOne,
});

const mockDb = jest.fn().mockReturnValue({
  collection: mockCollection,
});

const mockConnect = jest.fn();

jest.mock("mongodb", () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    db: mockDb,
  })),
  ObjectId: jest.fn().mockImplementation((id: string) => ({ _id: id })),
}));

// Need to clear module cache to reset singleton state
beforeEach(() => {
  jest.clearAllMocks();
  // Reset module-level variables by re-requiring
  jest.resetModules();
});

describe("MongoDB utilities", () => {
  describe("getDb", () => {
    it("connects and returns db instance", async () => {
      const { getDb } = await import("../mongodb");
      const db = await getDb();
      expect(mockConnect).toHaveBeenCalled();
      expect(db).toBeDefined();
    });

    it("returns cached db on second call", async () => {
      const { getDb } = await import("../mongodb");
      const db1 = await getDb();
      const db2 = await getDb();
      expect(db1).toBe(db2);
      // connect should only be called once
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCollection", () => {
    it("returns a typed collection", async () => {
      const { getCollection } = await import("../mongodb");
      const col = await getCollection("test_collection");
      expect(mockCollection).toHaveBeenCalledWith("test_collection");
      expect(col).toBeDefined();
    });
  });

  describe("saveDataset", () => {
    it("inserts dataset and returns ID", async () => {
      const { saveDataset } = await import("../mongodb");
      mockInsertOne.mockResolvedValue({
        insertedId: { toString: () => "abc123" },
      });

      const id = await saveDataset({
        name: "test_dataset",
        sourceApi: "https://api.example.com",
        apiType: "graphql",
        query: "list all users",
        data: [{ id: 1, name: "Alice" }],
        columns: ["id", "name"],
        rowCount: 1,
        tags: ["test"],
      });

      expect(id).toBe("abc123");
      expect(mockInsertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "test_dataset",
          sourceApi: "https://api.example.com",
          createdAt: expect.any(Date),
        })
      );
    });
  });

  describe("listDatasets", () => {
    it("returns datasets without data rows", async () => {
      const { listDatasets } = await import("../mongodb");
      const mockToArray = jest.fn().mockResolvedValue([
        { name: "ds1", rowCount: 5 },
        { name: "ds2", rowCount: 10 },
      ]);
      const mockLimit = jest.fn().mockReturnValue({ toArray: mockToArray });
      const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });
      mockFind.mockReturnValue({ sort: mockSort });

      const datasets = await listDatasets();
      expect(datasets).toHaveLength(2);
      expect(mockFind).toHaveBeenCalledWith({}, { projection: { data: 0 } });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(50);
    });
  });

  describe("getDatasetByName", () => {
    it("finds dataset by name", async () => {
      const { getDatasetByName } = await import("../mongodb");
      mockFindOne.mockResolvedValue({
        name: "test_ds",
        data: [{ x: 1 }],
      });

      const result = await getDatasetByName("test_ds");
      expect(result).toBeDefined();
      expect(result!.name).toBe("test_ds");
      expect(mockFindOne).toHaveBeenCalledWith({ name: "test_ds" });
    });

    it("returns null when dataset not found", async () => {
      const { getDatasetByName } = await import("../mongodb");
      mockFindOne.mockResolvedValue(null);

      const result = await getDatasetByName("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getDatasetById", () => {
    it("finds dataset by ID", async () => {
      const { getDatasetById } = await import("../mongodb");
      mockFindOne.mockResolvedValue({
        _id: "abc123",
        name: "test_ds",
      });

      const result = await getDatasetById("abc123");
      expect(result).toBeDefined();
      expect(mockFindOne).toHaveBeenCalled();
    });
  });

  describe("deleteDataset", () => {
    it("deletes existing dataset", async () => {
      const { deleteDataset } = await import("../mongodb");
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await deleteDataset("test_ds");
      expect(result).toBe(true);
      expect(mockDeleteOne).toHaveBeenCalledWith({ name: "test_ds" });
    });

    it("returns false when dataset not found", async () => {
      const { deleteDataset } = await import("../mongodb");
      mockDeleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await deleteDataset("nonexistent");
      expect(result).toBe(false);
    });
  });
});
