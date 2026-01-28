import { defineStore } from 'pinia';
import { startCopy, connectProgress } from 'src/services/copy.api';

export const useCopyStore = defineStore('copy', {
  state: () => ({
    running: false,
    runningJobId: null as string | null,
    percent: 0,
    currentFile: '',
    type: '',
    speed: '',
    ratio: '',
  }),

  actions: {
    connect() {
      connectProgress(
        (jobId, p) => {
          this.running = true;
          this.runningJobId = jobId;
          this.currentFile = p.currentFile;
          this.type = p.type;
          this.speed = p.speed;
        },
        (jobId) => {
          if (this.runningJobId === jobId) {
            this.running = false;
            this.runningJobId = null;
          }
        },
        (p) => {
          this.percent = p.percent;
        },
        (p) => {
          this.ratio = p.ratio;
        },
      );
    },
    async startCopy(jobId: string, name: string, from: string, to: string, type: string) {
      this.running = true;
      this.runningJobId = jobId;
      this.percent = 0;
      this.currentFile = '';
      this.type = '';

      await startCopy(from, to, type, jobId, name);
    },
  },
});
