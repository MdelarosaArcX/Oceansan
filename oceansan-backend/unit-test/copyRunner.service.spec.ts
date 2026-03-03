import { CopyRunnerService } from "../src/services/copyRunner.service";
import { createCopyEngine } from "../src/services/copy.factory";
import ScheduleLogs from "../src/models/ScheduleLogs";
import { walkDir } from "../src/utils/fileWalker";
import fs from "fs-extra";

jest.mock("../services/copy.factory");
jest.mock("../models/ScheduleLogs");
jest.mock("../utils/fileWalker");
jest.mock("fs-extra");

describe("CopyRunnerService", () => {
  let wsMock: jest.Mock;
  let archiveMock: jest.Mock;
  let syncMock: jest.Mock;
  let saveMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    wsMock = jest.fn();

    archiveMock = jest.fn().mockResolvedValue(undefined);
    syncMock = jest.fn().mockResolvedValue(undefined);

    (createCopyEngine as jest.Mock).mockReturnValue({
      archive: archiveMock,
      sync: syncMock,
    });

    saveMock = jest.fn().mockResolvedValue(undefined);

    (ScheduleLogs.create as jest.Mock).mockResolvedValue({
      files: [],
      save: saveMock,
    });

    (walkDir as jest.Mock).mockImplementation((dir: string) => {
      if (dir === "source") {
        return [
          { path: "source/file1.txt", size: 100 },
          { path: "source/file2.txt", size: 200 },
        ];
      }
      if (dir === "destination") {
        return [];
      }
      return [];
    });

    jest.spyOn(global, "setInterval").mockImplementation((fn: any) => {
      fn(); // run immediately
      return 1 as any;
    });

    jest.spyOn(global, "clearInterval").mockImplementation(() => {});
  });

  it("should create log and call archive engine", async () => {
    const service = new CopyRunnerService(wsMock);

    await service.run({
      scheduleId: "123",
      type: "archive",
      name: "Test",
      source: "source",
      destination: "destination",
      engine: "robocopy",
    });

    expect(ScheduleLogs.create).toHaveBeenCalled();
    expect(archiveMock).toHaveBeenCalledWith("source", "destination");

    expect(wsMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "start" })
    );

    expect(wsMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" })
    );
  });

  it("should call sync engine when type is sync", async () => {
    const service = new CopyRunnerService(wsMock);

    await service.run({
      scheduleId: "123",
      type: "sync",
      name: "Test",
      source: "source",
      destination: "destination",
      engine: "rclone",
      option: { recycle: false, recycle_path: "" },
    });

    expect(syncMock).toHaveBeenCalledWith(
      "source",
      "destination",
      { recycle: false, recycle_path: "" }
    );
  });

  it("should handle recycle move when enabled", async () => {
    (walkDir as jest.Mock).mockImplementation((dir: string) => {
      if (dir === "source") return [];
      if (dir === "destination") {
        return [{ path: "destination/file1.txt", size: 100 }];
      }
      return [];
    });

    const service = new CopyRunnerService(wsMock);

    await service.run({
      scheduleId: "123",
      type: "sync",
      name: "Test",
      source: "source",
      destination: "destination",
      engine: "robocopy",
      option: { recycle: true, recycle_path: "recycle" },
    });

    expect(fs.ensureDirSync).toHaveBeenCalledWith("recycle");
    expect(fs.moveSync).toHaveBeenCalled();
  });

  it("should emit error event when engine fails", async () => {
    archiveMock.mockRejectedValue(new Error("Copy failed"));

    const service = new CopyRunnerService(wsMock);

    await service.run({
      scheduleId: "123",
      type: "archive",
      name: "Test",
      source: "source",
      destination: "destination",
      engine: "robocopy",
    });

    expect(wsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: "Copy failed",
      })
    );
  });
});