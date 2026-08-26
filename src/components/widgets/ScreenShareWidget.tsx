import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Monitor, 
  Pause, 
  Play, 
  Square, 
  Eye, 
  EyeOff, 
  Sparkles, 
  RefreshCw, 
  AlertCircle,
  Activity
} from "lucide-react";
import { useMiraStore } from "../../store/useMiraStore";
import { liveSessionInstance } from "../../lib/LiveSession";

interface ScreenShareWidgetProps {
  onClose: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  videoStream: MediaStream | null;
}

export default function ScreenShareWidget({ 
  onClose, 
  startScreenShare, 
  stopScreenShare, 
  videoStream 
}: ScreenShareWidgetProps) {
  const { 
    isScreenSharing, 
    isScreenSharingPaused, 
    setScreenSharingPaused,
    screenContext
  } = useMiraStore();

  const [errorText, setErrorText] = useState<string | null>(null);
  const [successPing, setSuccessPing] = useState<boolean>(false);
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync streams with the visual preview element
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.warn("Widget video play error:", e));
      };
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoStream]);

  // Launch screen media share prompt
  const handleStartSharing = async () => {
    setErrorText(null);
    try {
      await startScreenShare();
      setSuccessPing(true);
      setTimeout(() => setSuccessPing(false), 1200);
    } catch (err: any) {
      setErrorText(err.message || "Failed to start sharing capture.");
    }
  };

  // Click on the active video container triggers focus-based analysis coordinate ripples
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isScreenSharing || isScreenSharingPaused) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    
    // Dispatch instant websocket coordinates notice to Gemini!
    liveSessionInstance.sendScreenClick(x, y);

    // Show visual indicator targets
    setClickCoords({ x, y });
    setTimeout(() => {
      setClickCoords(null);
    }, 2800);
  };

  return (
    <div id="mira-screen-widget" className="bg-[#0c0d16]/90 border border-white/10 backdrop-blur-[30px] rounded-3xl p-5 w-84 shadow-2xl relative text-white">
      {/* Target identifier */}
      <button 
        onClick={onClose} 
        className="absolute top-3.5 right-3.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        aria-label="Close Screen Sharing panel"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="mb-4 pr-6">
        <h3 className="text-sm font-semibold tracking-wide text-indigo-300 font-mono lowercase">aria.screen_vision</h3>
        <p className="text-xs text-indigo-200/50 mt-0.5">real-time screen analytics via gemini vision</p>
      </div>

      {errorText && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl flex items-start gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorText}</span>
        </div>
      )}

      {/* Interactive frame viewer stage */}
      <div 
        onClick={handlePreviewClick}
        className={`relative aspect-video w-full rounded-2xl bg-black/60 border border-white/5 overflow-hidden flex flex-col items-center justify-center mb-4 shadow-inner group ${isScreenSharing && !isScreenSharingPaused ? "cursor-crosshair" : "cursor-default"}`}
      >
        <video 
          ref={videoRef} 
          muted 
          playsInline 
          className={`w-full h-full object-cover transition-opacity duration-300 ${isScreenSharing && !isScreenSharingPaused ? "opacity-100" : "opacity-30"}`} 
        />

        {!isScreenSharing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <div className="p-3 rounded-full bg-white/5 border border-white/10 mb-2">
              <Monitor className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-xs font-semibold text-zinc-300">Screen Share Stopped</p>
            <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px]">Allow access to capture your display or tab for real-time analysis.</p>
          </div>
        )}

        {isScreenSharing && isScreenSharingPaused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="p-2.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 mb-1.5 animate-pulse">
              <Pause className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-amber-200">Transmission Paused</p>
          </div>
        )}

        {/* Live Visual capture ping indicator */}
        {isScreenSharing && !isScreenSharingPaused && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 backdrop-blur-md">
            <Activity className={`w-3.5 h-3.5 ${successPing ? "animate-ping" : ""}`} />
            <span className="text-[9px] font-mono tracking-widest font-bold">INTERACTIVE LIVE</span>
          </div>
        )}

        {/* Dynamic target coords indicator ripple (FOCUS-BASED) */}
        {clickCoords && (
          <div 
            className="absolute rounded-full border-2 border-indigo-400 bg-indigo-500/20 animate-ping shadow-[0_0_15px_rgba(129,140,248,0.8)] pointer-events-none"
            style={{ 
              width: "36px", 
              height: "36px", 
              left: `calc(${clickCoords.x}% - 18px)`, 
              top: `calc(${clickCoords.y}% - 18px)` 
            }}
          />
        )}
        {clickCoords && (
          <div 
            className="absolute rounded-full bg-indigo-400 border border-white pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.7)]"
            style={{ 
              width: "8px", 
              height: "8px", 
              left: `calc(${clickCoords.x}% - 4px)`, 
              top: `calc(${clickCoords.y}% - 4px)` 
            }}
          />
        )}
      </div>

      {/* Screen Sharing controls */}
      <div className="space-y-4">
        {/* Core Buttons Layout */}
        <div className="flex gap-2.5">
          {!isScreenSharing ? (
            <button
              onClick={handleStartSharing}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 border border-indigo-400/30 transition-all cursor-pointer"
            >
              <Monitor className="w-4 h-4" />
              <span>Share Screen</span>
            </button>
          ) : (
            <>
              {isScreenSharingPaused ? (
                <button
                  onClick={() => setScreenSharingPaused(false)}
                  className="flex-1 py-2.5 px-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-1.5 border border-white/10 transition-all cursor-pointer"
                  title="Resume frame streaming context"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={() => setScreenSharingPaused(true)}
                  className="flex-1 py-1 px-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-1.5 border border-white/10 transition-all cursor-pointer"
                  title="Pause screen capture"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={stopScreenShare}
                className="py-2.5 px-4 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Stop screen sharing stream entirely"
              >
                <Square className="w-3.5 h-3.5 fill-rose-300/10" />
                <span>Stop</span>
              </button>
            </>
          )}
        </div>

        {/* Display detected active App window */}
        {isScreenSharing && screenContext && (
          <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl space-y-1">
            <span className="text-[10px] text-indigo-300 font-mono tracking-wider block uppercase">Detected Screen Context</span>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <div className="text-xs truncate text-zinc-200">
                <span className="font-semibold text-zinc-100">{screenContext.appName}</span>
                {screenContext.title && <span className="text-zinc-400 text-[11px] ml-1">({screenContext.title})</span>}
              </div>
            </div>
            {screenContext.url && (
              <span className="text-[10px] font-mono text-zinc-500 truncate block pl-3.5">{screenContext.url}</span>
            )}
            <p className="text-[9px] text-zinc-500 leading-normal mt-1.5">
              Click anywhere on the preview above to send target focus clicks to ARIA!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
