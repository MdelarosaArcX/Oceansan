import { defineStore } from 'pinia';
import { startCopy, connectProgress } from 'src/services/copy.api';

export const useCopyStore = defineStore('copy', {
  state: () => ({
    backendStatus: 'offline' as 'online' | 'offline' | 'connecting',
    osType: '',
    osPlatform: '',
    freeGB: '',
    heapUsedMB: '',
    heapTotalMB: '',
    percent: '',
    rssMB: '',
    connected: false,
    jobs: {} as Record<
      string,
      {
        percent: number;
        type: string;
        speed: string;
        status: 'running' | 'complete';
      }
    >,
  }),

  actions: {
    connect() {
      if (this.connected) return;

      this.connected = true;
      connectProgress(
        (jobId, p) => {
          this.jobs[jobId] = {
            type: p.type,
            speed: p.speed,
            percent: p.percent / 100,
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
        (payload) => {
          this.osType = payload.os.type;
          this.osPlatform = payload.os.platform;
        },
        (status) => {
          this.backendStatus = status;
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
        percent: 0,
        type: '',
        speed: '',
        status: 'running',
      };
      console.log("jobId =>> ",jobId)

      await startCopy(from, to, engine, type, jobId, name, recycle, recycle_path);
    },
  },
});
