import cron from "node-cron";
import { BackupSettings } from "../entities/BackupSettings";

export type BackupScheduleOption = "Hourly" | "Daily" | "Monthly";

const SUPPORTED_SCHEDULES: BackupScheduleOption[] = ["Hourly", "Daily", "Monthly"];

export function isSupportedBackupSchedule(value: string): value is BackupScheduleOption {
  return SUPPORTED_SCHEDULES.includes(value as BackupScheduleOption);
}

export function getScheduleIntervalMs(schedule: string) {
  switch (schedule) {
    case "Hourly":
      return 60 * 60 * 1000;
    case "Daily":
      return 24 * 60 * 60 * 1000;
    case "Monthly":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function parseSyncTime(syncTime?: string | null) {
  const match = /^(\d{2}):(\d{2})$/.exec(syncTime ?? "");
  if (!match) {
    return { hours: 2, minutes: 0 };
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return { hours: 2, minutes: 0 };
  }

  return { hours, minutes };
}

function withTime(date: Date, syncTime?: string | null) {
  const { hours, minutes } = parseSyncTime(syncTime);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function normalizeDayOfMonth(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 1;
  }

  return Math.min(31, Math.max(1, Math.trunc(value)));
}

function getLastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function withMonthlyDateAndTime(date: Date, dayOfMonth?: number | null, syncTime?: string | null) {
  const next = withTime(date, syncTime);
  const normalizedDay = normalizeDayOfMonth(dayOfMonth);
  const lastDay = getLastDayOfMonth(next.getFullYear(), next.getMonth());
  next.setDate(Math.min(normalizedDay, lastDay));
  return next;
}

function resolveScheduleAnchor(settings?: Partial<BackupSettings> | null) {
  if (settings?.lastSyncAttemptAt) {
    return new Date(settings.lastSyncAttemptAt);
  }

  if (settings?.updatedAt) {
    return new Date(settings.updatedAt);
  }

  if (settings?.createdAt) {
    return new Date(settings.createdAt);
  }

  return new Date();
}

function computeNextOccurrenceAfter(
  schedule: string,
  baseline: Date,
  settings?: Partial<BackupSettings> | null,
) {
  if (schedule === "Hourly") {
    const next = new Date(baseline);
    next.setSeconds(0, 0);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next;
  }

  if (schedule === "Daily") {
    const next = withTime(baseline, settings?.syncTime);
    if (next.getTime() <= baseline.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (schedule === "Monthly") {
    const next = withMonthlyDateAndTime(
      baseline,
      settings?.syncDayOfMonth,
      settings?.syncTime,
    );
    if (next.getTime() <= baseline.getTime()) {
      const shifted = new Date(baseline);
      shifted.setMonth(shifted.getMonth() + 1, 1);
      return withMonthlyDateAndTime(
        shifted,
        settings?.syncDayOfMonth,
        settings?.syncTime,
      );
    }
    return next;
  }

  return null;
}

export function computeNextAutomaticSyncAt(
  settings?: Partial<BackupSettings> | null,
  referenceDate = new Date(),
): Date | null {
  if (!settings?.cloudSyncEnabled) {
    return null;
  }

  const schedule = settings.schedule ?? "";
  const anchor = resolveScheduleAnchor(settings);
  const baseline =
    anchor.getTime() > referenceDate.getTime() ? anchor : referenceDate;

  const scheduled = computeNextOccurrenceAfter(schedule, baseline, settings);
  if (scheduled) {
    return scheduled;
  }

  const intervalMs = getScheduleIntervalMs(schedule);
  if (!intervalMs) {
    return null;
  }

  const next = new Date(anchor);
  next.setTime(anchor.getTime() + intervalMs);

  return next.getTime() > referenceDate.getTime()
    ? next
    : new Date(referenceDate.getTime() + intervalMs);
}

export function computeDueAutomaticSyncAt(
  settings?: Partial<BackupSettings> | null,
): Date | null {
  if (!settings?.cloudSyncEnabled) {
    return null;
  }

  const schedule = settings.schedule ?? "";
  const anchor = resolveScheduleAnchor(settings);
  const scheduled = computeNextOccurrenceAfter(schedule, anchor, settings);
  if (scheduled) {
    return scheduled;
  }

  const intervalMs = getScheduleIntervalMs(schedule);
  if (!intervalMs) {
    return null;
  }

  return new Date(anchor.getTime() + intervalMs);
}

export function isBackupSyncDue(settings: BackupSettings, now = new Date()) {
  if (!settings.cloudSyncValidatedAt) {
    return false;
  }

  const nextRunAt = computeDueAutomaticSyncAt(settings);
  return Boolean(nextRunAt && nextRunAt.getTime() <= now.getTime());
}

type TickHandler = () => Promise<void>;

class BackupAutoSyncService {
  private started = false;

  start(onTick: TickHandler) {
    if (this.started) {
      return;
    }

    cron.schedule("* * * * *", async () => {
      try {
        await onTick();
      } catch (error) {
        console.error("Backup auto-sync tick failed:", error);
      }
    });

    this.started = true;
    console.log("Backup auto-sync scheduler running");
  }
}

export const backupAutoSyncService = new BackupAutoSyncService();
