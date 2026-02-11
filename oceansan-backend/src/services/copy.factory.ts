// copy-engine.factory.ts
import RobocopyService from "./robocopy.service";
import XcopyService from "./xcopy.service";
import RsyncService from "./rsync.service";
// import { CopyEngine } from "./copy.engine";

type EngineType = "robocopy" | "xcopy" | "rsync";
type Broadcaster = (data: unknown) => void;
// copy-engine.factory.ts
export function createCopyEngine(
  engine: "robocopy" | "xcopy" | "rsync",
  ws?: Broadcaster
) {
  switch (engine) {
    case "robocopy":
      return new RobocopyService(ws);
    case "xcopy":
      return new XcopyService(ws);
    case "rsync":
      return new RsyncService(ws);
  }
}

