import { defineStore } from 'pinia';
import { startCopy, connectProgress } from 'src/services/copy.api';

export const useCopyStore = defineStore('copy', {
  state: () => ({
    running: false,
    runningJobId: null as string | null,
    percent: 0,
    currentFile: '',
  }),

  actions: {
    connect() {
      connectProgress(
        (jobId, p) => {
          this.running = true;
          this.runningJobId = jobId;
          this.percent = p.percent;
          this.currentFile = p.currentFile;
        },
        (jobId) => {
          if (this.runningJobId === jobId) {
            this.running = false;
            this.runningJobId = null;
          }
        },
      );
    },
    async startCopy(jobId: string, from: string, to: string, type: string) {
      this.running = true;
      this.runningJobId = jobId;
      this.percent = 0;
      this.currentFile = '';

      connectProgress(
        (jobId, p) => {
          this.running = true;
          this.runningJobId = jobId;
          this.percent = p.percent;
          this.currentFile = p.currentFile;
        },
        (jobId) => {
          if (this.runningJobId === jobId) {
            this.running = false;
            this.runningJobId = null;
          }
        },
      );

      await startCopy(from, to, type, jobId);
    },
  },
});
