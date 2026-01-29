import axios from "axios";

const API_URL = "http://localhost:3000";
const WS_URL = "ws://localhost:3001";

let socket: WebSocket | null = null;

type ProgressPayload = {
  percent: number;
  currentFile: string;
  type: string;
  speed: string;
  ratio: string;
};

type PercentPayload = {
  percent: number;
};

type RatioPayload = {
  ratio: string;
};
export function startCopy(from: string, to: string, type: string, jobId: string,name:string) {
  return axios.post(`${API_URL}/copy/start`, { from, to, type, jobId,name });
}

export function connectProgress(
  onProgress: (jobId: string, p: ProgressPayload) => void,
  onComplete: (jobId: string) => void,
  onPercentage: (p: PercentPayload) => void,
  onFileComplete: (p: RatioPayload) => void,
) {
  socket = new WebSocket(WS_URL);

  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    console.log('data');
    console.log(data);
    if (data.type === "progress") {
      onProgress(data.scheduleId, data);
    }

    if (data.type === "percentage") {
      onPercentage(data);
    }

    if (data.type === "complete") {
      onComplete(data.scheduleId);
    }
    
    if (data.type === "ratio") {
      onFileComplete(data);
    }
  };
}
