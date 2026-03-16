import "reflect-metadata";
import { DataSource } from "typeorm";
import path from "path";
import dotenv from "dotenv";


dotenv.config();
const isDbSync =
  String(process.env.DB_SYNC || "false").toLowerCase() === "true";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT) || 3306,
  username: process.env.MYSQL_USER || "appuser",
  password: process.env.MYSQL_PASSWORD || "apppassword",
  database: process.env.MYSQL_DB || "appdb",

  synchronize: isDbSync, // use migrations in production
  logging: false,

  entities: [path.join(__dirname, "..", "entities", "*.{ts,js}")],
  migrations: [path.join(__dirname, "..", "migrations", "*.{ts,js}")],
  subscribers: [path.join(__dirname, "..", "subscribers", "*.{ts,js}")],

  poolSize: 10,
});
