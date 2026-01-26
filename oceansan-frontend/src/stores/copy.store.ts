import { defineStore } from 'pinia';
import { startCopy, connectProgress } from 'src/services/copy.api';

export const useCopyStore = defineStore('copy', {
  state: () => ({
    running: false,
    runningJobId: null as string | null,
    percent: 0,
    currentFile: '',
    status: '',
  }),

  actions: {
    connect() {
      connectProgress(
        (jobId, p) => {
          this.running = true;
          this.runningJobId = jobId;
          this.percent = p.percent;
          this.currentFile = p.currentFile;
          this.status = p.status;
        },
        (jobId) => {
          if (this.runningJobId === jobId) {
            this.running = false;
            this.runningJobId = null;
          }
        },
      );
    },
    async startCopy(jobId: string,name: string, from: string, to: string, type: string) {
      this.running = true;
      this.runningJobId = jobId;
      this.percent = 0;
      this.currentFile = '';
      this.status = '';

      await startCopy(from, to, type, jobId,name);
    },
  },
});
