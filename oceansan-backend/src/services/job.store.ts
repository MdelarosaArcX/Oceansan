import fs from "fs";
import path from "path";
import { CopyJob } from "../types/scheduler.types";

const JOBS_FILE = path.join(__dirname, "../../config/jobs.json");

function readJobs(): CopyJob[] {
  if (!fs.existsSync(JOBS_FILE)) return [];
  return JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8"));
}

function saveJobs(jobs: CopyJob[]) {
  fs.mkdirSync(path.dirname(JOBS_FILE), { recursive: true });
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

export function addJob(job: CopyJob) {
  const jobs = readJobs();
  jobs.push(job);
  saveJobs(jobs);
}

export function updateJob(job: CopyJob) {
  const jobs = readJobs().map(j => (j.id === job.id ? job : j));
  saveJobs(jobs);
}

export function deleteJob(id: string) {
  saveJobs(readJobs().filter(j => j.id !== id));
}

export function getJobs(): CopyJob[] {
  return readJobs();
}
