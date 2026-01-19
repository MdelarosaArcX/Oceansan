import axios from "axios";

const API_URL = "http://localhost:3000";
const WS_URL = "ws://localhost:3001";

let socket: WebSocket | null = null;

type ProgressPayload = {
  percent: number;
  currentFile: string;
};

export function startCopy(from: string, to: string) {
  return axios.post(`${API_URL}/copy/start`, { from, to });
}

export function connectProgress(
  onProgress: (p: ProgressPayload) => void,
  onComplete: () => void
) {
  socket = new WebSocket(WS_URL);

  socket.onmessage = event => {
    const data = JSON.parse(event.data);

    if (data.type === "progress") {
      onProgress(data.payload);
    }

    if (data.type === "complete") {
      onComplete();
    }
  };
}
