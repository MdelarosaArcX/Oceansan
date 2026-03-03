import RcloneService from "../src/services/rclone.service";
import { spawn } from "child_process";
import { EventEmitter } from "events";

jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

describe("RcloneService", () => {
  let wsMock: jest.Mock;
  let mockProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();

    wsMock = jest.fn();

    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    (spawn as jest.Mock).mockReturnValue(mockProcess);
  });

  /* =====================================
     SUCCESS - ARCHIVE (copy)
  ====================================== */
  it("should spawn rclone with copy for archive", async () => {
    const service = new RcloneService(wsMock);

    const promise = service.archive("src", "dest");

    mockProcess.emit("close", 0);

    await expect(promise).resolves.toBeUndefined();

    expect(spawn).toHaveBeenCalled();

    const args = (spawn as jest.Mock).mock.calls[0][1];
    expect(args[0]).toBe("copy");
  });

  /* =====================================
     SUCCESS - SYNC
  ====================================== */
  it("should spawn rclone with sync for sync()", async () => {
    const service = new RcloneService(wsMock);

    const promise = service.sync("src", "dest");

    mockProcess.emit("close", 0);

    await expect(promise).resolves.toBeUndefined();

    const args = (spawn as jest.Mock).mock.calls[0][1];
    expect(args[0]).toBe("sync");
  });

  /* =====================================
     PROGRESS PARSING
  ====================================== */
  it("should parse percent and emit progress", async () => {
    const service = new RcloneService(wsMock);

    const promise = service.archive("src", "dest");

    const sampleOutput =
      "Transferred:   1.234 GiB / 5.678 GiB, 21%, 12.3 MiB/s, ETA 1m23s\n";

    mockProcess.stdout.emit("data", Buffer.from(sampleOutput));

    mockProcess.emit("close", 0);

    await promise;

    expect(wsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "progress",
        engine: "rclone",
        percent: 21,
      })
    );
  });

  /* =====================================
     SPEED PARSING
  ====================================== */
  it("should parse speed and emit speed", async () => {
    const service = new RcloneService(wsMock);

    const promise = service.archive("src", "dest");

    const sampleOutput =
      "Transferred:   1.234 GiB / 5.678 GiB, 21%, 12.3 MiB/s, ETA 1m23s\n";

    mockProcess.stdout.emit("data", Buffer.from(sampleOutput));

    mockProcess.emit("close", 0);

    await promise;

    expect(wsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "speed",
        engine: "rclone",
        speed: "12.3 MiB/s",
      })
    );
  });

  /* =====================================
     STDERR HANDLING
  ====================================== */
  it("should emit error-log from stderr", async () => {
    const service = new RcloneService(wsMock);

    const promise = service.archive("src", "dest");

    mockProcess.stderr.emit("data", Buffer.from("warning message"));

    mockProcess.emit("close", 0);

    await promise;

    expect(wsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error-log",
        engine: "rclone",
        message: "warning message",
      })
    );
  });

  /* =====================================
     SPAWN ERROR
  ====================================== */
  it("should reject when spawn fails", async () => {
    const service = new RcloneService(wsMock);

    const promise = service.archive("src", "dest");

    mockProcess.emit("error", new Error("spawn fail"));

    await expect(promise).rejects.toThrow("Failed to start rclone");

    expect(wsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        engine: "rclone",
      })
    );
  });

  /* =====================================
     NON-ZERO EXIT
  ====================================== */
  it("should reject if exit code is not 0", async () => {
    const service = new RcloneService(wsMock);

    const promise = service.archive("src", "dest");

    mockProcess.emit("close", 1);

    await expect(promise).rejects.toThrow("rclone failed (1)");

    expect(wsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        engine: "rclone",
        code: 1,
      })
    );
  });
});