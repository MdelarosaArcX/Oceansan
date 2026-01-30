import { api } from 'boot/axios';
import type { AxiosError } from "axios";

export interface CreateSchedulePayload {
  sched_name: string;
  src_path: string;
  dest_path: string;
  recycle_path: string;
  days: number[];
  type: 'sync' | 'archive';
  time: string;
  recycle: boolean;
  active: boolean;
}


interface ApiErrorResponse {
  error?: string;
}
export interface UpdateSchedulePayload {
  id: string;
  sched_name: string;
  src_path: string;
  dest_path: string;
  recycle_path: string;
  days: number[];
  type: 'sync' | 'archive';
  time: string;
  recycle: boolean;
  active: boolean;
}

// create schedule
export async function createSchedule(payload: CreateSchedulePayload) {
  try {
    const { data } = await api.post("/api/schedules", payload);
    return data;
  } catch (err: unknown) {
    if (err instanceof Error && "response" in err) {
      const axiosErr = err as AxiosError<ApiErrorResponse>;

      if (axiosErr.response?.status === 409) {
        throw new Error(
          axiosErr.response.data?.error ||
          "Schedule already exists for the same source, destination, and time"
        );
      }
    }

    throw err;
  }
}

// get all schedules
export async function getSchedules() {
  const response = await api.get('/api/schedules');
  return response.data;
}

// create schedule
export function updateSchedule(payload: UpdateSchedulePayload) {
  return api.put('/api/schedules/' + payload.id, payload);
}

// delete schedule
export function deleteSchedule(id: string) {
  return api.delete('/api/schedules/' + id);
}
