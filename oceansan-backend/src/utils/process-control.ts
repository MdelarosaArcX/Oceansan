import { execFile } from "child_process";

function execFileAsync(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function suspendProcess(pid: number): Promise<void> {
  if (!Number.isFinite(pid) || pid <= 0) {
    throw new Error("Invalid process id for suspend.");
  }

  if (process.platform === "win32") {
    await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      `
        $target = ${pid}
        $root = Get-Process -Id $target -ErrorAction SilentlyContinue
        if (-not $root) { throw "Process not found: $target" }

        $visited = New-Object 'System.Collections.Generic.HashSet[int]'
        $queue = New-Object 'System.Collections.Generic.Queue[int]'
        $all = New-Object System.Collections.Generic.List[int]

        $queue.Enqueue([int]$target)
        while ($queue.Count -gt 0) {
          $current = $queue.Dequeue()
          if (-not $visited.Add([int]$current)) { continue }

          $all.Add([int]$current)
          $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $current" |
            Select-Object -ExpandProperty ProcessId

          foreach ($child in $children) {
            $queue.Enqueue([int]$child)
          }
        }

        # Suspend children first, then parent.
        foreach ($id in ($all | Sort-Object -Descending)) {
          try { Suspend-Process -Id $id -ErrorAction Stop } catch {}
        }
      `,
    ]);
    return;
  }

  process.kill(pid, "SIGSTOP");
}

export async function resumeProcess(pid: number): Promise<void> {
  if (!Number.isFinite(pid) || pid <= 0) {
    throw new Error("Invalid process id for resume.");
  }

  if (process.platform === "win32") {
    await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      `
        $target = ${pid}
        $root = Get-Process -Id $target -ErrorAction SilentlyContinue
        if (-not $root) { throw "Process not found: $target" }

        $visited = New-Object 'System.Collections.Generic.HashSet[int]'
        $queue = New-Object 'System.Collections.Generic.Queue[int]'
        $all = New-Object System.Collections.Generic.List[int]

        $queue.Enqueue([int]$target)
        while ($queue.Count -gt 0) {
          $current = $queue.Dequeue()
          if (-not $visited.Add([int]$current)) { continue }

          $all.Add([int]$current)
          $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $current" |
            Select-Object -ExpandProperty ProcessId

          foreach ($child in $children) {
            $queue.Enqueue([int]$child)
          }
        }

        # Resume parent first, then children.
        foreach ($id in ($all | Sort-Object)) {
          try { Resume-Process -Id $id -ErrorAction Stop } catch {}
        }
      `,
    ]);
    return;
  }

  process.kill(pid, "SIGCONT");
}

export async function killProcessTree(pid: number): Promise<void> {
  if (!Number.isFinite(pid) || pid <= 0) {
    throw new Error("Invalid process id for stop.");
  }

  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/PID", `${pid}`, "/T", "/F"]);
    return;
  }

  process.kill(pid, "SIGTERM");
}
