/**
 * ARIA Desktop Main Process
 * Cross-platform Electron runtime with System Tray, Secure IPC, Window State persistence, and Native OS bridging.
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, desktopCapturer, Notification, clipboard } from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn, ChildProcess } from "node:child_process";
import { getDesktopController } from "./controllers";
import { ActionValidator } from "./security/ActionValidator";
import { WindowState } from "./types";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null = null;
const isDev = !app.isPackaged;
const appVersion = app.getVersion() || "1.0.0";

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log("[Electron] Another instance of ARIA is already running. Exiting.");
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Window state file path
function getWindowStatePath(): string {
  return path.join(app.getPath("userData"), "aria-window-state.json");
}

function loadWindowState(): WindowState {
  try {
    const file = getWindowStatePath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      return {
        width: typeof data.width === "number" ? data.width : 1280,
        height: typeof data.height === "number" ? data.height : 840,
        x: data.x,
        y: data.y,
        isMaximized: Boolean(data.isMaximized)
      };
    }
  } catch (e) {
    // Ignore and return defaults
  }
  return { width: 1280, height: 840, isMaximized: false };
}

function saveWindowState(win: BrowserWindow) {
  try {
    const isMaximized = win.isMaximized();
    if (!isMaximized) {
      const bounds = win.getBounds();
      const state: WindowState = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: false
      };
      fs.writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2), "utf8");
    } else {
      const state: WindowState = {
        ...loadWindowState(),
        isMaximized: true
      };
      fs.writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2), "utf8");
    }
  } catch (e) {
    // Non-fatal
  }
}

/**
 * Start Backend Server for full-stack API and WebSocket synchronization
 */
function startBackendServer() {
  console.log("[Electron] Starting ARIA backend server process...");
  
  if (isDev) {
    serverProcess = spawn("npx", ["tsx", "server.ts"], {
      shell: true,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "development" }
    });
  } else {
    // Production bundle
    const serverPath = path.join(__dirname, "..", "server.cjs");
    const fallbackPath = path.join(__dirname, "server.cjs");
    const activePath = fs.existsSync(serverPath) ? serverPath : fallbackPath;

    if (fs.existsSync(activePath)) {
      serverProcess = spawn("node", [activePath], {
        shell: true,
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "production" }
      });
    } else {
      console.warn("[Electron] Production server bundle not found at:", activePath);
    }
  }

  if (serverProcess) {
    serverProcess.on("error", (err) => {
      console.error("[Electron] Backend server process error:", err);
    });
  }
}

/**
 * Create Cross-Platform System Tray
 */
function createSystemTray() {
  if (tray) return;

  const iconPath = path.join(__dirname, "..", "..", "assets", "icon.png");
  let trayIcon = nativeImage.createFromPath(iconPath);
  if (trayIcon.isEmpty()) {
    // Fallback standard icon
    trayIcon = nativeImage.createEmpty();
  } else {
    trayIcon = trayIcon.resize({ width: 18, height: 18 });
  }

  try {
    tray = new Tray(trayIcon);
    tray.setToolTip("ARIA AI Desktop Assistant");

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "⚡ Open ARIA Assistant",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: "🎙️ Toggle Listening (Pause/Resume)",
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send("tray:action", "toggle-listening");
          }
        }
      },
      {
        label: "⚙️ Settings",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.send("tray:action", "settings");
          }
        }
      },
      { type: "separator" },
      {
        label: "🚪 Quit ARIA",
        click: () => {
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on("double-click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (e) {
    console.warn("[Electron] Could not initialize system tray:", e);
  }
}

/**
 * Create Main Desktop Window
 */
function createMainWindow() {
  const windowState = loadWindowState();

  const preloadPath = path.join(__dirname, "preload.cjs");
  const fallbackPreload = path.join(__dirname, "..", "desktop", "preload.cjs");
  const activePreload = fs.existsSync(preloadPath) ? preloadPath : (fs.existsSync(fallbackPreload) ? fallbackPreload : path.join(__dirname, "preload.js"));

  const iconPath = path.join(__dirname, "..", "..", "assets", "icon.png");

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 980,
    minHeight: 680,
    title: "ARIA AI Assistant",
    backgroundColor: "#07080d",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: activePreload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Load URL with automatic retry
  const targetUrl = "http://localhost:3000";
  const tryLoad = (attemptsLeft = 10) => {
    if (!mainWindow) return;
    mainWindow.loadURL(targetUrl).catch((err) => {
      if (attemptsLeft > 0) {
        console.log(`[Electron] Waiting for server at ${targetUrl}... (${attemptsLeft} retries left)`);
        setTimeout(() => tryLoad(attemptsLeft - 1), 1000);
      } else {
        console.error("[Electron] Failed to connect to server:", err);
      }
    });
  };

  // Give server 1.5s to start then connect
  setTimeout(() => tryLoad(), 1500);

  mainWindow.on("resize", () => {
    if (mainWindow) saveWindowState(mainWindow);
  });

  mainWindow.on("move", () => {
    if (mainWindow) saveWindowState(mainWindow);
  });

  mainWindow.on("close", () => {
    if (mainWindow) saveWindowState(mainWindow);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Intercept external links to open in system default browser safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const sanitized = ActionValidator.sanitizeUrl(url);
    if (sanitized) {
      shell.openExternal(sanitized);
    }
    return { action: "deny" };
  });
}

/**
 * Register Secure IPC Handlers
 */
function registerIpcHandlers() {
  const controller = getDesktopController();

  // 1. Safe OS Operations
  ipcMain.handle("desktop:openApplication", async (_event, appName: string) => {
    return await controller.openApplication(appName);
  });

  ipcMain.handle("desktop:openUrl", async (_event, url: string) => {
    return await controller.openUrl(url);
  });

  ipcMain.handle("desktop:lockComputer", async () => {
    return await controller.lockComputer();
  });

  ipcMain.handle("desktop:sleepComputer", async () => {
    return await controller.sleepComputer();
  });

  ipcMain.handle("desktop:restartComputer", async (_event, confirmed?: boolean) => {
    return await controller.restartComputer(confirmed);
  });

  ipcMain.handle("desktop:shutdownComputer", async (_event, confirmed?: boolean) => {
    return await controller.shutdownComputer(confirmed);
  });

  // 2. Hardware & Volume
  ipcMain.handle("desktop:setSystemVolume", async (_event, vol: number | "up" | "down") => {
    return await controller.setSystemVolume(vol);
  });

  ipcMain.handle("desktop:getSystemVolume", async () => {
    return await controller.getSystemVolume();
  });

  ipcMain.handle("desktop:toggleMute", async () => {
    return await controller.toggleMute();
  });

  ipcMain.handle("desktop:getPowerStatus", async () => {
    return await controller.getPowerStatus();
  });

  ipcMain.handle("desktop:getSystemInfo", async () => {
    return await controller.getSystemInfo(appVersion);
  });

  // 3. Screen Sources & Screen Vision
  ipcMain.handle("desktop:getScreenSources", async (_event, types = ["screen", "window"]) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: types as any,
        thumbnailSize: { width: 480, height: 270 },
        fetchWindowIcons: true
      });

      return sources.map((src) => ({
        id: src.id,
        name: src.name,
        thumbnailDataUrl: src.thumbnail.toDataURL(),
        displayId: src.display_id,
        appIcon: src.appIcon ? src.appIcon.toDataURL() : undefined,
        isScreen: src.id.startsWith("screen")
      }));
    } catch (e: any) {
      console.error("[Electron] Failed to get screen sources:", e);
      return [];
    }
  });

  ipcMain.handle("desktop:takeScreenshot", async (_event, displayId?: string) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1920, height: 1080 }
      });
      const target = displayId ? sources.find(s => s.display_id === displayId) || sources[0] : sources[0];
      if (target) {
        return { success: true, dataUrl: target.thumbnail.toDataURL() };
      }
      return { success: false, error: "No screen display found", dataUrl: "" };
    } catch (e: any) {
      return { success: false, error: e.message, dataUrl: "" };
    }
  });

  // 4. Startup & System Notifications
  ipcMain.handle("desktop:setStartupOnBoot", async (_event, enabled: boolean) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: false
      });
      return true;
    } catch (e) {
      console.warn("[Electron] Failed to set login item settings:", e);
      return false;
    }
  });

  ipcMain.handle("desktop:isStartupOnBootEnabled", async () => {
    try {
      const settings = app.getLoginItemSettings();
      return Boolean(settings.openAtLogin);
    } catch {
      return false;
    }
  });

  ipcMain.handle("desktop:showNotification", async (_event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({
        title: title || "ARIA AI Assistant",
        body: body || ""
      }).show();
      return true;
    }
    return false;
  });

  ipcMain.handle("desktop:readClipboard", async () => {
    return clipboard.readText();
  });

  ipcMain.handle("desktop:writeClipboard", async (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  // 5. Window Controls
  ipcMain.on("window:minimize", () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on("window:maximize", () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on("window:restore", () => {
    if (mainWindow && mainWindow.isMinimized()) mainWindow.restore();
  });

  ipcMain.on("window:close", () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle("window:isMaximized", () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });
}

// App lifecycle
app.whenReady().then(() => {
  startBackendServer();
  registerIpcHandlers();
  createMainWindow();
  createSystemTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // Ignore
    }
  }
});
