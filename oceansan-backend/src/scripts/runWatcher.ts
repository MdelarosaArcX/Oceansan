import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Schedule from "../models/Schedule";
import FileWatcherService from "../services/file-watcher.service";

// Normalize paths (Windows-friendly)
function normalizePath(p: string) {
  return p.replace(/\\/g, "/").toLowerCase();
}

async function run() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("MongoDB connected.");

    const watcher = new FileWatcherService();
    const watchedPaths = new Set<string>(); // track paths already being watched
    let isRunning = false; // prevent overlapping polls

    // --- FUNCTION TO FETCH AND WATCH SCHEDULE PATHS ---
    const fetchAndWatch = async () => {
      if (isRunning) return;
      isRunning = true;

      try {
        const schedules = await Schedule.find({ active: true }).lean();
        const pathSet = new Set<string>();

        // Collect unique paths from schedules
        schedules.forEach((sched) => {
          if (sched.src_path) pathSet.add(normalizePath(sched.src_path));
          if (sched.dest_path) pathSet.add(normalizePath(sched.dest_path));
        });

        // Watch any new paths
        for (const dirPath of pathSet) {
          if (!watchedPaths.has(dirPath)) {
            await watcher.watchPath(dirPath);
            watchedPaths.add(dirPath);
            console.log("Started watching new path:", dirPath);
          }
        }

        console.log(`Total watched paths: ${watchedPaths.size}`);
      } catch (err) {
        console.error("Error fetching schedules or watching paths:", err);
      } finally {
        isRunning = false;
      }
    };

    // --- INITIAL LOAD ---
    await fetchAndWatch();

    // --- POLL EVERY 30 SECONDS ---
    setInterval(fetchAndWatch, 30_000);

    console.log("Watcher running... Press Ctrl+C to stop.");
  } catch (err) {
    console.error("Watcher failed:", err);
    process.exit(1);
  }
}

run();
