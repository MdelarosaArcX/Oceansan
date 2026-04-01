import type { Request, Response } from "express";
import { AppDataSource } from "../config/typeorm.config";
import { License } from "../entities/License";
import { LicenseUsage } from "../entities/LicenseUsage";

const licenseRepo = AppDataSource.getRepository(License);
const usageRepo = AppDataSource.getRepository(LicenseUsage);

function getClientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function isExpired(license: License) {
  if (!license.expiresAt) return false;
  return license.expiresAt.getTime() < Date.now();
}

export const getLicenseStatus = async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const usage = await usageRepo.findOne({
      where: { ip },
    });

    if (!usage) {
      return res.json({ active: false });
    }

    if (isExpired(usage.license)) {
      return res.json({
        active: false,
        expired: true,
        expiresAt: usage.license.expiresAt,
      });
    }

    usage.lastSeenAt = new Date();
    await usageRepo.save(usage);

    return res.json({
      active: true,
      expiresAt: usage.license.expiresAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to check license" });
  }
};

export const activateLicense = async (req: Request, res: Response) => {
  try {
    const { key } = req.body as { key?: string };
    const ip = getClientIp(req);

    if (!key || !key.trim()) {
      return res.status(400).json({ message: "License key is required." });
    }

    const license = await licenseRepo.findOne({
      where: { key: key.trim() },
    });

    if (!license) {
      return res.status(404).json({ message: "License key not found." });
    }

    if (isExpired(license)) {
      return res.status(400).json({ message: "License is expired." });
    }

    const existingUsage = await usageRepo.findOne({
      where: { license: { id: license.id }, ip },
    });

    if (existingUsage) {
      existingUsage.lastSeenAt = new Date();
      await usageRepo.save(existingUsage);
      return res.json({
        active: true,
        message: "License already active for this device.",
        expiresAt: license.expiresAt,
      });
    }

    const otherUsage = await usageRepo.findOne({
      where: { license: { id: license.id } },
    });

    if (otherUsage) {
      return res.status(409).json({
        message: "License already in use on another device.",
      });
    }

    const usage = usageRepo.create({
      license,
      ip,
      lastSeenAt: new Date(),
    });

    await usageRepo.save(usage);

    return res.json({
      active: true,
      message: "License activated.",
      expiresAt: license.expiresAt,
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to activate license." });
  }
};
