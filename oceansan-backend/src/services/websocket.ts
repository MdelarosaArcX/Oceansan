export type TransferWSMessage =
  | {
      type: "start";
      totalFiles: number;
      totalBytes: number;
      startedAt: number;
    }
  | {
      type: "progress";
      currentFile: string;
      filesCopied: number;
      totalFiles: number;
      bytesCopied: number;
      totalBytes: number;
      percent: number;
      speedBps: number;       // smoothed
      rawSpeedBps: number;    // optional (debug)
      etaSeconds: number | null;
    }
  | {
      type: "complete";
      totalFiles: number;
      totalBytes: number;
      averageSpeedBps: number;
      durationSeconds: number;
    }
  | {
      type: "error";
      message: string;
    };