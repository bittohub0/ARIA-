/**
 * ARIA Abstract Desktop Controller
 * 
 * Provides unified interface and common utilities for OS-specific desktop controllers.
 */

import {
  DesktopPlatform,
  ActionResult,
  DesktopPowerStatus,
  DesktopSystemInfo,
  DesktopScreenSource
} from "../types";
import { ActionValidator } from "../security/ActionValidator";
import os from "node:os";

export abstract class DesktopController {
  abstract readonly platform: DesktopPlatform;
  abstract readonly platformName: string;

  /**
   * Safe application launcher
   */
  abstract openApplication(appName: string): Promise<ActionResult>;

  /**
   * Safe external browser URL opener
   */
  abstract openUrl(url: string): Promise<ActionResult>;

  /**
   * Workstation lock
   */
  abstract lockComputer(): Promise<ActionResult>;

  /**
   * System sleep / standby
   */
  abstract sleepComputer(): Promise<ActionResult>;

  /**
   * System restart (strictly confirmed)
   */
  abstract restartComputer(confirmed?: boolean): Promise<ActionResult>;

  /**
   * System shutdown (strictly confirmed)
   */
  abstract shutdownComputer(confirmed?: boolean): Promise<ActionResult>;

  /**
   * Audio volume controller (0-100 or relative)
   */
  abstract setSystemVolume(volume: number | "up" | "down"): Promise<ActionResult>;
  abstract getSystemVolume(): Promise<{ volume: number; isMuted: boolean }>;
  abstract toggleMute(): Promise<{ isMuted: boolean }>;

  /**
   * Hardware power & battery state
   */
  abstract getPowerStatus(): Promise<DesktopPowerStatus>;

  /**
   * System telemetry & specs
   */
  async getSystemInfo(appVersion: string = "1.0.0"): Promise<DesktopSystemInfo> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    const cpus = os.cpus() || [];
    const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : "Host CPU";
    const cpuCores = cpus.length || 4;

    // Calculate approximate CPU load
    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    }
    const cpuLoadPercent = Math.min(100, Math.max(5, Math.round((1 - totalIdle / (totalTick || 1)) * 100)));

    return {
      platform: this.platform,
      platformName: this.platformName,
      osRelease: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      username: os.userInfo ? os.userInfo().username : "User",
      cpuModel,
      cpuCores,
      cpuLoadPercent,
      totalMemoryBytes: totalMem,
      freeMemoryBytes: freeMem,
      usedMemoryPercent: usedMemPercent,
      uptimeSeconds: Math.floor(os.uptime()),
      appVersion,
      isElectron: Boolean(process.versions.electron)
    };
  }

  /**
   * Safe command execution wrapper
   */
  protected executeShellSafe(cmd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // Import child_process dynamically
      import("node:child_process").then(({ exec }) => {
        exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
          if (err) {
            reject(err);
          } else {
            resolve({ stdout: stdout ? stdout.toString() : "", stderr: stderr ? stderr.toString() : "" });
          }
        });
      }).catch(reject);
    });
  }
}
