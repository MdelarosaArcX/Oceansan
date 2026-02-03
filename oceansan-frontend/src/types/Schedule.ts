export interface ScheduleData {
  id: string;
  name: string;
  from: string;
  to: string;
  last_archived: string;
  type: 'sync' | 'archive';
  recycle:boolean;
  status: 'Active' | 'In-active';
  sched?: string;   // optional
  time?: string;    // optional
}

export interface SchedulePayload {
  id?: string;
  name: string;
  src_path: string;
  dest_path: string;
  recycle_path?:string;
  sched: number[];
  type: 'sync' | 'archive';
  time: string;
  recycle:boolean;
  status: boolean;
}

export interface BackendSchedule {
  _id: string;
  sched_name: string;
  src_path: string;
  dest_path: string;
  recycle_path?:string;
  days: number[];
  type: 'sync' | 'archive';
  time: string;
  recycle:boolean;
  active: boolean;
  last_archived?: string; // optional
  last_sync?: string; // optional
}
