import CopyService from "./services/copy.service";
import { writeLog } from "./services/logger.service";

async function manualCopy(from: string, to: string): Promise<void> {
  const copier = new CopyService();

  writeLog({
    type: "manual",
    from,
    to,
    status: "started"
  });

  copier.on("progress", p => {
    console.log(`[${p.percent}%] ${p.currentFile}`);
  });

  copier.on("complete", () => {
    writeLog({
      type: "manual",
      from,
      to,
      status: "completed"
    });
    console.log("Copy finished");
  });

  await copier.copyFolder(from, to);
}

// TEST
manualCopy("C:/Users/asus tuf a15/Documents/Project/Work/ArcX/Project/Oceansan/input", "C:/Users/asus tuf a15/Documents/Project/Work/ArcX/Project/Oceansan/output");
