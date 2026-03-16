import "reflect-metadata";
import { DataSource } from "typeorm";
import path from "path";
import dotenv from "dotenv";


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

  entities: [path.join(__dirname, "..", "entities", "*.{ts,js}")],
  migrations: [path.join(__dirname, "..", "migrations", "*.{ts,js}")],
  subscribers: [path.join(__dirname, "..", "subscribers", "*.{ts,js}")],

});
