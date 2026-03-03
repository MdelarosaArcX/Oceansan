import XcopyService from "../src/services/xcopy.service";
import { spawn } from "child_process";
import os from "os";
import { normalizeWindowsPath } from "../src/utils/path.utils";
import { EventEmitter } from "events";

jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

jest.mock("os");
jest.mock("../utils/path.utils");

describe("XcopyService", () => {
  let wsMock: jest.Mock;
  let mockProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();

    wsMock = jest.fn();

    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    (spawn as jest.Mock).mockReturnValue(mockProcess);

    (normalizeWindowsPath as jest.Mock).mockImplementation((p) => `WIN_${p}`);
  });

  /* =====================================
     PLATFORM VALIDATION
  ====================================== */
  it("should throw if platform is not win32", async () => {
    (os.platform as jest.Mock).mockReturnValue("linux");

    const service = new XcopyService(wsMock);

    await expect(service.archive("src", "dest")).rejects.toThrow(
      "XCopy is Windows-only"
    );
  });

  /* =====================================
     SUCCESS (exit 0)
  ====================================== */
  it("should resolve on exit code 0", async () => {
    (os.platform as jest.Mock).mockReturnValue("win32");

    const service = new XcopyService(wsMock);

    const promise = service.archive("src", "dest");

    mockProcess.emit("close", 0);

    await expect(promise).resolves.toBeUndefined();

    expect(spawn).toHaveBeenCalledWith(
      "xcopy",
      expect.arrayContaining(["WIN_src", "WIN_dest"]),
      expect.objectContaining({ shell: false, windowsHide: true })
    );
  });

  /* =====================================
     SUCCESS (exit 1)
  ====================================== */
  it("should resolve on exit code 1", async () => {
    (os.platform as jest.Mock).mockReturnValue("win32");

    const service = new XcopyService(wsMock);

    const promise = service.archive("src", "dest");

    mockProcess.emit("close", 1);

    await expect(promise).resolves.toBeUndefined();
  });

  /* =====================================
     FAILURE (exit > 1)
  ====================================== */
  it("should reject on exit code > 1", async () => {
    (os.platform as jest.Mock).mockReturnValue("win32");

    const service = new XcopyService(wsMock);

    const promise = service.archive("src", "dest");

    mockProcess.emit("close", 5);

    await expect(promise).rejects.toThrow("Xcopy failed (5)");
  });

  /* =====================================
     SPAWN ERROR
  ====================================== */
  it("should reject and send ws error on spawn error", async () => {
    (os.platform as jest.Mock).mockReturnValue("win32");

    const service = new XcopyService(wsMock);

    const promise = service.archive("src", "dest");

    mockProcess.emit("error", new Error("spawn failed"));

    await expect(promise).rejects.toThrow("spawn failed");

    expect(wsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        engine: "xcopy",
      })
    );
  });

  /* =====================================
     SYNC CALLS ARCHIVE
  ====================================== */
  it("sync should call archive internally", async () => {
    (os.platform as jest.Mock).mockReturnValue("win32");

    const service = new XcopyService(wsMock);

    const spy = jest.spyOn(service, "archive").mockResolvedValue();

    await service.sync("src", "dest");

    expect(spy).toHaveBeenCalledWith("src", "dest");
  });

  /* =====================================
     LOG EVENTS
  ====================================== */
  it("should emit log events on stdout and stderr", async () => {
    (os.platform as jest.Mock).mockReturnValue("win32");

    const service = new XcopyService(wsMock);

    const logSpy = jest.spyOn(service as any, "emit");

    const promise = service.archive("src", "dest");

    mockProcess.stdout.emit("data", Buffer.from("stdout message"));
    mockProcess.stderr.emit("data", Buffer.from("stderr message"));

    mockProcess.emit("close", 0);

    await promise;

    expect(logSpy).toHaveBeenCalledWith("log", "stdout message");
    expect(logSpy).toHaveBeenCalledWith("log", "stderr message");
  });
});