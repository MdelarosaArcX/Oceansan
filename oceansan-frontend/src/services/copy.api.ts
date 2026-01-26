import axios from "axios";

const API_URL = "http://localhost:3000";
const WS_URL = "ws://localhost:3001";

let socket: WebSocket | null = null;

type ProgressPayload = {
  percent: number;
  currentFile: string;
  status: string;
};

export function startCopy(from: string, to: string, type: string, jobId: string,name:string) {
  return axios.post(`${API_URL}/copy/start`, { from, to, type, jobId,name });
}

export function connectProgress(
  onProgress: (jobId: string, p: ProgressPayload) => void,
  onComplete: (jobId: string) => void
) {
  socket = new WebSocket(WS_URL);

  socket.onmessage = event => {
    const data = JSON.parse(event.data);

    if (data.type === "progress") {
      onProgress(data.jobId, data.payload);
    }

    if (data.type === "complete") {
      onComplete(data.jobId);
    }
  };
}
