import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, 
  MicOff, 
  Power, 
  Terminal, 
  Sparkles, 
  Calculator, 
  FileText, 
  Clock as ClockIcon, 
  CloudRain, 
  Music, 
  Compass, 
  HelpCircle,
  Cpu,
  RefreshCw,
  Brain,
  Monitor,
  Globe,
  User,
  Send,
  AlertTriangle,
  AlarmClock,
  Hourglass,
  Zap,
  Battery,
  BatteryCharging
} from "lucide-react";

import { useMiraStore } from "./store/useMiraStore";
import { liveSessionInstance } from "./lib/LiveSession";
import MiraOrb from "./components/MiraOrb";
import WaveformVisualizer from "./components/WaveformVisualizer";
import ToolCallsPanel from "./components/ToolCallsPanel";
import ActionPlanWidget from "./components/ActionPlanWidget";

// Import overlay widgets
import CalculatorWidget from "./components/widgets/CalculatorWidget";
import NotesWidget from "./components/widgets/NotesWidget";
import ClockWidget from "./components/widgets/ClockWidget";
import WeatherWidget from "./components/widgets/WeatherWidget";
import MusicWidget from "./components/widgets/MusicWidget";
import MemoryWidget from "./components/widgets/MemoryWidget";
import ScreenShareWidget from "./components/widgets/ScreenShareWidget";
import BrowserWidget from "./components/widgets/BrowserWidget";
import { PowerWidget } from "./components/widgets/PowerWidget";

// Import Onboarding & Profile Services
import Onboarding from "./components/Onboarding";
import ProfileSettings from "./components/ProfileSettings";
import { loadUserProfile, UserProfile } from "./lib/profileService";

function parseScreenDetails(label: string, activeApp: string, browserTabs: any[], activeTabId: string) {
  let appName = "Screen Share";
  let title = label || "";
  let url = "";

  if (activeApp === "browser") {
    appName = "Google Chrome (In-App)";
    const activeTab = browserTabs.find(t => t.id === activeTabId);
    if (activeTab) {
      title = activeTab.title || "Custom Tab";
      url = activeTab.url || "";
    }
  } else if (activeApp !== "none" && activeApp !== "screen_share") {
    appName = "ARIA Ecosystem";
    title = `Active Widget: ${activeApp}`;
  } else if (label) {
    const cleanLabel = label.toLowerCase();
    if (cleanLabel.includes("chrome") || cleanLabel.includes("chromium")) {
      appName = "Google Chrome";
    } else if (cleanLabel.includes("firefox")) {
      appName = "Mozilla Firefox";
    } else if (cleanLabel.includes("edge")) {
      appName = "Microsoft Edge";
    } else if (cleanLabel.includes("safari")) {
      appName = "Safari";
    } else if (cleanLabel.includes("code") || cleanLabel.includes("vs")) {
      appName = "Visual Studio Code";
    } else if (cleanLabel.includes("spotify")) {
      appName = "Spotify";
    } else if (cleanLabel.includes("canva")) {
      appName = "Canva Design";
    } else if (cleanLabel.includes("youtube")) {
      appName = "YouTube";
      url = "https://youtube.com";
    } else if (cleanLabel.includes("chatgpt") || cleanLabel.includes("openai")) {
      appName = "ChatGPT";
      url = "https://chatgpt.com";
    } else if (cleanLabel.includes("gmail") || cleanLabel.includes("mail")) {
      appName = "Gmail Inbox";
      url = "https://mail.google.com";
    }

    const parts = label.split(" - ");
    if (parts.length > 1) {
      title = parts[0];
      if (appName === "Screen Share") {
        appName = parts[parts.length - 1];
      }
    }
  }

  return { appName, title, url };
}

export default function App() {
  const { 
    status, 
    errorMessage, 
    userTranscript, 
    miraTranscript, 
    activeApp, 
    isMuted,
    isScreenSharing,
    isScreenSharingPaused,
    screenContext,
    clickCoordinates,
    setActiveApp, 
    setIsMuted,
    setScreenSharing,
    setScreenSharingPaused,
    setScreenContext,
    setClickCoordinates,
    resetAll,
    browserTabs,
    activeTabId,
    isMicDenied,
    setIsMicDenied,
    wakeWord,
    setUserTranscript,
    setMiraTranscript,
    pendingConfirmation,
    setPendingConfirmation,
    powerStatus,
    setPowerStatus,
    alarms,
    timers,
    reminders,
    updateTimer,
    toggleAlarm
  } = useMiraStore();

  const [activeAlert, setActiveAlert] = useState<{ id: string; type: "alarm" | "timer"; label: string } | null>(null);

  const [typedText, setTypedText] = useState("");
  const [showConsole, setShowConsole] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isOnboardingNeeded, setIsOnboardingNeeded] = useState<boolean | null>(null);

  // Screen Capture States & References (Continuous Background Sense)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [captureRate] = useState<number>(3); // 3 seconds continuous frame rate

  const stopScreenShare = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Track stop error:", e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScreenSharing(false);
    setScreenSharingPaused(false);
    setScreenContext(null);
  }, [setScreenSharing, setScreenSharingPaused, setScreenContext]);

  const startScreenShare = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Display capture API not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.warn("Background video play error:", e));
        };
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      setScreenSharing(true);
      setScreenSharingPaused(false);

      // Perform instantaneous initial context resolution and announce to AI over bridge
      setTimeout(() => {
        const label = videoTrack?.label || "";
        const details = parseScreenDetails(
          label,
          useMiraStore.getState().activeApp,
          useMiraStore.getState().browserTabs,
          useMiraStore.getState().activeTabId
        );
        setScreenContext(details);
        liveSessionInstance.sendScreenContext(details.appName, details.title, details.url);
      }, 500);

    } catch (err: any) {
      console.error("Screen Share initialization failed:", err);
      throw err;
    }
  }, [setScreenSharing, setScreenSharingPaused, setScreenContext, stopScreenShare]);

  const handleGlobalCapture = useCallback(() => {
    if (!videoRef.current || !streamRef.current || isScreenSharingPaused) return;
    const video = videoRef.current;
    if (video.readyState < 2) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const maxWidth = 1024;
    let width = video.videoWidth || 1280;
    let height = video.videoHeight || 720;

    if (width > maxWidth) {
      const scale = maxWidth / width;
      width = maxWidth;
      height = Math.round(height * scale);
    }

    canvas.width = width;
    canvas.height = height;

    try {
      ctx.drawImage(video, 0, 0, width, height);
      const base64 = canvas.toDataURL("image/jpeg", 0.6);
      liveSessionInstance.sendScreenFrame(base64);
    } catch (err) {
      console.warn("Global frame dispatch capture warning:", err);
    }
  }, [isScreenSharingPaused]);

  // Frame Capture scheduler loop (runs continuous sensing as long as screenshare is active)
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isScreenSharing && !isScreenSharingPaused) {
      handleGlobalCapture();

      intervalRef.current = setInterval(() => {
        handleGlobalCapture();
      }, captureRate * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isScreenSharing, isScreenSharingPaused, handleGlobalCapture, captureRate]);

  // Smart Follow Mode effect (automatically detects switching in-app browser tabs, active applications or widgets)
  useEffect(() => {
    if (isScreenSharing && !isScreenSharingPaused) {
      let label = "";
      if (streamRef.current) {
        const track = streamRef.current.getVideoTracks()[0];
        if (track) label = track.label || "";
      }
      const details = parseScreenDetails(
        label,
        activeApp,
        browserTabs,
        activeTabId
      );
      if (
        !screenContext ||
        screenContext.appName !== details.appName ||
        screenContext.title !== details.title ||
        screenContext.url !== details.url
      ) {
        setScreenContext(details);
        liveSessionInstance.sendScreenContext(details.appName, details.title, details.url);
      }
    }
  }, [activeApp, activeTabId, browserTabs, isScreenSharing, isScreenSharingPaused, screenContext, setScreenContext]);

  // Web Audio API Synthesizer Chime
  const playAlertChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const now = audioCtx.currentTime;
      
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
      
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(440.00, now); // A4
      osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
      
      gainNode.gain.setValueAtTime(0.25, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch (err) {
      console.warn("Could not play sound chime:", err);
    }
  }, []);

  // Alarm sound looping effect when alert is active
  useEffect(() => {
    if (!activeAlert) return;
    playAlertChime();
    const soundInterval = setInterval(() => {
      playAlertChime();
    }, 1500);
    return () => clearInterval(soundInterval);
  }, [activeAlert, playAlertChime]);

  // Global ticking interval for active Alarms and Timers
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, "0");
      const currentMinutes = String(now.getMinutes()).padStart(2, "0");
      const currentTimeString = `${currentHours}:${currentMinutes}`;
      const currentSeconds = now.getSeconds();

      const { timers: currentTimers, alarms: currentAlarms, updateTimer: updateTimerFn } = useMiraStore.getState();

      // 1. Tick down running timers
      currentTimers.forEach((timer) => {
        if (timer.status === "running") {
          if (timer.remaining > 1) {
            updateTimerFn(timer.id, { remaining: timer.remaining - 1 });
          } else {
            // Timer finished!
            updateTimerFn(timer.id, { remaining: 0, status: "completed" });
            setActiveAlert({ id: timer.id, type: "timer", label: timer.label || "Timer" });
          }
        }
      });

      // 2. Check active alarms (only check at 0 seconds of the minute to prevent duplicate alerts)
      if (currentSeconds === 0) {
        currentAlarms.forEach((alarm) => {
          if (alarm.enabled && alarm.time === currentTimeString) {
            setActiveAlert({ id: alarm.id, type: "alarm", label: alarm.label || "Alarm" });
          }
        });
      }
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // Initialize connection on mount, perform cleanup, and retrieve user profile
  useEffect(() => {
    async function initProfile() {
      const profile = await loadUserProfile();
      if (profile && profile.onboardingCompleted) {
        setUserProfile(profile);
        setIsOnboardingNeeded(false);
      } else {
        setIsOnboardingNeeded(true);
      }
    }
    initProfile();

    // Background power status telemetry polling
    const fetchPower = async () => {
      try {
        const res = await fetch("/api/system/power-status");
        if (res.ok) {
          const data = await res.json();
          useMiraStore.getState().setPowerStatus(data);
        }
      } catch (e) {
        // Silently ignore or fallback
      }
    };
    fetchPower();
    const powerPollInterval = setInterval(fetchPower, 8000);

    return () => {
      clearInterval(powerPollInterval);
      liveSessionInstance.disconnect();
      stopScreenShare();
    };
  }, [stopScreenShare]);

  const handleProfileUpdate = (updated: UserProfile) => {
    setUserProfile(updated);
    if (updated.wakeWord) {
      useMiraStore.getState().setWakeWord(updated.wakeWord);
      liveSessionInstance.updateVoiceParams({ wakeWord: updated.wakeWord });
    }
  };

  const handleSendTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedText.trim()) return;
    liveSessionInstance.sendTextMessage(typedText);
    setUserTranscript(typedText);
    setMiraTranscript("");
    setTypedText("");
  };

  const handleToggleConnect = () => {
    if (status === "disconnected" || status === "error") {
      liveSessionInstance.connect();
    } else {
      liveSessionInstance.disconnect();
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Helper to render state status messages politely
  const getStatusLabelText = () => {
    switch (status) {
      case "disconnected": return "Disconnected";
      case "connecting": return "Synthesizing Bridge...";
      case "listening": return "ARIA is listening...";
      case "thinking": return "ARIA is evaluating...";
      case "speaking": return "ARIA is speaking...";
      case "error": return "Core Offline";
      default: return "Offline";
    }
  };

  if (isOnboardingNeeded === null) {
    return (
      <div 
        className="min-h-screen text-zinc-100 flex flex-col items-center justify-center overflow-hidden font-sans relative"
        style={{ background: "radial-gradient(circle at 50% 50%, #1a103d 0%, #050508 100%)" }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-30" />
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-widest text-indigo-300 uppercase animate-pulse">Initializing neural link...</span>
        </div>
      </div>
    );
  }

  if (isOnboardingNeeded === true) {
    return (
      <Onboarding 
        onComplete={(profile) => {
          setUserProfile(profile);
          setIsOnboardingNeeded(false);
        }} 
      />
    );
  }

  return (
    <div 
      className="min-h-screen text-zinc-100 flex flex-col justify-between overflow-x-hidden p-4 md:p-6 select-none font-sans relative"
      style={{ background: "radial-gradient(circle at 50% 50%, #1a103d 0%, #050508 100%)" }}
    >
      <video ref={videoRef} id="global-screen-video" className="hidden" muted playsInline />

      {/* FLOATING SCREEN SHARING BAR */}
      <AnimatePresence>
        {isScreenSharing && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3.5 bg-[#0b0c15]/85 border border-white/10 backdrop-blur-xl px-4 py-2.5 rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.6)] text-white select-none whitespace-nowrap"
          >
            {/* Pulsing state indicator */}
            <div className="flex items-center gap-2 pr-3.5 border-r border-white/10">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isScreenSharingPaused ? "bg-amber-400" : "bg-emerald-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isScreenSharingPaused ? "bg-amber-400" : "bg-emerald-400"}`}></span>
              </span>
              <span className="text-[9px] font-mono font-bold tracking-widest uppercase">
                {isScreenSharingPaused ? "paused" : "sharing active"}
              </span>
            </div>

            {/* Application and Tab detected labels */}
            {screenContext && (
              <div className="flex items-center gap-2 max-w-[180px] md:max-w-[260px] truncate">
                <Monitor className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <div className="text-[11px] truncate font-sans text-zinc-300">
                  <span className="font-semibold text-zinc-100">{screenContext.appName}</span>
                  {screenContext.title && <span className="text-zinc-500 text-[10px] ml-1">({screenContext.title})</span>}
                </div>
              </div>
            )}

            {/* Quick Controllers */}
            <div className="flex items-center gap-1.5 pl-3.5 border-l border-white/10">
              {isScreenSharingPaused ? (
                <button
                  onClick={() => setScreenSharingPaused(false)}
                  className="px-2.5 py-1 rounded-full hover:bg-white/10 text-emerald-400 hover:text-white text-[10px] font-mono tracking-wider uppercase transition-all cursor-pointer"
                  title="Resume screen vision indexing"
                >
                  Resume
                </button>
              ) : (
                <button
                  onClick={() => setScreenSharingPaused(true)}
                  className="px-2.5 py-1 rounded-full hover:bg-white/10 text-amber-300 hover:text-white text-[10px] font-mono tracking-wider uppercase transition-all cursor-pointer"
                  title="Pause screen capture"
                >
                  Pause
                </button>
              )}

              <button
                onClick={startScreenShare}
                className="px-2.5 py-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all text-[10px] font-mono tracking-wider uppercase cursor-pointer"
                title="Change shared screen source"
              >
                Change
              </button>

              <button
                onClick={stopScreenShare}
                className="ml-1 px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition-all text-[10px] font-mono font-bold tracking-wider uppercase cursor-pointer shadow-lg shadow-rose-500/20"
                title="Disconnect screen sharing session"
              >
                ✕ Close Sharing
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Background cyber grid effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-30" />
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-fuchsia-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Decorative center frame from theme */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-[1000px] h-[calc(100%-4rem)] max-h-[720px] border-2 border-indigo-500/5 rounded-[40px] pointer-events-none hidden md:block z-0" />

      {/* HEADER SECTION */}
      <header className="flex items-center justify-between w-full max-w-6xl mx-auto z-10">
        <div className="flex items-center gap-3">
          <div className="bg-white/[0.03] border border-white/[0.05] p-2.5 rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                ARIA
              </h1>
              <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full uppercase">STABLE</span>
            </div>
            <p className="text-[10px] text-indigo-200/50 font-mono tracking-widest uppercase mt-0.5">voice.interactive_core</p>
          </div>
        </div>

        {/* State Tag Badge as custom tool-pill */}
        <div className="flex items-center gap-2.5">
          {/* Live Battery & Power Telemetry Pill */}
          <button
            id="header-power-telemetry-pill"
            onClick={() => setActiveApp(activeApp === "power" ? "none" : "power")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-medium backdrop-blur-xl transition-all cursor-pointer border ${
              activeApp === "power"
                ? "bg-indigo-500/25 border-indigo-500/50 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
            }`}
            title="Open Power & Battery Telemetry Hub"
          >
            {powerStatus?.isCharging ? (
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <Battery className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span>{powerStatus ? `${powerStatus.batteryPercent}%` : "100%"}</span>
            <span className="text-[10px] text-zinc-400 hidden sm:inline">{powerStatus?.powerMode || "Balanced"}</span>
          </button>

          {isScreenSharing && (
            <button
              onClick={() => setActiveApp("screen_share")}
              className={`flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 px-4 py-2 rounded-full text-xs text-emerald-300 font-mono font-semibold tracking-wider backdrop-blur-xl hover:bg-emerald-500/20 transition-all cursor-pointer ${isScreenSharingPaused ? "animate-pulse" : ""}`}
              title="Click to manage Screen Share"
            >
              <span className={`w-2 h-2 rounded-full bg-emerald-400 ${isScreenSharingPaused ? "" : "animate-ping"}`} />
              <span>SCREEN {isScreenSharingPaused ? "PAUSED" : "VISION LIVE"}</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-xs text-white/80 font-medium backdrop-blur-xl">
            <span className={`w-2 h-2 rounded-full ${
              status === "listening" 
                ? "bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" 
                : status === "thinking" 
                ? "bg-fuchsia-400 animate-pulse" 
                : status === "speaking" 
                ? "bg-rose-400 animate-pulse" 
                : status === "connecting"
                ? "bg-amber-400 animate-spin"
                : status === "error" 
                ? "bg-rose-500" 
                : "bg-zinc-500"
            }`} />
            <span className="font-mono tracking-wider text-[11px] uppercase">{getStatusLabelText()}</span>
          </div>

          <button 
            onClick={() => setActiveApp("profile_settings")}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer backdrop-blur-xl ${
              activeApp === "profile_settings" 
                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.2)]" 
                : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20"
            }`}
            title="Profile Settings"
            aria-label="Open profile settings panel"
          >
            <User className="w-4.5 h-4.5" />
          </button>

          <button 
            onClick={() => setShowConsole(!showConsole)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer backdrop-blur-xl ${
              showConsole 
                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.2)]" 
                : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20"
            }`}
            title="System Kernal Console"
            aria-label="Toggle system terminal panel"
          >
            <Terminal className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* CORE DISPLAY STAGE */}
      <main className="flex-1 max-w-6xl w-full mx-auto flex flex-col items-center justify-center min-h-[450px] relative z-10 py-6">
        
        {/* Floating instruction tips (Guides) */}
        <AnimatePresence>
          {showGuide && status === "disconnected" && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-2 md:top-6 md:right-0 bg-white/[0.03] border border-white/[0.05] backdrop-blur-2xl rounded-3xl p-5 max-w-sm md:max-w-[260px] text-center md:text-left shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col items-center md:items-start gap-2 z-20"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 font-mono uppercase tracking-wider">
                <Compass className="w-4 h-4" />
                aria.instructions
              </div>
              <p className="text-xs text-indigo-100/75 leading-relaxed font-sans px-1 md:px-0">
                Press the central orb or the bottom button to activate your voice session with ARIA. Ensure microphone access is granted.
              </p>
              <button 
                onClick={() => setShowGuide(false)}
                className="text-[10px] text-indigo-300 hover:text-indigo-100 font-mono tracking-wider uppercase mt-1 cursor-pointer hover:underline"
                aria-label="Dismiss Guide"
              >
                close_info
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Central visual core area */}
        <div className="flex flex-col items-center gap-6 py-2 relative">
          
          {/* Animated Mira Orb */}
          <MiraOrb onToggleConnect={handleToggleConnect} />

          {/* Sound reactive waveform */}
          <WaveformVisualizer />
        </div>

        {/* Dynamic Multi-Step Action Execution Plan Overlay */}
        <ActionPlanWidget />

        {/* Captions displays styled with exact glass attributes from design */}
        <div className="w-full max-w-xl flex flex-col gap-3.5 mt-auto bg-white/[0.03] border border-white/[0.05] backdrop-blur-[20px] rounded-3xl p-5 shadow-[0_10px_35px_rgba(0,0,0,0.3)] min-h-[110px] justify-center transition-all">
          {isMicDenied && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/10 bg-amber-950/20 text-amber-200 text-[10px] font-sans leading-relaxed mb-1.5 text-left">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block uppercase tracking-wider text-[9px] text-amber-400 mb-0.5">Microphone access blocked</span>
                To talk to ARIA, please click the site settings padlock next to the URL bar, allow <b>Microphone</b> permission, and reconnect.
                <span className="block mt-1 text-amber-300 font-mono">You can still chat with ARIA by typing below!</span>
              </div>
            </div>
          )}

          {errorMessage ? (
            <div className="text-center p-3 text-rose-300 text-xs font-mono lowercase border border-rose-500/10 rounded-xl bg-rose-950/20">
              <span className="font-bold flex items-center justify-center gap-1.5 mb-1.5 uppercase tracking-wider">
                <Cpu className="w-4 h-4 text-rose-400" /> system.fail_log
              </span>
              {errorMessage}
            </div>
          ) : !userTranscript && !miraTranscript ? (
            <div className="text-center text-indigo-200/40 text-xs py-4 font-mono tracking-wider lowercase">
              {status === "listening" 
                ? `listening... say "${wakeWord || "Hey ARIA"}" to speak` 
                : status === "speaking" 
                ? "speaking feed stream..."
                : status === "thinking"
                ? "evaluating vocal vectors..."
                : (
                  <div className="space-y-1">
                    <p className="text-zinc-200 text-sm font-sans not-italic">Welcome back, {userProfile?.name || "user"} 😊</p>
                    <p className="text-[10px] text-indigo-400 font-mono tracking-wide">standby. voice terminal offline</p>
                  </div>
                )}
            </div>
          ) : (
            <div className="space-y-3.5 text-xs text-left font-sans">
              {/* User transcript row */}
              {userTranscript && (
                <div className="flex items-start gap-3">
                  <div className="text-[10px] bg-indigo-500/10 text-indigo-300 font-mono font-bold px-2 py-0.5 rounded-md min-w-[50px] text-center lowercase border border-indigo-500/20">you:</div>
                  <div className="text-indigo-50 font-sans font-medium mt-0.5 leading-relaxed">{userTranscript}</div>
                </div>
              )}
              {/* ARIA transcript row */}
              {miraTranscript && (
                <div className="flex items-start gap-3 border-t border-white/5 pt-3.5">
                  <div className="text-[10px] bg-fuchsia-500/10 text-fuchsia-300 font-mono font-bold px-2 py-0.5 rounded-md min-w-[50px] text-center lowercase border border-fuchsia-500/20">aria:</div>
                  <div className="text-violet-100 font-sans font-medium mt-0.5 leading-relaxed">{miraTranscript}</div>
                </div>
              )}
            </div>
          )}

          {/* Typing input form when connected */}
          {userProfile?.enableTypingMode && (status === "listening" || status === "speaking" || status === "thinking") && (
            <form onSubmit={handleSendTyped} className="w-full mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
              <input 
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder="Type a message to ARIA..."
                className="flex-1 bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-indigo-500/30 rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-500 font-sans outline-none transition-all duration-200"
              />
              <button 
                type="submit"
                disabled={!typedText.trim()}
                className="bg-indigo-650 hover:bg-indigo-600 disabled:opacity-40 text-indigo-200 p-2 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center shrink-0 w-8 h-8"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </main>

      {/* FOOTER & OVERLAY TRAYS */}
      <footer className="w-full max-w-6xl mx-auto flex flex-col items-center gap-6 z-10 pt-4 border-t border-white/5">
        
        {/* Dynamic Widget Panels viewport drawer */}
        <AnimatePresence>
          {activeApp !== "none" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-40 p-4"
              onClick={() => setActiveApp("none")}
            >
              <div onClick={(e) => e.stopPropagation()}>
                {activeApp === "calculator" && <CalculatorWidget onClose={() => setActiveApp("none")} />}
                {activeApp === "notes" && <NotesWidget onClose={() => setActiveApp("none")} />}
                {activeApp === "clock" && <ClockWidget onClose={() => setActiveApp("none")} />}
                {activeApp === "weather" && <WeatherWidget onClose={() => setActiveApp("none")} />}
                {activeApp === "music" && <MusicWidget onClose={() => setActiveApp("none")} />}
                {activeApp === "memory" && <MemoryWidget onClose={() => setActiveApp("none")} />}
                {activeApp === "screen_share" && (
                  <ScreenShareWidget 
                    onClose={() => setActiveApp("none")} 
                    startScreenShare={startScreenShare}
                    stopScreenShare={stopScreenShare}
                    videoStream={streamRef.current}
                  />
                )}
                {activeApp === "browser" && <BrowserWidget onClose={() => setActiveApp("none")} />}
                {activeApp === "power" && <PowerWidget onClose={() => setActiveApp("none")} />}
                {activeApp === "profile_settings" && (
                  <ProfileSettings 
                    onClose={() => setActiveApp("none")} 
                    onUpdate={handleProfileUpdate} 
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Trace Terminal drawer */}
        <AnimatePresence>
          {showConsole && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 45 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-40 p-4"
              onClick={() => setShowConsole(false)}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <ToolCallsPanel />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controllers tray row */}
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-5">
          
          {/* Quick utility app icon drawer buttons */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-xl">
            <button
              onClick={() => setActiveApp("calculator")}
              className={`p-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-all cursor-pointer ${activeApp === "calculator" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/30" : "text-white/60"}`}
              title="Open Calculator"
              aria-label="Launch Calculator widget"
            >
              <Calculator className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveApp("notes")}
              className={`p-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-all cursor-pointer ${activeApp === "notes" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/30" : "text-white/60"}`}
              title="Open Notes"
              aria-label="Launch Notes directory widget"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveApp("clock")}
              className={`p-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-all cursor-pointer ${activeApp === "clock" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/30" : "text-white/60"}`}
              title="Open Timezone Clock"
              aria-label="Launch Clocks widget"
            >
              <ClockIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveApp("weather")}
              className={`p-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-all cursor-pointer ${activeApp === "weather" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/30" : "text-white/60"}`}
              title="Open Weather Display"
              aria-label="Launch Weather widget"
            >
              <CloudRain className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveApp("music")}
              className={`p-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-all cursor-pointer ${activeApp === "music" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/30" : "text-white/60"}`}
              title="Open Music Player"
              aria-label="Launch Music stream widget"
            >
              <Music className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveApp("memory")}
              className={`p-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-all cursor-pointer ${activeApp === "memory" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/30" : "text-white/60"}`}
              title="Open Memory Vault"
              aria-label="Launch Memory vault widget"
            >
              <Brain className="w-4 h-4" />
            </button>
             <button
              onClick={() => setActiveApp("screen_share")}
              className={`p-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-all cursor-pointer ${activeApp === "screen_share" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-505/30 border border-indigo-400/30" : "text-white/60"}`}
              title="Open Screen Vision"
              aria-label="Launch Screen sharing widget"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveApp("browser")}
              className={`p-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-all cursor-pointer ${activeApp === "browser" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/30" : "text-white/60"}`}
              title="Open Web Browser"
              aria-label="Launch Web Browser widget"
            >
              <Globe className="w-4 h-4" />
            </button>
            <button
              id="dock-power-status-btn"
              onClick={() => setActiveApp("power")}
              className={`p-2.5 rounded-xl hover:bg-white/10 hover:text-white transition-all cursor-pointer ${activeApp === "power" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/30" : "text-white/60"}`}
              title="Open Power & Battery Telemetry Hub"
              aria-label="Launch Power & Battery widget"
            >
              <Zap className="w-4 h-4" />
            </button>
          </div>

          {/* Main call action panel (Mute + Power Ring) */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleMute}
              disabled={status === "disconnected"}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                status === "disconnected" 
                  ? "bg-white/5 border-white/5 text-white/20 pointer-events-none" 
                  : isMuted 
                  ? "bg-rose-500/20 border-rose-500/30 text-rose-300"
                  : "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-indigo-400/30"
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              aria-label="Toggle mute"
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={handleToggleConnect}
              className={`px-5 py-3.5 rounded-2xl border font-mono text-xs tracking-wider font-semibold uppercase flex items-center gap-2 transition-all cursor-pointer ${
                status === "disconnected" 
                  ? "bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white border-indigo-400/30 shadow-[0_0_20px_rgba(99,102,241,0.3)]" 
                  : status === "connecting"
                  ? "bg-amber-500 border-amber-400 text-black pointer-events-none animate-pulse"
                  : "bg-white/5 border-white/10 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/20"
              }`}
              aria-label={status === "disconnected" ? "Activate session" : "Terminate session"}
            >
              {status === "connecting" ? (
                <RefreshCw className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <Power className="w-4.5 h-4.5" />
              )}
              <span>
                {status === "disconnected" ? "Connect" : status === "connecting" ? "Linking" : "Disconnect"}
              </span>
            </button>
          </div>

          {/* Telemetry metadata tags aligned meticulously with the design */}
          <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 text-[10px]">
            <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-white/60 font-mono tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
              24ms LATENCY
            </div>
          </div>
        </div>
      </footer>

      {/* Native Desktop Safety Confirmation Overlay */}
      <AnimatePresence>
        {pendingConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 font-sans"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-slate-900 border border-rose-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden"
            >
              {/* Alert Warning Glow Accent */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                    Security Confirmation
                  </h3>
                  <p className="text-[10px] text-rose-400 font-mono mt-0.5 tracking-widest uppercase">
                    Destructive Action Intercepted
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-white/80 text-sm leading-relaxed">
                  {pendingConfirmation.action === "shutdown_pc" && (
                    "ARIA has requested to shut down your PC. Are you sure you want to proceed?"
                  )}
                  {pendingConfirmation.action === "restart_pc" && (
                    "ARIA has requested to restart your PC. Are you sure you want to proceed?"
                  )}
                  {pendingConfirmation.action === "delete_file" && (
                    <span>
                      ARIA has requested to permanently delete a file: 
                      <code className="block mt-2 px-3 py-2 bg-black/40 border border-white/5 rounded text-xs font-mono text-rose-300 break-all select-all">
                        {pendingConfirmation.args?.targetPath || "Unknown file path"}
                      </code>
                      This action is completely irreversible. Are you sure?
                    </span>
                  )}
                  {pendingConfirmation.action === "empty_recycle_bin" && (
                    "ARIA has requested to empty your Recycle Bin. All deleted items will be lost forever. Are you sure?"
                  )}
                </p>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5">
                  <Cpu className="w-4.5 h-4.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300 leading-normal">
                    On a real PC, this will execute native powershell scripts. For safety, confirmation is strictly required.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    liveSessionInstance.sendActionConfirmation(pendingConfirmation.actionId, false);
                    setPendingConfirmation(null);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer text-center"
                >
                  CANCEL ACTION
                </button>
                <button
                  onClick={() => {
                    liveSessionInstance.sendActionConfirmation(pendingConfirmation.actionId, true);
                    setPendingConfirmation(null);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-mono text-xs font-semibold tracking-wider shadow-lg shadow-rose-950/40 border border-rose-400/30 transition-all cursor-pointer text-center"
                >
                  CONFIRM & RUN
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Alarm / Timer Trigger Alert Overlay */}
      <AnimatePresence>
        {activeAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 font-sans"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="bg-zinc-950 border border-indigo-500/30 rounded-3xl max-w-sm w-full p-8 shadow-[0_0_50px_rgba(99,102,241,0.25)] text-center relative overflow-hidden flex flex-col items-center"
            >
              {/* Pulsing ring glowing animation */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_65%)] pointer-events-none" />
              
              {/* Pulsing glowing visual orb */}
              <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping scale-110 opacity-75" />
                <div className="absolute inset-2 bg-indigo-500/30 rounded-full animate-pulse" />
                <div className="relative w-14 h-14 bg-gradient-to-tr from-indigo-500 to-fuchsia-600 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.6)] flex items-center justify-center text-white">
                  {activeAlert.type === "alarm" ? <AlarmClock className="w-7 h-7" /> : <Hourglass className="w-7 h-7" />}
                </div>
              </div>

              <h3 className="text-sm font-semibold uppercase tracking-widest text-indigo-400 font-mono mb-1">
                {activeAlert.type === "alarm" ? "alarm alert" : "timer completed"}
              </h3>
              
              <h2 className="text-xl font-bold text-white mb-2 font-sans tracking-tight">
                {activeAlert.label}
              </h2>

              <p className="text-xs text-zinc-400 font-mono mb-8">
                {activeAlert.type === "alarm" ? "Scheduled wake up call / event" : "Countdown duration elapsed"}
              </p>

              <div className="w-full flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    if (activeAlert.type === "alarm") {
                      // Disable the alarm once it fires
                      toggleAlarm(activeAlert.id);
                    }
                    setActiveAlert(null);
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-mono text-xs font-semibold tracking-wider shadow-lg shadow-indigo-950/50 border border-indigo-400/20 transition-all cursor-pointer text-center"
                >
                  DISMISS ALERT
                </button>
                {activeAlert.type === "alarm" && (
                  <button
                    onClick={() => {
                      // Snooze for 5 minutes: delete current, schedule new alarm for +5m
                      const now = new Date();
                      now.setMinutes(now.getMinutes() + 5);
                      const currentHours = String(now.getHours()).padStart(2, "0");
                      const currentMinutes = String(now.getMinutes()).padStart(2, "0");
                      const newTime = `${currentHours}:${currentMinutes}`;
                      
                      const store = useMiraStore.getState();
                      store.addAlarm(newTime, `${activeAlert.label} (Snoozed)`);
                      setActiveAlert(null);
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 font-mono text-xs font-semibold tracking-wider transition-all cursor-pointer text-center"
                  >
                    SNOOZE 5 MINUTES
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
