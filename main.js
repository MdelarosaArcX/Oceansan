const path = require('path');
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

function getRootDir() {
  return app.isPackaged ? process.resourcesPath : __dirname;
}

function getBackendDir() {
  return path.join(getRootDir(), 'oceansan-backend');
}

function getFrontendDir() {
  return path.join(getRootDir(), 'oceansan-frontend');
}

let backendProcess = null;
let frontendProcess = null;

function isUrlReachable(targetUrl, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const client = targetUrl.startsWith('https') ? https : http;
    const req = client.get(targetUrl, { timeout: timeoutMs }, (res) => {
      res.destroy();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl(targetUrl, attempts = 30, delayMs = 1000) {
  for (let i = 0; i < attempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isUrlReachable(targetUrl);
    if (ok) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

function spawnProcess(command, args, cwd, label, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      ...extraEnv,
    },
  });

  child.on('exit', (code, signal) => {
    const exitCode = code === null ? `signal ${signal}` : code;
    console.log(`[${label}] exited with ${exitCode}`);
  });

  return child;
}

function killProcessTree(child) {
  if (!child || child.killed) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    return;
  }

  child.kill('SIGTERM');
}

function startBackend() {
  if (backendProcess) return;

  if (app.isPackaged) {
    const backendDir = getBackendDir();
    backendProcess = spawnProcess(
      process.execPath,
      [path.join(backendDir, 'dist', 'server.js')],
      backendDir,
      'backend',
      { ELECTRON_RUN_AS_NODE: '1' },
    );
    return;
  }

  const backendDir = getBackendDir();
  backendProcess = spawnProcess(
    'npm',
    ['run', 'dev'],
    backendDir,
    'backend',
  );
}

function startFrontendDevServer() {
  if (frontendProcess || app.isPackaged) return;

  const shouldStart =
    process.env.OCEANSAN_START_FRONTEND !== 'false' &&
    process.env.OCEANSAN_START_FRONTEND !== '0';

  if (!shouldStart) return;

  const frontendDir = getFrontendDir();
  frontendProcess = spawnProcess(
    'npm',
    ['run', 'dev'],
    frontendDir,
    'frontend',
  );
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  if (app.isPackaged) {
    const frontendDir = getFrontendDir();
    const indexPath = path.join(frontendDir, 'dist', 'spa', 'index.html');
    await win.loadFile(indexPath);
    return;
  }

  const devUrl = 'http://localhost:9000';
  const ready = await waitForUrl(devUrl, 60, 1000);

  if (!ready) {
    console.warn('Frontend dev server not reachable. Loading fallback page.');
    await win.loadURL('data:text/plain,Frontend dev server not reachable.');
    return;
  }

  await win.loadURL(devUrl);
}

app.on('before-quit', () => {
  killProcessTree(frontendProcess);
  killProcessTree(backendProcess);
});

app.whenReady().then(async () => {
  startBackend();
  startFrontendDevServer();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
