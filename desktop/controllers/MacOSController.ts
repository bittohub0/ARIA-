/**
 * ARIA macOS Desktop Controller
 * Native macOS implementation using AppleScript (osascript), pmset, open, and CoreGraphics bridging.
 */

import { DesktopController } from "./DesktopController";
import { ActionResult, DesktopPlatform, DesktopPowerStatus } from "../types";
import { ActionValidator } from "../security/ActionValidator";

export class MacOSController extends DesktopController {
  readonly platform: DesktopPlatform = "darwin";
  readonly platformName: string = "macOS Native";

  async openApplication(appName: string): Promise<ActionResult> {
    const sanitized = ActionValidator.sanitizeAppName(appName, "darwin");
    if (!sanitized) {
      return ActionValidator.rejectUnauthorized("OPEN_APPLICATION", "darwin", "Invalid application name");
    }

    try {
      console.log(`[MacOSController] Launching application on macOS: ${sanitized}`);
      await this.executeShellSafe(`open -a "${sanitized}"`);
      return {
        success: true,
        action: "OPEN_APPLICATION",
        message: `Successfully opened ${appName} on macOS.`,
        platform: "darwin"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "OPEN_APPLICATION",
        message: `Could not launch ${appName} on macOS. Please ensure it is installed in /Applications.`,
        error: e.message,
        platform: "darwin"
      };
    }
  }

  async openUrl(url: string): Promise<ActionResult> {
    const sanitizedUrl = ActionValidator.sanitizeUrl(url);
    if (!sanitizedUrl) {
      return ActionValidator.rejectUnauthorized("OPEN_URL", "darwin", "Invalid or dangerous URL format");
    }

    try {
      console.log(`[MacOSController] Opening URL in macOS default browser: ${sanitizedUrl}`);
      await this.executeShellSafe(`open "${sanitizedUrl}"`);
      return {
        success: true,
        action: "OPEN_URL",
        message: `Opened ${sanitizedUrl} in Safari / default browser.`,
        platform: "darwin"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "OPEN_URL",
        message: `Failed to open ${sanitizedUrl}.`,
        error: e.message,
        platform: "darwin"
      };
    }
  }

  async lockComputer(): Promise<ActionResult> {
    try {
      console.log("[MacOSController] Locking macOS session...");
      await this.executeShellSafe("pmset displaysleepnow || osascript -e 'tell application \"System Events\" to keystroke \"q\" using {control down, command down}'");
      return {
        success: true,
        action: "LOCK_PC",
        message: "macOS screen locked successfully.",
        platform: "darwin"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "LOCK_PC",
        message: "Failed to lock macOS screen.",
        error: e.message,
        platform: "darwin"
      };
    }
  }

  async sleepComputer(): Promise<ActionResult> {
    try {
      console.log("[MacOSController] Putting Mac to sleep...");
      await this.executeShellSafe("pmset sleepnow || osascript -e 'tell app \"System Events\" to sleep'");
      return {
        success: true,
        action: "SLEEP_PC",
        message: "Mac placed into sleep mode.",
        platform: "darwin"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "SLEEP_PC",
        message: "Failed to sleep Mac.",
        error: e.message,
        platform: "darwin"
      };
    }
  }

  async restartComputer(confirmed: boolean = false): Promise<ActionResult> {
    if (!confirmed) {
      return {
        success: false,
        action: "RESTART_PC",
        message: "Restarting macOS requires your confirmation. Would you like me to restart now?",
        requiresConfirmation: true,
        platform: "darwin"
      };
    }

    try {
      console.log("[MacOSController] Initiating macOS restart...");
      await this.executeShellSafe("osascript -e 'tell app \"System Events\" to restart'");
      return {
        success: true,
        action: "RESTART_PC",
        message: "macOS restart sequence initiated.",
        platform: "darwin"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "RESTART_PC",
        message: "Failed to restart macOS.",
        error: e.message,
        platform: "darwin"
      };
    }
  }

  async shutdownComputer(confirmed: boolean = false): Promise<ActionResult> {
    if (!confirmed) {
      return {
        success: false,
        action: "SHUTDOWN_PC",
        message: "Shutting down macOS requires your confirmation. Would you like me to proceed with shutdown?",
        requiresConfirmation: true,
        platform: "darwin"
      };
    }

    try {
      console.log("[MacOSController] Initiating macOS shutdown...");
      await this.executeShellSafe("osascript -e 'tell app \"System Events\" to shut down'");
      return {
        success: true,
        action: "SHUTDOWN_PC",
        message: "macOS shutdown sequence initiated.",
        platform: "darwin"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "SHUTDOWN_PC",
        message: "Failed to shut down macOS.",
        error: e.message,
        platform: "darwin"
      };
    }
  }

  async setSystemVolume(volume: number | "up" | "down"): Promise<ActionResult> {
    try {
      let script = "";
      if (volume === "up") {
        script = `osascript -e "set volume output volume ((output volume of (get volume settings)) + 10)"`;
      } else if (volume === "down") {
        script = `osascript -e "set volume output volume ((output volume of (get volume settings)) - 10)"`;
      } else {
        const val = Math.min(100, Math.max(0, volume));
        script = `osascript -e "set volume output volume ${val}"`;
      }
      await this.executeShellSafe(script);
      return {
        success: true,
        action: "ADJUST_VOLUME",
        message: "macOS volume adjusted.",
        platform: "darwin"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "ADJUST_VOLUME",
        message: "Could not adjust macOS volume.",
        error: e.message,
        platform: "darwin"
      };
    }
  }

  async getSystemVolume(): Promise<{ volume: number; isMuted: boolean }> {
    try {
      const { stdout } = await this.executeShellSafe(`osascript -e "output volume of (get volume settings)"`);
      const vol = parseInt(stdout.trim(), 10);
      return { volume: isNaN(vol) ? 70 : vol, isMuted: false };
    } catch {
      return { volume: 70, isMuted: false };
    }
  }

  async toggleMute(): Promise<{ isMuted: boolean }> {
    try {
      await this.executeShellSafe(`osascript -e "set volume output muted (not (output muted of (get volume settings)))"`);
      return { isMuted: true };
    } catch {
      return { isMuted: false };
    }
  }

  async getPowerStatus(): Promise<DesktopPowerStatus> {
    let hasBattery = false;
    let batteryPercent = 90;
    let isCharging = true;
    let powerSource: "AC" | "Battery" | "Direct Power" = "AC";
    let timeRemainingMinutes: number | null = null;

    try {
      const { stdout } = await this.executeShellSafe("pmset -g batt");
      if (stdout) {
        hasBattery = true;
        const pctMatch = stdout.match(/(\d+)%/);
        if (pctMatch) batteryPercent = parseInt(pctMatch[1], 10);
        isCharging = stdout.includes("charging") || stdout.includes("AC attached") || stdout.includes("charged");
        powerSource = isCharging ? "AC" : "Battery";
        const timeMatch = stdout.match(/(\d+):(\d+)\s+remaining/);
        if (timeMatch) {
          timeRemainingMinutes = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
        }
      }
    } catch {
      // Fallback
    }

    return {
      hasBattery,
      batteryPercent,
      isCharging,
      powerSource,
      statusText: isCharging ? `Charging (${batteryPercent}%)` : `On Battery (${batteryPercent}%)`,
      timeRemainingMinutes,
      batteryHealth: "Normal",
      powerMode: "Balanced",
      timestamp: Date.now()
    };
  }
}
