import os from "os";

type Broadcast = (data: unknown) => void;

export default class RamMonitorService {
  private timer?: NodeJS.Timeout;
  private warned = false;

  constructor(
    private broadcast: Broadcast,
    private intervalMs = 1000,
    private limitMB = 1024 // adjust limit here
  ) {}

  start() {
    if (!this.broadcast) return;

    this.timer = setInterval(() => {
      const mem = process.memoryUsage();
      const rssMB = +(mem.rss / 1024 / 1024).toFixed(2);

      // WARNING ONLY
      if (rssMB >= this.limitMB && !this.warned) {
        this.warned = true;

        const message = `RAM limit reached: ${rssMB}MB / ${this.limitMB}MB`;

        console.warn("warning", message);

        // this.broadcast({
        //   type: "RAM_WARNING",
        //   payload: {
        //     message,
        //     rssMB,
        //     limitMB: this.limitMB,
        //     timestamp: Date.now(),
        //   },
        // });
      }

      // 🟢 Always send live stats
      // this.broadcast({
      //   type: "RAM_USAGE",
      //   payload: {
      //     process: {
      //       rssMB,
      //       heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
      //       heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(2),
      //     },
      //     system: {
      //       freeGB: +(os.freemem() / 1024 / 1024 / 1024).toFixed(2),
      //     },
      //   },
      // });
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
