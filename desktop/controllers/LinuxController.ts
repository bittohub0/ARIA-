/**
 * ARIA Linux Desktop Controller
 * Native Linux implementation supporting Ubuntu, Debian, Fedora, Arch (systemd, loginctl, pactl, amixer, xdg-open).
 */

import { DesktopController } from "./DesktopController";
import { ActionResult, DesktopPlatform, DesktopPowerStatus } from "../types";
import { ActionValidator } from "../security/ActionValidator";
import fs from "node:fs";
import path from "node:path";

export class LinuxController extends DesktopController {
  readonly platform: DesktopPlatform = "linux";
  readonly platformName: string = "Linux Native";

  async openApplication(appName: string): Promise<ActionResult> {
    const sanitized = ActionValidator.sanitizeAppName(appName, "linux");
    if (!sanitized) {
      return ActionValidator.rejectUnauthorized("OPEN_APPLICATION", "linux", "Invalid application name");
    }

    try {
      console.log(`[LinuxController] Launching application on Linux: ${sanitized}`);
      await this.executeShellSafe(`gtk-launch ${sanitized} || ${sanitized} &`);
      return {
        success: true,
        action: "OPEN_APPLICATION",
        message: `Successfully started ${appName} on Linux.`,
        platform: "linux"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "OPEN_APPLICATION",
        message: `Could not launch ${appName} on Linux.`,
        error: e.message,
        platform: "linux"
      };
    }
  }

  async openUrl(url: string): Promise<ActionResult> {
    const sanitizedUrl = ActionValidator.sanitizeUrl(url);
    if (!sanitizedUrl) {
      return ActionValidator.rejectUnauthorized("OPEN_URL", "linux", "Invalid or dangerous URL format");
    }

    try {
      console.log(`[LinuxController] Opening URL with xdg-open: ${sanitizedUrl}`);
      await this.executeShellSafe(`xdg-open "${sanitizedUrl}"`);
      return {
        success: true,
        action: "OPEN_URL",
        message: `Opened ${sanitizedUrl} in default browser.`,
        platform: "linux"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "OPEN_URL",
        message: `Failed to open ${sanitizedUrl} via xdg-open.`,
        error: e.message,
        platform: "linux"
      };
    }
  }

  async lockComputer(): Promise<ActionResult> {
    try {
      console.log("[LinuxController] Locking Linux desktop session...");
      await this.executeShellSafe("loginctl lock-session || xdg-screensaver lock || gnome-screensaver-command -l");
      return {
        success: true,
        action: "LOCK_PC",
        message: "Linux desktop session locked.",
        platform: "linux"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "LOCK_PC",
        message: "Failed to lock Linux session.",
        error: e.message,
        platform: "linux"
      };
    }
  }

  async sleepComputer(): Promise<ActionResult> {
    try {
      console.log("[LinuxController] Suspending Linux system...");
      await this.executeShellSafe("systemctl suspend || pm-suspend || echo mem > /sys/power/state");
      return {
        success: true,
        action: "SLEEP_PC",
        message: "Linux system suspended.",
        platform: "linux"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "SLEEP_PC",
        message: "Failed to suspend Linux system.",
        error: e.message,
        platform: "linux"
      };
    }
  }

  async restartComputer(confirmed: boolean = false): Promise<ActionResult> {
    if (!confirmed) {
      return {
        success: false,
        action: "RESTART_PC",
        message: "Restarting Linux requires your confirmation. Would you like me to reboot now?",
        requiresConfirmation: true,
        platform: "linux"
      };
    }

    try {
      console.log("[LinuxController] Initiating Linux reboot...");
      await this.executeShellSafe("systemctl reboot || reboot || shutdown -r now");
      return {
        success: true,
        action: "RESTART_PC",
        message: "Linux system reboot initiated.",
        platform: "linux"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "RESTART_PC",
        message: "Failed to reboot Linux.",
        error: e.message,
        platform: "linux"
      };
    }
  }

  async shutdownComputer(confirmed: boolean = false): Promise<ActionResult> {
    if (!confirmed) {
      return {
        success: false,
        action: "SHUTDOWN_PC",
        message: "Shutting down Linux requires your confirmation. Would you like me to proceed with power off?",
        requiresConfirmation: true,
        platform: "linux"
      };
    }

    try {
      console.log("[LinuxController] Initiating Linux poweroff...");
      await this.executeShellSafe("systemctl poweroff || poweroff || shutdown -h now");
      return {
        success: true,
        action: "SHUTDOWN_PC",
        message: "Linux system poweroff initiated.",
        platform: "linux"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "SHUTDOWN_PC",
        message: "Failed to shut down Linux.",
        error: e.message,
        platform: "linux"
      };
    }
  }

  async setSystemVolume(volume: number | "up" | "down"): Promise<ActionResult> {
    try {
      let cmd = "";
      if (volume === "up") {
        cmd = "pactl set-sink-volume @DEFAULT_SINK@ +5% || amixer -D pulse sset Master 5%+";
      } else if (volume === "down") {
        cmd = "pactl set-sink-volume @DEFAULT_SINK@ -5% || amixer -D pulse sset Master 5%-";
      } else {
        const val = Math.min(100, Math.max(0, volume));
        cmd = `pactl set-sink-volume @DEFAULT_SINK@ ${val}% || amixer -D pulse sset Master ${val}%`;
      }
      await this.executeShellSafe(cmd);
      return {
        success: true,
        action: "ADJUST_VOLUME",
        message: "Linux audio volume adjusted.",
        platform: "linux"
      };
    } catch (e: any) {
      return {
        success: false,
        action: "ADJUST_VOLUME",
        message: "Could not adjust Linux audio volume.",
        error: e.message,
        platform: "linux"
      };
    }
  }

  async getSystemVolume(): Promise<{ volume: number; isMuted: boolean }> {
    return { volume: 70, isMuted: false };
  }

  async toggleMute(): Promise<{ isMuted: boolean }> {
    try {
      await this.executeShellSafe("pactl set-sink-mute @DEFAULT_SINK@ toggle || amixer -D pulse sset Master toggle");
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
      const sysPowerPath = "/sys/class/power_supply";
      if (fs.existsSync(sysPowerPath)) {
        const supplies = fs.readdirSync(sysPowerPath);
        const bat = supplies.find(s => s.startsWith("BAT"));
        if (bat) {
          hasBattery = true;
          const batDir = path.join(sysPowerPath, bat);
          if (fs.existsSync(path.join(batDir, "capacity"))) {
            const cap = parseInt(fs.readFileSync(path.join(batDir, "capacity"), "utf8").trim(), 10);
            if (!isNaN(cap)) batteryPercent = Math.min(100, Math.max(0, cap));
          }
          if (fs.existsSync(path.join(batDir, "status"))) {
            const status = fs.readFileSync(path.join(batDir, "status"), "utf8").trim();
            isCharging = /charging|full/i.test(status);
            powerSource = isCharging ? "AC" : "Battery";
          }
        }
      }
    } catch {
      // Default
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
