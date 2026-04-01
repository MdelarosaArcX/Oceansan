// runWatcher.ts
import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
dotenv.config();

import { Schedule } from "../entities/Schedule";
import { Directories } from "../entities/Directories";
import { FileMetadata } from "../entities/FileMetadata";
import { FileWatcherService } from "../services/file-watcher.service";

const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  username: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  entities: [Schedule, Directories, FileMetadata],
  synchronize: true, // true only in dev
});

function normalizePath(p: string) {
  return p.replace(/\\/g, "/").toLowerCase();
}

async function run() {
  try {
    await AppDataSource.initialize();
    console.log("Database connected via TypeORM.");

    const watcher = new FileWatcherService(AppDataSource);
    const watchedPaths = new Set<string>();
    let isRunning = false;

    const scheduleRepo = AppDataSource.getRepository(Schedule);
    const directoriesRepo = AppDataSource.getRepository(Directories);
    //  const fileMetaDataRepo = AppDataSource.getRepository(FileMetadata);

    const fetchAndWatch = async () => {
      if (isRunning) return;
      isRunning = true;

      try {
        // Fetch active schedules
        const schedules = await scheduleRepo.find({ where: { active: true } });
        const pathSet = new Set<string>();

        schedules.forEach((sched) => {
          if (sched.src_path) pathSet.add(normalizePath(sched.src_path));
          if (sched.dest_path) pathSet.add(normalizePath(sched.dest_path));
          if (sched.recycle_path) pathSet.add(normalizePath(sched.recycle_path));
        });

        // --- Save paths to Directories table and watch them ---
        for (const dirPath of pathSet) {
          if (!watchedPaths.has(dirPath)) {
            // Save or get directory entity
            let dirEntity = await directoriesRepo.findOne({ where: { path: dirPath } });
            if (!dirEntity) {
              dirEntity = directoriesRepo.create({ path: dirPath });
              await directoriesRepo.save(dirEntity);
            }

            // Watch directory
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

    // Initial fetch
    await fetchAndWatch();

    // Poll every 30 seconds
    setInterval(fetchAndWatch, 30_000);

    console.log("Watcher running... Press Ctrl+C to stop.");
  } catch (err) {
    console.error("Watcher failed:", err);
    process.exit(1);
  }
}

run();