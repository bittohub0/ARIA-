import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useMiraStore } from "../store/useMiraStore";
import { Sparkles, Radio, Shield, Cpu, Activity } from "lucide-react";

interface MiraOrbProps {
  onToggleConnect: () => void;
}

export default function MiraOrb({ onToggleConnect }: MiraOrbProps) {
  const status = useMiraStore((state) => state.status);
  const inputVolume = useMiraStore((state) => state.inputVolume);
  const miraVolume = useMiraStore((state) => state.miraVolume);

  // Fallback state to handle CDN loading failures and recover instantly
  const [videoSrcs, setVideoSrcs] = useState({
    idle: "https://labs.google/fx/api/og-video/shared/5c789c63-90e1-4476-b638-5fd5bc426bba",
    thinking: "https://labs.google/fx/api/og-video/shared/8fe429bc-9500-4130-84ad-86c58ec675d9",
    talking: "https://labs.google/fx/api/og-video/shared/e9fff626-e3fd-4f19-8c35-9427d5a2595b"
  });

  const handleIdleError = () => {
    console.warn("CDN idle video failed to load, falling back to local files");
    setVideoSrcs(prev => ({ ...prev, idle: "/JUST WAITNG.mp4" }));
  };

  const handleThinkingError = () => {
    console.warn("CDN thinking video failed to load, falling back to local files");
    setVideoSrcs(prev => ({ ...prev, thinking: "/ANIMA GIRL THINKING.mp4" }));
  };

  const handleTalkingError = () => {
    console.warn("CDN talking video failed to load, falling back to local files");
    setVideoSrcs(prev => ({ ...prev, talking: "/ANIMA GIRL TAKING.mp4" }));
  };

  // Video references for background thread preloading and instant switching
  const idleVideoRef = useRef<HTMLVideoElement | null>(null);
  const thinkingVideoRef = useRef<HTMLVideoElement | null>(null);
  const talkingVideoRef = useRef<HTMLVideoElement | null>(null);

  // Determine active state cleanly
  const activeState: "IDLE" | "THINKING" | "TALKING" = 
    status === "speaking" 
      ? "TALKING" 
      : (status === "thinking" || status === "connecting" || (status === "listening" && inputVolume > 0.15))
      ? "THINKING" 
      : "IDLE";

  // Ensure background video elements start loop once without thrashing
  useEffect(() => {
    [idleVideoRef.current, thinkingVideoRef.current, talkingVideoRef.current].forEach(videoEl => {
      if (videoEl) {
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.loop = true;
        if (videoEl.paused) {
          videoEl.play().catch(() => {});
        }
      }
    });
  }, [videoSrcs]);

  // Sound reactive pulse factor
  const volumeScale = status === "speaking" ? miraVolume : inputVolume;
  const pulseFactor = 1 + volumeScale * 0.15;

  return (
    <div 
      className="relative flex flex-col items-center justify-center w-full max-w-2xl px-4"
      onClick={onToggleConnect}
    >
      {/* Outer ambient pulsing neon hologram halo */}
      <motion.div
        className="absolute rounded-full filter blur-[60px]"
        animate={{
          width: status === "speaking" ? ["50vh", "62vh", "50vh"] : ["40vh", "52vh", "40vh"],
          height: status === "speaking" ? ["50vh", "62vh", "50vh"] : ["40vh", "52vh", "40vh"],
          opacity: status === "disconnected" ? [0.15, 0.25, 0.15] : [0.55, 0.75, 0.55],
        }}
        transition={{
          duration: activeState === "THINKING" ? 1.5 : activeState === "TALKING" ? 1.0 : 3.0,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background: activeState === "TALKING" 
            ? "radial-gradient(circle, rgba(236,72,153,0.38) 0%, rgba(244,63,94,0.05) 70%)"
            : activeState === "THINKING"
            ? "radial-gradient(circle, rgba(168,85,247,0.38) 0%, rgba(99,102,241,0.05) 70%)"
            : "radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(79,70,229,0) 75%)",
          zIndex: 1,
        }}
      />

      {/* Subtle pulsing tech ring to signify active and ready status */}
      {status !== "disconnected" && (
        <motion.div
          className="absolute rounded-full border border-violet-500/25 pointer-events-none z-[1] w-[66vh] h-[66vh] md:w-[76vh] md:h-[76vh] max-w-[95vw] max-h-[95vw]"
          animate={{
            scale: [0.99, 1.04, 0.99],
            opacity: [0.4, 0.8, 0.4],
            boxShadow: [
              "0 0 15px rgba(139, 92, 246, 0.2), inset 0 0 10px rgba(139, 92, 246, 0.1)",
              "0 0 30px rgba(139, 92, 246, 0.5), inset 0 0 20px rgba(139, 92, 246, 0.25)",
              "0 0 15px rgba(139, 92, 246, 0.2), inset 0 0 10px rgba(139, 92, 246, 0.1)"
            ]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}

      {/* Futuristic Transparent Holographic Area (Box-less, Border-less, Frame-less projection) */}
      <motion.div
        id="mira-character-hologram-frame"
        className="relative w-[66vh] h-[66vh] md:w-[76vh] md:h-[76vh] max-w-[95vw] overflow-hidden flex items-center justify-center group active:scale-[0.98] transition-all duration-300 z-[2]"
        animate={{
          scale: pulseFactor,
        }}
        transition={{
          type: "spring",
          stiffness: 240,
          damping: 22
        }}
      >
        {/* CHARACTER DISPLAY VIDEO STATE MACHINE ENGINE (STACKED OPACITY-BASED CROSSFADE) */}
        {/* Rendered fully transparently over the website background to prevent any background box or noise */}
        <div className="relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden">
          
           {/* STATE 1: IDLE VIDEO STREAM */}
          <video
            ref={idleVideoRef}
            id="global-screen-video"
            src={videoSrcs.idle}
            onError={handleIdleError}
            className="absolute top-0 left-1/2 w-[138%] h-[138%] object-contain select-none pointer-events-none transition-all duration-700 ease-in-out bg-transparent"
            style={{ 
               opacity: activeState === "IDLE" ? 1 : 0, 
               transform: activeState === "IDLE" ? "translateX(-50%) scale(1.0)" : "translateX(-50%) scale(1.04)",
               transformOrigin: "top center",
               filter: `url(#remove-white-bg) brightness(${status === "disconnected" ? "0.6" : "1.2"}) contrast(1.15) saturate(1.22)`,
               mixBlendMode: "normal",
               backgroundColor: "transparent",
               background: "transparent"
            }}
            muted
            playsInline
            loop
            autoPlay
            preload="auto"
          >
            {/* Direct nested fallbacks if browser refuses standard attributes */}
            <source src={videoSrcs.idle} type="video/mp4" />
            <source src="/JUST WAITNG.mp4" type="video/mp4" />
            <source src="JUST WAITNG.mp4" type="video/mp4" />
            <source src="/assets/JUST WAITNG.mp4" type="video/mp4" />
          </video>
   
          {/* STATE 2: THINKING VIDEO STREAM */}
          <video
            ref={thinkingVideoRef}
            id="global-screen-video"
            src={videoSrcs.thinking}
            onError={handleThinkingError}
            className="absolute top-0 left-1/2 w-[138%] h-[138%] object-contain select-none pointer-events-none transition-all duration-700 ease-in-out bg-transparent"
            style={{ 
               opacity: activeState === "THINKING" ? 1 : 0, 
               transform: activeState === "THINKING" ? "translateX(-50%) scale(1.0)" : "translateX(-50%) scale(1.04)",
               transformOrigin: "top center",
               filter: "url(#remove-white-bg) brightness(1.2) contrast(1.15) saturate(1.22)",
               mixBlendMode: "normal",
               backgroundColor: "transparent",
               background: "transparent"
            }}
            muted
            playsInline
            loop
            autoPlay
            preload="auto"
          >
            <source src={videoSrcs.thinking} type="video/mp4" />
            <source src="/ANIMA GIRL THINKING.mp4" type="video/mp4" />
            <source src="ANIMA GIRL THINKING.mp4" type="video/mp4" />
            <source src="/assets/ANIMA GIRL THINKING.mp4" type="video/mp4" />
          </video>
   
          {/* STATE 3: TALKING VIDEO STREAM */}
          <video
            ref={talkingVideoRef}
            id="global-screen-video"
            src={videoSrcs.talking}
            onError={handleTalkingError}
            className="absolute top-0 left-1/2 w-[142%] h-[142%] object-contain select-none pointer-events-none transition-all duration-700 ease-in-out bg-transparent"
            style={{ 
               opacity: activeState === "TALKING" ? 1 : 0, 
               transform: activeState === "TALKING" ? "translateX(-50%) scale(1.02)" : "translateX(-50%) scale(1.0)",
               transformOrigin: "top center",
               filter: "url(#remove-white-bg) brightness(1.22) contrast(1.15) saturate(1.28)",
               mixBlendMode: "normal",
               backgroundColor: "transparent",
               background: "transparent"
            }}
            muted
            playsInline
            loop
            autoPlay
            preload="auto"
          >
            <source src={videoSrcs.talking} type="video/mp4" />
            <source src="/ANIMA GIRL TAKING.mp4" type="video/mp4" />
            <source src="ANIMA GIRL TAKING.mp4" type="video/mp4" />
            <source src="/assets/ANIMA GIRL TAKING.mp4" type="video/mp4" />
          </video>
          
        </div>
      </motion.div>

      {/* SVG Luma Key Filter to permanently key out and remove pure white or light grey backgrounds from videos */}
      <svg width="0" height="0" className="absolute pointer-events-none select-none" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <defs>
          <filter id="remove-white-bg" colorInterpolationFilters="sRGB">
            <feColorMatrix 
              type="matrix" 
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -1.8 -4.8 -4.8 11.4 -0.3" 
            />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0 0 0 0.1 0.3 0.6 0.9 1 1 1" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>
    </div>
  );
}
