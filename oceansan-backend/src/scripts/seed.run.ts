import "reflect-metadata";
import dotenv from "dotenv";
import { AppDataSource } from "../config/typeorm.config";
import { seedLicensesIfNeeded } from "../services/license-seed.service";

dotenv.config();

async function run() {
  try {
    await AppDataSource.initialize();
    console.log("Database connected.");

    await seedLicensesIfNeeded();

    console.log("All seeders completed.");
    await AppDataSource.destroy();
  } catch (err) {
    console.error("Seeder failed:", err);
    process.exit(1);
  }
}

run();
