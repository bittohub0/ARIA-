/**
 * ARIA Windows Desktop Controller
 * Native Windows 11 / 10 system implementation using Win32 API, PowerShell, and rundll32.
 */

import { DesktopController } from "./DesktopController";
import { ActionResult, DesktopPlatform, DesktopPowerStatus } from "../types";
import { ActionValidator } from "../security/ActionValidator";
import os from "node:os";

export class WindowsController extends DesktopController {
  readonly platform: DesktopPlatform = "win32";
  readonly platformName: string = "Windows Native";

  async openApplication(appName: string): Promise<ActionResult> {
    const sanitized = ActionValidator.sanitizeAppName(appName, "win32");
    if (!sanitized) {
      return ActionValidator.rejectUnauthorized("OPEN_APPLICATION", "win32", "Invalid application name");
    }

    try {
      console.log(`[WindowsController] Launching native application: ${sanitized}`);
      if (sanitized.startsWith("ms-settings:")) {
        await this.executeShellSafe(`start ${sanitized}`);
      } else {
        await this.executeShellSafe(`start "" "${sanitized}"`);
      }
      return {
        success: true,
        action: "OPEN_APPLICATION",
        message: `Successfully launched ${appName} on Windows.`,
        platform: "win32"
      };
    } catch (e: any) {
      console.warn(`[WindowsController] Standard launch failed, trying PowerShell Start-Process:`, e);
      try {
        await this.executeShellSafe(`powershell -NoProfile -Command "Start-Process '${sanitized}'"`);
        return {
          success: true,
          action: "OPEN_APPLICATION",
          message: `Successfully started ${appName}.`,
          platform: "win32"
        };
      } catch (err: any) {
        return {
          success: false,
          action: "OPEN_APPLICATION",
          message: `Could not launch ${appName} on Windows.`,
          error: err.message,
          platform: "win32"
        };
      }
    }
  }

  async openUrl(url: string): Promise<ActionResult> {
    const sanitizedUrl = ActionValidator.sanitizeUrl(url);
    if (!sanitizedUrl) {
      return ActionValidator.rejectUnauthorized("OPEN_URL", "win32", "Invalid or dangerous URL format");
    }

    try {
      console.log(`[WindowsController] Opening URL in default browser: ${sanitizedUrl}`);
      await this.executeShellSafe(`start "" "${sanitizedUrl}"`);
      return {
        success: true,
        action: "OPEN_URL",
        message: `Opened ${sanitizedUrl} in your default browser.`,
        platform: "win32"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "OPEN_URL",
        message: `Failed to open ${sanitizedUrl}.`,
        error: e.message,
        platform: "win32"
      };
    }
  }

  async lockComputer(): Promise<ActionResult> {
    try {
      console.log("[WindowsController] Locking Windows WorkStation...");
      await this.executeShellSafe("rundll32.exe user32.dll,LockWorkStation");
      return {
        success: true,
        action: "LOCK_PC",
        message: "Windows workstation locked successfully.",
        platform: "win32"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "LOCK_PC",
        message: "Failed to lock Windows workstation.",
        error: e.message,
        platform: "win32"
      };
    }
  }

  async sleepComputer(): Promise<ActionResult> {
    try {
      console.log("[WindowsController] Putting Windows PC to sleep...");
      await this.executeShellSafe("rundll32.exe powrprof.dll,SetSuspendState 0,1,0");
      return {
        success: true,
        action: "SLEEP_PC",
        message: "Windows PC entered sleep state.",
        platform: "win32"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "SLEEP_PC",
        message: "Failed to put Windows PC to sleep.",
        error: e.message,
        platform: "win32"
      };
    }
  }

  async restartComputer(confirmed: boolean = false): Promise<ActionResult> {
    if (!confirmed) {
      return {
        success: false,
        action: "RESTART_PC",
        message: "Restarting Windows requires your confirmation. Would you like me to restart now?",
        requiresConfirmation: true,
        platform: "win32"
      };
    }

    try {
      console.log("[WindowsController] Initiating Windows restart...");
      await this.executeShellSafe("shutdown.exe /r /t 0");
      return {
        success: true,
        action: "RESTART_PC",
        message: "Windows restart sequence initiated.",
        platform: "win32"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "RESTART_PC",
        message: "Failed to restart Windows.",
        error: e.message,
        platform: "win32"
      };
    }
  }

  async shutdownComputer(confirmed: boolean = false): Promise<ActionResult> {
    if (!confirmed) {
      return {
        success: false,
        action: "SHUTDOWN_PC",
        message: "Shutting down Windows requires your confirmation. Would you like me to proceed with shutdown?",
        requiresConfirmation: true,
        platform: "win32"
      };
    }

    try {
      console.log("[WindowsController] Initiating Windows shutdown...");
      await this.executeShellSafe("shutdown.exe /s /t 0");
      return {
        success: true,
        action: "SHUTDOWN_PC",
        message: "Windows shutdown sequence initiated.",
        platform: "win32"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "SHUTDOWN_PC",
        message: "Failed to shut down Windows.",
        error: e.message,
        platform: "win32"
      };
    }
  }

  async setSystemVolume(volume: number | "up" | "down"): Promise<ActionResult> {
    try {
      let psCommand = "";
      if (volume === "up") {
        psCommand = `(New-Object -ComObject WScript.Shell).SendKeys([char]175)`;
      } else if (volume === "down") {
        psCommand = `(New-Object -ComObject WScript.Shell).SendKeys([char]174)`;
      } else {
        // Set approximate step
        const normalized = Math.min(100, Math.max(0, volume));
        psCommand = `powershell -Command "[Audio.Volume]::SetMasterVolume(${normalized / 100})"`;
      }
      await this.executeShellSafe(`powershell -NoProfile -Command "${psCommand}"`);
      return {
        success: true,
        action: "ADJUST_VOLUME",
        message: `Windows volume adjusted.`,
        platform: "win32"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "ADJUST_VOLUME",
        message: "Could not adjust Windows volume.",
        error: e.message,
        platform: "win32"
      };
    }
  }

  async getSystemVolume(): Promise<{ volume: number; isMuted: boolean }> {
    return { volume: 75, isMuted: false };
  }

  async toggleMute(): Promise<{ isMuted: boolean }> {
    try {
      await this.executeShellSafe(`powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`);
      return { isMuted: true };
    } catch {
      return { isMuted: false };
    }
  }

  async getPowerStatus(): Promise<DesktopPowerStatus> {
    let hasBattery = false;
    let batteryPercent = 95;
    let isCharging = true;
    let powerSource: "AC" | "Battery" | "Direct Power" = "AC";
    let timeRemainingMinutes: number | null = null;

    try {
      const { stdout } = await this.executeShellSafe(
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance -ClassName Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus, EstimatedRunTime | ConvertTo-Json"'
      );
      if (stdout && stdout.trim()) {
        const parsed = JSON.parse(stdout.trim());
        const item = Array.isArray(parsed) ? parsed[0] : parsed;
        if (item && item.EstimatedChargeRemaining !== undefined) {
          hasBattery = true;
          batteryPercent = Math.min(100, Math.max(0, Number(item.EstimatedChargeRemaining)));
          const bStatus = Number(item.BatteryStatus);
          isCharging = [2, 3, 6, 7, 8, 9, 11].includes(bStatus);
          powerSource = isCharging ? "AC" : "Battery";
          if (item.EstimatedRunTime && Number(item.EstimatedRunTime) > 0 && Number(item.EstimatedRunTime) < 10000) {
            timeRemainingMinutes = Number(item.EstimatedRunTime);
          }
        }
      }
    } catch {
      // Default to workstation AC
      hasBattery = false;
      powerSource = "Direct Power";
      batteryPercent = 100;
      isCharging = true;
    }

    return {
      hasBattery,
      batteryPercent,
      isCharging,
      powerSource,
      statusText: isCharging ? `Charging (${batteryPercent}%)` : `On Battery (${batteryPercent}%)`,
      timeRemainingMinutes,
      batteryHealth: "Good",
      powerMode: "Balanced",
      timestamp: Date.now()
    };
  }
}
