/**
 * ARIA Precision Latency Profiler & Benchmark Engine
 * 
 * Accurately measures duration between all pipeline stages:
 * - Wake word detected
 * - Recording started
 * - User finished speaking
 * - STT started / completed
 * - Intent detection started / detected
 * - Action started / completed
 * - TTS started / first audio received / playback started
 */

export interface LatencyStage {
  name: string;
  timestamp: number;
  deltaMs: number;
  metadata?: any;
}

export interface LatencyReport {
  id: string;
  command: string;
  startTime: number;
  endTime: number;
  totalDurationMs: number;
  stages: LatencyStage[];
  breakdown: {
    sttDurationMs: number;
    intentDurationMs: number;
    actionDurationMs: number;
    ttsDurationMs: number;
    audioPipelineMs: number;
  };
  isFastRouted: boolean;
  intent?: string;
  action?: string;
}

class LatencyProfiler {
  private currentSessionId: string | null = null;
  private currentCommand: string = "";
  private sessionStartTime: number = 0;
  private lastStageTime: number = 0;
  private stages: LatencyStage[] = [];
  private reportHistory: LatencyReport[] = [];
  private stageTimestamps: Record<string, number> = {};
  private isFastRouted: boolean = false;
  private intentName?: string;
  private actionName?: string;

  /**
   * Start a new command profiling session
   */
  startSession(command: string = ""): string {
    const now = performance.now();
    this.currentSessionId = Math.random().toString(36).substring(7);
    this.currentCommand = command;
    this.sessionStartTime = now;
    this.lastStageTime = now;
    this.stages = [];
    this.stageTimestamps = {};
    this.isFastRouted = false;
    this.intentName = undefined;
    this.actionName = undefined;

    return this.currentSessionId;
  }

  /**
   * Record a stage in the pipeline
   */
  markStage(stageName: string, metadata?: any): number {
    const now = performance.now();
    if (!this.sessionStartTime) {
      this.startSession();
    }

    const delta = Math.round(now - this.lastStageTime);
    const elapsedTotal = Math.round(now - this.sessionStartTime);
    this.lastStageTime = now;
    this.stageTimestamps[stageName] = now;

    this.stages.push({
      name: stageName,
      timestamp: now,
      deltaMs: delta,
      metadata
    });

    const metaStr = metadata ? ` | ${JSON.stringify(metadata)}` : "";
    console.log(`[ARIA LATENCY] ${stageName} (+${delta}ms | total: ${elapsedTotal}ms)${metaStr}`);

    return delta;
  }

  /**
   * Mark wake word detected
   */
  markWakeWordDetected(wakeWord: string = "Hey ARIA") {
    this.markStage("Wake word detected", { wakeWord });
  }

  /**
   * Mark recording started
   */
  markRecordingStarted() {
    this.markStage("Recording started");
  }

  /**
   * Mark user finished speaking (VAD silence threshold reached)
   */
  markUserFinishedSpeaking(speechDurationMs?: number) {
    this.markStage("User finished speaking", { speechDurationMs });
  }

  /**
   * Mark STT started
   */
  markSTTStarted(engine: "browser_webspeech" | "gemini_live" | "server_whisper" | "text_input" = "browser_webspeech") {
    this.markStage("STT started", { engine });
  }

  /**
   * Mark STT completed
   */
  markSTTCompleted(transcript: string, engine: string = "browser_webspeech") {
    this.currentCommand = transcript;
    const sttStart = this.stageTimestamps["STT started"] || this.sessionStartTime;
    const duration = Math.round(performance.now() - sttStart);
    this.markStage("STT completed", { transcript, durationMs: duration, engine });
  }

  /**
   * Mark intent detection started
   */
  markIntentDetectionStarted() {
    this.markStage("Intent detection started");
  }

  /**
   * Mark intent detected
   */
  markIntentDetected(intent: string, isFastRoute: boolean = true, details?: any) {
    this.isFastRouted = isFastRoute;
    this.intentName = intent;
    const intentStart = this.stageTimestamps["Intent detection started"] || this.lastStageTime;
    const duration = Math.round(performance.now() - intentStart);
    this.markStage("Intent detected", { intent, isFastRoute, durationMs: duration, ...details });
  }

  /**
   * Mark action started
   */
  markActionStarted(action: string, target?: string) {
    this.actionName = action;
    this.markStage("Action started", { action, target });
  }

  /**
   * Mark action completed
   */
  markActionCompleted(action: string, success: boolean = true, result?: any) {
    const actionStart = this.stageTimestamps["Action started"] || this.lastStageTime;
    const duration = Math.round(performance.now() - actionStart);
    this.markStage("Action completed", { action, success, durationMs: duration, result });
  }

  /**
   * Mark TTS started
   */
  markTTSStarted(text: string, engine: "local_speech_synthesis" | "gemini_live_audio" = "local_speech_synthesis") {
    this.markStage("TTS started", { text, engine });
  }

  /**
   * Mark TTS first audio received
   */
  markTTSFirstAudioReceived(engine: string = "local_speech_synthesis") {
    const ttsStart = this.stageTimestamps["TTS started"] || this.lastStageTime;
    const duration = Math.round(performance.now() - ttsStart);
    this.markStage("TTS first audio received", { durationMs: duration, engine });
  }

  /**
   * Mark TTS playback started
   */
  markTTSPlaybackStarted() {
    const ttsStart = this.stageTimestamps["TTS started"] || this.lastStageTime;
    const duration = Math.round(performance.now() - ttsStart);
    this.markStage("TTS playback started", { durationMs: duration });
  }

  /**
   * Finalize and generate the latency debug report
   */
  endSession(): LatencyReport {
    const now = performance.now();
    const totalDuration = Math.round(now - this.sessionStartTime);

    // Calculate stage durations
    const sttStart = this.stageTimestamps["STT started"] || this.sessionStartTime;
    const sttEnd = this.stageTimestamps["STT completed"] || sttStart;
    const sttDurationMs = Math.round(sttEnd - sttStart);

    const intentStart = this.stageTimestamps["Intent detection started"] || sttEnd;
    const intentEnd = this.stageTimestamps["Intent detected"] || intentStart;
    const intentDurationMs = Math.round(intentEnd - intentStart);

    const actionStart = this.stageTimestamps["Action started"] || intentEnd;
    const actionEnd = this.stageTimestamps["Action completed"] || actionStart;
    const actionDurationMs = Math.round(actionEnd - actionStart);

    const ttsStart = this.stageTimestamps["TTS started"] || actionEnd;
    const ttsEnd = this.stageTimestamps["TTS playback started"] || this.stageTimestamps["TTS first audio received"] || ttsStart;
    const ttsDurationMs = Math.round(ttsEnd - ttsStart);

    const report: LatencyReport = {
      id: this.currentSessionId || Math.random().toString(36).substring(7),
      command: this.currentCommand,
      startTime: this.sessionStartTime,
      endTime: now,
      totalDurationMs: totalDuration,
      stages: [...this.stages],
      breakdown: {
        sttDurationMs,
        intentDurationMs,
        actionDurationMs,
        ttsDurationMs,
        audioPipelineMs: totalDuration
      },
      isFastRouted: this.isFastRouted,
      intent: this.intentName,
      action: this.actionName
    };

    this.reportHistory.unshift(report);
    if (this.reportHistory.length > 50) {
      this.reportHistory.pop();
    }

    console.log(`==================================================`);
    console.log(`[ARIA LATENCY REPORT] Command: "${report.command}"`);
    console.log(`- Path: ${report.isFastRouted ? "⚡ FAST LOCAL INTENT ROUTER (BYPASS GEMINI)" : "🤖 AI ACTION PLANNER / GEMINI"}`);
    console.log(`- STT Duration: ${sttDurationMs}ms`);
    console.log(`- Intent Classification: ${intentDurationMs}ms`);
    console.log(`- Action Execution: ${actionDurationMs}ms`);
    console.log(`- TTS Audio Start: ${ttsDurationMs}ms`);
    console.log(`- TOTAL PIPELINE LATENCY: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`==================================================`);

    return report;
  }

  getRecentReports(): LatencyReport[] {
    return this.reportHistory;
  }
}

export const latencyProfiler = new LatencyProfiler();
export default latencyProfiler;
