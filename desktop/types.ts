/**
 * ARIA Desktop Native Types & IPC Interface Definitions
 * Cross-platform type safety for Windows, macOS, and Linux desktop integration.
 */

export type DesktopPlatform = "win32" | "darwin" | "linux";

export type AllowedActionType =
  | "OPEN_APPLICATION"
  | "OPEN_URL"
  | "LOCK_PC"
  | "SLEEP_PC"
  | "RESTART_PC"
  | "SHUTDOWN_PC"
  | "SCREEN_CAPTURE"
  | "GET_SCREEN_SOURCES"
  | "ADJUST_VOLUME"
  | "GET_VOLUME"
  | "TOGGLE_MUTE"
  | "SET_STARTUP"
  | "GET_STARTUP_STATUS"
  | "GET_POWER_STATUS"
  | "GET_SYSTEM_INFO"
  | "SHOW_NOTIFICATION"
  | "READ_CLIPBOARD"
  | "WRITE_CLIPBOARD";

export interface ActionResult<T = any> {
  success: boolean;
  action: AllowedActionType;
  message: string;
  data?: T;
  error?: string;
  platform: DesktopPlatform;
  requiresConfirmation?: boolean;
}

export interface DesktopScreenSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  displayId?: string;
  appIcon?: string;
  isScreen: boolean;
}

export interface DesktopSystemInfo {
  platform: DesktopPlatform;
  platformName: string;
  osRelease: string;
  arch: string;
  hostname: string;
  username: string;
  cpuModel: string;
  cpuCores: number;
  cpuLoadPercent: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  usedMemoryPercent: number;
  uptimeSeconds: number;
  appVersion: string;
  isElectron: boolean;
}

export interface DesktopPowerStatus {
  hasBattery: boolean;
  batteryPercent: number;
  isCharging: boolean;
  powerSource: "AC" | "Battery" | "Direct Power" | "Unknown";
  statusText: string;
  timeRemainingMinutes: number | null;
  batteryHealth: string;
  powerMode: "Balanced" | "Battery Saver" | "High Performance";
  voltageMv?: number;
  temperatureC?: number;
  timestamp: number;
}

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

export interface AriaDesktopBridge {
  isDesktop: boolean;
  platform: DesktopPlatform;
  appVersion: string;
  
  // Safe OS Operations
  openApplication: (appName: string) => Promise<ActionResult>;
  openUrl: (url: string) => Promise<ActionResult>;
  lockComputer: () => Promise<ActionResult>;
  sleepComputer: () => Promise<ActionResult>;
  restartComputer: (confirmed?: boolean) => Promise<ActionResult>;
  shutdownComputer: (confirmed?: boolean) => Promise<ActionResult>;
  
  // Media & Hardware
  getScreenSources: (types?: string[]) => Promise<DesktopScreenSource[]>;
  takeScreenshot: (displayId?: string) => Promise<{ success: boolean; dataUrl: string; error?: string }>;
  setSystemVolume: (volume: number | "up" | "down") => Promise<ActionResult>;
  getSystemVolume: () => Promise<{ volume: number; isMuted: boolean }>;
  toggleMute: () => Promise<{ isMuted: boolean }>;
  getPowerStatus: () => Promise<DesktopPowerStatus>;
  getSystemInfo: () => Promise<DesktopSystemInfo>;
  
  // OS Integrations
  setStartupOnBoot: (enabled: boolean) => Promise<boolean>;
  isStartupOnBootEnabled: () => Promise<boolean>;
  showNotification: (title: string, body: string) => Promise<boolean>;
  readClipboard: () => Promise<string>;
  writeClipboard: (text: string) => Promise<boolean>;
  
  // Window Management
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  restoreWindow: () => void;
  closeWindow: () => void;
  isWindowMaximized: () => Promise<boolean>;
  
  // Event listeners
  onTrayAction: (callback: (action: "open" | "toggle-listening" | "settings" | "quit") => void) => () => void;
  onPowerChange: (callback: (status: DesktopPowerStatus) => void) => () => void;
}

declare global {
  interface Window {
    ariaDesktop?: AriaDesktopBridge;
  }
}
