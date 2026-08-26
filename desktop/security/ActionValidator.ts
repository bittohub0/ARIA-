/**
 * ARIA Desktop Security & Action Validation Layer
 * 
 * Enforces strict allowlisting, parameter sanitization, and safety confirmations.
 * AI output is NEVER executed as raw shell strings.
 */

import { AllowedActionType, ActionResult, DesktopPlatform } from "../types";

export const ALLOWED_ACTIONS: ReadonlySet<AllowedActionType> = new Set([
  "OPEN_APPLICATION",
  "OPEN_URL",
  "LOCK_PC",
  "SLEEP_PC",
  "RESTART_PC",
  "SHUTDOWN_PC",
  "SCREEN_CAPTURE",
  "GET_SCREEN_SOURCES",
  "ADJUST_VOLUME",
  "GET_VOLUME",
  "TOGGLE_MUTE",
  "SET_STARTUP",
  "GET_STARTUP_STATUS",
  "GET_POWER_STATUS",
  "GET_SYSTEM_INFO",
  "SHOW_NOTIFICATION",
  "READ_CLIPBOARD",
  "WRITE_CLIPBOARD"
]);

// Allowlisted Known Safe Desktop Applications
export const SAFE_APPLICATION_NAMES: Record<string, { win: string; mac: string; linux: string }> = {
  notepad: { win: "notepad.exe", mac: "TextEdit", linux: "gedit" },
  calculator: { win: "calc.exe", mac: "Calculator", linux: "gnome-calculator" },
  browser: { win: "chrome.exe", mac: "Google Chrome", linux: "google-chrome" },
  chrome: { win: "chrome.exe", mac: "Google Chrome", linux: "google-chrome" },
  firefox: { win: "firefox.exe", mac: "Firefox", linux: "firefox" },
  edge: { win: "msedge.exe", mac: "Microsoft Edge", linux: "microsoft-edge" },
  code: { win: "code.cmd", mac: "Visual Studio Code", linux: "code" },
  vscode: { win: "code.cmd", mac: "Visual Studio Code", linux: "code" },
  spotify: { win: "spotify.exe", mac: "Spotify", linux: "spotify" },
  terminal: { win: "wt.exe", mac: "Terminal", linux: "gnome-terminal" },
  cmd: { win: "cmd.exe", mac: "Terminal", linux: "gnome-terminal" },
  paint: { win: "mspaint.exe", mac: "Preview", linux: "gimp" },
  explorer: { win: "explorer.exe", mac: "Finder", linux: "nautilus" },
  finder: { win: "explorer.exe", mac: "Finder", linux: "nautilus" },
  settings: { win: "ms-settings:", mac: "System Preferences", linux: "gnome-control-center" },
  taskmanager: { win: "taskmgr.exe", mac: "Activity Monitor", linux: "gnome-system-monitor" }
};

export class ActionValidator {
  /**
   * Check if action is in the strict allowlist
   */
  static isAllowedAction(action: string): action is AllowedActionType {
    return ALLOWED_ACTIONS.has(action as AllowedActionType);
  }

  /**
   * Validates whether a dangerous action requires explicit user confirmation
   */
  static requiresConfirmation(action: AllowedActionType): boolean {
    return action === "SHUTDOWN_PC" || action === "RESTART_PC";
  }

  /**
   * Sanitize URL to ensure valid protocol (http, https, mailto, steam, etc.)
   */
  static sanitizeUrl(url: string): string | null {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    
    // Prevent malicious protocol injection like javascript:, data:, file:, etc.
    if (/^(javascript|data|vbscript):/i.test(trimmed)) {
      return null;
    }

    try {
      // Add default https if missing
      const urlToTest = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const parsed = new URL(urlToTest);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Sanitize and map application name safely
   */
  static sanitizeAppName(appName: string, platform: DesktopPlatform): string {
    if (!appName || typeof appName !== "string") return "";
    const clean = appName.toLowerCase().replace(/[^a-z0-9_\-\.\s]/g, "").trim();
    
    // Check if known alias exists
    if (SAFE_APPLICATION_NAMES[clean]) {
      const entry = SAFE_APPLICATION_NAMES[clean];
      if (platform === "win32") return entry.win;
      if (platform === "darwin") return entry.mac;
      return entry.linux;
    }

    // Otherwise return cleaned single token or string without dangerous shell metacharacters
    return clean;
  }

  /**
   * Rejects invalid or dangerous requests with formatted ActionResult
   */
  static rejectUnauthorized(action: string, platform: DesktopPlatform, reason: string): ActionResult {
    return {
      success: false,
      action: (action as AllowedActionType) || "OPEN_APPLICATION",
      message: `Security validation blocked action "${action}": ${reason}`,
      error: reason,
      platform
    };
  }
}
