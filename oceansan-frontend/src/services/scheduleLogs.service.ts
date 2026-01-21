import axios from 'axios';

const API_URL = 'http://localhost:3000';

/* -------------------------
 Types
--------------------------*/

export type FileLog = {
  _id: string;
  path: string;
  size: number;
  status: 'copied' | 'failed' | 'pending';
};

export type JobLog = {
  _id: string;
  scheduleId: string;
  type: 'archive' | 'sync';
  source: string;
  destination: string;
  startTime: string;
  endTime: string;
  totalFiles: number;
  totalSize: number;
  files: FileLog[];
};

export type LogsPagination = {
  page: number;
  rowsPerPage: number;
  total: number;
  totalPages: number;
};

export type LogsResponse = {
  data: JobLog[];
  pagination: LogsPagination;
};

/* -------------------------
 API
--------------------------*/

export function fetchScheduleLogs(params: {
  page: number;
  rowsPerPage: number;
  sortBy?: string;
  descending?: boolean;
}) {
  return axios.get<LogsResponse>(`${API_URL}/api/schedulesLogs`, {
    params,
  });
}
