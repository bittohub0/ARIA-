/**
 * ARIA Desktop Preload Bridge
 * 
 * Secure contextIsolation bridge exposing strictly typed native OS APIs
 * without allowing unrestricted Node.js primitives into renderer.
 */

import { contextBridge, ipcRenderer } from "electron";
import { AriaDesktopBridge, DesktopPlatform } from "./types";

const platform: DesktopPlatform = (process.platform as DesktopPlatform) || "win32";

const bridge: AriaDesktopBridge = {
  isDesktop: true,
  platform,
  appVersion: "1.0.0",

  // Safe OS Operations
  openApplication: (appName: string) => ipcRenderer.invoke("desktop:openApplication", appName),
  openUrl: (url: string) => ipcRenderer.invoke("desktop:openUrl", url),
  lockComputer: () => ipcRenderer.invoke("desktop:lockComputer"),
  sleepComputer: () => ipcRenderer.invoke("desktop:sleepComputer"),
  restartComputer: (confirmed?: boolean) => ipcRenderer.invoke("desktop:restartComputer", confirmed),
  shutdownComputer: (confirmed?: boolean) => ipcRenderer.invoke("desktop:shutdownComputer", confirmed),

  // Media & Hardware
  getScreenSources: (types?: string[]) => ipcRenderer.invoke("desktop:getScreenSources", types),
  takeScreenshot: (displayId?: string) => ipcRenderer.invoke("desktop:takeScreenshot", displayId),
  setSystemVolume: (vol: number | "up" | "down") => ipcRenderer.invoke("desktop:setSystemVolume", vol),
  getSystemVolume: () => ipcRenderer.invoke("desktop:getSystemVolume"),
  toggleMute: () => ipcRenderer.invoke("desktop:toggleMute"),
  getPowerStatus: () => ipcRenderer.invoke("desktop:getPowerStatus"),
  getSystemInfo: () => ipcRenderer.invoke("desktop:getSystemInfo"),

  // Integrations
  setStartupOnBoot: (enabled: boolean) => ipcRenderer.invoke("desktop:setStartupOnBoot", enabled),
  isStartupOnBootEnabled: () => ipcRenderer.invoke("desktop:isStartupOnBootEnabled"),
  showNotification: (title: string, body: string) => ipcRenderer.invoke("desktop:showNotification", { title, body }),
  readClipboard: () => ipcRenderer.invoke("desktop:readClipboard"),
  writeClipboard: (text: string) => ipcRenderer.invoke("desktop:writeClipboard", text),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  maximizeWindow: () => ipcRenderer.send("window:maximize"),
  restoreWindow: () => ipcRenderer.send("window:restore"),
  closeWindow: () => ipcRenderer.send("window:close"),
  isWindowMaximized: () => ipcRenderer.invoke("window:isMaximized"),

  // Subscriptions
  onTrayAction: (callback) => {
    const handler = (_event: any, action: "open" | "toggle-listening" | "settings" | "quit") => callback(action);
    ipcRenderer.on("tray:action", handler);
    return () => {
      ipcRenderer.removeListener("tray:action", handler);
    };
  },

  onPowerChange: (callback) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on("power:changed", handler);
    return () => {
      ipcRenderer.removeListener("power:changed", handler);
    };
  }
};

contextBridge.exposeInMainWorld("ariaDesktop", bridge);
