// copy-engine.factory.ts
import RobocopyService from "./robocopy.service";
import XcopyService from "./xcopy.service";
import RcloneService from "./rclone.service";
// import { CopyEngine } from "./copy.engine";

type EngineType = "robocopy" | "xcopy" | "rclone";
type Broadcaster = (data: unknown) => void;
// copy-engine.factory.ts
export function createCopyEngine(
  engine: EngineType,
  ws?: Broadcaster
) {
  switch (engine) {
    case "robocopy":
      return new RobocopyService(ws);
    case "xcopy":
      return new XcopyService(ws);
    case "rclone":
      return new RcloneService(ws);
  }

  throw new Error(`Unsupported copy engine: ${engine}`);
}
