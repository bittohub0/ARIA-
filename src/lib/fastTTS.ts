/**
 * ARIA High-Speed Client TTS Synthesizer
 * 
 * Provides instant (<50ms) spoken confirmations for simple actions and system feedback.
 * Operates in parallel with command execution without blocking UI or background audio.
 */

import latencyProfiler from "./latencyProfiler";

export interface FastTTSOptions {
  pitch?: number; // 0.5 to 2
  rate?: number;  // 0.5 to 2
  voiceName?: string;
  isHindi?: boolean;
}

class FastTTSEngine {
  private synth: SpeechSynthesis | null = null;
  private isAvailable: boolean = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private voicesLoaded: boolean = false;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
      this.isAvailable = true;
      this.initVoices();
    }
  }

  private initVoices() {
    if (!this.synth) return;

    const loadVoices = () => {
      const voices = this.synth?.getVoices() || [];
      if (voices.length > 0) {
        this.voicesLoaded = true;
        // Prefer natural female English or Hindi voices
        const preferred = voices.find(v => 
          (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Zira") || v.name.includes("Samantha") || v.name.includes("Female")) &&
          (v.lang.startsWith("en") || v.lang.startsWith("hi"))
        ) || voices[0];

        this.selectedVoice = preferred || null;
      }
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Speak confirmation text immediately
   */
  speak(text: string, options?: FastTTSOptions): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isAvailable || !this.synth || !text.trim()) {
        resolve();
        return;
      }

      latencyProfiler.markTTSStarted(text, "local_speech_synthesis");

      try {
        // Cancel any pending utterance to avoid queue lag
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Anime-heroine tuned pitch & delivery
        utterance.pitch = options?.pitch !== undefined ? options.pitch : 1.25;
        utterance.rate = options?.rate !== undefined ? options.rate : 1.1;

        if (options?.isHindi) {
          utterance.lang = "hi-IN";
          const hindiVoice = this.synth.getVoices().find(v => v.lang.startsWith("hi"));
          if (hindiVoice) utterance.voice = hindiVoice;
        } else if (this.selectedVoice) {
          utterance.voice = this.selectedVoice;
        }

        let firstAudioFired = false;

        utterance.onstart = () => {
          if (!firstAudioFired) {
            firstAudioFired = true;
            latencyProfiler.markTTSFirstAudioReceived("local_speech_synthesis");
            latencyProfiler.markTTSPlaybackStarted();
          }
        };

        utterance.onend = () => {
          resolve();
        };

        utterance.onerror = (err) => {
          console.warn("[FastTTS] Utterance error:", err);
          resolve();
        };

        this.synth.speak(utterance);
      } catch (e) {
        console.warn("[FastTTS] Speak exception:", e);
        resolve();
      }
    });
  }

  /**
   * Stop any current speech
   */
  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const fastTTS = new FastTTSEngine();
export default fastTTS;
