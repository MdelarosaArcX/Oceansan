import axios from 'axios';

const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3001';

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualClose = false;

type ProgressPayload = {
  percent: number;
  currentFile: string;
  type: string;
  speed: string;
  ratio: string;
};

type RamPayload = {
  freeGB: string;
  heapUsedMB: string;
  heapTotalMB: string;
  rssMB: string;
};

type SystemInfoPayload = {
  os: {
    platform: string;
    arch: string;
    release: string;
    type: string;
  };
  cpuCount: number;
  totalMemoryGB: number;
  timestamp: number;
};

export function startCopy(from: string, to: string, engine: string, type: string, jobId: string,name:string,recycle:boolean,recycle_path:string) {
  return axios.post(`${API_URL}/copy/start`, { from, to, engine, type, jobId,name,recycle:recycle,recycle_path:recycle_path });
}

export function connectProgress(
  onProgress: (jobId: string, p: ProgressPayload) => void,
  onComplete: (jobId: string) => void,
  onRamUsage: (p: RamPayload, gb: string) => void,
  onSystemInfo: (payload: SystemInfoPayload) => void,
  onBackendStatus: (status: 'online' | 'offline' | 'connecting') => void,
) {
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    return;
  }

  manualClose = false;
  onBackendStatus('connecting');
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    onBackendStatus('online');
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'progress') {
      onProgress(data.scheduleId, data);
    }

    if (data.type === 'complete') {
      onComplete(data.scheduleId);
    }

    if (data.type === 'RAM_USAGE') {
      onRamUsage(data.payload.process, data.payload.system.freeGB);
    }

    if (data.type === 'SYSTEM_INFO') {
      onSystemInfo(data.payload);
    }
  };

  socket.onerror = () => {
    onBackendStatus('offline');
  };

  socket.onclose = () => {
    socket = null;
    onBackendStatus('offline');

    if (!manualClose && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectProgress(onProgress, onComplete, onRamUsage, onSystemInfo, onBackendStatus);
      }, 3000);
    }
  };
}

export function disconnectProgress() {
  manualClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (socket) {
    socket.close();
    socket = null;
  }
}
