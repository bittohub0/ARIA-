import { motion } from "motion/react";
import { useMiraStore } from "../store/useMiraStore";

export default function WaveformVisualizer() {
  const status = useMiraStore((state) => state.status);
  const inputVolume = useMiraStore((state) => state.inputVolume);
  const miraVolume = useMiraStore((state) => state.miraVolume);

  if (status === "disconnected") {
    return (
      <div className="flex items-center justify-center gap-1 h-12 w-48 opacity-40">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="w-1 h-3 bg-zinc-600 rounded-full" />
        ))}
      </div>
    );
  }

  // Determine active volume
  const activeVolume = status === "speaking" ? miraVolume : inputVolume;
  const isSpeaking = status === "speaking";
  const isListening = status === "listening";

  // Create an array of bar indices to model a full waveform
  const bars = [...Array(16)];

  return (
    <div className="flex items-center justify-center gap-2 h-16 w-64 bg-white/5 backdrop-blur-xl rounded-full px-6 py-3 border border-white/5 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
      {bars.map((_, i) => {
        // Distribute height factors so it tapers at the edges (like a classic wave envelope)
        const edgeFactor = Math.sin((i / (bars.length - 1)) * Math.PI);
        const minHeight = 4;
        const maxHeight = 34;
        
        // Compute dynamic height based on volume
        const scaleVal = activeVolume * 1.5;
        const dynamicHeight = minHeight + (maxHeight - minHeight) * scaleVal * edgeFactor;

        // Custom style gradient based on state
        const backgroundStyle = isSpeaking
          ? "linear-gradient(to top, #ec4899, #f43f5e)"
          : isListening
          ? "linear-gradient(to top, #0d9488, #2dd4bf)"
          : "linear-gradient(to top, #6366f1, #c084fc)";
        
        return (
          <motion.div
            key={i}
            className="w-1.5 rounded-[2px] transition-all duration-300 opacity-90 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
            style={{
              background: backgroundStyle
            }}
            animate={{
              height: status === "thinking" 
                ? [6, 18, 6] 
                : Math.max(minHeight, Math.min(maxHeight, dynamicHeight))
            }}
            transition={{
              repeat: Infinity,
              duration: status === "thinking" ? 0.6 : 0.1,
              delay: i * 0.03,
              ease: "easeInOut"
            }}
          />
        );
      })}
    </div>
  );
}
