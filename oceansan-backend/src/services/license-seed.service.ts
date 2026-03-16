import fs from "fs";
import path from "path";
import { AppDataSource } from "../config/typeorm.config";
import { License } from "../entities/License";

type LicenseSeed = {
  key: string;
  expiresAt?: string | null;
  note?: string | null;
};

function resolveSeedFile(): string | null {
  if (process.env.LICENSE_SEED_FILE) {
    return process.env.LICENSE_SEED_FILE;
  }

  const cwdPath = path.join(process.cwd(), "license.seed.json");
  if (fs.existsSync(cwdPath)) return cwdPath;

  const cwdAlt = path.join(process.cwd(), "seed", "licenses.json");
  if (fs.existsSync(cwdAlt)) return cwdAlt;

  return null;
}

function parseSeeds(raw: string): LicenseSeed[] {
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) return [];
  return data
    .filter((item) => item && typeof item === "object")
    .map((item) => item as LicenseSeed)
    .filter((item) => typeof item.key === "string" && item.key.trim().length > 0);
}

export async function seedLicensesIfNeeded() {
  const seedPath = resolveSeedFile();
  if (!seedPath) {
    return;
  }

  const repo = AppDataSource.getRepository(License);
  const existing = await repo.find();
  const existingKeys = new Set(existing.map((l) => l.key));

  const raw = fs.readFileSync(seedPath, "utf8");
  const seeds = parseSeeds(raw);
  if (!seeds.length) return;

  const toCreate = seeds.filter((seed) => !existingKeys.has(seed.key.trim()));
  if (!toCreate.length) return;

  const entities = toCreate.map((seed) => {
    const license = new License();
    license.key = seed.key.trim();
    license.note = seed.note?.trim() || null;
    if (seed.expiresAt) {
      const date = new Date(seed.expiresAt);
      license.expiresAt = Number.isNaN(date.getTime()) ? null : date;
    } else {
      license.expiresAt = null;
    }
    return license;
  });

  await repo.save(entities);
  console.log(`[license-seed] Seeded ${entities.length} license(s).`);
}
