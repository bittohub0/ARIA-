import { useMiraStore } from "../store/useMiraStore";

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private analyserNode: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private statusResetTimeout: any = null;

  constructor() {
    // Lazy initialized on active interaction to respect browser auto-play policies
  }

  /**
   * Initialize Web Audio nodes
   */
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000, // Gemini voice output model plays back at 24kHz
      });
      
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.connect(this.audioContext.destination);
      
      this.startAnalyserAnimation();
      console.log("[AudioPlayer] Intialized Web Audio context and speaker nodes at 24kHz");
    }
  }

  /**
   * Decode base64 PCM 16-bit to Float32 sample buffer for AudioBuffer playback
   */
  private base64ToAudioBuffer(base64: string): AudioBuffer {
    const raw = atob(base64);
    const numSamples = raw.length / 2;
    const float32 = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const byte1 = raw.charCodeAt(i * 2);
      const byte2 = raw.charCodeAt(i * 2 + 1);
      let val = byte1 | (byte2 << 8);
      if (val & 0x8000) val |= ~0xffff; // sign extension for 16-bit little-endian PCM
      float32[i] = val / 32768.0; // Normalize Int16 to [-1.0, 1.0]
    }

    const ctx = this.audioContext!;
    const audioBuffer = ctx.createBuffer(1, numSamples, 24000);
    audioBuffer.getChannelData(0).set(float32);
    return audioBuffer;
  }

  /**
   * Queue an audio chunk for gapless playback scheduling
   */
  playChunk(base64: string) {
    const tStart = performance.now();
    this.init();
    
    // Clear any pending transition back to listening
    if (this.statusResetTimeout) {
      clearTimeout(this.statusResetTimeout);
      this.statusResetTimeout = null;
    }

    const ctx = this.audioContext!;
    if (ctx.state === "suspended") {
      ctx.resume().catch((e) => console.log("Failed to resume audio playback context:", e));
    }
    
    const buffer = this.base64ToAudioBuffer(base64);
    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.connect(this.analyserNode!);
    
    const now = ctx.currentTime;
    
    // Gapless scheduling strategy:
    // If no active audio is currently playing, start immediately with 5ms micro cushion
    if (this.activeSources.length === 0 || this.nextStartTime < now) {
      this.nextStartTime = now + 0.005;
    }
    
    sourceNode.start(this.nextStartTime);
    this.activeSources.push(sourceNode);
    
    // Advance next playback slot by exact duration of this newly scheduled buffer
    this.nextStartTime += buffer.duration;
    
    if (useMiraStore.getState().status !== "speaking") {
      useMiraStore.getState().setStatus("speaking");
      console.log(`[Latency Metric] Audio playback started in ${(performance.now() - tStart).toFixed(1)}ms`);
    }

    sourceNode.onended = () => {
      // Remove this finished source
      this.activeSources = this.activeSources.filter((s) => s !== sourceNode);
      if (this.activeSources.length === 0) {
        useMiraStore.getState().setMiraVolume(0);
        
        // Fast transition back to listening (80ms)
        if (this.statusResetTimeout) {
          clearTimeout(this.statusResetTimeout);
        }
        this.statusResetTimeout = setTimeout(() => {
          const currentStatus = useMiraStore.getState().status;
          if (currentStatus === "speaking") {
            useMiraStore.getState().setStatus("listening");
          }
        }, 80);
      }
    };
  }

  /**
   * Interrupt playback instantly by stopping all active buffer nodes and resetting timeline
   */
  interrupt() {
    console.log("[AudioPlayer] Interrupting audio streams immediately");
    if (this.statusResetTimeout) {
      clearTimeout(this.statusResetTimeout);
      this.statusResetTimeout = null;
    }
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (err) {
        // Ignore errors from already stopped nodes
      }
    });
    this.activeSources = [];
    this.nextStartTime = 0;
    useMiraStore.getState().setMiraVolume(0);
    
    const currentStatus = useMiraStore.getState().status;
    if (currentStatus === "speaking") {
      useMiraStore.getState().setStatus("listening");
    }
  }

  /**
   * Continuously analyze speaker waveform amplitude for dynamic interface visualizer
   */
  private startAnalyserAnimation() {
    const update = () => {
      if (this.analyserNode && this.activeSources.length > 0) {
        const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.getByteTimeDomainData(dataArray);
        
        let maxVal = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = Math.abs(dataArray[i] - 128); // centered around silent value 128
          if (val > maxVal) {
            maxVal = val;
          }
        }
        
        const normalized = Math.min(1, maxVal / 128.0) * 1.5; // Scale slightly for aesthetic sensitivity
        useMiraStore.getState().setMiraVolume(normalized);
      } else {
        useMiraStore.getState().setMiraVolume(0);
      }
      this.animationFrameId = requestAnimationFrame(update);
    };
    
    update();
  }

  /**
   * Shutdown AudioPlayer resources
   */
  cleanup() {
    this.interrupt();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
