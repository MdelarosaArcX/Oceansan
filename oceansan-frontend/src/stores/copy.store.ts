import { defineStore } from 'pinia';
import { connectProgress, startCopy, stopCopy } from 'src/services/copy.api';

export const useCopyStore = defineStore('copy', {
  state: () => ({
    backendStatus: 'offline' as 'online' | 'offline' | 'connecting',
    osType: '',
    osPlatform: '',
    freeGB: null as number | null,
    heapUsedMB: null as number | null,
    heapTotalMB: null as number | null,
    ramUsagePercent: null as number | null,
    cpuUsagePercent: null as number | null,
    networkMbps: null as number | null,
    percent: '',
    rssMB: null as number | null,
    connected: false,
    pauseRequested: {} as Record<string, boolean>,
    jobs: {} as Record<
      string,
      {
        percent: number;
        type: string;
        speed: string;
        status: 'running' | 'paused' | 'complete';
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
        (jobId, state) => {
          const existing = this.jobs[jobId] ?? {
            percent: 0,
            type: '',
            speed: '',
            status: 'running' as const,
          };

          this.jobs[jobId] = {
            ...existing,
            status:
              state === 'stopped'
                ? this.pauseRequested[jobId]
                  ? 'paused'
                  : 'complete'
                : state,
          };

          if (state === 'stopped' && this.pauseRequested[jobId]) {
            delete this.pauseRequested[jobId];
          }
        },
        (payload) => {
          if (payload?.system?.freeGB !== undefined) {
            this.freeGB = payload.system.freeGB;
          }
          if (payload?.process?.heapUsedMB !== undefined) {
            this.heapUsedMB = payload.process.heapUsedMB;
          }
          if (payload?.process?.heapTotalMB !== undefined) {
            this.heapTotalMB = payload.process.heapTotalMB;
          }
          if (payload?.process?.rssMB !== undefined) {
            this.rssMB = payload.process.rssMB;
          }
          if (payload?.system?.ramUsagePercent !== undefined) {
            this.ramUsagePercent = payload.system.ramUsagePercent;
          }
          if (payload?.system?.cpuUsagePercent !== undefined) {
            this.cpuUsagePercent = payload.system.cpuUsagePercent;
          }
          if (payload?.system?.network?.totalMbps !== undefined) {
            this.networkMbps = payload.system.network.totalMbps;
          }
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
      await startCopy(from, to, engine, type, jobId, name, recycle, recycle_path);
    },

    async pauseCopy(jobId: string) {
      const existing = this.jobs[jobId] ?? {
        percent: 0,
        type: '',
        speed: '',
        status: 'running' as const,
      };

      this.pauseRequested[jobId] = true;
      this.jobs[jobId] = {
        ...existing,
        status: 'paused',
      };

      try {
        await stopCopy(jobId);
      } catch (error) {
        delete this.pauseRequested[jobId];
        this.jobs[jobId] = {
          ...existing,
          status: 'running',
        };
        throw error;
      }
    },

    async resumeCopy(
      jobId: string,
      name: string,
      from: string,
      to: string,
      engine: string,
      type: string,
      recycle: boolean,
      recycle_path: string,
    ) {
      if (this.jobs[jobId]) {
        this.jobs[jobId].status = 'running';
      }
      delete this.pauseRequested[jobId];
      await this.startCopy(jobId, name, from, to, engine, type, recycle, recycle_path);
    },

    async stopCopy(jobId: string) {
      delete this.pauseRequested[jobId];
      await stopCopy(jobId);
      if (this.jobs[jobId]) {
        this.jobs[jobId].status = 'complete';
      }
    },
  },
});
