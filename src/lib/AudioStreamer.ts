import { useMiraStore } from "../store/useMiraStore";

export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private onAudioChunkCallback: ((base64Data: string) => void) | null = null;

  constructor(onAudioChunk: (base64Data: string) => void) {
    this.onAudioChunkCallback = onAudioChunk;
  }

  /**
   * Starts capturing microphone audio at 16000Hz and converting to PCM 16-bit
   */
  async start() {
    try {
      // 1. Request microphone permissions
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 2. Initialize AudioContext at 16000Hz (downsampling requested natively)
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Creating ScriptProcessor with low latency 512 buffer length (~32ms chunks)
      this.processorNode = this.audioContext.createScriptProcessor(512, 1, 1);
      
      this.processorNode.onaudioprocess = (e) => {
        const isMuted = useMiraStore.getState().isMuted;
        if (isMuted) {
          useMiraStore.getState().setInputVolume(0);
          return;
        }

        const inputChannel = e.inputBuffer.getChannelData(0); // Float32Array of samples
        
        // Compute volume energy (RMS) for user mic wave animations
        let sum = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          sum += inputChannel[i] * inputChannel[i];
        }
        const rms = Math.sqrt(sum / inputChannel.length);
        
        // Expose to state, normalized for aesthetics (scale slightly)
        useMiraStore.getState().setInputVolume(Math.min(1, rms * 4));

        // Convert down-sampled Float32 to Int16 PCM
        const pcmBuffer = this.float32ToPCM16(inputChannel);
        const base64Audio = this.arrayBufferToBase64(pcmBuffer);

        if (this.onAudioChunkCallback) {
          this.onAudioChunkCallback(base64Audio);
        }
      };

      // Connect nodes
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      console.log("[AudioStreamer] Microphone streaming capture started at 16kHz");
    } catch (err) {
      console.error("[AudioStreamer] Failed to start microphone capture:", err);
      throw err;
    }
  }

  /**
   * Stop capturing audio
   */
  stop() {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
    useMiraStore.getState().setInputVolume(0);
    console.log("[AudioStreamer] Microphone streaming capture stopped");
  }

  /**
   * Helper: converts Float32 data in [-1.0, 1.0] to a newly allocated 16-bit PCM ArrayBuffer
   */
  private float32ToPCM16(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to range [-1.0, 1.0]
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      const val = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(i * 2, val, true); // true = little-endian binary
    }
    return buffer;
  }

  /**
   * Helper: converts ArrayBuffer to standard base64 string with high performance
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 1024;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, sub as unknown as number[]);
    }
    return btoa(binary);
  }
}
