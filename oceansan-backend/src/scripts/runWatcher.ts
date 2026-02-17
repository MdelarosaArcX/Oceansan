import mongoose from "mongoose";
import Schedule from "../models/Schedule";
import FileWatcherService from "../services/file-watcher.service";
import dotenv from "dotenv";
dotenv.config();


async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("MongoDB connected.");

    const watcher = new FileWatcherService();

    // Fetch all active schedules
    const schedules = await Schedule.find({ active: true }).lean();

    // Collect unique paths to watch
    const pathSet = new Set<string>();

    schedules.forEach((sched) => {
      if (sched.src_path) pathSet.add(normalizePath(sched.src_path));
      if (sched.dest_path) pathSet.add(normalizePath(sched.dest_path));
    });

    console.log(`Found ${pathSet.size} unique paths to watch.`);

    // Start watcher on each unique path
    for (const dirPath of pathSet) {
      await watcher.watchPath(dirPath);
    }

    console.log("Watcher running... Press Ctrl+C to stop.");
  } catch (err) {
    console.error("Watcher failed:", err);
    process.exit(1);
  }
}

// Normalize paths (Windows friendly)
function normalizePath(p: string) {
  return p.replace(/\\/g, "/").toLowerCase();
}

run();
