import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, User, Check, Award, ArrowRight } from "lucide-react";
import { saveUserProfile, UserProfile } from "../lib/profileService";

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trim and check validations
  const handleNextStep = async () => {
    setError(null);

    if (step === 1) {
      const cleanName = name.trim();
      if (!cleanName) {
        setError("Please enter your name.");
        return;
      }
      if (cleanName.length < 2) {
        setError("Name must contain at least 2 characters.");
        return;
      }
      if (cleanName.length > 50) {
        setError("Name must be less than 50 characters.");
        return;
      }
      setStep(2);
    } 
    
    else if (step === 2) {
      if (!gender) {
        setError("Please select your gender.");
        return;
      }
      
      // Complete setup and save data
      setIsSubmitting(true);
      try {
        const finalProfile: UserProfile = {
          name: name.trim(),
          gender: gender,
          onboardingCompleted: true,
          wakeWord: "Hey ARIA"
        };
        await saveUserProfile(finalProfile);
        setStep(3);
      } catch (err) {
        console.error("Error saving profile:", err);
        setError("Could not save setup profile. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleStartTalking = () => {
    onComplete({
      name: name.trim(),
      gender: gender as "male" | "female",
      onboardingCompleted: true,
      wakeWord: "Hey ARIA"
    });
  };

  const getPercentage = () => {
    if (step === 1) return "50%";
    return "100%";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto select-none font-sans"
         style={{ background: "radial-gradient(circle at 50% 50%, #150d30 0%, #030307 100%)" }}>
      
      {/* Dynamic Ambient Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-purple-500/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[40%] bg-fuchsia-500/15 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#0c0a18]/90 border border-white/[0.08] rounded-[32px] overflow-hidden backdrop-blur-3xl shadow-[0_24px_64px_rgba(0,0,0,0.8),0_0_40px_rgba(139,92,246,0.1)] relative"
      >
        
        {/* Step Progress bars (not visible on completion slide Step 3) */}
        {step <= 2 && (
          <div className="p-6 pb-2">
            <div className="flex items-center justify-between text-[11px] font-mono tracking-widest text-[#a78bfa] uppercase mb-2.5">
              <span>Step {step} of 2</span>
              <span className="font-bold">{getPercentage()}</span>
            </div>
            
            {/* Smooth glowing progress track */}
            <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden relative border border-white/[0.02]">
              <motion.div 
                className="h-full bg-gradient-to-r from-violet-500 to-[#d946ef] rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                initial={{ width: "50%" }}
                animate={{ width: getPercentage() }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        {/* Animated Slide view transitions */}
        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="inline-flex p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl mb-2 text-purple-400">
                    <User className="w-6 h-6 animate-pulse" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
                    Welcome to ARIA AI Assistant 👋
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans max-w-xs mx-auto leading-relaxed">
                    What should I call you?
                  </p>
                </div>

                <div className="space-y-2.5 relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleNextStep(); }}
                    placeholder="Enter your name"
                    autoFocus
                    className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.06] border border-white/[0.08] focus:border-purple-500/60 rounded-2xl px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-0 transition-all font-medium text-center shadow-inner"
                  />
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-400 font-mono text-center"
                  >
                    ⚠ {error}
                  </motion.div>
                )}

                <button
                  onClick={handleNextStep}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold text-xs md:text-sm py-3.5 rounded-2xl shadow-[0_4px_24px_rgba(139,92,246,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01]"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="inline-flex p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl mb-2 text-purple-400">
                    <Award className="w-6 h-6 animate-bounce" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
                    Select your gender
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans max-w-xs mx-auto leading-relaxed">
                    Choose one option below to setup.
                  </p>
                </div>

                {/* SELECTABLE CARDS */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => { setGender("male"); if (error) setError(null); }}
                    className={`relative p-5 border rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all outline-none cursor-pointer ${
                      gender === "male"
                        ? "bg-violet-600/20 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.25)] text-white"
                        : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-[11px] font-bold ${gender === "male" ? "border-violet-400 text-violet-300" : "border-zinc-600 text-zinc-500"}`}>
                      {gender === "male" ? <Check className="w-3.5 h-3.5" /> : "♂"}
                    </div>
                    <span className="text-sm font-bold tracking-wide">Male</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setGender("female"); if (error) setError(null); }}
                    className={`relative p-5 border rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all outline-none cursor-pointer ${
                      gender === "female"
                        ? "bg-fuchsia-600/20 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.25)] text-white"
                        : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-[11px] font-bold ${gender === "female" ? "border-fuchsia-400 text-fuchsia-300" : "border-zinc-600 text-zinc-500"}`}>
                      {gender === "female" ? <Check className="w-3.5 h-3.5" /> : "♀"}
                    </div>
                    <span className="text-sm font-bold tracking-wide">Female</span>
                  </button>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-400 font-mono text-center"
                  >
                    ⚠ {error}
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setError(null); setStep(1); }}
                    className="w-1/3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-zinc-300 font-semibold text-xs md:text-sm py-3.5 rounded-2xl transition-all cursor-pointer"
                    disabled={isSubmitting}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold text-xs md:text-sm py-3.5 rounded-2xl shadow-[0_4px_24px_rgba(139,92,246,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01]"
                  >
                    <span>{isSubmitting ? "Finalizing Setup..." : "Finish Setup"}</span>
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", damping: 12 }}
                className="text-center space-y-6"
              >
                <div className="space-y-3">
                  <div className="inline-flex p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 animate-pulse">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white bg-gradient-to-r from-violet-200 via-fuchsia-200 to-white bg-clip-text text-transparent">
                    You're all set ✨
                  </h2>
                  <p className="text-sm text-zinc-300 font-sans leading-relaxed">
                    Welcome to ARIA AI, <span className="text-[#a78bfa] font-bold">{name}</span>
                  </p>
                  <p className="text-xs text-zinc-500 font-sans leading-relaxed max-w-xs mx-auto">
                    Your profile has been saved securely to cloud Firestore, local browser memory, and synced synchronously with ARIA's neural core.
                  </p>
                </div>

                <button
                  onClick={handleStartTalking}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-900 font-extrabold text-sm py-4 rounded-2xl shadow-[0_4px_24px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                >
                  <span>Start Talking</span>
                  <ArrowRight className="w-4 h-4 text-slate-900 stroke-[3]" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </motion.div>
    </div>
  );
}
