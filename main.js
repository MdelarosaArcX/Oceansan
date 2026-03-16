const path = require('path');
const { app, BrowserWindow, protocol, dialog } = require('electron');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function getRootDir() {
  return app.isPackaged ? app.getAppPath() : __dirname;
}

function getBackendDir() {
  if (!app.isPackaged) {
    return path.join(getRootDir(), 'oceansan-backend');
  }

  const resourcesPath = process.resourcesPath;
  const packagedPath = path.join(resourcesPath, 'oceansan-backend');
  if (fs.existsSync(packagedPath)) {
    return packagedPath;
  }

  const fallbackPath = path.join(resourcesPath, 'app.asar.unpacked', 'oceansan-backend');
  return fallbackPath;
}

function getFrontendDir() {
  if (!app.isPackaged) {
    return path.join(getRootDir(), 'oceansan-frontend');
  }

  const appPath = getRootDir();
  const packagedPath = path.join(appPath, 'oceansan-frontend');
  if (fs.existsSync(packagedPath)) {
    return packagedPath;
  }

  const fallbackPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'oceansan-frontend');
  return fallbackPath;
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
    shell: process.platform === 'win32' && !app.isPackaged,
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
    const serverPath = path.join(backendDir, 'dist', 'server.js');
    const userDataDir = app.getPath('userData');
    const sqliteDir = path.join(userDataDir, 'oceansan-backend', 'data');
    const sqlitePath = path.join(sqliteDir, 'app.sqlite');

    if (!fs.existsSync(sqliteDir)) {
      fs.mkdirSync(sqliteDir, { recursive: true });
    }

    if (!fs.existsSync(serverPath)) {
      dialog.showErrorBox(
        'Backend Not Found',
        `Missing backend build at: ${serverPath}`,
      );
      return;
    }

    backendProcess = spawnProcess(
      process.execPath,
      [serverPath],
      backendDir,
      'backend',
      {
        ELECTRON_RUN_AS_NODE: '1',
        SQLITE_DB: sqlitePath,
      },
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
    await win.loadURL('app://index.html');
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
  if (app.isPackaged) {
    const frontendDir = getFrontendDir();
    const spaRoot = path.join(frontendDir, 'dist', 'spa');

    if (!fs.existsSync(spaRoot)) {
      dialog.showErrorBox(
        'Frontend Not Found',
        `Missing frontend build at: ${spaRoot}`,
      );
    }

    protocol.registerFileProtocol('app', (request, callback) => {
      const urlPath = request.url.replace('app://', '');
      let safePath = urlPath.replace(/^\/+/, '');

      // Handle app://index.html/assets/... (some builds resolve relative paths this way)
      if (safePath.startsWith('index.html/')) {
        safePath = safePath.slice('index.html/'.length);
      }

      let filePath = path.join(spaRoot, safePath || 'index.html');

      if (!fs.existsSync(filePath)) {
        filePath = path.join(spaRoot, 'index.html');
      }

      callback({ path: filePath });
    });
  }

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
