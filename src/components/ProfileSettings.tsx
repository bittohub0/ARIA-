import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { X, User, Award, Check, Sparkles, RefreshCw, MessageSquare, Mic, Radio, Volume2, MapPin, Navigation, ShieldCheck, LocateFixed } from "lucide-react";
import { saveUserProfile, loadUserProfile, UserProfile } from "../lib/profileService";
import { useMiraStore } from "../store/useMiraStore";

interface ProfileSettingsProps {
  onClose: () => void;
  onUpdate: (updatedProfile: UserProfile) => void;
}

const WAKE_WORD_PRESETS = [
  "Hey ARIA",
  "Hey Computer",
  "Hey Jarvis",
  "Hey Assistant"
];

export default function ProfileSettings({ onClose, onUpdate }: ProfileSettingsProps) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [enableTypingMode, setEnableTypingMode] = useState(false);
  const [wakeWord, setWakeWordInput] = useState("Hey ARIA");
  const [startOnBoot, setStartOnBoot] = useState(false);
  const [isDesktopApp, setIsDesktopApp] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { 
    userLocation, 
    geolocationPermission, 
    isLocating, 
    requestDeviceLocation, 
    setUserLocation 
  } = useMiraStore();
  const [geoCalibrating, setGeoCalibrating] = useState(false);

  // Load existing profile values and desktop settings
  useEffect(() => {
    async function load() {
      const profile = await loadUserProfile();
      if (profile) {
        setName(profile.name);
        setGender(profile.gender);
        setEnableTypingMode(!!profile.enableTypingMode);
        setWakeWordInput(profile.wakeWord || "Hey ARIA");
      }

      if (typeof window !== "undefined" && window.ariaDesktop) {
        setIsDesktopApp(true);
        try {
          const autoStart = await window.ariaDesktop.isStartupOnBootEnabled();
          setStartOnBoot(autoStart);
        } catch (e) {
          // ignore
        }
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Please enter your name.");
      return;
    }
    if (cleanName.length < 2) {
      setError("Name must contain at least 2 characters.");
      return;
    }
    if (!gender) {
      setError("Please select your gender.");
      return;
    }

    const cleanWakeWord = wakeWord.trim() || "Hey ARIA";
    if (cleanWakeWord.length < 2) {
      setError("Wake word must contain at least 2 characters.");
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile: UserProfile = {
        name: cleanName,
        gender: gender,
        onboardingCompleted: true,
        enableTypingMode: enableTypingMode,
        wakeWord: cleanWakeWord
      };

      await saveUserProfile(updatedProfile);
      useMiraStore.getState().setWakeWord(cleanWakeWord);

      if (typeof window !== "undefined" && window.ariaDesktop) {
        await window.ariaDesktop.setStartupOnBoot(startOnBoot);
      }
      
      setSuccess("Profile and preferences updated successfully ✨");
      onUpdate(updatedProfile);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError("Could not save profile updates. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      id="mira-profile-settings"
      className="bg-[#0b0c10]/95 border border-white/[0.08] backdrop-blur-[35px] rounded-[32px] w-[90vw] max-w-md shadow-[0_24px_60px_rgba(0,0,0,0.8)] text-white flex flex-col overflow-hidden relative"
    >
      {/* Decorative gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[50%] bg-fuchsia-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04] z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <Sparkles className="w-4.5 h-4.5 text-indigo-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wider font-mono text-indigo-300 uppercase leading-none">Profile Settings</h3>
            <span className="text-[9px] text-zinc-400 font-mono tracking-widest mt-0.5 block leading-none">aria.identity_config</span>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="text-zinc-400 hover:text-white transition-colors cursor-pointer bg-white/[0.03] p-1.5 rounded-xl hover:bg-white/[0.06]"
          aria-label="Close Settings"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Form container */}
      <form onSubmit={handleSave} className="p-6 md:p-8 space-y-5 z-10 overflow-y-auto max-h-[75vh]">
        
        {/* Name input */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-widest flex items-center gap-1.5 leading-none">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            Display Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder="What should I call you?"
            className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.06] border border-white/[0.08] focus:border-indigo-500/60 rounded-2xl px-4 py-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-0 transition-all font-medium font-sans"
          />
        </div>

        {/* Gender selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-widest flex items-center gap-1.5 leading-none">
            <Award className="w-3.5 h-3.5 text-indigo-400" />
            Select Gender
          </label>
          <div className="grid grid-cols-2 gap-3.5 pr-1">
            <button
              type="button"
              onClick={() => { setGender("male"); setError(null); }}
              className={`p-3.5 border rounded-xl flex items-center justify-center gap-2 transition-all outline-none cursor-pointer ${
                gender === "male"
                  ? "bg-indigo-600/20 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.2)] text-white"
                  : "bg-white/[0.01] border-white/[0.05] text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
              }`}
            >
              <span className="text-xs font-bold font-sans">Male</span>
              {gender === "male" && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => { setGender("female"); setError(null); }}
              className={`p-3.5 border rounded-xl flex items-center justify-center gap-2 transition-all outline-none cursor-pointer ${
                gender === "female"
                  ? "bg-fuchsia-600/20 border-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.2)] text-white"
                  : "bg-white/[0.01] border-white/[0.05] text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
              }`}
            >
              <span className="text-xs font-bold font-sans">Female</span>
              {gender === "female" && <Check className="w-3.5 h-3.5 text-fuchsia-400 flex-shrink-0" />}
            </button>
          </div>
        </div>

        {/* Custom Wake Word Settings */}
        <div className="space-y-3 border-t border-white/[0.04] pt-4.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-widest flex items-center gap-1.5 leading-none">
              <Mic className="w-3.5 h-3.5 text-indigo-400" />
              Voice Wake Word
            </label>
            <span className="text-[9px] text-indigo-400/80 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
              VOICE_TRIGGER
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed font-sans text-left">
            Define your custom voice activation trigger phrase (e.g., <span className="text-indigo-300 font-mono font-medium">"Hey Computer"</span>, <span className="text-indigo-300 font-mono font-medium">"Hey ARIA"</span>, or <span className="text-indigo-300 font-mono font-medium">"Hey Jarvis"</span>).
          </p>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {WAKE_WORD_PRESETS.map((preset) => {
              const isSelected = wakeWord.trim().toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setWakeWordInput(preset);
                    setError(null);
                  }}
                  className={`px-3 py-1.5 text-xs rounded-xl font-mono transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.25)] font-semibold"
                      : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>

          {/* Custom Wake Word Input */}
          <div className="relative">
            <input
              type="text"
              value={wakeWord}
              onChange={(e) => {
                setWakeWordInput(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Hey Computer"
              className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.06] border border-white/[0.08] focus:border-indigo-500/60 rounded-2xl px-4 py-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-0 transition-all font-mono"
            />
          </div>

          {/* Trigger Example Preview */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-950/20 border border-indigo-500/10 rounded-xl text-[11px] text-indigo-200/80">
            <Radio className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="font-mono text-left">
              Spoken trigger preview: <strong className="text-indigo-300">"{wakeWord.trim() || "Hey ARIA"}, open YouTube"</strong>
            </span>
          </div>
        </div>

        {/* Toggle chat option (Text Mode Preference) */}
        <div className="space-y-2 border-t border-white/[0.04] pt-4.5">
          <label className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-widest flex items-center justify-between leading-none mb-1">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              Enable Chat Typing
            </span>
            <span className="text-[9px] text-zinc-500 font-mono">TEXT_INPUT</span>
          </label>
          <div className="flex items-center justify-between bg-white/[0.015] border border-white/[0.04] rounded-2xl p-4">
            <div className="space-y-0.5 max-w-[75%] pr-2 text-left">
              <p className="text-xs font-semibold text-zinc-200">Show Typing Input Bar</p>
              <p className="text-[10px] text-zinc-500 leading-normal">Show text message field to type prompts to ARIA during active sessions.</p>
            </div>
            <button
              type="button"
              onClick={() => setEnableTypingMode(!enableTypingMode)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enableTypingMode ? "bg-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.4)]" : "bg-zinc-800"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  enableTypingMode ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Device Geolocation & Local Context Setting */}
        <div className="space-y-2 border-t border-white/[0.04] pt-4.5">
          <label className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-widest flex items-center justify-between leading-none mb-1">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Navigation className="w-3.5 h-3.5 text-cyan-400" />
              Device Geolocation & GPS
            </span>
            <span className="text-[9px] text-zinc-500 font-mono">LOCAL_CONTEXT</span>
          </label>
          <div className="bg-white/[0.015] border border-white/[0.04] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 text-left">
                <p className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span>GPS Status:</span>
                  {userLocation ? (
                    <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Active ({userLocation.city}, {userLocation.country})
                    </span>
                  ) : geolocationPermission === "denied" ? (
                    <span className="text-amber-400 font-mono text-[11px]">Permission Blocked</span>
                  ) : (
                    <span className="text-zinc-500 font-mono text-[11px]">Not Calibrated</span>
                  )}
                </p>
                <p className="text-[10px] text-zinc-500 leading-normal">
                  {userLocation 
                    ? `Coordinates: ${userLocation.latitude.toFixed(3)}°, ${userLocation.longitude.toFixed(3)}° (±${userLocation.accuracyMeters || 10}m accuracy)`
                    : "Used for hyper-local weather alerts, local time calculations, and voice context."}
                </p>
              </div>

              <button
                type="button"
                disabled={isLocating || geoCalibrating}
                onClick={async () => {
                  setGeoCalibrating(true);
                  try {
                    const loc = await requestDeviceLocation(true);
                    if (loc) {
                      setSuccess(`Device GPS updated: ${loc.city}, ${loc.country}`);
                    }
                  } finally {
                    setGeoCalibrating(false);
                  }
                }}
                className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <LocateFixed className={`w-3.5 h-3.5 ${isLocating || geoCalibrating ? "animate-spin" : ""}`} />
                <span>{userLocation ? "Re-calibrate" : "Calibrate GPS"}</span>
              </button>
            </div>

            {userLocation && (
              <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                <span>Last Synced: {new Date(userLocation.timestamp).toLocaleTimeString()}</span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("aria_user_geolocation");
                    setUserLocation(null);
                    setSuccess("Cleared cached GPS coordinates");
                  }}
                  className="text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Reset Location
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Start on Boot Desktop Setting (if in native Desktop or optional) */}
        {isDesktopApp && (
          <div className="space-y-2 border-t border-white/[0.04] pt-4.5">
            <label className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-widest flex items-center justify-between leading-none mb-1">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Launch at Startup
              </span>
              <span className="text-[9px] text-zinc-500 font-mono">AUTO_LAUNCH</span>
            </label>
            <div className="flex items-center justify-between bg-white/[0.015] border border-white/[0.04] rounded-2xl p-4">
              <div className="space-y-0.5 max-w-[75%] pr-2 text-left">
                <p className="text-xs font-semibold text-zinc-200">Start ARIA on Computer Boot</p>
                <p className="text-[10px] text-zinc-500 leading-normal">Automatically launch ARIA background assistant when your computer turns on.</p>
              </div>
              <button
                type="button"
                onClick={() => setStartOnBoot(!startOnBoot)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  startOnBoot ? "bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-zinc-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    startOnBoot ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Validation and notifications prompts */}
        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[11px] text-rose-400 font-mono bg-rose-950/20 border border-rose-500/10 p-2.5 rounded-xl text-center"
          >
            ⚠ {error}
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[11px] text-[#34d399] font-mono bg-[#064e3b]/20 border border-[#059669]/20 p-2.5 rounded-xl text-center"
          >
            {success}
          </motion.div>
        )}

        {/* Save button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-505 hover:to-indigo-600 text-white font-mono text-xs font-bold py-3.5 rounded-2xl shadow-[0_4px_15px_rgba(99,102,241,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-4"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Updating profile...</span>
            </>
          ) : (
            <span>Save Profile Changes</span>
          )}
        </button>

      </form>
    </div>
  );
}
