import { defineStore } from 'pinia';
import { startCopy, connectProgress } from 'src/services/copy.api';

export const useCopyStore = defineStore('copy', {
  state: () => ({
    freeGB: '',
    heapUsedMB: '',
    heapTotalMB: '',
    rssMB: '',
    jobs: {} as Record<
      string,
      {
        type: string;
        speed: string;
        status: 'running' | 'complete';
      }
    >,
  }),

  actions: {
    connect() {
      connectProgress(
        (jobId, p) => {
          this.jobs[jobId] = {
            type: p.type,
            speed: p.speed,
            status: 'running',
          };
        },
        (jobId) => {
          if (this.jobs[jobId]) {
            this.jobs[jobId].status = 'complete';
          }
        },
        (p, gb) => {
          this.freeGB = gb;
          this.heapUsedMB = p.heapUsedMB;
          this.heapTotalMB = p.heapTotalMB;
          this.rssMB = p.rssMB;
        },
      );
    },

    async startCopy(
      jobId: string,
      name: string,
      from: string,
      to: string,
      engine: string,
      type: string,
      recycle: boolean,
      recycle_path: string,
    ) {
      this.jobs[jobId] = {
        type: '',
        speed: '',
        status: 'running',
      };

      await startCopy(from, to, engine, type, jobId, name, recycle, recycle_path);
    },
  },
});
