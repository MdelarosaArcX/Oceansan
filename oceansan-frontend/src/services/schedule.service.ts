import { api } from 'boot/axios';

export interface CreateSchedulePayload {
  sched_name: string;
  src_path: string;
  dest_path: string;
  days: number[];
  type: 'sync' | 'archive';
  time: string;
  active: boolean;
}

export interface UpdateSchedulePayload {
  id: string;
  sched_name: string;
  src_path: string;
  dest_path: string;
  days: number[];
  type: 'sync' | 'archive';
  time: string;
  active: boolean;
}

// create schedule
export function createSchedule(payload: CreateSchedulePayload) {
  return api.post('/api/schedules', payload);
}

// get all schedules
export async function getSchedules() {
  const response = await api.get('/api/schedules');
  return response.data;
}

// create schedule
export function updateSchedule(payload: UpdateSchedulePayload) {
  return api.put('/api/schedules/'+payload.id, payload);
}

// delete schedule
export function deleteSchedule(id: string) {
  return api.delete('/api/schedules/'+id);
}
