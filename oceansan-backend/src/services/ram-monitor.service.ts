import os from "os";

type Broadcast = (data: unknown) => void;

export default class RamMonitorService {
  private timer?: NodeJS.Timeout;
  private warned = false;

  private readonly osInfo = {
    platform: os.platform(),      // win32 | linux | darwin
    arch: os.arch(),              // x64 | arm64
    release: os.release(),        // OS version
    type: os.type(),              // Windows_NT | Linux | Darwin
  };

  constructor(
    private broadcast: Broadcast,
    private intervalMs = 1000,
    private limitMB = 1024 // adjust limit here
  ) { }

  private safeBroadcast(data: unknown) {
    try {
      this.broadcast(data);
    } catch (error) {
      console.error("RAM monitor broadcast failed:", error);
    }
  }

  start() {
    if (!this.broadcast) return;

    this.safeBroadcast({
      type: "SYSTEM_INFO",
      payload: {
        os: this.osInfo,
        cpuCount: os.cpus().length,
        totalMemoryGB: +(os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
        timestamp: Date.now(),
      },
    });


    this.timer = setInterval(() => {
      try {
        const mem = process.memoryUsage();
        const rssMB = +(mem.rss / 1024 / 1024).toFixed(2);

        if (rssMB >= this.limitMB && !this.warned) {
          this.warned = true;

          const message = `RAM limit reached: ${rssMB}MB / ${this.limitMB}MB`;

          console.warn("warning", message);

          this.safeBroadcast({
            type: "RAM_WARNING",
            payload: {
              message,
              rssMB,
              limitMB: this.limitMB,
              os: this.osInfo,
              timestamp: Date.now(),
            },
          });
        }

        this.safeBroadcast({
          type: "RAM_USAGE",
          payload: {
            process: {
              os: this.osInfo,
              rssMB,
              heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
              heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(2),
            },
            system: {
              freeGB: +(os.freemem() / 1024 / 1024 / 1024).toFixed(2),
            },
          },
        });
      } catch (error) {
        console.error("RAM monitor loop failed:", error);
      }
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
