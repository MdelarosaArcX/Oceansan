export interface ScheduleData {
  id: number;
  name: string;
  from: string;
  to: string;
  lastArchive: string;
  type: 'sync' | 'archive';
  status: 'Active' | 'In-active';
  sched?: string;   // optional
  time?: string;    // optional
}

export interface SchedulePayload {
  id?: number;
  name: string;
  from: string | null;
  to: string | null;
  sched: string[];
  time: string;
}
