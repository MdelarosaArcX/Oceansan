import "reflect-metadata";
import { DataSource } from "typeorm";
import path from "path";
import dotenv from "dotenv";
import { BackupRun } from "../entities/BackupRun";
import { BackupSettings } from "../entities/BackupSettings";
import { Directories } from "../entities/Directories";
import { FileMetadata } from "../entities/FileMetadata";
import { Schedule } from "../entities/Schedule";
import { ScheduleLogFile } from "../entities/ScheduleLogFile";
import { ScheduleLogs } from "../entities/ScheduleLogs";


dotenv.config();
const isDbSync =
  String(process.env.DB_SYNC || "false").toLowerCase() === "true";

export const AppDataSource = new DataSource({
  type: "sqlite",
  database:
    process.env.SQLITE_DB ||
    path.join(process.cwd(), "data", "app.sqlite"),

  synchronize: isDbSync, // use migrations in production
  logging: false,

  entities: [
    BackupRun,
    BackupSettings,
    Directories,
    FileMetadata,
    Schedule,
    ScheduleLogFile,
    ScheduleLogs,
  ],
  migrations: [path.join(__dirname, "..", "migrations", "*.{ts,js}")],
  subscribers: [path.join(__dirname, "..", "subscribers", "*.{ts,js}")],

});
