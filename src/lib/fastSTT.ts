/**
 * ARIA High-Speed Client-Side Speech Recognition & VAD System
 * 
 * Provides sub-second local Speech-To-Text transcription using browser Web Speech API
 * with fast silence detection (400ms VAD endpointing) to eliminate cloud buffer delays.
 */

import latencyProfiler from "./latencyProfiler";

export interface FastSTTCallbacks {
  onWakeWordDetected?: (wakeWord: string) => void;
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string, latencyMs: number) => void;
  onError?: (err: any) => void;
}

class FastSTTEngine {
  private recognition: any = null;
  private isListening: boolean = false;
  private callbacks: FastSTTCallbacks = {};
  private activeWakeWord: string = "Hey ARIA";
  private silenceTimer: any = null;
  private lastSpeechTime: number = 0;
  private speechStartTime: number = 0;
  private accumulatedInterim: string = "";
  private isSupported: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.isSupported = true;
        this.initRecognition(SpeechRecognition);
      } else {
        console.warn("[FastSTT] Web Speech API not supported in this browser environment; using server stream STT.");
      }
    }
  }

  private initRecognition(SpeechRecognitionClass: any) {
    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = "en-US"; // Also recognizes Hindi keywords in bilingual mode

      this.recognition.onstart = () => {
        console.log("[FastSTT] High-speed local STT engine listening");
      };

      this.recognition.onresult = (event: any) => {
        const now = performance.now();
        let interimStr = "";
        let finalStr = "";

        if (!this.speechStartTime) {
          this.speechStartTime = now;
          latencyProfiler.markRecordingStarted();
          latencyProfiler.markSTTStarted("browser_webspeech");
        }

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalStr += transcript;
          } else {
            interimStr += transcript;
          }
        }

        this.lastSpeechTime = now;
        const currentText = (finalStr || interimStr).trim();
        this.accumulatedInterim = currentText;

        if (currentText) {
          if (this.callbacks.onInterimTranscript) {
            this.callbacks.onInterimTranscript(currentText);
          }

          // Check wake word immediately
          const wakeWordRegex = new RegExp(`\\b(${this.activeWakeWord}|aria|mira|hey aria|hi aria|ok aria)\\b`, "i");
          if (wakeWordRegex.test(currentText)) {
            latencyProfiler.markWakeWordDetected(this.activeWakeWord);
            if (this.callbacks.onWakeWordDetected) {
              this.callbacks.onWakeWordDetected(this.activeWakeWord);
            }
          }

          // Fast VAD silence detector (450ms after user pauses speaking)
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
          }

          this.silenceTimer = setTimeout(() => {
            this.handleSpeechEndpoint(currentText);
          }, 450);
        }
      };

      this.recognition.onerror = (event: any) => {
        // Silently ignore "no-speech" or "aborted"
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.warn("[FastSTT] Recognition error:", event.error);
          if (this.callbacks.onError) {
            this.callbacks.onError(event.error);
          }
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // Restart immediately to keep continuous low-latency channel alive
          try {
            this.recognition.start();
          } catch (e) {
            // Ignore if already started
          }
        }
      };
    } catch (e) {
      console.warn("[FastSTT] Failed to initialize SpeechRecognition:", e);
      this.isSupported = false;
    }
  }

  private handleSpeechEndpoint(text: string) {
    if (!text || !text.trim()) return;

    const speechDuration = this.speechStartTime ? Math.round(performance.now() - this.speechStartTime) : 0;
    latencyProfiler.markUserFinishedSpeaking(speechDuration);
    latencyProfiler.markSTTCompleted(text, "browser_webspeech");

    if (this.callbacks.onFinalTranscript) {
      this.callbacks.onFinalTranscript(text.trim(), speechDuration);
    }

    // Reset speech turn
    this.speechStartTime = 0;
    this.accumulatedInterim = "";
  }

  /**
   * Start listening for voice commands
   */
  start(callbacks: FastSTTCallbacks, wakeWord: string = "Hey ARIA") {
    this.callbacks = callbacks;
    this.activeWakeWord = wakeWord;
    this.isListening = true;
    this.speechStartTime = 0;

    if (!this.isSupported || !this.recognition) return;

    try {
      this.recognition.start();
    } catch (e) {
      // Already running
    }
  }

  /**
   * Stop listening
   */
  stop() {
    this.isListening = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore
      }
    }
  }

  setWakeWord(wakeWord: string) {
    this.activeWakeWord = wakeWord;
  }

  getIsSupported(): boolean {
    return this.isSupported;
  }
}

export const fastSTT = new FastSTTEngine();
export default fastSTT;
