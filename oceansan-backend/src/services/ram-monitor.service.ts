import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";

type Broadcast = (data: unknown) => void;
type CpuSample = { idle: number; total: number };
type NetworkSample = { rxBytes: number; txBytes: number; timestamp: number };

const execFileAsync = promisify(execFile);

export default class RamMonitorService {
  private timer?: NodeJS.Timeout;
  private warned = false;
  private busy = false;
  private previousCpuSample?: CpuSample;
  private previousNetworkSample?: NetworkSample;

  private readonly osInfo = {
    platform: os.platform(), // win32 | linux | darwin
    arch: os.arch(), // x64 | arm64
    release: os.release(), // OS version
    type: os.type(), // Windows_NT | Linux | Darwin
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

  private snapshotCpu(): CpuSample {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      const times = cpu.times;
      idle += times.idle;
      total += times.user + times.nice + times.sys + times.idle + times.irq;
    }

    return { idle, total };
  }

  private calculateCpuUsage(previous: CpuSample, current: CpuSample): number {
    const idleDelta = current.idle - previous.idle;
    const totalDelta = current.total - previous.total;

    if (totalDelta <= 0) return 0;

    return +((1 - idleDelta / totalDelta) * 100).toFixed(2);
  }

  private async getLinuxNetworkBytes(): Promise<{ rxBytes: number; txBytes: number }> {
    const statsDir = "/sys/class/net";
    const interfaces = await fs.readdir(statsDir);
    let rxBytes = 0;
    let txBytes = 0;

    for (const iface of interfaces) {
      if (iface === "lo") continue;

      try {
        const rxPath = path.join(statsDir, iface, "statistics", "rx_bytes");
        const txPath = path.join(statsDir, iface, "statistics", "tx_bytes");

        const [rxRaw, txRaw] = await Promise.all([
          fs.readFile(rxPath, "utf8"),
          fs.readFile(txPath, "utf8"),
        ]);

        rxBytes += Number(rxRaw.trim()) || 0;
        txBytes += Number(txRaw.trim()) || 0;
      } catch {
        // Ignore interfaces that cannot be read.
      }
    }

    return { rxBytes, txBytes };
  }

  private async getWindowsNetworkBytes(): Promise<{ rxBytes: number; txBytes: number }> {
    const psScript = [
      "$stats = Get-NetAdapterStatistics -ErrorAction SilentlyContinue |",
      "Where-Object { $_.Name -notmatch 'Loopback' };",
      "if (-not $stats) { Write-Output '{\"rxBytes\":0,\"txBytes\":0}'; exit 0 };",
      "$rx = ($stats | Measure-Object -Property ReceivedBytes -Sum).Sum;",
      "$tx = ($stats | Measure-Object -Property SentBytes -Sum).Sum;",
      "$obj = @{ rxBytes = [double]$rx; txBytes = [double]$tx };",
      "$obj | ConvertTo-Json -Compress",
    ].join(" ");

    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      psScript,
    ]);

    const parsed = JSON.parse(stdout.trim()) as { rxBytes?: number; txBytes?: number };

    return {
      rxBytes: Number(parsed.rxBytes) || 0,
      txBytes: Number(parsed.txBytes) || 0,
    };
  }

  private async getNetworkBytes(): Promise<{ rxBytes: number; txBytes: number }> {
    if (this.osInfo.platform === "win32") {
      return this.getWindowsNetworkBytes();
    }

    if (this.osInfo.platform === "linux") {
      return this.getLinuxNetworkBytes();
    }

    return { rxBytes: 0, txBytes: 0 };
  }

  start() {
    if (!this.broadcast) return;

    this.previousCpuSample = this.snapshotCpu();

    this.safeBroadcast({
      type: "SYSTEM_INFO",
      payload: {
        os: this.osInfo,
        cpuCount: os.cpus().length,
        totalMemoryGB: +(os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
        timestamp: Date.now(),
      },
    });


    this.timer = setInterval(async () => {
      if (this.busy) return;
      this.busy = true;

      try {
        const mem = process.memoryUsage();
        const rssMB = +(mem.rss / 1024 / 1024).toFixed(2);
        const totalMemoryBytes = os.totalmem();
        const freeMemoryBytes = os.freemem();
        const ramUsagePercent = +(((totalMemoryBytes - freeMemoryBytes) / totalMemoryBytes) * 100).toFixed(2);

        const currentCpuSample = this.snapshotCpu();
        const cpuUsagePercent = this.previousCpuSample
          ? this.calculateCpuUsage(this.previousCpuSample, currentCpuSample)
          : 0;
        this.previousCpuSample = currentCpuSample;

        const networkBytes = await this.getNetworkBytes();
        const now = Date.now();

        let rxMbps = 0;
        let txMbps = 0;
        let totalMbps = 0;

        if (this.previousNetworkSample) {
          const elapsedSeconds = (now - this.previousNetworkSample.timestamp) / 1000;

          if (elapsedSeconds > 0) {
            const rxDelta = Math.max(networkBytes.rxBytes - this.previousNetworkSample.rxBytes, 0);
            const txDelta = Math.max(networkBytes.txBytes - this.previousNetworkSample.txBytes, 0);

            rxMbps = +(((rxDelta * 8) / 1_000_000) / elapsedSeconds).toFixed(3);
            txMbps = +(((txDelta * 8) / 1_000_000) / elapsedSeconds).toFixed(3);
            totalMbps = +(rxMbps + txMbps).toFixed(3);
          }
        }

        this.previousNetworkSample = {
          ...networkBytes,
          timestamp: now,
        };

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
              freeGB: +(freeMemoryBytes / 1024 / 1024 / 1024).toFixed(2),
              ramUsagePercent,
              cpuUsagePercent,
              network: {
                rxMbps,
                txMbps,
                totalMbps,
              },
            },
          },
        });
      } catch (error) {
        console.error("RAM monitor loop failed:", error);
      } finally {
        this.busy = false;
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
