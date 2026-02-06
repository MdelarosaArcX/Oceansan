// copy.factory.ts
import os from "os";
import RobocopyService from "./robocopy.service";
import XcopyService from "./xcopy.service";
import RsyncService from "./rsync.service";

export function createCopyService() {
  if (os.platform() === "win32") {
    return new RobocopyService();
  }

  return new RsyncService();
}
// createCopyService("robocopy" | "xcopy" | "rsync")
