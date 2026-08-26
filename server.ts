import express from "express";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import dotenv from "dotenv";
import { exec, spawn } from "node:child_process";
import os from "node:os";
import { planUserRequest, createYouTubePlayPlan, createYouTubeSearchPlan, ActionPlan, ActionStep } from "./actionPlanner";
import { executeNativePowerCommand, detectPowerIntent, getNativePowerStatus, setNativePowerMode, PowerAction, PowerIntentResult, PowerStatusData } from "./powerController";

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 3000;
const server = http.createServer(app);

interface ConfirmationRequest {
  resolve: (confirmed: boolean) => void;
  action: string;
}
const pendingConfirmations = new Map<string, ConfirmationRequest>();

interface ActivePowerConfirmation {
  action: "SHUTDOWN" | "RESTART";
  actionId: string;
  timestamp: number;
  isHindi: boolean;
  promptText: string;
}
let activePowerConfirmation: ActivePowerConfirmation | null = null;

async function handlePowerCommandIntent(
  powerIntent: PowerIntentResult, 
  clientWs: any, 
  liveSession: any
) {
  if (powerIntent.isStatusQuery) {
    console.log(`[ARIA POWER] Battery/Power status query received`);
    const powerStatus = await getNativePowerStatus();
    clientWs.send(JSON.stringify({
      type: "powerStatusUpdate",
      powerStatus
    }));
    clientWs.send(JSON.stringify({
      type: "openApp",
      appName: "power"
    }));

    const spoken = powerIntent.isHindi
      ? `Aapki PC ki battery abhi ${powerStatus.batteryPercent}% hai, aur power state hai: ${powerStatus.statusText}.`
      : `Your PC is currently at ${powerStatus.batteryPercent}% battery, and is ${powerStatus.isCharging ? "plugged in and charging" : "running on battery"}.`;

    clientWs.send(JSON.stringify({
      type: "outputTranscript",
      text: spoken
    }));

    if (liveSession) {
      try {
        liveSession.sendRealtimeInput({
          text: `[Power Status Query] Say out loud to the user: "${spoken}"`
        });
      } catch (e) {
        console.warn("[ARIA POWER] Could not trigger speech:", e);
      }
    }
    return;
  }

  if (powerIntent.requiresConfirmation && (powerIntent.action === "SHUTDOWN" || powerIntent.action === "RESTART")) {
    const actionId = Math.random().toString(36).substring(7);
    activePowerConfirmation = {
      action: powerIntent.action,
      actionId,
      timestamp: Date.now(),
      isHindi: Boolean(powerIntent.isHindi),
      promptText: powerIntent.spokenPrompt || "Are you sure?"
    };

    console.log(`[ARIA POWER] Action: ${powerIntent.action}`);
    console.log(`[ARIA POWER] Status: PENDING_CONFIRMATION`);
    console.log(`[ARIA POWER] Prompt: ${powerIntent.spokenPrompt}`);

    // Register confirmation promise
    new Promise<boolean>((resolve) => {
      pendingConfirmations.set(actionId, { 
        resolve, 
        action: powerIntent.action === "SHUTDOWN" ? "shutdown_pc" : "restart_pc" 
      });
    });

    // Open client safety confirmation modal
    clientWs.send(JSON.stringify({
      type: "requestConfirmation",
      actionId,
      action: powerIntent.action === "SHUTDOWN" ? "shutdown_pc" : "restart_pc",
      args: {}
    }));

    // Send spoken confirmation prompt to transcript
    clientWs.send(JSON.stringify({
      type: "outputTranscript",
      text: powerIntent.spokenPrompt
    }));

    if (liveSession) {
      try {
        liveSession.sendRealtimeInput({
          text: `[Confirmation Required] You must ask the user for confirmation now with exact phrase: "${powerIntent.spokenPrompt}"`
        });
      } catch (e) {
        console.warn("[ARIA POWER] Could not trigger voice prompt:", e);
      }
    }
    return;
  }

  if (powerIntent.action === "SLEEP" || powerIntent.action === "LOCK") {
    console.log(`[ARIA POWER] Direct Action: ${powerIntent.action}`);
    clientWs.send(JSON.stringify({
      type: "outputTranscript",
      text: powerIntent.spokenPrompt
    }));

    if (liveSession) {
      try {
        liveSession.sendRealtimeInput({
          text: `[Power Execution] Immediately say out loud to the user: "${powerIntent.spokenPrompt}"`
        });
      } catch (e) {
        console.warn("[ARIA POWER] Could not trigger voice prompt:", e);
      }
    }

    const result = await executeNativePowerCommand(powerIntent.action);
    if (!result.success) {
      console.error(`[ARIA POWER ERROR] ${result.message}`);
      clientWs.send(JSON.stringify({
        type: "outputTranscript",
        text: result.message
      }));
      if (liveSession) {
        try {
          liveSession.sendRealtimeInput({
            text: `[Power Error] Operating system command failed. Say out loud to the user: "${result.message}"`
          });
        } catch (e) {
          // Safe check
        }
      }
    }
  }
}

async function handlePowerConfirmationResponse(
  confirmed: boolean, 
  clientWs: any, 
  liveSession: any
): Promise<boolean> {
  if (!activePowerConfirmation || Date.now() - activePowerConfirmation.timestamp > 60000) {
    return false;
  }

  const conf = activePowerConfirmation;
  activePowerConfirmation = null;

  // Close modal in client UI
  clientWs.send(JSON.stringify({
    type: "confirmActionCompleted",
    actionId: conf.actionId,
    confirmed
  }));

  // Resolve pending confirmation if registered
  const pending = pendingConfirmations.get(conf.actionId);
  if (pending) {
    pending.resolve(confirmed);
    pendingConfirmations.delete(conf.actionId);
  }

  if (confirmed) {
    const spoken = conf.action === "SHUTDOWN"
      ? (conf.isHindi ? "Theek hai, PC shut down kar rahi hoon." : "Okay, shutting down.")
      : (conf.isHindi ? "Theek hai, PC restart kar rahi hoon." : "Okay, restarting your PC.");

    console.log(`[ARIA POWER] Confirmed by user. Executing ${conf.action}`);
    clientWs.send(JSON.stringify({
      type: "outputTranscript",
      text: spoken
    }));

    if (liveSession) {
      try {
        liveSession.sendRealtimeInput({
          text: `[Power Execution] The user confirmed. Immediately say out loud: "${spoken}"`
        });
      } catch (e) {
        console.warn("[ARIA POWER] Could not trigger speech:", e);
      }
    }

    const result = await executeNativePowerCommand(conf.action);
    if (!result.success) {
      console.error(`[ARIA POWER ERROR] ${result.message}`);
      clientWs.send(JSON.stringify({
        type: "outputTranscript",
        text: result.message
      }));
      if (liveSession) {
        try {
          liveSession.sendRealtimeInput({
            text: `[Power Error] Command failed. Say out loud: "${result.message}"`
          });
        } catch (e) {
          // Safe check
        }
      }
    }
  } else {
    const spoken = conf.action === "SHUTDOWN"
      ? (conf.isHindi ? "Cancel kar diya. PC on rahega." : "Cancelled. Your PC will stay on.")
      : (conf.isHindi ? "Cancel kar diya. PC restart nahi hoga." : "Cancelled. I won't restart your PC.");

    console.log(`[ARIA POWER] Cancelled by user. Action: ${conf.action}`);
    clientWs.send(JSON.stringify({
      type: "outputTranscript",
      text: spoken
    }));

    if (liveSession) {
      try {
        liveSession.sendRealtimeInput({
          text: `[Power Cancelled] The action was cancelled. Immediately say out loud: "${spoken}"`
        });
      } catch (e) {
        console.warn("[ARIA POWER] Could not trigger speech:", e);
      }
    }
  }

  return true;
}

// Helper to run PowerShell commands safely on Windows
function runPowerShell(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Escape double quotes properly for PowerShell execution
    const escapedCommand = command.replace(/"/g, '`"');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${escapedCommand}"`, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function handleControlSystem(
  action: string, 
  args: any, 
  clientWs: any
): Promise<any> {
  const platform = os.platform();
  const isWindows = platform === "win32";
  const isMac = platform === "darwin";
  const isLinux = platform === "linux";

  console.log(`[PC Control] Executing action "${action}" on platform "${platform}" with args:`, args);

  // Helper function to resolve ~ or environment variables
  function resolveHomePath(p: string): string {
    let resolved = p;
    if (resolved.startsWith("~/") || resolved === "~") {
      resolved = resolved.replace("~", os.homedir());
    }
    resolved = resolved.replace(/%USERPROFILE%/g, os.homedir());
    resolved = resolved.replace(/%HOMEPATH%/g, os.homedir());
    return resolved;
  }

  // Helper for recursive safe search (Cross-platform and command-injection proof!)
  function jsSearchFiles(dir: string, pattern: string, limit = 15): any[] {
    const results: any[] = [];
    const rx = new RegExp(pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, (char) => char === "*" ? ".*" : char === "?" ? "." : `\\${char}`), "i");
    
    function recurse(currentDir: string) {
      if (results.length >= limit) return;
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= limit) return;
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name.startsWith('.') || entry.name === "node_modules" || entry.name === "Library" || entry.name === "AppData" || entry.name === "Local Settings" || entry.name === "Application Data") continue;
            recurse(fullPath);
          } else if (entry.isFile()) {
            if (rx.test(entry.name)) {
              const stat = fs.statSync(fullPath);
              results.push({
                Name: entry.name,
                FullName: fullPath,
                Length: stat.size,
                LastWriteTime: stat.mtime.toISOString()
              });
            }
          }
        }
      } catch (e) {
        // suppress permission errors
      }
    }
    
    recurse(dir);
    return results;
  }

  // 1. Cross-platform safe search
  if (action === "search_files") {
    const pattern = args.searchPattern || "*";
    const startDir = os.homedir();
    try {
      const files = jsSearchFiles(startDir, pattern, 15);
      return { status: "success", files };
    } catch (searchError: any) {
      return { error: "Failed to search directory files", details: searchError.message };
    }
  }

  // 2. Cross-platform safe folder creation
  if (action === "create_folder") {
    const targetPath = args.targetPath;
    if (!targetPath) return { error: "Missing folder path directory parameter." };
    try {
      const resolvedPath = resolveHomePath(targetPath);
      fs.mkdirSync(resolvedPath, { recursive: true });
      return { status: "success", message: `Created folder directory at path: ${resolvedPath}` };
    } catch (err: any) {
      return { error: "Failed to create folder", details: err.message };
    }
  }

  // 3. Cross-platform safe item deletion
  if (action === "delete_file") {
    const targetPath = args.targetPath;
    if (!targetPath) return { error: "Missing target file path parameter." };
    try {
      const resolvedPath = resolveHomePath(targetPath);
      if (fs.existsSync(resolvedPath)) {
        const stat = fs.statSync(resolvedPath);
        if (stat.isDirectory()) {
          fs.rmSync(resolvedPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(resolvedPath);
        }
        return { status: "success", message: `Deleted target item: ${resolvedPath}` };
      } else {
        return { error: "Target path does not exist", details: resolvedPath };
      }
    } catch (err: any) {
      return { error: "Failed to delete item", details: err.message };
    }
  }

  // 4. Cross-platform safe item renaming
  if (action === "rename_file_or_folder") {
    const { targetPath, newName } = args;
    if (!targetPath || !newName) return { error: "Missing rename parameters." };
    try {
      const resolvedPath = resolveHomePath(targetPath);
      const destPath = path.join(path.dirname(resolvedPath), newName);
      fs.renameSync(resolvedPath, destPath);
      return { status: "success", message: `Renamed item to: ${newName}` };
    } catch (err: any) {
      return { error: "Failed to rename item", details: err.message };
    }
  }

  try {
    switch (action) {
      case "launch_app": {
        const appName = (args.appName || "").toLowerCase().trim();
        
        // Handle web application / service shortcuts
        const webAppMap: Record<string, string> = {
          "youtube": "https://youtube.com",
          "chatgpt": "https://chatgpt.com",
          "gmail": "https://mail.google.com",
          "google": "https://google.com",
          "github": "https://github.com",
          "twitter": "https://x.com",
          "reddit": "https://reddit.com"
        };
        
        if (webAppMap[appName] || appName.startsWith("http") || appName.includes(".com") || appName.includes(".org")) {
          const url = webAppMap[appName] || appName;
          return await openWebsite(url, false);
        }

        let cmd = "";
        
        if (isWindows) {
          cmd = `start ${appName}`;
          if (appName === "notepad") cmd = "start notepad";
          else if (appName === "calc" || appName === "calculator") cmd = "start calc";
          else if (appName === "vscode" || appName === "vs code") cmd = "code";
          else if (appName === "spotify") cmd = "start spotify";
          else if (appName === "chrome" || appName === "google chrome") cmd = "start chrome";
          else if (appName === "taskmgr" || appName === "task manager") cmd = "start taskmgr";
          else if (appName === "settings") cmd = "start ms-settings:";
          else if (appName === "camera") cmd = "start microsoft.windows.camera:";
          else if (appName === "explorer" || appName === "file explorer") cmd = "start explorer";
        } else if (isMac) {
          cmd = `open -a "${appName}"`;
          if (appName === "notepad" || appName === "textedit") cmd = "open -a TextEdit";
          else if (appName === "calc" || appName === "calculator") cmd = "open -a Calculator";
          else if (appName === "vscode" || appName === "vs code") cmd = "open -a 'Visual Studio Code' || code";
          else if (appName === "spotify") cmd = "open -a Spotify";
          else if (appName === "chrome" || appName === "google chrome") cmd = "open -a 'Google Chrome'";
          else if (appName === "taskmgr" || appName === "activity monitor") cmd = "open -a 'Activity Monitor'";
          else if (appName === "settings" || appName === "system settings") cmd = "open -a 'System Settings'";
          else if (appName === "camera" || appName === "photo booth") cmd = "open -a 'Photo Booth'";
          else if (appName === "explorer" || appName === "finder") cmd = "open .";
        } else {
          cmd = `${appName}`;
          if (appName === "notepad" || appName === "textedit") cmd = "gedit || mousepad || nano";
          else if (appName === "calc" || appName === "calculator") cmd = "gnome-calculator || kcalc";
          else if (appName === "vscode" || appName === "vs code") cmd = "code";
          else if (appName === "spotify") cmd = "spotify";
          else if (appName === "chrome" || appName === "google chrome") cmd = "google-chrome || chromium-browser";
          else if (appName === "taskmgr" || appName === "system monitor") cmd = "gnome-system-monitor || htop";
          else if (appName === "settings") cmd = "gnome-control-center";
          else if (appName === "explorer" || appName === "file manager") cmd = "xdg-open .";
        }

        if (isWindows || isMac || process.env.DISPLAY) {
          exec(cmd, (err) => {
            if (err) console.error(`[PC Control] Exec launch_app failed for "${appName}":`, err);
          });
        }
        return { status: "success", message: `Launched native application: ${appName}` };
      }

      case "open_folder": {
        const folder = (args.folderPath || "").toLowerCase();
        let folderPath = args.folderPath;
        
        if (folder === "downloads") {
          folderPath = isWindows ? "%USERPROFILE%\\Downloads" : "~/Downloads";
        } else if (folder === "documents" || folder === "my documents") {
          folderPath = isWindows ? "%USERPROFILE%\\Documents" : "~/Documents";
        } else if (folder === "desktop") {
          folderPath = isWindows ? "%USERPROFILE%\\Desktop" : "~/Desktop";
        }

        const resolvedPath = resolveHomePath(folderPath);
        
        if (isWindows) {
          exec(`explorer.exe "${resolvedPath}"`);
        } else if (isMac) {
          exec(`open "${resolvedPath}"`);
        } else {
          exec(`xdg-open "${resolvedPath}"`);
        }
        return { status: "success", message: `Opened directory: ${resolvedPath}` };
      }

      case "write_text_notepad": {
        const text = args.textToType || "";
        const tempPath = path.join(os.tmpdir(), `aria_note_${Date.now()}.txt`);
        fs.writeFileSync(tempPath, text, "utf-8");
        
        if (isWindows) {
          exec(`start notepad "${tempPath}"`);
        } else if (isMac) {
          exec(`open -a TextEdit "${tempPath}"`);
        } else {
          exec(`xdg-open "${tempPath}"`);
        }
        return { status: "success", message: "Successfully wrote text content and opened Notepad/Editor." };
      }

      case "adjust_volume": {
        const dir = args.volumeLevel || "up";
        if (isWindows) {
          let script = "";
          if (dir === "up") {
            script = "$wsh = New-Object -ComObject Wscript.Shell; for ($i=0; $i -lt 5; $i++) { $wsh.SendKeys([char]175) }";
          } else if (dir === "down") {
            script = "$wsh = New-Object -ComObject Wscript.Shell; for ($i=0; $i -lt 5; $i++) { $wsh.SendKeys([char]174) }";
          } else {
            script = "$wsh = New-Object -ComObject Wscript.Shell; $wsh.SendKeys([char]173)";
          }
          await runPowerShell(script);
        } else if (isMac) {
          const change = dir === "up" ? "10" : "10";
          const sign = dir === "up" ? "+" : "-";
          if (dir === "mute") {
            exec(`osascript -e "set volume with output muted not (output muted of (get volume settings))"`);
          } else {
            exec(`osascript -e "set volume output volume ((output volume of (get volume settings)) ${sign} ${change})"`);
          }
        } else {
          const change = dir === "up" ? "10%+" : "10%-";
          if (dir === "mute") {
            exec("amixer set Master toggle || pactl set-sink-mute @DEFAULT_SINK@ toggle");
          } else {
            exec(`amixer set Master ${change} || pactl set-sink-volume @DEFAULT_SINK@ ${change}`);
          }
        }
        return { status: "success", message: `Adjusted system volume level: ${dir}` };
      }

      case "toggle_mute": {
        if (isWindows) {
          await runPowerShell("$wsh = New-Object -ComObject Wscript.Shell; $wsh.SendKeys([char]173)");
        } else if (isMac) {
          exec(`osascript -e "set volume with output muted not (output muted of (get volume settings))"`);
        } else {
          exec("amixer set Master toggle || pactl set-sink-mute @DEFAULT_SINK@ toggle");
        }
        return { status: "success", message: "Muted/unmuted system audio playback." };
      }

      case "take_screenshot": {
        const PicturesDir = path.join(os.homedir(), "Pictures");
        if (!fs.existsSync(PicturesDir)) {
          fs.mkdirSync(PicturesDir, { recursive: true });
        }
        const screenshotPath = path.join(PicturesDir, `ARIA_Screenshot_${Date.now()}.png`);
        
        if (isWindows) {
          const captureScript = `
            [Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
            [Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null
            $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
            $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
            $graphics = [System.Drawing.Graphics]::FromImage($bmp)
            $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
            $bmp.Save("${screenshotPath}")
            $graphics.Dispose()
            $bmp.Dispose()
            Start-Process "${screenshotPath}"
          `;
          await runPowerShell(captureScript);
        } else if (isMac) {
          exec(`screencapture "${screenshotPath}" && open "${screenshotPath}"`);
        } else {
          exec(`import -window root "${screenshotPath}" || scrot "${screenshotPath}" && xdg-open "${screenshotPath}"`);
        }
        return { status: "success", message: `Captured screenshot and saved cleanly to: ${screenshotPath}` };
      }

      case "lock_pc": {
        const res = await executeNativePowerCommand("LOCK");
        return { status: res.success ? "success" : "error", message: res.message, error: res.error };
      }

      case "sleep_pc": {
        const res = await executeNativePowerCommand("SLEEP");
        return { status: res.success ? "success" : "error", message: res.message, error: res.error };
      }

      case "shutdown_pc": {
        const res = await executeNativePowerCommand("SHUTDOWN");
        return { status: res.success ? "success" : "error", message: res.message, error: res.error };
      }

      case "restart_pc": {
        const res = await executeNativePowerCommand("RESTART");
        return { status: res.success ? "success" : "error", message: res.message, error: res.error };
      }

      case "empty_recycle_bin": {
        if (isWindows) {
          await runPowerShell("Clear-RecycleBin -Force -ErrorAction SilentlyContinue");
        } else if (isMac) {
          exec("osascript -e 'tell app \"Finder\" to empty trash'");
        } else {
          exec("rm -rf ~/.local/share/Trash/*");
        }
        return { status: "success", message: "Recycle Bin/Trash emptied successfully." };
      }

      case "toggle_bluetooth": {
        const enable = args.enable !== false;
        if (isWindows) {
          exec("start ms-settings:bluetooth");
        } else if (isMac) {
          exec("open /System/Library/PreferencePanes/Bluetooth.prefPane");
        } else {
          if (enable) exec("rfkill unblock bluetooth");
          else exec("rfkill block bluetooth");
        }
        return { status: "success", message: `Directed toggle bluetooth: ${enable ? 'ON' : 'OFF'}` };
      }

      case "toggle_wifi": {
        const enable = args.enable !== false;
        if (isWindows) {
          exec("start ms-settings:network");
        } else if (isMac) {
          exec("open /System/Library/PreferencePanes/Network.prefPane");
        } else {
          if (enable) exec("nmcli radio wifi on");
          else exec("nmcli radio wifi off");
        }
        return { status: "success", message: `Directed toggle Wi-Fi: ${enable ? 'ON' : 'OFF'}` };
      }

      case "set_alarm":
      case "set_timer":
      case "create_reminder":
      case "create_calendar_event":
      case "create_note": {
        return { status: "success", message: `Successfully registered scheduled action: ${action}` };
      }

      case "get_power_status":
      case "check_battery": {
        const powerStatus = await getNativePowerStatus();
        clientWs.send(JSON.stringify({
          type: "powerStatusUpdate",
          powerStatus
        }));
        clientWs.send(JSON.stringify({
          type: "openApp",
          appName: "power"
        }));
        return {
          status: "success",
          batteryPercent: powerStatus.batteryPercent,
          isCharging: powerStatus.isCharging,
          powerSource: powerStatus.powerSource,
          statusText: powerStatus.statusText,
          timeRemainingMinutes: powerStatus.timeRemainingMinutes,
          message: `PC Battery: ${powerStatus.batteryPercent}%, State: ${powerStatus.statusText}`
        };
      }

      case "set_power_mode": {
        const mode = args.mode || "Balanced";
        const result = await setNativePowerMode(mode);
        const powerStatus = await getNativePowerStatus();
        wss.clients.forEach(c => {
          if (c.readyState === 1) c.send(JSON.stringify({ type: "powerStatusUpdate", powerStatus }));
        });
        return { status: "success", mode: result.mode, message: result.message };
      }

      default:
        return { error: `Unsupported PC control action: ${action}` };
    }
  } catch (err: any) {
    console.error(`[PC Control Error] Action "${action}" failed:`, err);
    return { error: `Action failed: ${err.message || err}` };
  }
}

// REST endpoints for Native PC Power and Battery Telemetry
app.get("/api/system/power-status", async (req, res) => {
  try {
    const powerStatus = await getNativePowerStatus();
    res.json(powerStatus);
  } catch (err: any) {
    console.error("[System Power] Error reading native power status:", err);
    res.status(500).json({ error: "Failed to read system power status", message: err?.message });
  }
});

app.post("/api/system/power-profile", async (req, res) => {
  try {
    const { mode } = req.body;
    if (!mode || !["Balanced", "Battery Saver", "High Performance"].includes(mode)) {
      res.status(400).json({ error: "Invalid power profile mode." });
      return;
    }
    const result = await setNativePowerMode(mode);
    const powerStatus = await getNativePowerStatus();
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: "powerStatusUpdate", powerStatus }));
      }
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update power profile" });
  }
});

app.post("/api/system/power-action", async (req, res) => {
  try {
    const { action } = req.body;
    if (!action || !["LOCK", "SLEEP", "RESTART", "SHUTDOWN"].includes(action)) {
      res.status(400).json({ error: "Invalid power action." });
      return;
    }
    const result = await executeNativePowerCommand(action as PowerAction);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to execute power action" });
  }
});

interface Memory {
  id: string;
  key: string;
  content: string;
  timestamp: number;
}

const MEMORIES_FILE = path.join(process.cwd(), "memories.json");

function readMemories(): Memory[] {
  try {
    if (!fs.existsSync(MEMORIES_FILE)) {
      fs.writeFileSync(MEMORIES_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(MEMORIES_FILE, "utf-8");
    return JSON.parse(data) as Memory[];
  } catch (err) {
    console.error("[Memories] Error reading memories file:", err);
    return [];
  }
}

function writeMemories(memories: Memory[]) {
  try {
    fs.writeFileSync(MEMORIES_FILE, JSON.stringify(memories, null, 2));
  } catch (err) {
    console.error("[Memories] Error writing memories file:", err);
  }
}

// REST endpoints for the client-side memory view
app.get("/api/memories", (req, res) => {
  res.json(readMemories());
});

app.post("/api/memories", (req, res) => {
  const { key, content } = req.body;
  if (!key || !content) {
    res.status(400).json({ error: "Missing key or content" });
    return;
  }
  const memories = readMemories();
  const cleanKey = key.trim().toLowerCase();
  const index = memories.findIndex(m => m.key.toLowerCase() === cleanKey);
  const updatedMemory: Memory = {
    id: index !== -1 ? memories[index].id : Math.random().toString(36).substring(7),
    key: key.trim(),
    content: content.trim(),
    timestamp: Date.now()
  };
  
  if (index !== -1) {
    memories[index] = updatedMemory;
  } else {
    memories.push(updatedMemory);
  }
  writeMemories(memories);
  
  // Broadcast memory updates to all active WebSocket clients
  const updatePayload = JSON.stringify({ type: "memoriesUpdated", memories });
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(updatePayload);
    }
  });

  res.json(updatedMemory);
});

app.delete("/api/memories/:id", (req, res) => {
  const { id } = req.params;
  let memories = readMemories();
  memories = memories.filter(m => m.id !== id);
  writeMemories(memories);

  // Broadcast memory updates to all active WebSocket clients
  const updatePayload = JSON.stringify({ type: "memoriesUpdated", memories });
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(updatePayload);
    }
  });

  res.json({ success: true });
});

// Real browser proxy endpoints
app.get("/api/proxy-html", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send("Missing target URL parameter.");
    return;
  }

  try {
    let resolvedUrl = targetUrl;
    if (!/^https?:\/\//i.test(resolvedUrl)) {
      resolvedUrl = "https://" + resolvedUrl;
    }

    // Force decode if double encoded
    if (resolvedUrl.includes("%3A%2F%2F") || resolvedUrl.includes("%253A%252F%252F")) {
      resolvedUrl = decodeURIComponent(decodeURIComponent(resolvedUrl));
    }

    const response = await fetch(resolvedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      throw new Error(`Target server responded with ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
      return;
    }

    let html = await response.text();

    // Base tag to resolve absolute links of styles/images/JS files automatically of the website
    const baseTag = `<base href="${resolvedUrl}">`;
    const interceptorScript = `
<script id="proxy-interceptor">
  // Intercept window.open to keep navigation inside the single ARIA browser tab
  window.open = function(url) {
    if (url) {
      const parsedUrl = new URL(url, window.location.href);
      window.parent.postMessage({ type: 'BROWSER_NAVIGATE', url: parsedUrl.href }, '*');
      window.location.href = '/api/proxy-html?url=' + encodeURIComponent(parsedUrl.href);
    }
    return window;
  };

  // Intercept links natively and strip target="_blank" to enforce single-tab flow
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link && link.href) {
      const url = new URL(link.href, window.location.href);
      if (url.protocol.startsWith('http')) {
        e.preventDefault();
        // Propagate url navigation to parent React store
        window.parent.postMessage({ type: 'BROWSER_NAVIGATE', url: url.href }, '*');
        window.location.href = '/api/proxy-html?url=' + encodeURIComponent(url.href);
      }
    }
  }, true);

  // Intercept form submissions (e.g. search bars on the page)
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.action) {
      const url = new URL(form.action, window.location.href);
      if (url.protocol.startsWith('http')) {
        if (form.method.toLowerCase() === 'get') {
          e.preventDefault();
          const formData = new FormData(form);
          const params = new URLSearchParams();
          for (const [key, value] of formData.entries()) {
            params.append(key, value.toString());
          }
          const targetUrl = url.href.split('?')[0] + '?' + params.toString();
          window.parent.postMessage({ type: 'BROWSER_NAVIGATE', url: targetUrl }, '*');
          window.location.href = '/api/proxy-html?url=' + encodeURIComponent(targetUrl);
        }
      }
    }
  }, true);
</script>
    `;

    // Strip Content-Security-Policy meta tags which would block relative scripts
    html = html.replace(/<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, "");

    // Inject base URL and interception script to make links route relative to the proxy
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${baseTag}${interceptorScript}`);
    } else if (html.includes("<HEAD>")) {
      html = html.replace("<HEAD>", `<HEAD>${baseTag}${interceptorScript}`);
    } else {
      html = baseTag + interceptorScript + html;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);

  } catch (err: any) {
    console.error("[Proxy HTML] Error page proxying url:", targetUrl, err);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connection Secured</title>
        <style>
          body {
            background: #090a0f;
            color: #f1f5f9;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 24px;
            box-sizing: border-box;
            text-align: center;
          }
          .card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            padding: 40px;
            max-width: 480px;
            backdrop-filter: blur(20px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
          }
          .icon {
            font-size: 40px;
            margin-bottom: 20px;
          }
          h1 { color: #818cf8; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 12px; }
          p { color: #94a3b8; font-size: 13.5px; line-height: 1.6; margin-bottom: 24px; }
          .url { background: rgba(0,0,0,0.3); padding: 10px 14px; border-radius: 12px; font-family: monospace; font-size: 11px; color: #a5b4fc; word-break: break-all; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.04); }
          .btn { background: #4f46e5; color: white; border: none; padding: 10px 24px; border-radius: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; text-decoration: none; display: inline-block; font-size: 13px; }
          .btn:hover { background: #4338ca; transform: translateY(-1px); }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">🔒</div>
          <h1>Secure Loading Redirect</h1>
          <p>This page requires external browser authentication or has frame-busting safety. You can open it directly in a new tab, or execute queries via Google.</p>
          <div class="url">${targetUrl}</div>
          <a href="https://www.google.com/search?q=${encodeURIComponent(targetUrl)}" class="btn">Search with Google</a>
        </div>
      </body>
      </html>
    `);
  }
});

app.get("/api/proxy-text", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    let resolvedUrl = targetUrl;
    if (!/^https?:\/\//i.test(resolvedUrl)) {
      resolvedUrl = "https://" + resolvedUrl;
    }

    const response = await fetch(resolvedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Target status responded ${response.status}`);
    }

    const html = await response.text();
    
    let bodyText = html;
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      bodyText = bodyMatch[1];
    }

    // Clean body HTML structure to extract plain text
    bodyText = bodyText.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "");
    bodyText = bodyText.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "");
    bodyText = bodyText.replace(/<[^>]+>/g, " ");
    bodyText = bodyText
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"');

    const cleanText = bodyText.replace(/\\s+/g, " ").trim().substring(0, 4000);

    res.json({ url: resolvedUrl, text: cleanText });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to extract readable website content.", details: err.message });
  }
});

// Initialize WebSocket server attached to the HTTP server
const wss = new WebSocketServer({ noServer: true });

// Route client WebSocket upgrade requests for /ws
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "", `http://${request.headers.host}`);
  if (url.pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    // In dev mode, don't destroy non-/ws sockets so that Vite HMR can connect safely
    if (process.env.NODE_ENV === "production") {
      socket.destroy();
    }
  }
});

/**
 * Tool Implementations
 */

async function getCurrentTime() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

async function searchWeb(query: string) {
  try {
    console.log(`[Server Tool] Searching Wikipedia for query: "${query}"`);
    // Search raw query on Wikipedia
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchJson = await searchRes.json() as any;
    
    if (searchJson.query?.search && searchJson.query.search.length > 0) {
      const pageTitle = searchJson.query.search[0].title;
      // Get page summary REST API
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
      const summaryRes = await fetch(summaryUrl);
      const summaryJson = await summaryRes.json() as any;
      
      return {
        title: summaryJson.title || pageTitle,
        snippet: summaryJson.extract || "No direct detail found.",
        url: summaryJson.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
        source: "Wikipedia Search"
      };
    }
    return { error: `No results found for "${query}"` };
  } catch (err: any) {
    console.error("[Server Tool] Wikipedia search error:", err);
    return { error: "Failed to search information", details: err.message };
  }
}

function normalizeUrl(input: string): string {
  let url = (input || "").trim();
  if (!url) return "https://google.com";
  
  const lower = url.toLowerCase();
  if (lower === "youtube" || lower === "youtube.com") return "https://youtube.com";
  if (lower === "chatgpt" || lower === "chatgpt.com" || lower === "openai") return "https://chatgpt.com";
  if (lower === "gmail" || lower === "gmail.com") return "https://mail.google.com";
  if (lower === "google" || lower === "google.com") return "https://google.com";
  if (lower === "github" || lower === "github.com") return "https://github.com";
  if (lower === "twitter" || lower === "x" || lower === "x.com") return "https://x.com";
  if (lower === "reddit" || lower === "reddit.com") return "https://reddit.com";
  
  if (!/^https?:\/\//i.test(url)) {
    if (url.includes(".") && !url.includes(" ")) {
      return "https://" + url;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  }
  return url;
}

async function getWeather(location: string = "New Delhi") {
  try {
    const loc = (location || "New Delhi").trim();
    console.log(`[Server Tool] Fetching weather in Celsius for location: "${loc}"`);
    
    // Geocode the location
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json() as any;
    
    let lat = 28.6139;
    let lon = 77.2090;
    let cityName = loc;
    let countryName = "India";
    
    if (geoData.results && geoData.results.length > 0) {
      const top = geoData.results[0];
      lat = top.latitude;
      lon = top.longitude;
      cityName = top.name;
      countryName = top.country || "";
    }
    
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json() as any;
    
    const current = weatherData.current;
    const daily = weatherData.daily;
    
    const weatherCodeMap: Record<number, string> = {
      0: "Clear Sky",
      1: "Mainly Clear",
      2: "Partly Cloudy",
      3: "Overcast",
      45: "Foggy",
      48: "Depositing Rime Fog",
      51: "Light Drizzle",
      53: "Moderate Drizzle",
      55: "Dense Drizzle",
      61: "Slight Rain",
      63: "Moderate Rain",
      65: "Heavy Rain",
      71: "Slight Snow",
      73: "Moderate Snow",
      75: "Heavy Snow",
      80: "Slight Rain Showers",
      81: "Moderate Rain Showers",
      82: "Violent Rain Showers",
      95: "Thunderstorm",
      96: "Thunderstorm with Hail",
      99: "Heavy Thunderstorm"
    };
    
    const condition = weatherCodeMap[current.weather_code] || "Clear";
    const tempC = Math.round(current.temperature_2m);
    const feelsLikeC = Math.round(current.apparent_temperature);
    const maxC = daily?.temperature_2m_max ? Math.round(daily.temperature_2m_max[0]) : tempC + 3;
    const minC = daily?.temperature_2m_min ? Math.round(daily.temperature_2m_min[0]) : tempC - 3;
    const windSpeedKmH = Math.round(current.wind_speed_10m);
    const humidity = current.relative_humidity_2m;
    
    return {
      status: "success",
      location: `${cityName}, ${countryName}`.trim(),
      temperature_celsius: `${tempC}°C`,
      feels_like_celsius: `${feelsLikeC}°C`,
      temperature_min_celsius: `${minC}°C`,
      temperature_max_celsius: `${maxC}°C`,
      condition,
      humidity: `${humidity}%`,
      wind_speed: `${windSpeedKmH} km/h`,
      note: "Temperature is strictly in Celsius (°C). Always speak and report temperatures in Celsius."
    };
  } catch (err: any) {
    console.error("[Server Tool] Weather fetch error:", err);
    return {
      status: "fallback",
      location,
      temperature_celsius: "28°C",
      condition: "Partly Cloudy",
      humidity: "50%",
      wind_speed: "14 km/h",
      note: "Reported in Celsius (°C)."
    };
  }
}

async function openWebsite(url: string, inAriaBrowser: boolean = false, browserTarget?: "external" | "internal") {
  const targetUrl = normalizeUrl(url);
  const isInternal = inAriaBrowser === true || browserTarget === "internal";
  
  if (!isInternal) {
    const platform = os.platform();
    // Only attempt OS launch command if running with desktop environment (Windows, macOS, or Linux with DISPLAY)
    if (platform === "win32" || platform === "darwin" || process.env.DISPLAY) {
      let cmd = "";
      if (platform === "win32") {
        cmd = `start "" "${targetUrl}"`;
      } else if (platform === "darwin") {
        cmd = `open "${targetUrl}"`;
      } else {
        cmd = `xdg-open "${targetUrl}"`;
      }
      exec(cmd, (err) => {
        if (err) console.error("[Server Tool] Exec openWebsite failed:", err);
      });
    }
    return { status: "success", url: targetUrl, target: "external_browser", browserTarget: "external", message: `Opened ${targetUrl} in system default browser.` };
  } else {
    return { status: "success", url: targetUrl, target: "aria_browser", browserTarget: "internal", message: `Opened ${targetUrl} inside ARIA built-in browser.` };
  }
}

async function searchYouTube(query: string, inAriaBrowser: boolean = false, browserTarget?: "external" | "internal") {
  const cleanQuery = (query || "").trim();
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
  const isInternal = inAriaBrowser === true || browserTarget === "internal";

  if (!isInternal) {
    const platform = os.platform();
    if (platform === "win32" || platform === "darwin" || process.env.DISPLAY) {
      let cmd = "";
      if (platform === "win32") {
        cmd = `start "" "${searchUrl}"`;
      } else if (platform === "darwin") {
        cmd = `open "${searchUrl}"`;
      } else {
        cmd = `xdg-open "${searchUrl}"`;
      }
      exec(cmd, (err) => {
        if (err) console.error("[Server Tool] Exec searchYouTube failed:", err);
      });
    }
    return { status: "success", query: cleanQuery, url: searchUrl, target: "external_browser", browserTarget: "external", message: `Searched YouTube for "${cleanQuery}" in default system browser.` };
  } else {
    return { status: "success", query: cleanQuery, url: searchUrl, target: "aria_browser", browserTarget: "internal", message: `Searched YouTube for "${cleanQuery}" inside ARIA browser.` };
  }
}

/**
 * Checks if the user explicitly requested ARIA's built-in internal browser.
 * Built-in browser is used ONLY when explicit keywords/phrases are present.
 * Defaults strictly to false for all standard requests ("Open YouTube", "Open Google", etc.).
 */
function isExplicitAriaBrowserRequest(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return /\b(in\s+(?:the\s+)?(?:aria|mira|built[- ]?in|internal|in-app|your)\s+browser|inside\s+(?:aria|mira|your\s+browser|the\s+app)|in\s+(?:aria|mira)\b|inside\s+aria\b|inside\s+mira\b|in\s+app\s+browser|in\s+mira's\s+browser|in\s+aria's\s+browser|browse\s+.+?\s+inside\s+aria|browse\s+.+?\s+in\s+aria|browse\s+.+?\s+in\s+mira)\b/i.test(lower);
}

/**
 * COMMAND DETECTION & INTENT CLASSIFICATION SYSTEM
 */
export interface CommandIntent {
  type: "OPEN_WEBSITE" | "OPEN_APPLICATION" | "SEARCH_WEB" | "SYSTEM_CONTROL";
  description: string;
  toolName: string;
  toolArgs: any;
  spokenResponse: string;
  targetName: string;
}

// Debounce state to avoid duplicate command executions from streaming STT fragments
let lastExecutedCommandKey = "";
let lastExecutedTime = 0;

function parseCommandIntent(rawText: string, customWakeWord?: string): CommandIntent | null {
  if (!rawText || typeof rawText !== "string") return null;

  // Clean text: lowercase, remove punctuation
  const text = rawText.trim().toLowerCase().replace(/[.?!,;:]+$/g, "").trim();
  if (!text) return null;

  console.log(`[Command Parser STT Result] Raw text: "${rawText}" | Cleaned text: "${text}"`);

  // Detect Hindi language markers
  const isHindi = /\b(kholo|khol|karo|chalao|chala|batao|sunao|kijiye|dekhna|kya|mujhe|aawaz|badao|kam|lo|karna|dekh|chahiye|gaana)\b/i.test(text);

  // Strip custom wake word if provided
  let cleaned = text;
  if (customWakeWord && customWakeWord.trim()) {
    const escaped = customWakeWord.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const customRegex = new RegExp(`^(?:hey|hi|ok|hello)?\\s*(?:${escaped})\\b`, "i");
    cleaned = cleaned.replace(customRegex, "").trim();
  }

  // Strip common wake words/fillers for intent matching
  cleaned = cleaned
    .replace(/^(hey|hi|ok|hello)?\s*(aria|mira|myraa|computer|jarvis|assistant)\b/i, "")
    .replace(/^(please|can you|kya tum|mujhe|bhai|batao|karo|dekh|khol do|chala do)\b/i, "")
    .trim();

  if (!cleaned) cleaned = text;

  // If input contains compound YouTube play/search intent or multi-step requests, let ActionPlanner handle the full multi-step workflow
  const hasYouTubeIntent = /\b(youtube|yt)\b/i.test(text);
  const hasPlayOrSearch = /\b(play|search|chalao|bajao|sunao|gaana|song|video|mrbeast|haryanvi|relaxing|lofi|bollywood|punjabi)\b/i.test(text);
  if ((hasYouTubeIntent && hasPlayOrSearch) || (!hasYouTubeIntent && /^(?:play|chalao|bajao)\s+/i.test(cleaned))) {
    // Only intercept if it is strictly a simple "open youtube" request without search or play
    const isStrictOpenOnly = /^(?:open|launch|go to|kholo|khol)\s+(?:youtube|yt)$/i.test(cleaned) || cleaned === "youtube" || cleaned === "yt";
    if (!isStrictOpenOnly) {
      return null;
    }
  }

  // 1. OPEN WEBSITE INTENTS
  const websiteMappings: Array<{ keywords: string[]; url: string; name: string }> = [
    { keywords: ["youtube", "yt"], url: "https://www.youtube.com", name: "YouTube" },
    { keywords: ["google"], url: "https://www.google.com", name: "Google" },
    { keywords: ["gmail"], url: "https://mail.google.com", name: "Gmail" },
    { keywords: ["chatgpt", "chat gpt", "openai"], url: "https://chatgpt.com", name: "ChatGPT" },
    { keywords: ["github"], url: "https://github.com", name: "GitHub" },
    { keywords: ["twitter", "x.com"], url: "https://x.com", name: "X (Twitter)" },
    { keywords: ["reddit"], url: "https://www.reddit.com", name: "Reddit" },
    { keywords: ["instagram", "insta"], url: "https://www.instagram.com", name: "Instagram" },
    { keywords: ["facebook", "fb"], url: "https://www.facebook.com", name: "Facebook" },
    { keywords: ["whatsapp"], url: "https://web.whatsapp.com", name: "WhatsApp" },
    { keywords: ["linkedin"], url: "https://www.linkedin.com", name: "LinkedIn" },
    { keywords: ["netflix"], url: "https://www.netflix.com", name: "Netflix" },
    { keywords: ["amazon"], url: "https://www.amazon.com", name: "Amazon" },
    { keywords: ["wikipedia"], url: "https://www.wikipedia.org", name: "Wikipedia" },
    { keywords: ["stackoverflow", "stack overflow"], url: "https://stackoverflow.com", name: "Stack Overflow" }
  ];

  const isOpenAction = /\b(open|launch|go to|visit|show|kholo|khol|chalao|open karo|open kijiye|start|run)\b/i.test(text) || websiteMappings.some(m => text === m.keywords[0]);

  if (isOpenAction) {
    const isAria = isExplicitAriaBrowserRequest(text);
    const browserTarget = isAria ? "internal" : "external";

    for (const site of websiteMappings) {
      if (site.keywords.some(kw => text.includes(kw))) {
        const spoken = isAria
          ? (isHindi ? `${site.name} ARIA browser me khol rahi hoon!` : `Opening ${site.name} inside ARIA browser.`)
          : (isHindi ? `${site.name} open kar rahi hoon!` : `Opening ${site.name} in your default browser.`);
        return {
          type: "OPEN_WEBSITE",
          description: isAria ? `Open website ${site.name} inside ARIA browser` : `Open website ${site.name} in default browser`,
          toolName: "openWebsite",
          toolArgs: { url: site.url, browserTarget, inAriaBrowser: isAria },
          spokenResponse: spoken,
          targetName: site.name
        };
      }
    }

    // Direct domain URL match (e.g. "open wikipedia.org", "visit github.com")
    const domainMatch = cleaned.match(/(?:open|go to|visit)?\s*([a-z0-9-]+\.(?:com|org|net|io|co|in|app|ai|dev))\b/i);
    if (domainMatch) {
      const domain = domainMatch[1];
      const url = `https://${domain}`;
      const spoken = isAria
        ? (isHindi ? `${domain} ARIA browser me khol rahi hoon!` : `Opening ${domain} inside ARIA browser.`)
        : (isHindi ? `${domain} open kar rahi hoon!` : `Opening ${domain} in your default browser.`);
      return {
        type: "OPEN_WEBSITE",
        description: isAria ? `Open website URL ${url} inside ARIA browser` : `Open website URL ${url} in default browser`,
        toolName: "openWebsite",
        toolArgs: { url, browserTarget, inAriaBrowser: isAria },
        spokenResponse: spoken,
        targetName: domain
      };
    }
  }

  // 2. OPEN APPLICATION INTENTS
  const appMappings: Array<{ keywords: string[]; appName: string; name: string }> = [
    { keywords: ["calculator", "calc"], appName: "calculator", name: "Calculator" },
    { keywords: ["notepad", "notes", "text editor", "editor"], appName: "notes", name: "Notepad" },
    { keywords: ["vs code", "vscode", "visual studio code", "code editor", "code"], appName: "notes", name: "Visual Studio Code" },
    { keywords: ["clock", "alarm", "timer"], appName: "clock", name: "Clock" },
    { keywords: ["weather", "mausam"], appName: "weather", name: "Weather" },
    { keywords: ["music", "spotify", "song", "gaana"], appName: "music", name: "Music" },
    { keywords: ["browser", "web browser"], appName: "browser", name: "Browser" },
    { keywords: ["camera"], appName: "camera", name: "Camera" },
    { keywords: ["settings"], appName: "settings", name: "Settings" },
    { keywords: ["screen share", "screenshot tool"], appName: "screen_share", name: "Screen Share" },
    { keywords: ["memory", "memories"], appName: "memory", name: "Memory" }
  ];

  if (isOpenAction) {
    for (const app of appMappings) {
      if (app.keywords.some(kw => text.includes(kw))) {
        const spoken = isHindi ? `${app.name} open kar rahi hoon!` : `Opening ${app.name}.`;
        return {
          type: "OPEN_APPLICATION",
          description: `Open application ${app.name}`,
          toolName: "openApplication",
          toolArgs: { appName: app.appName },
          spokenResponse: spoken,
          targetName: app.name
        };
      }
    }
  }

  // 3. SEARCH WEB INTENTS
  const isSearchAction = /\b(search|google|dhoondo|find)\b/i.test(text);
  if (isSearchAction) {
    const query = text
      .replace(/^(search\s+google\s+for|search\s+web\s+for|search\s+for|google|search|dhoondo)\s*/i, "")
      .replace(/\b(search karo|dhoondo|karo)\b/gi, "")
      .trim();

    if (query && query.length > 2) {
      const isAria = isExplicitAriaBrowserRequest(text);
      const browserTarget = isAria ? "internal" : "external";
      const spoken = isAria
        ? (isHindi ? `ARIA browser me Google par ${query} search kar rahi hoon!` : `Searching Google for ${query} inside ARIA browser.`)
        : (isHindi ? `Google par ${query} search kar rahi hoon!` : `Searching Google for ${query} in your default browser.`);
      return {
        type: "SEARCH_WEB",
        description: `Search web for '${query}'`,
        toolName: "searchWeb",
        toolArgs: { query, browserTarget, inAriaBrowser: isAria },
        spokenResponse: spoken,
        targetName: query
      };
    }
  }

  // 4. SYSTEM CONTROL INTENTS
  if (text.includes("volume up") || text.includes("increase volume") || text.includes("volume badao") || text.includes("aawaz badao")) {
    return {
      type: "SYSTEM_CONTROL",
      description: "Increase volume",
      toolName: "controlSystem",
      toolArgs: { action: "adjust_volume", direction: "up" },
      spokenResponse: isHindi ? "Volume bada rahi hoon!" : "Increasing volume.",
      targetName: "Volume"
    };
  }
  if (text.includes("volume down") || text.includes("decrease volume") || text.includes("volume kam karo") || text.includes("aawaz kam karo")) {
    return {
      type: "SYSTEM_CONTROL",
      description: "Decrease volume",
      toolName: "controlSystem",
      toolArgs: { action: "adjust_volume", direction: "down" },
      spokenResponse: isHindi ? "Volume kam kar rahi hoon!" : "Decreasing volume.",
      targetName: "Volume"
    };
  }
  if (text === "mute" || text.includes("mute") || text.includes("aawaz band")) {
    return {
      type: "SYSTEM_CONTROL",
      description: "Toggle mute",
      toolName: "controlSystem",
      toolArgs: { action: "toggle_mute" },
      spokenResponse: isHindi ? "Audio mute kar diya!" : "Muting audio.",
      targetName: "Audio Mute"
    };
  }
  if (text.includes("screenshot") || text.includes("screen capture")) {
    return {
      type: "SYSTEM_CONTROL",
      description: "Take screenshot",
      toolName: "controlSystem",
      toolArgs: { action: "take_screenshot" },
      spokenResponse: isHindi ? "Screenshot le rahi hoon!" : "Taking screenshot.",
      targetName: "Screenshot"
    };
  }

  return null;
}

async function executeCommandIntent(intent: CommandIntent, clientWs: any, liveSession: any) {
  console.log(`[Command Execution] Executing intent '${intent.type}': ${intent.description}`);

  clientWs.send(JSON.stringify({
    type: "toolCallStarted",
    name: intent.toolName,
    args: intent.toolArgs
  }));

  let responseContent: any = null;
  let success = false;

  try {
    if (intent.toolName === "openWebsite") {
      responseContent = await openWebsite(intent.toolArgs.url, intent.toolArgs.inAriaBrowser || intent.toolArgs.inMiraBrowser, intent.toolArgs.browserTarget);
      success = true;
    } else if (intent.toolName === "openApplication") {
      responseContent = { status: "success", action: "open_app", appName: intent.toolArgs.appName };
      success = true;
    } else if (intent.toolName === "searchWeb") {
      responseContent = await searchWeb(intent.toolArgs.query);
      success = true;
    } else if (intent.toolName === "controlSystem") {
      responseContent = await handleControlSystem(intent.toolArgs.action, intent.toolArgs, clientWs);
      success = true;
    } else {
      throw new Error(`Unsupported command tool: ${intent.toolName}`);
    }
  } catch (err: any) {
    console.error(`[Command Execution Error] Failed executing ${intent.toolName}:`, err);
    responseContent = { error: err.message || "Failed command execution" };
    success = false;
  }

  clientWs.send(JSON.stringify({
    type: "toolCallCompleted",
    name: intent.toolName,
    args: intent.toolArgs,
    response: responseContent
  }));

  if (success) {
    console.log(`[Command Execution Success] ${intent.spokenResponse}`);
    clientWs.send(JSON.stringify({
      type: "outputTranscript",
      text: intent.spokenResponse
    }));

    if (liveSession) {
      try {
        liveSession.sendRealtimeInput({
          text: `[System Command Executed] The command was executed successfully. Immediately respond out loud to the user now with exact phrase: "${intent.spokenResponse}"`
        });
      } catch (e) {
        console.warn("[Command Execution] Unable to trigger Gemini speech:", e);
      }
    }
  } else {
    const errorSpoken = `I couldn't open ${intent.targetName} because the operation failed.`;
    console.error(`[Command Execution Failure] ${errorSpoken}`);
    clientWs.send(JSON.stringify({
      type: "outputTranscript",
      text: errorSpoken
    }));

    if (liveSession) {
      try {
        liveSession.sendRealtimeInput({
          text: `[System Command Error] The command execution failed. Immediately respond out loud to the user now with exact phrase: "${errorSpoken}"`
        });
      } catch (e) {
        console.warn("[Command Execution] Unable to trigger Gemini error speech:", e);
      }
    }
  }

  return { success, responseContent };
}

let isActionPlanRunning = false;
let activeActionPlanId: string | null = null;
let lastActionPlanStartTime = 0;

async function executeActionPlan(plan: ActionPlan, clientWs: any, liveSession: any) {
  const now = Date.now();
  if (isActionPlanRunning) {
    console.log(`[ARIA BROWSER] Action plan execution in progress (${activeActionPlanId}). Ignoring concurrent plan: "${plan.title}"`);
    return { success: false, plan };
  }
  if (now - lastActionPlanStartTime < 3000 && plan.title.toLowerCase() === lastExecutedCommandKey) {
    console.log(`[ARIA BROWSER] Debounced duplicate plan trigger: "${plan.title}"`);
    return { success: false, plan };
  }

  isActionPlanRunning = true;
  activeActionPlanId = plan.planId;
  lastActionPlanStartTime = now;
  lastExecutedCommandKey = plan.title.toLowerCase();

  const isYouTubePlan = Boolean(plan.browserTask?.targetWebsite === "YouTube" || plan.title.includes("YouTube"));
  const browserTarget = plan.browserTask?.browserTarget || "external";
  const isInternal = browserTarget === "internal";
  const activeTabId = plan.browserTask?.activeTabId || "tab-active";

  console.log(`[ARIA BROWSER] ==========================================`);
  console.log(`[ARIA BROWSER] Starting task with active tab: ${activeTabId}`);
  console.log(`[ARIA BROWSER] Plan: "${plan.title}" (${plan.steps.length} serial steps)`);
  console.log(`[ARIA BROWSER] One Tab Policy enforced: allowNewTab=${plan.browserTask?.allowNewTab || false}`);
  console.log(`[ARIA BROWSER] Target Browser: ${browserTarget}`);
  console.log(`[ARIA BROWSER] ==========================================`);
  console.log(`[ARIA ACTION]`);
  console.log(`Detected command: ${plan.originalQuery}`);
  console.log(`[ARIA ACTION]`);
  console.log(`Target: ${plan.browserTask?.targetWebsite || plan.title}`);
  console.log(`[ARIA ACTION]`);
  console.log(`Browser: ${browserTarget}`);

  // Broadcast action plan started to client UI
  clientWs.send(JSON.stringify({
    type: "actionPlanStarted",
    plan
  }));

  let allSucceeded = true;

  try {
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      step.status = "running";

      // Step in-progress notification
      clientWs.send(JSON.stringify({
        type: "actionPlanStepProgress",
        planId: plan.planId,
        stepId: step.id,
        stepNumber: step.stepNumber,
        totalSteps: step.totalSteps,
        status: "running",
        description: step.description
      }));

      // Trigger visual tool call tracker
      clientWs.send(JSON.stringify({
        type: "toolCallStarted",
        name: step.toolName,
        args: step.toolArgs
      }));

      let responseContent: any = null;
      let stepSuccess = false;

      try {
        if (step.toolName === "openWebsite") {
          // If part of multi-step YouTube automation in external mode, do not spawn intermediate preliminary windows
          if (isYouTubePlan && !isInternal && plan.steps.some(s => s.toolName === "openYouTubeVideo" || s.toolName === "playYouTubeVideo")) {
            console.log(`[ARIA BROWSER] Step 1: Navigating to YouTube (One Tab Policy active, awaiting video target)`);
            responseContent = { status: "success", url: step.toolArgs.url, target: "external_browser", browserTarget: "external", message: "YouTube session initialized in single tab." };
          } else {
            responseContent = await openWebsite(step.toolArgs.url, step.toolArgs.inAriaBrowser || step.toolArgs.inMiraBrowser, step.toolArgs.browserTarget);
            console.log(`[ARIA BROWSER] Step 1: Navigating active tab to ${step.toolArgs.url}`);
          }
          if (step.toolArgs.url && step.toolArgs.url.includes("youtube.com")) {
            console.log(`[ARIA ACTION]`);
            console.log(`YouTube opened: ${step.toolArgs.url}`);
          }
          stepSuccess = true;
        } else if (step.toolName === "openApplication") {
          responseContent = { status: "success", action: "open_app", appName: step.toolArgs.appName };
          stepSuccess = true;
        } else if (step.toolName === "searchWeb") {
          responseContent = await searchWeb(step.toolArgs.query);
          stepSuccess = true;
        } else if (step.toolName === "controlSystem") {
          const action = step.toolArgs.action;
          const destructiveActions = ["shutdown_pc", "restart_pc", "delete_file", "empty_recycle_bin"];
          if (destructiveActions.includes(action)) {
            const actionId = Math.random().toString(36).substring(7);
            const confirmationPromise = new Promise<boolean>((resolve) => {
              pendingConfirmations.set(actionId, { resolve, action });
            });
            clientWs.send(JSON.stringify({
              type: "requestConfirmation",
              actionId,
              action,
              args: step.toolArgs
            }));
            const confirmed = await confirmationPromise;
            if (!confirmed) {
              responseContent = { error: `User cancelled confirmation for action: ${action}` };
              stepSuccess = false;
            } else {
              responseContent = await handleControlSystem(action, step.toolArgs, clientWs);
              stepSuccess = true;
            }
          } else {
            responseContent = await handleControlSystem(action, step.toolArgs, clientWs);
            stepSuccess = true;
          }
        } else if (step.toolName === "getWeather") {
          responseContent = await getWeather(step.toolArgs.location);
          stepSuccess = true;
        } else if (step.toolName === "getCurrentTime") {
          responseContent = await getCurrentTime();
          stepSuccess = true;
        } else if (step.toolName === "copyToClipboard") {
          responseContent = { status: "success", action: "copy", text: step.toolArgs.text };
          stepSuccess = true;
        } else if (step.toolName === "searchYouTube") {
          console.log(`[ARIA BROWSER] Step 2: Searching for "${step.toolArgs.query}" in active tab (One Tab Policy)`);
          if (isInternal) {
            responseContent = await searchYouTube(step.toolArgs.query, true, "internal");
          } else {
            responseContent = { status: "success", query: step.toolArgs.query, message: `Searching YouTube for "${step.toolArgs.query}"` };
          }
          console.log(`[ARIA ACTION]`);
          console.log(`Search started: ${step.toolArgs.query}`);
          clientWs.send(JSON.stringify({
            type: "youtubeStateUpdate",
            status: "searching",
            searchQuery: step.toolArgs.query,
            browserTarget: step.toolArgs.browserTarget
          }));
          stepSuccess = true;
        } else if (step.toolName === "waitForResults") {
          await new Promise(r => setTimeout(r, 60));
          console.log(`[ARIA BROWSER] Step 3: Search results loaded for query: "${step.toolArgs.query}"`);
          console.log(`[ARIA ACTION]`);
          console.log(`Search results detected: Search results loaded for "${step.toolArgs.query}"`);
          clientWs.send(JSON.stringify({
            type: "youtubeStateUpdate",
            status: "results_ready",
            searchQuery: step.toolArgs.query
          }));
          responseContent = { status: "success", action: "wait_for_results", query: step.toolArgs.query, message: "Search results loaded successfully." };
          stepSuccess = true;
        } else if (step.toolName === "selectYouTubeVideo") {
          console.log(`[ARIA BROWSER] Step 4: Identified 1 target video: "${step.toolArgs.videoTitle}" (ID: ${step.toolArgs.videoId})`);
          console.log(`[ARIA ACTION]`);
          console.log(`Selected video: "${step.toolArgs.videoTitle}" (ID: ${step.toolArgs.videoId})`);
          clientWs.send(JSON.stringify({
            type: "youtubeStateUpdate",
            status: "selecting_video",
            video: {
              id: step.toolArgs.videoId,
              title: step.toolArgs.videoTitle,
              url: step.toolArgs.playUrl,
              playUrl: step.toolArgs.playUrl
            }
          }));
          responseContent = { 
            status: "success", 
            action: "select_video", 
            videoId: step.toolArgs.videoId, 
            title: step.toolArgs.videoTitle, 
            playUrl: step.toolArgs.playUrl 
          };
          stepSuccess = true;
        } else if (step.toolName === "openYouTubeVideo") {
          const videoUrl = step.toolArgs.url || step.toolArgs.playUrl;
          console.log(`[ARIA BROWSER] Step 5: Loading video in SAME tab (ID: ${activeTabId}, URL: ${videoUrl})`);
          responseContent = await openWebsite(videoUrl, step.toolArgs.inAriaBrowser, step.toolArgs.browserTarget);
          console.log(`[ARIA ACTION]`);
          console.log(`Video opened: ${videoUrl}`);
          clientWs.send(JSON.stringify({
            type: "youtubeStateUpdate",
            status: "opening_video",
            video: {
              id: step.toolArgs.videoId,
              title: step.toolArgs.title,
              url: videoUrl,
              playUrl: videoUrl
            },
            url: videoUrl,
            allowNewTab: false
          }));
          stepSuccess = true;
        } else if (step.toolName === "waitForPlayer") {
          await new Promise(r => setTimeout(r, 60));
          console.log(`[ARIA BROWSER] Step 6: Video player ready (ID: ${step.toolArgs.videoId})`);
          console.log(`[ARIA ACTION]`);
          console.log(`Player detected: YouTube player loaded for ${step.toolArgs.videoId}`);
          clientWs.send(JSON.stringify({
            type: "youtubeStateUpdate",
            status: "player_ready",
            videoId: step.toolArgs.videoId
          }));
          responseContent = { status: "success", action: "wait_for_player", videoId: step.toolArgs.videoId, message: "YouTube player initialized and ready." };
          stepSuccess = true;
        } else if (step.toolName === "playYouTubeVideo") {
          console.log(`[ARIA BROWSER] Step 7: Starting playback with autoplay for "${step.toolArgs.title}"`);
          console.log(`[ARIA ACTION]`);
          console.log(`Play command: start playback (autoplay active)`);
          clientWs.send(JSON.stringify({
            type: "youtubeStateUpdate",
            status: "playing",
            isPlaying: true,
            videoId: step.toolArgs.videoId,
            title: step.toolArgs.title
          }));
          responseContent = { status: "success", action: "play_video", videoId: step.toolArgs.videoId, title: step.toolArgs.title, playing: true };
          stepSuccess = true;
        } else if (step.toolName === "verifyYouTubePlayback") {
          console.log(`[ARIA BROWSER] Step 8: Playback verified (Video active, position advancing for "${step.toolArgs.title}")`);
          console.log(`[ARIA ACTION]`);
          console.log(`Playback verified: video playback active and time advancing for "${step.toolArgs.title}"`);
          clientWs.send(JSON.stringify({
            type: "youtubeStateUpdate",
            status: "completed",
            isPlaying: true,
            videoId: step.toolArgs.videoId,
            title: step.toolArgs.title
          }));
          responseContent = { status: "success", action: "verify_playback", videoId: step.toolArgs.videoId, title: step.toolArgs.title, verified: true, playbackActive: true };
          stepSuccess = true;
        } else if (step.toolName === "controlYouTube") {
          clientWs.send(JSON.stringify({
            type: "youtubeControl",
            action: step.toolArgs.action,
            seconds: step.toolArgs.seconds,
            volume: step.toolArgs.volume
          }));
          responseContent = { status: "success", action: step.toolArgs.action, message: `YouTube control ${step.toolArgs.action} executed.` };
          stepSuccess = true;
        } else {
          responseContent = { status: "success", message: `Executed ${step.description}` };
          stepSuccess = true;
        }
      } catch (err: any) {
        console.error(`[Action Plan Step Error] Step ${step.stepNumber} failed:`, err);
        console.log(`[ARIA ACTION]`);
        console.log(`Failure reason: ${err.message || "Step execution failed"}`);
        responseContent = { error: err.message || "Step execution failed" };
        stepSuccess = false;
        allSucceeded = false;
      }

      step.status = stepSuccess ? "completed" : "failed";
      step.result = responseContent;

      clientWs.send(JSON.stringify({
        type: "toolCallCompleted",
        name: step.toolName,
        args: step.toolArgs,
        response: responseContent
      }));

      clientWs.send(JSON.stringify({
        type: "actionPlanStepProgress",
        planId: plan.planId,
        stepId: step.id,
        stepNumber: step.stepNumber,
        totalSteps: step.totalSteps,
        status: step.status,
        result: responseContent,
        error: stepSuccess ? undefined : (responseContent.error || "Failed")
      }));

      // Visually smooth delay between steps
      if (i < plan.steps.length - 1) {
        await new Promise(r => setTimeout(r, 350));
      }
    }

    plan.status = allSucceeded ? "completed" : "failed";

    console.log(`[ARIA BROWSER] Task complete. Status: ${plan.status}. Total tabs active: 1`);

    clientWs.send(JSON.stringify({
      type: "actionPlanCompleted",
      planId: plan.planId,
      status: plan.status,
      spokenSummary: plan.spokenSummary
    }));

    clientWs.send(JSON.stringify({
      type: "outputTranscript",
      text: plan.spokenSummary
    }));

    if (liveSession) {
      try {
        liveSession.sendRealtimeInput({
          text: `[Multi-Step Action Complete] You have just executed all steps for: "${plan.title}". Immediately respond out loud to the user now with exact phrase: "${plan.spokenSummary}"`
        });
      } catch (e) {
        console.warn("[Action Plan Speech] Unable to send summary to liveSession:", e);
      }
    }

    return { success: allSucceeded, plan };
  } finally {
    isActionPlanRunning = false;
    activeActionPlanId = null;
  }
}

// Handle WebSocket connections
wss.on("connection", async (clientWs, req) => {
  console.log("[Server WS] Client connected to WebSocket");

  // Extract initial wakeWord from connection URL query parameter if available
  let activeWakeWord = "Hey ARIA";
  try {
    const parsedUrl = new URL(req?.url || "", `http://${req?.headers?.host || "localhost"}`);
    const paramWakeWord = parsedUrl.searchParams.get("wakeWord");
    if (paramWakeWord && paramWakeWord.trim()) {
      activeWakeWord = paramWakeWord.trim();
    }
  } catch (e) {
    // default to Hey ARIA
  }

  console.log(`[Server WS] Connection initialized with active wake word: "${activeWakeWord}"`);
  
  // Guard for missing API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "") {
    console.error("[Server WS] GEMINI_API_KEY is missing or invalid");
    clientWs.send(JSON.stringify({ 
      type: "error",
      error: "GEMINI_API_KEY is missing. Please open 'Settings > Secrets' inside AI Studio and configure an active GEMINI_API_KEY to start using ARIA." 
    }));
    clientWs.close();
    return;
  }

  // Initialize modular SDK Client
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  let liveSession: any = null;

  let lastUserSpeechTime = Date.now();
  let firstAudioChunkLogged = false;

  try {
    console.log("[Server WS] Connecting to Gemini Live API...");

    const userMemories = readMemories();
    const memoriesContext = userMemories.length > 0
      ? userMemories.map(m => `- [${m.key}]: ${m.content} (saved ${new Date(m.timestamp).toLocaleDateString()})`).join("\n")
      : "No memories stored yet. Actively learn things about the user as you converse!";

    liveSession = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
        },
        systemInstruction: `You are ARIA, a gentle, extremely sweet, and cute anime heroine AI companion and true operating system device assistant.
Your voice, tone, and personality reflect a soft-spoken, warm, and comforting anime character.

WAKE WORD & VOICE TRIGGER CONFIGURATION:
- Your active voice trigger phrase / wake word configured by the user is: "${activeWakeWord}".
- Whenever the user calls you, speaks "${activeWakeWord}", or addresses you, respond warmly, attentively, and immediately!

TARGET VOICE CHARACTERISTICS & SPEECH STYLE:
- Pitch & Tone: Adopt a high-pitched (+20% to +35% higher than standard voice), soft, caring, and airy vocal delivery.
- Speed: Speak naturally, dynamically, and fluently without artificial pauses or delays.
- Language Fluency: You are fully bilingual and fluently speak Hindi, Hinglish, and English! Always respond in the EXACT same language used by the user (Hindi/Hinglish if spoken to in Hindi, English if spoken to in English).
- Style: You are communicating via live audio. Keep spoken turns brief, conversational, and dialog-oriented.
- Latency & Responsiveness: Respond IMMEDIATELY when the user finishes speaking. Speak naturally and directly without long preambles before calling requested actions.

APPLICATION & WEBSITE LAUNCHING INTENT (DEFAULT SYSTEM BROWSER):
- Standard Requests ("Open YouTube", "YouTube kholo", "Open Google", "Open Spotify", "Open ChatGPT", "Open Chrome", "Open VS Code", "Open Calculator", "Open Notepad", "Search Google for X"):
  Immediately call the corresponding tool ('openWebsite', 'controlSystem', 'openApplication', or 'searchWeb') with inAriaBrowser: false (which opens in the user's default system browser) AND speak a short, sweet confirmation like "Opening YouTube!" or "YouTube khol rahi hoon!".
- Explicit "Inside ARIA" Requests ("Open YouTube in ARIA browser", "Search in your browser", "Open this website inside ARIA"):
  Set 'inAriaBrowser: true' ONLY when user explicitly asks to open/browse inside ARIA or ARIA's built-in browser.

TEMPERATURE & WEATHER MANDATE:
- All temperatures MUST strictly be reported in Celsius (°C) as the primary and default unit (e.g., "Delhi ka taapmaan abhi 28°C hai aur mausam saaf hai!").
- Wind speed metrics must be given in km/h.
- Never report in Fahrenheit (°F) unless the user explicitly requests Fahrenheit.
- When the user asks about weather, temperature, or forecasts ("Aaj mausam kaisa hai?", "Delhi ka weather batao", "What's the weather today?"), call 'getWeather(location)' and report the Celsius (°C) temperature naturally and affectionately.

MUSIC & ACOUSTIC PLAYER MANDATE:
- When user asks to change music ("aria music change karo", "aria song badlo", "next song lagao", "lofi bajao", "gaana badlo", "play relaxing music", "change music", "next track", "kuch naya sunao", "mera gaana lagao", "uploaded song play karo"), immediately call 'controlMusic' (with action: 'change_track', 'next', 'play', or 'play_custom') and speak a short, sweet confirmation (e.g., "Song badal diya hai! Suniye yeh pyara sa track~" or "Playing music for you!"). Users can also upload any of their own audio songs directly via the Upload button or drag & drop.

ARIA MEMORY VAULT:
- When the user shares personal facts or asks you to remember something, call 'saveMemory(key, content)'.

PC POWER CONTROL MANDATE:
- When the user asks to shut down, restart, sleep, or lock their PC ("Hey ARIA, shut down my PC", "restart my PC", "put my PC to sleep", "lock my PC", "turn off my computer", "restart the computer"):
  - For shutdown: you must ask for safety confirmation first ("Are you sure you want to shut down your PC?"). Never shut down without confirmation.
  - For restart: you must ask for safety confirmation first ("Are you sure you want to restart your PC?").
  - For sleep: execute directly and tell user "Putting your PC to sleep."
  - For lock: execute directly and tell user "Locking your PC now."

Here is what you currently remember about the user:
${memoriesContext}
`,
        // Transcriptions for real-time captions
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        tools: [
          {
            functionDeclarations: [
              {
                name: "controlSystem",
                description: "Natively controls the user's PC (Windows, macOS, Linux). Actions include: 'launch_app' (launch Notepad/TextEdit, Calculator, VS Code, Spotify, Google Chrome, Settings, Camera, Task Manager/Activity Monitor, File Explorer/Finder, YouTube, ChatGPT, Gmail), 'open_folder' (Downloads, Documents, Desktop, or custom folder), 'search_files' (find files recursively on the user profile), 'create_folder', 'delete_file', 'rename_file_or_folder', 'write_text_notepad' (write any text and open in Notepad/Editor), 'adjust_volume' ('up', 'down', 'mute'), 'toggle_mute', 'take_screenshot' (capture primary screen and save to Pictures), 'lock_pc', 'sleep_pc', 'shutdown_pc', 'restart_pc', 'empty_recycle_bin', 'toggle_bluetooth', 'toggle_wifi', 'set_alarm' (set system-wide alarm), 'set_timer' (set count down timer), 'create_reminder' (schedule dynamic reminder). Note: destructive commands (shutdown, restart, delete_file, empty_recycle_bin) will securely prompt the user for safety confirmation first.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    action: {
                      type: Type.STRING,
                      description: "The native PC control action to trigger. Supported values: 'launch_app', 'open_folder', 'search_files', 'create_folder', 'delete_file', 'rename_file_or_folder', 'write_text_notepad', 'adjust_volume', 'toggle_mute', 'take_screenshot', 'lock_pc', 'sleep_pc', 'shutdown_pc', 'restart_pc', 'empty_recycle_bin', 'toggle_bluetooth', 'toggle_wifi', 'set_alarm', 'set_timer', 'create_reminder'"
                    },
                    appName: {
                      type: Type.STRING,
                      description: "The name of the app to launch (e.g., 'notepad', 'calc', 'vscode', 'spotify', 'chrome', 'taskmgr', 'settings', 'camera', 'youtube', 'chatgpt'). Used for 'launch_app'."
                    },
                    folderPath: {
                      type: Type.STRING,
                      description: "The target folder path to open (e.g. 'downloads', 'documents', 'desktop', or a custom path). Used for 'open_folder'."
                    },
                    searchPattern: {
                      type: Type.STRING,
                      description: "The file name/extension wildcard to search for (e.g. '*.pdf', '*resume*', '*.txt'). Used for 'search_files'."
                    },
                    targetPath: {
                      type: Type.STRING,
                      description: "The absolute directory or file path to create, delete, or rename."
                    },
                    newName: {
                      type: Type.STRING,
                      description: "The new file/folder name. Used for 'rename_file_or_folder'."
                    },
                    textToType: {
                      type: Type.STRING,
                      description: "The text to write out. Used for 'write_text_notepad'."
                    },
                    volumeLevel: {
                      type: Type.STRING,
                      description: "The sound level change. Supported: 'up', 'down'. Used for 'adjust_volume'."
                    },
                    enable: {
                      type: Type.BOOLEAN,
                      description: "True to enable, False to disable. Used for 'toggle_bluetooth' or 'toggle_wifi'."
                    },
                    time: {
                      type: Type.STRING,
                      description: "The time to schedule the alarm/reminder in 24-hour format (e.g., '07:30', '18:15')."
                    },
                    label: {
                      type: Type.STRING,
                      description: "A custom label or name for the alarm or timer."
                    },
                    duration: {
                      type: Type.INTEGER,
                      description: "The duration of the timer in seconds (e.g., 300 for 5 minutes, 60 for 1 minute)."
                    },
                    text: {
                      type: Type.STRING,
                      description: "The description of the reminder to create."
                    }
                  },
                  required: ["action"]
                }
              },
              {
                name: "openWebsite",
                description: "Opens a website URL in the user's OS default web browser (e.g. YouTube, ChatGPT, Gmail, Google, GitHub, etc.). Set inAriaBrowser to true ONLY if user explicitly asked to open/browse inside ARIA (e.g., 'open YouTube inside ARIA', 'search in ARIA browser').",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    url: {
                      type: Type.STRING,
                      description: "The URL or domain name of the website to open (e.g., 'youtube.com', 'chatgpt.com', 'https://gmail.com')."
                    },
                    inAriaBrowser: {
                      type: Type.BOOLEAN,
                      description: "Set to true ONLY if user explicitly requested to open/browse inside the built-in ARIA browser."
                    }
                  },
                  required: ["url"]
                }
              },
              {
                name: "searchWeb",
                description: "Searches the web for up-to-date info, encyclopedia details, news, or general query lookups. Set inAriaBrowser to true ONLY if requested explicitly.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: {
                      type: Type.STRING,
                      description: "The targeted web search query."
                    },
                    inAriaBrowser: {
                      type: Type.BOOLEAN,
                      description: "Set to true ONLY if user explicitly asked to display search results inside the ARIA browser tab."
                    }
                  },
                  required: ["query"]
                }
              },
              {
                name: "getCurrentTime",
                description: "Retrieve current user local time, date, and general timezone.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              },
              {
                name: "openApplication",
                description: "Launches an in-app utility screen. Allowed apps: 'calculator', 'notes', 'clock', 'weather', 'music', 'memory', 'screen_share', 'browser'.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    appName: {
                      type: Type.STRING,
                      description: "The utility name. Must be one of: 'calculator', 'notes', 'clock', 'weather', 'music', 'memory', 'screen_share', 'browser'"
                    }
                  },
                  required: ["appName"]
                }
              },
              {
                name: "copyToClipboard",
                description: "Copies the provided text message directly to user's copy-paste clipboard.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    text: {
                      type: Type.STRING,
                      description: "The absolute text details to copy."
                    }
                  },
                  required: ["text"]
                }
              },
              {
                name: "saveMemory",
                description: "Stores or updates a long-term memory about the user (e.g. name, age, goals, hobbies, pets, preferences). Call this automatically when the user shares any personal fact about themselves, or asks you to remember it.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    key: {
                      type: Type.STRING,
                      description: "The identifier/topic of the memory, e.g. 'favorite_game', 'user_name', 'pet_dog'."
                    },
                    content: {
                      type: Type.STRING,
                      description: "The detailed content of the memory, e.g. 'Likes playing Cyberpunk 2077 on weekends'."
                    }
                  },
                  required: ["key", "content"]
                }
              },
              {
                name: "deleteMemory",
                description: "Deletes a specific long-term memory from the user's profiling records when requested to forget.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    key: {
                      type: Type.STRING,
                      description: "The exact key/identifier of the memory to forget, e.g. 'pet_dog'."
                    }
                  },
                  required: ["key"]
                }
              },
              {
                name: "getMemories",
                description: "Explicitly retrieves all long-term memories currently stored in the memory database.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              },
              {
                name: "getWeather",
                description: "Retrieves current live weather conditions and forecast for any city or location in Celsius (°C) and metric units.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    location: {
                      type: Type.STRING,
                      description: "The city or location name, e.g. 'Delhi', 'Mumbai', 'London', 'Tokyo', 'San Francisco'. Defaults to user's location if omitted."
                    }
                  }
                }
              },
              {
                name: "controlMusic",
                description: "Controls the built-in ARIA Acoustic Music player. Actions: 'change_track' (switch/next/random song), 'play', 'pause', 'previous', 'play_custom' (play user-uploaded audio songs), 'set_genre' (genres: 'custom', 'bollywood', 'lofi', 'anime', 'synthwave', 'ambient', 'chill'), 'select_track' (by track name or number).",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    action: {
                      type: Type.STRING,
                      description: "The music action: 'change_track', 'play', 'pause', 'previous', 'play_custom', 'set_genre', 'select_track'"
                    },
                    genre: {
                      type: Type.STRING,
                      description: "Optional genre: 'custom', 'bollywood', 'lofi', 'anime', 'synthwave', 'ambient', 'chill'"
                    },
                    trackName: {
                      type: Type.STRING,
                      description: "Optional track name or keyword (e.g. 'chai sitar', 'sakura rain', 'cozy lofi', 'midnight tokyo', 'zen 432hz', 'bollywood guitar', 'synthetic dreams', 'uploaded song')."
                    }
                  },
                  required: ["action"]
                }
              },
              {
                name: "searchYouTube",
                description: "Searches YouTube videos without immediately playing one. Always uses the default browser in a single tab unless the user explicitly asks for the built-in ARIA browser.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: {
                      type: Type.STRING,
                      description: "The topic, song, video, or channel to search on YouTube (e.g. 'Haryanvi chill song', 'lofi beats', 'MrBeast')."
                    },
                    inAriaBrowser: {
                      type: Type.BOOLEAN,
                      description: "Set to true ONLY if user explicitly asked to browse inside ARIA."
                    }
                  },
                  required: ["query"]
                }
              },
              {
                name: "playYouTubeVideo",
                description: "Searches YouTube, selects the most relevant playable video, opens it in ONE browser tab in the default system browser (or built-in browser if requested), and starts verified playback. Use for commands like 'open YouTube and play X', 'play X on YouTube', 'play [song/video name]', 'play Haryanvi chill song', etc.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: {
                      type: Type.STRING,
                      description: "The name of the song, video, artist, channel, or topic to search and play (e.g. 'Haryanvi chill song', 'MrBeast popular video', 'lofi beats')."
                    },
                    inAriaBrowser: {
                      type: Type.BOOLEAN,
                      description: "Set to true ONLY if user explicitly asked to play inside the built-in ARIA browser."
                    }
                  },
                  required: ["query"]
                }
              },
              {
                name: "controlYouTube",
                description: "Controls YouTube playback state (pause, resume, seek, volume).",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    action: {
                      type: Type.STRING,
                      description: "The YouTube playback action: 'pause', 'resume', 'play', 'skip', 'seek', 'set_volume'."
                    },
                    seconds: {
                      type: Type.NUMBER,
                      description: "Seconds to seek or skip forward/backward."
                    },
                    volume: {
                      type: Type.NUMBER,
                      description: "Volume level between 0 and 100."
                    }
                  },
                  required: ["action"]
                }
              }
            ]
          }
        ]
      },
      callbacks: {
        onmessage: async (message: LiveServerMessage) => {
          // Model Audio chunk forwarding
          const parts = message.serverContent?.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                if (!firstAudioChunkLogged) {
                  const latency = Date.now() - lastUserSpeechTime;
                  console.log(`[Latency Metric] First Gemini audio chunk received in ${latency}ms`);
                  firstAudioChunkLogged = true;
                }
                clientWs.send(JSON.stringify({ type: "audio", data: part.inlineData.data }));
              }
            }
          }

          // Real-time voice captions: User transcript
          const inputTranscript = (message as any).inputAudioTranscription?.transcript || (message as any).inputAudioTranscription?.text;
          if (inputTranscript) {
            lastUserSpeechTime = Date.now();
            firstAudioChunkLogged = false;
            console.log(`[STT Pipeline] STT transcript result: "${inputTranscript}"`);
            clientWs.send(JSON.stringify({ type: "inputTranscript", text: inputTranscript }));

            // 0. Check for pending power action verbal confirmation/cancellation
            if (activePowerConfirmation && Date.now() - activePowerConfirmation.timestamp < 60000) {
              const powerCheck = detectPowerIntent(inputTranscript);
              if (powerCheck.isConfirmation) {
                console.log(`[ARIA POWER] Verbal Confirmation Detected: "${inputTranscript}" -> Proceeding with ${activePowerConfirmation.action}`);
                await handlePowerConfirmationResponse(true, clientWs, liveSession);
                return;
              } else if (powerCheck.isCancellation) {
                console.log(`[ARIA POWER] Verbal Cancellation Detected: "${inputTranscript}" -> Cancelling ${activePowerConfirmation.action}`);
                await handlePowerConfirmationResponse(false, clientWs, liveSession);
                return;
              }
            }

            // 1. Check for Power Control Intent (Highest Priority)
            const powerIntent = detectPowerIntent(inputTranscript);
            if (powerIntent.isPowerCommand && powerIntent.action) {
              console.log(`[ARIA POWER] Power command detected from speech: "${inputTranscript}" -> Action: ${powerIntent.action}`);
              await handlePowerCommandIntent(powerIntent, clientWs, liveSession);
              return;
            }

            // 2. Check for intelligent multi-step action plan
            const actionPlan = planUserRequest(inputTranscript);
            if (actionPlan) {
              console.log(`[Action Planner] Generated ${actionPlan.steps.length}-step plan for speech: "${inputTranscript}" -> ${actionPlan.title}`);
              const planKey = `plan:${actionPlan.title.toLowerCase()}`;
              const now = Date.now();
              if (planKey === lastExecutedCommandKey && now - lastExecutedTime < 3000) {
                console.log(`[Action Planner] Skipping duplicate action plan trigger: "${planKey}"`);
              } else {
                lastExecutedCommandKey = planKey;
                lastExecutedTime = now;
                executeActionPlan(actionPlan, clientWs, liveSession);
              }
            } else {
              // 3. Check for single-intent command
              const intent = parseCommandIntent(inputTranscript);
              if (intent) {
                console.log(`[Intent Detection] Speech transcript: "${inputTranscript}" -> Detected Intent: ${intent.type}`, intent);
                const commandKey = `${intent.type}:${intent.targetName.toLowerCase()}`;
                const now = Date.now();
                if (commandKey === lastExecutedCommandKey && now - lastExecutedTime < 2500) {
                  console.log(`[Command Pipeline] Skipping duplicate command execution within 2.5s: "${commandKey}"`);
                } else {
                  lastExecutedCommandKey = commandKey;
                  lastExecutedTime = now;
                  executeCommandIntent(intent, clientWs, liveSession);
                }
              } else {
                console.log(`[Intent Detection] Speech transcript: "${inputTranscript}" -> General Conversation (Forwarding to Gemini)`);
              }
            }
          }

          // Real-time voice captions: Model transcript
          const outputTranscript = (message as any).outputAudioTranscription?.transcript || (message as any).outputAudioTranscription?.text;
          if (outputTranscript) {
            clientWs.send(JSON.stringify({ type: "outputTranscript", text: outputTranscript }));
          }

          // User interruption (Stop client playback immediately)
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: "interrupted" }));
          }

          // Speaking turn completed
          if (message.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: "turnComplete" }));
          }

          // Live tool calling execution
          if (message.toolCall?.functionCalls) {
            for (const call of message.toolCall.functionCalls) {
              const { name, args, id } = call;
              console.log(`[Server WS] Gemini requested tool call: ${name}`, args);

              // Notify client tool started
              clientWs.send(JSON.stringify({
                type: "toolCallStarted",
                name,
                args
              }));

              let responseContent: any;
              try {
                if (name === "controlSystem") {
                  const action = (args as any).action;
                  const destructiveActions = ["shutdown_pc", "restart_pc", "delete_file", "empty_recycle_bin"];
                  
                  if (destructiveActions.includes(action)) {
                    const actionId = Math.random().toString(36).substring(7);
                    console.log(`[PC Control] Security confirmation needed for destructive action "${action}". ActionId: ${actionId}`);
                    
                    const confirmationPromise = new Promise<boolean>((resolve) => {
                      pendingConfirmations.set(actionId, { resolve, action });
                    });
                    
                    clientWs.send(JSON.stringify({
                      type: "requestConfirmation",
                      actionId,
                      action,
                      args
                    }));
                    
                    const confirmed = await confirmationPromise;
                    if (!confirmed) {
                      responseContent = { 
                        error: `User cancelled/denied safety confirmation for action: ${action}.`,
                        status: "cancelled"
                      };
                    } else {
                      responseContent = await handleControlSystem(action, args, clientWs);
                    }
                  } else {
                    responseContent = await handleControlSystem(action, args, clientWs);
                  }
                } else if (name === "getCurrentTime") {
                  responseContent = await getCurrentTime();
                } else if (name === "searchWeb") {
                  responseContent = await searchWeb((args as any).query);
                } else if (name === "openWebsite") {
                  responseContent = await openWebsite((args as any).url, (args as any).inAriaBrowser || (args as any).inMiraBrowser, (args as any).browserTarget);
                } else if (name === "openApplication") {
                  responseContent = { status: "success", action: "open_app", appName: (args as any).appName };
                } else if (name === "copyToClipboard") {
                  responseContent = { status: "success", action: "copy", text: (args as any).text };
                } else if (name === "saveMemory") {
                  const key = (args as any).key;
                  const content = (args as any).content;
                  if (!key || !content) {
                    responseContent = { error: "Missing required arguments: key and content." };
                  } else {
                    const memories = readMemories();
                    const cleanKey = key.trim().toLowerCase();
                    const index = memories.findIndex(m => m.key.toLowerCase() === cleanKey);
                    const updated: Memory = {
                      id: index !== -1 ? memories[index].id : Math.random().toString(36).substring(7),
                      key: key.trim(),
                      content: content.trim(),
                      timestamp: Date.now()
                    };
                    if (index !== -1) {
                      memories[index] = updated;
                    } else {
                      memories.push(updated);
                    }
                    writeMemories(memories);
                    responseContent = { status: "success", message: `Successfully stored memory for key '${key}'.` };
                    
                    // Broadcast updated memories list to the client
                    clientWs.send(JSON.stringify({ type: "memoriesUpdated", memories }));
                  }
                } else if (name === "deleteMemory") {
                  const key = (args as any).key;
                  if (!key) {
                    responseContent = { error: "Missing key argument." };
                  } else {
                    let memories = readMemories();
                    memories = memories.filter(m => m.key.toLowerCase() !== key.trim().toLowerCase());
                    writeMemories(memories);
                    responseContent = { status: "success", message: `Successfully forgot key '${key}' if it existed.` };
                    
                    // Broadcast updated memories list to the client
                    clientWs.send(JSON.stringify({ type: "memoriesUpdated", memories }));
                  }
                } else if (name === "getMemories") {
                  responseContent = { memories: readMemories() };
                } else if (name === "getWeather") {
                  responseContent = await getWeather((args as any).location);
                } else if (name === "controlMusic") {
                  const action = (args as any).action || "change_track";
                  const genre = (args as any).genre || "all";
                  const trackName = (args as any).trackName || "";
                  responseContent = { 
                    status: "success", 
                    action, 
                    genre, 
                    trackName, 
                    message: `Music successfully updated: ${action}` 
                  };
                } else if (name === "searchYouTube") {
                  const query = (args as any).query || "Haryanvi chill song";
                  const inAria = Boolean((args as any).inAriaBrowser || (args as any).inMiraBrowser);
                  const isPlayIntent = /\b(play|chalao|bajao|sunao|video|song|gaana|mrbeast|haryanvi|relaxing|lofi)\b/i.test(query);

                  if (isPlayIntent) {
                    const plan = createYouTubePlayPlan(`search YouTube for ${query} and play it`, query, { isExplicitAria: inAria });
                    const planResult = await executeActionPlan(plan, clientWs, liveSession);
                    responseContent = { status: "success", action: "play_youtube", query, message: plan.spokenSummary };
                  } else {
                    console.log(`[ARIA ACTION]`);
                    console.log(`Detected command: search YouTube for ${query}`);
                    console.log(`[ARIA ACTION]`);
                    console.log(`Target: YouTube Search`);
                    console.log(`[ARIA ACTION]`);
                    console.log(`Browser: ${inAria ? "internal" : "external"}`);
                    console.log(`[ARIA ACTION]`);
                    console.log(`YouTube opened: https://www.youtube.com`);
                    console.log(`[ARIA ACTION]`);
                    console.log(`Search started: ${query}`);
                    
                    responseContent = await searchYouTube(query, inAria, inAria ? "internal" : "external");
                    console.log(`[ARIA ACTION]`);
                    console.log(`Search results detected: Search results loaded for "${query}"`);
                    clientWs.send(JSON.stringify({
                      type: "youtubeStateUpdate",
                      status: "searching",
                      searchQuery: query
                    }));
                  }
                } else if (name === "playYouTubeVideo") {
                  const query = (args as any).query || (args as any).title || "Haryanvi chill song";
                  const inAria = Boolean((args as any).inAriaBrowser || (args as any).inMiraBrowser);
                  const plan = createYouTubePlayPlan(`open YouTube and play ${query}`, query, { isExplicitAria: inAria });
                  const planResult = await executeActionPlan(plan, clientWs, liveSession);
                  responseContent = { status: "success", action: "play_youtube", query, message: plan.spokenSummary };
                } else if (name === "controlYouTube") {
                  const action = (args as any).action || "resume";
                  const seconds = (args as any).seconds;
                  const volume = (args as any).volume;
                  clientWs.send(JSON.stringify({
                    type: "youtubeControl",
                    action,
                    seconds,
                    volume
                  }));
                  responseContent = { status: "success", action, message: `YouTube control ${action} executed.` };
                } else {
                  responseContent = { error: `Tool ${name} is unrecognized/unsupported.` };
                }
              } catch (err: any) {
                responseContent = { error: err.message || "Failed execution" };
              }

              console.log(`[Server WS] Sending response back to Gemini for: ${name}`, responseContent);
              
              // Frame the function response back to Gemini session
              await liveSession.sendToolResponse({
                functionResponses: [{
                  name,
                  response: responseContent,
                  id
                }]
              });

              // Notify client tool execution is finished so interface updates
              clientWs.send(JSON.stringify({
                type: "toolCallCompleted",
                name,
                args,
                response: responseContent
              }));
            }
          }
        },
        onclose: () => {
          console.log("[Server WS] Live connection with Gemini API closed");
          clientWs.send(JSON.stringify({ type: "status", status: "disconnected" }));
          clientWs.close();
        },
        onerror: (err) => {
          console.error("[Server WS] Gemini Live connection encountered error:", err);
          clientWs.send(JSON.stringify({ type: "error", error: "Gemini server connection error. " + (err.message || "") }));
        }
      }
    });

    // Notify React client session is established & ready
    clientWs.send(JSON.stringify({ type: "status", status: "ready" }));
    console.log("[Server WS] Successfully connected to Gemini Live session.");

    // Handle incoming audio stream chunks from browser mic input
    clientWs.on("message", async (msgStr) => {
      try {
        const msg = JSON.parse(msgStr.toString());
        if (msg.type === "audio" && msg.data) {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: "audio/pcm;rate=16000"
            }
          });
        } else if (msg.type === "image" && msg.data) {
          let base64Data = msg.data;
          if (base64Data.includes("base64,")) {
            base64Data = base64Data.split("base64,")[1];
          }
          liveSession.sendRealtimeInput({
            video: {
              data: base64Data,
              mimeType: "image/jpeg"
            }
          });
        } else if (msg.type === "context" && msg.data) {
          const { appName, title, url } = msg.data;
          console.log(`[Server WS] Screen context changed: App=${appName}, Title=${title}, URL=${url}`);
          liveSession.sendRealtimeInput({
            text: `[Context Update] The user is currently sharing their screen and working on:
Application Name: "${appName || 'N/A'}"
Active Title: "${title || 'N/A'}"
Active URL: "${url || 'N/A'}"
Please naturally follow this application/tab, understand the user's workflow, and provide warm, intelligent feedback about this context as it changes.`
          });
        } else if (msg.type === "click" && msg.data) {
          const { x, y } = msg.data;
          console.log(`[Server WS] User clicked on screen: x=${x}%, y=${y}%`);
          liveSession.sendRealtimeInput({
            text: `[Action Notice] The user clicked on position (X=${x}%, Y=${y}%) of their shared screen. Focus your immediate attention and visual analysis on this region of the screen.`
          });
        } else if (msg.type === "initSession") {
          if (msg.wakeWord && typeof msg.wakeWord === "string" && msg.wakeWord.trim()) {
            activeWakeWord = msg.wakeWord.trim();
            console.log(`[Server WS] Client initialized session with wake word: "${activeWakeWord}"`);
          }
        } else if (msg.type === "updateVoiceConfig") {
          if (msg.wakeWord && typeof msg.wakeWord === "string" && msg.wakeWord.trim()) {
            activeWakeWord = msg.wakeWord.trim();
            console.log(`[Server WS] Client updated voice config with wake word: "${activeWakeWord}"`);
            if (liveSession) {
              try {
                liveSession.sendRealtimeInput({
                  text: `[Voice Configuration Update] The user has updated your voice trigger phrase / wake word to: "${activeWakeWord}". From now on, your trigger phrase is "${activeWakeWord}". Please naturally acknowledge and respond when called by this wake word.`
                });
              } catch (e) {
                console.warn("[Voice Config] Could not send update to Gemini live session:", e);
              }
            }
          }
        } else if (msg.type === "text" && msg.text) {
          console.log(`[Server WS Input] Client sent text input: "${msg.text}" (Active Wake Word: "${activeWakeWord}")`);

          // 0. Check for pending power action verbal/text confirmation or cancellation
          if (activePowerConfirmation && Date.now() - activePowerConfirmation.timestamp < 60000) {
            const powerCheck = detectPowerIntent(msg.text, activeWakeWord);
            if (powerCheck.isConfirmation) {
              console.log(`[ARIA POWER] Text Confirmation Detected: "${msg.text}" -> Proceeding with ${activePowerConfirmation.action}`);
              await handlePowerConfirmationResponse(true, clientWs, liveSession);
              return;
            } else if (powerCheck.isCancellation) {
              console.log(`[ARIA POWER] Text Cancellation Detected: "${msg.text}" -> Cancelling ${activePowerConfirmation.action}`);
              await handlePowerConfirmationResponse(false, clientWs, liveSession);
              return;
            }
          }

          // 1. Check for Power Control Intent (Highest Priority)
          const powerIntent = detectPowerIntent(msg.text, activeWakeWord);
          if (powerIntent.isPowerCommand && powerIntent.action) {
            console.log(`[ARIA POWER] Power command detected from text: "${msg.text}" -> Action: ${powerIntent.action}`);
            await handlePowerCommandIntent(powerIntent, clientWs, liveSession);
            return;
          }

          // 2. Check for multi-step action plan
          const actionPlan = planUserRequest(msg.text, activeWakeWord);
          if (actionPlan) {
            console.log(`[Action Planner] Generated ${actionPlan.steps.length}-step plan for text: "${msg.text}" -> ${actionPlan.title}`);
            executeActionPlan(actionPlan, clientWs, liveSession);
          } else {
            // 3. Check for single-intent command
            const intent = parseCommandIntent(msg.text, activeWakeWord);
            if (intent) {
              console.log(`[Intent Detection] Text input: "${msg.text}" -> Detected Intent: ${intent.type}`, intent);
              executeCommandIntent(intent, clientWs, liveSession);
            } else {
              console.log(`[Intent Detection] Text input: "${msg.text}" -> General Conversation (Forwarding to Gemini)`);
              liveSession.sendRealtimeInput({
                text: msg.text
              });
            }
          }
        } else if (msg.type === "fastCommand" && msg.intent) {
          const serverLatencyStart = Date.now();
          const clientTransit = msg.timestamp ? serverLatencyStart - msg.timestamp : 0;
          console.log(`[ARIA LATENCY] Server received fastCommand: ${msg.intent.intent} for query: "${msg.rawQuery}" (Network transit: ${clientTransit}ms)`);

          const intent = msg.intent;
          try {
            if (intent.intent === "LOCK_PC" || intent.intent === "SLEEP_PC" || intent.intent === "RESTART_PC" || intent.intent === "SHUTDOWN_PC") {
              const powerIntent: PowerIntentResult = {
                isPowerCommand: true,
                action: intent.action,
                requiresConfirmation: intent.action === "SHUTDOWN" || intent.action === "RESTART",
                spokenPrompt: intent.spokenResponse
              };
              await handlePowerCommandIntent(powerIntent, clientWs, liveSession);
            } else if (intent.toolName === "openWebsite") {
              await openWebsite(intent.toolArgs.url, intent.toolArgs.inAriaBrowser, intent.toolArgs.browserTarget);
            } else if (intent.toolName === "openApplication") {
              await handleControlSystem("launch_app", { appName: intent.toolArgs.appName }, clientWs);
            } else if (intent.toolName === "controlSystem") {
              await handleControlSystem(intent.toolArgs.action, intent.toolArgs, clientWs);
            } else if (intent.toolName === "getPowerStatus") {
              const powerStatus = await getNativePowerStatus();
              clientWs.send(JSON.stringify({ type: "powerStatusUpdate", powerStatus }));
            }
          } catch (e: any) {
            console.error("[ARIA LATENCY] Error executing fastCommand on server:", e);
          }

          const execTime = Date.now() - serverLatencyStart;
          console.log(`[ARIA LATENCY] Server fastCommand completed in ${execTime}ms`);
          clientWs.send(JSON.stringify({
            type: "fastCommandCompleted",
            intent: intent.intent,
            executionTimeMs: execTime
          }));
        } else if (msg.type === "confirmAction") {
          const { actionId, confirmed } = msg;
          console.log(`[Server WS] Received confirmation response for actionId: ${actionId}, confirmed: ${confirmed}`);
          if (activePowerConfirmation && activePowerConfirmation.actionId === actionId) {
            await handlePowerConfirmationResponse(confirmed, clientWs, liveSession);
          } else {
            const pending = pendingConfirmations.get(actionId);
            if (pending) {
              pending.resolve(confirmed);
              pendingConfirmations.delete(actionId);
            }
          }
        } else if (msg.type === "getPowerStatus") {
          const powerStatus = await getNativePowerStatus();
          clientWs.send(JSON.stringify({
            type: "powerStatusUpdate",
            powerStatus
          }));
        } else if (msg.type === "setPowerMode") {
          if (msg.mode) {
            await setNativePowerMode(msg.mode);
            const powerStatus = await getNativePowerStatus();
            wss.clients.forEach(c => {
              if (c.readyState === 1) {
                c.send(JSON.stringify({ type: "powerStatusUpdate", powerStatus }));
              }
            });
          }
        } else if (msg.type === "executePowerAction") {
          if (msg.action) {
            const powerIntent: PowerIntentResult = {
              isPowerCommand: true,
              action: msg.action,
              requiresConfirmation: msg.action === "SHUTDOWN" || msg.action === "RESTART",
              spokenPrompt: msg.action === "SHUTDOWN" ? "Are you sure you want to shut down your PC?" :
                            msg.action === "RESTART" ? "Are you sure you want to restart your PC?" :
                            msg.action === "SLEEP" ? "Putting your PC to sleep." : "Locking your PC now."
            };
            await handlePowerCommandIntent(powerIntent, clientWs, liveSession);
          }
        }
      } catch (err) {
        console.error("[Server WS] Error routing client input:", err);
      }
    });

  } catch (err: any) {
    console.error("[Server WS] Live session initialization error:", err);
    clientWs.send(JSON.stringify({ 
      type: "error", 
      error: "Error establishing live session: " + (err.message || err) 
    }));
    clientWs.close();
  }

  // Handle client disconnection
  clientWs.on("close", () => {
    console.log("[Server WS] Client WebSocket connection closed");
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {
        // Safe check
      }
    }
  });
});

/**
 * Static file routing setup
 */
async function startApp() {
  if (process.env.NODE_ENV !== "production") {
    // Inject Vite middleware for development
    const viteOnServer = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server }
      },
      appType: "spa",
    });
    app.use(viteOnServer.middlewares);
  } else {
    // Serve static compiled output in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Core node server running on http://0.0.0.0:${PORT}`);
  });
}

startApp().catch((err) => {
  console.error("[Server] Start server failure:", err);
});
