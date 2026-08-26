/**
 * ARIA Desktop Controller Factory
 * Dynamically resolves the native platform controller (Windows, macOS, or Linux).
 */

import os from "node:os";
import { DesktopController } from "./DesktopController";
import { WindowsController } from "./WindowsController";
import { MacOSController } from "./MacOSController";
import { LinuxController } from "./LinuxController";

let instance: DesktopController | null = null;

export function getDesktopController(): DesktopController {
  if (instance) return instance;

  const platform = os.platform();
  if (platform === "win32") {
    instance = new WindowsController();
  } else if (platform === "darwin") {
    instance = new MacOSController();
  } else {
    instance = new LinuxController();
  }

  console.log(`[DesktopController] Initialized native host controller: ${instance.platformName} (${instance.platform})`);
  return instance;
}

export * from "./DesktopController";
export * from "./WindowsController";
export * from "./MacOSController";
export * from "./LinuxController";
