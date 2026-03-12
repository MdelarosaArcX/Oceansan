import "reflect-metadata";
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT) || 3306,
  username: process.env.MYSQL_USER || "appuser",
  password: process.env.MYSQL_PASSWORD || "apppassword",
  database: process.env.MYSQL_DB || "appdb",

  synchronize: false, // use migrations in production
  logging: false,

  entities: ["src/entities/**/*.ts"],
  migrations: ["src/migrations/**/*.ts"],
  subscribers: ["src/subscribers/**/*.ts"],

  poolSize: 10,
});