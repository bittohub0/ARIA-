import React, { useState, useEffect, useCallback } from "react";
import { 
  X, 
  Battery, 
  BatteryCharging, 
  BatteryFull, 
  BatteryMedium, 
  BatteryLow, 
  BatteryWarning, 
  Zap, 
  Plug, 
  Power, 
  RotateCcw, 
  Lock, 
  Moon, 
  Cpu, 
  HardDrive, 
  Activity, 
  Clock, 
  Shield, 
  Sliders, 
  RefreshCw, 
  Laptop, 
  Server,
  AlertTriangle,
  CheckCircle2,
  Gauge
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useMiraStore, PowerStatusData } from "../../store/useMiraStore";
import { liveSessionInstance } from "../../lib/LiveSession";

interface PowerWidgetProps {
  onClose: () => void;
}

export const PowerWidget: React.FC<PowerWidgetProps> = ({ onClose }) => {
  const { powerStatus, setPowerStatus } = useMiraStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isChangingMode, setIsChangingMode] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"SHUTDOWN" | "RESTART" | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Fetch live power status from backend API
  const fetchPowerStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/system/power-status");
      if (res.ok) {
        const data: PowerStatusData = await res.json();
        setPowerStatus(data);
      } else {
        // Try requesting via WebSocket as fallback
        liveSessionInstance.getPowerStatus();
      }
    } catch (err) {
      console.warn("[PowerWidget] Error polling power status:", err);
      liveSessionInstance.getPowerStatus();
    } finally {
      setIsLoading(false);
    }
  }, [setPowerStatus]);

  // Initial fetch and 4s polling interval when widget is open
  useEffect(() => {
    fetchPowerStatus();
    const interval = setInterval(fetchPowerStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchPowerStatus]);

  // Handle Power Mode switch
  const handleSetPowerMode = async (mode: "Balanced" | "Battery Saver" | "High Performance") => {
    try {
      setIsChangingMode(true);
      const res = await fetch("/api/system/power-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        const data = await res.json();
        setActionFeedback(`Switched profile to ${mode}`);
        setTimeout(() => setActionFeedback(null), 3000);
        await fetchPowerStatus();
      } else {
        liveSessionInstance.setPowerMode(mode);
      }
    } catch (e) {
      liveSessionInstance.setPowerMode(mode);
    } finally {
      setIsChangingMode(false);
    }
  };

  // Handle Quick Power Action
  const handleExecuteAction = async (action: "LOCK" | "SLEEP" | "RESTART" | "SHUTDOWN") => {
    if (action === "SHUTDOWN" || action === "RESTART") {
      setConfirmAction(action);
      return;
    }

    try {
      setActionFeedback(`Executing ${action.toLowerCase()}...`);
      const res = await fetch("/api/system/power-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        setActionFeedback(data.message || `${action} executed successfully.`);
      } else {
        setActionFeedback(data.message || `Error executing ${action}`);
      }
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      liveSessionInstance.executePowerAction(action);
    }
  };

  // Confirm dangerous power action (Shutdown / Restart)
  const handleConfirmPowerAction = async () => {
    if (!confirmAction) return;
    const act = confirmAction;
    setConfirmAction(null);
    try {
      setActionFeedback(`Initiating ${act.toLowerCase()}...`);
      const res = await fetch("/api/system/power-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act })
      });
      const data = await res.json();
      setActionFeedback(data.message || `${act} scheduled.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      liveSessionInstance.executePowerAction(act);
    }
  };

  // Format uptime nicely
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Format bytes to GB
  const formatGB = (bytes: number) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  };

  // Get battery status icon based on percentage and charging state
  const getBatteryIcon = (percent: number, isCharging: boolean) => {
    if (isCharging) {
      return <BatteryCharging className="w-8 h-8 text-emerald-400 animate-pulse" />;
    }
    if (percent > 80) {
      return <BatteryFull className="w-8 h-8 text-emerald-400" />;
    }
    if (percent > 40) {
      return <BatteryMedium className="w-8 h-8 text-sky-400" />;
    }
    if (percent > 20) {
      return <BatteryLow className="w-8 h-8 text-amber-400" />;
    }
    return <BatteryWarning className="w-8 h-8 text-rose-400 animate-bounce" />;
  };

  const status = powerStatus || {
    hasBattery: true,
    batteryPercent: 100,
    isCharging: true,
    powerSource: "AC",
    statusText: "Plugged into AC power (100%)",
    timeRemainingMinutes: null,
    batteryHealth: "Good",
    powerMode: "Balanced",
    system: {
      platform: "linux",
      platformName: "Linux System",
      arch: "x64",
      uptimeSeconds: 3600,
      hostname: "PC-Host",
      cpuModel: "Native Processor",
      cpuCores: 8,
      cpuLoadPercent: 14,
      totalMemBytes: 16 * 1024 * 1024 * 1024,
      freeMemBytes: 9 * 1024 * 1024 * 1024,
      usedMemPercent: 44,
      osRelease: "Release-1.0"
    },
    timestamp: Date.now()
  };

  const isCharging = status.isCharging;
  const batteryPct = Math.min(100, Math.max(0, status.batteryPercent));
  const currentMode = status.powerMode || "Balanced";

  return (
    <div 
      id="power-status-widget"
      className="bg-[#0e0f19]/95 border border-white/10 backdrop-blur-2xl rounded-3xl p-5 md:p-6 w-full max-w-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] text-white relative z-50 flex flex-col gap-5 max-h-[90vh] overflow-y-auto custom-scrollbar"
    >
      {/* HEADER ROW */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
            <Zap className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Power & Battery Hub
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Native Bridge
              </span>
            </h2>
            <p className="text-xs text-zinc-400 font-sans">
              Real-time hardware telemetry and native power management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="refresh-power-status-btn"
            onClick={fetchPowerStatus}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Power Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
          <button
            id="close-power-widget-btn"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 transition-all cursor-pointer"
            title="Close Widget"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ACTION FEEDBACK TOAST */}
      <AnimatePresence>
        {actionFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-500/20 border border-indigo-500/40 rounded-xl px-4 py-2 text-xs text-indigo-200 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-sans">{actionFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION MODAL OVERLAY */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-rose-950/80 border border-rose-500/30 rounded-2xl p-4 flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wider">
                  Confirm System {confirmAction === "SHUTDOWN" ? "Shutdown" : "Restart"}
                </h4>
                <p className="text-xs text-rose-200/80 font-sans mt-0.5 leading-relaxed">
                  Are you sure you want to {confirmAction.toLowerCase()} your computer now? Unsaved work will be closed.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white/80 transition-all cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPowerAction}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs text-white font-semibold shadow-lg shadow-rose-600/30 transition-all cursor-pointer font-sans flex items-center gap-1.5"
              >
                <Power className="w-3.5 h-3.5" />
                Confirm {confirmAction === "SHUTDOWN" ? "Shut Down" : "Restart"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN TELEMETRY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* HERO BATTERY CARD */}
        <div className="md:col-span-2 bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div 
            className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-20 pointer-events-none ${
              isCharging ? "bg-emerald-500" : batteryPct > 20 ? "bg-indigo-500" : "bg-rose-500"
            }`} 
          />

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                {getBatteryIcon(batteryPct, isCharging)}
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
                  Power Source
                </span>
                <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                  {isCharging ? (
                    <>
                      <Plug className="w-3.5 h-3.5 text-emerald-400" />
                      AC Adapter Connected
                    </>
                  ) : (
                    <>
                      <Battery className="w-3.5 h-3.5 text-sky-400" />
                      Battery Power
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-3xl font-extrabold tracking-tight font-mono text-white">
                {batteryPct}%
              </span>
              <span className={`text-[11px] font-semibold block ${isCharging ? "text-emerald-400" : "text-zinc-300"}`}>
                {isCharging ? "Charging" : "Discharging"}
              </span>
            </div>
          </div>

          {/* Battery Level Progress Bar */}
          <div className="my-4 space-y-1.5">
            <div className="w-full h-3 bg-black/40 border border-white/10 rounded-full overflow-hidden p-0.5">
              <motion.div
                className={`h-full rounded-full transition-all duration-500 ${
                  isCharging
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    : batteryPct > 40
                    ? "bg-gradient-to-r from-indigo-500 to-sky-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    : batteryPct > 20
                    ? "bg-gradient-to-r from-amber-500 to-orange-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                    : "bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${batteryPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
              <span>0% Empty</span>
              <span className="text-zinc-300">{status.statusText}</span>
              <span>100% Full</span>
            </div>
          </div>

          {/* Battery Sub-details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-white/5 text-xs font-sans">
            <div className="bg-white/[0.02] p-2 rounded-xl border border-white/5">
              <span className="text-[10px] text-zinc-400 font-mono uppercase block">Estimated Time</span>
              <span className="font-semibold text-zinc-200 text-xs">
                {status.timeRemainingMinutes !== null && status.timeRemainingMinutes > 0
                  ? `${Math.floor(status.timeRemainingMinutes / 60)}h ${status.timeRemainingMinutes % 60}m`
                  : isCharging
                  ? "Direct AC / Full"
                  : "Calculating..."}
              </span>
            </div>

            <div className="bg-white/[0.02] p-2 rounded-xl border border-white/5">
              <span className="text-[10px] text-zinc-400 font-mono uppercase block">Battery Health</span>
              <span className="font-semibold text-emerald-400 text-xs flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {status.batteryHealth || "Optimal"}
              </span>
            </div>

            <div className="bg-white/[0.02] p-2 rounded-xl border border-white/5 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-zinc-400 font-mono uppercase block">Active Profile</span>
              <span className="font-semibold text-indigo-300 text-xs">
                {currentMode}
              </span>
            </div>
          </div>
        </div>

        {/* SYSTEM HARDWARE STATUS CARD */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">System Specs</h3>
          </div>

          <div className="space-y-2.5 text-xs font-sans">
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-zinc-400 flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-indigo-300" /> CPU Load
                </span>
                <span className="font-mono text-zinc-200 font-bold">{status.system.cpuLoadPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(100, Math.max(5, status.system.cpuLoadPercent))}%` }} 
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-zinc-400 flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-sky-300" /> RAM Usage
                </span>
                <span className="font-mono text-zinc-200 font-bold">{status.system.usedMemPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(100, Math.max(5, status.system.usedMemPercent))}%` }} 
                />
              </div>
              <div className="text-[9px] font-mono text-zinc-400 mt-1 flex justify-between">
                <span>Free: {formatGB(status.system.freeMemBytes)}</span>
                <span>Total: {formatGB(status.system.totalMemBytes)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-300" /> System Uptime
              </span>
              <span className="font-mono text-amber-200 font-semibold">
                {formatUptime(status.system.uptimeSeconds)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 flex items-center gap-1">
                <Laptop className="w-3 h-3 text-zinc-400" /> Host Machine
              </span>
              <span className="font-mono text-zinc-300 text-[10px] truncate max-w-[110px]" title={status.system.hostname}>
                {status.system.hostname}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* POWER PROFILE SELECTOR */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-indigo-400" /> Power Management Profile
          </span>
          {isChangingMode && (
            <span className="text-[10px] font-mono text-indigo-300 animate-pulse">
              Applying OS Power Policy...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Battery Saver */}
          <button
            id="power-profile-saver-btn"
            onClick={() => handleSetPowerMode("Battery Saver")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
              currentMode === "Battery Saver"
                ? "bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
                Battery Saver
              </span>
              {currentMode === "Battery Saver" && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] text-zinc-400 leading-tight">
              Reduces energy usage & extends battery run time.
            </span>
          </button>

          {/* Balanced */}
          <button
            id="power-profile-balanced-btn"
            onClick={() => handleSetPowerMode("Balanced")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
              currentMode === "Balanced"
                ? "bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                Balanced
              </span>
              {currentMode === "Balanced" && (
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] text-zinc-400 leading-tight">
              Optimal balance between responsive speed and energy efficiency.
            </span>
          </button>

          {/* High Performance */}
          <button
            id="power-profile-perf-btn"
            onClick={() => handleSetPowerMode("High Performance")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
              currentMode === "High Performance"
                ? "bg-fuchsia-500/20 border-fuchsia-500/50 shadow-[0_0_15px_rgba(217,70,239,0.2)]"
                : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-fuchsia-400" />
                High Performance
              </span>
              {currentMode === "High Performance" && (
                <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] text-zinc-400 leading-tight">
              Maximum CPU speed & power throughput for demanding tasks.
            </span>
          </button>
        </div>
      </div>

      {/* QUICK POWER CONTROLS */}
      <div className="flex flex-col gap-2 pt-1">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Power className="w-3.5 h-3.5 text-zinc-400" /> Quick Power Actions
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Lock */}
          <button
            id="action-lock-pc-btn"
            onClick={() => handleExecuteAction("LOCK")}
            className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-zinc-200 hover:text-white"
          >
            <Lock className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-medium">Lock Screen</span>
          </button>

          {/* Sleep */}
          <button
            id="action-sleep-pc-btn"
            onClick={() => handleExecuteAction("SLEEP")}
            className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-zinc-200 hover:text-white"
          >
            <Moon className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-medium">Sleep PC</span>
          </button>

          {/* Restart */}
          <button
            id="action-restart-pc-btn"
            onClick={() => handleExecuteAction("RESTART")}
            className="p-3 rounded-xl bg-white/[0.04] hover:bg-amber-500/15 border border-white/10 hover:border-amber-500/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-zinc-200 hover:text-amber-200"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium">Restart PC</span>
          </button>

          {/* Shut Down */}
          <button
            id="action-shutdown-pc-btn"
            onClick={() => handleExecuteAction("SHUTDOWN")}
            className="p-3 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-zinc-200 hover:text-rose-200"
          >
            <Power className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-medium">Shut Down</span>
          </button>
        </div>
      </div>

    </div>
  );
};
