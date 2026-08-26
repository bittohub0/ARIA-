import { useMiraStore } from "../store/useMiraStore";
import { AudioStreamer } from "./AudioStreamer";
import { AudioPlayer } from "./AudioPlayer";
import { fastSTT } from "./fastSTT";
import { fastTTS } from "./fastTTS";
import { classifyFastIntent } from "./fastIntentRouter";
import { latencyProfiler } from "./latencyProfiler";

export class LiveSession {
  private ws: WebSocket | null = null;
  private streamer: AudioStreamer | null = null;
  private player: AudioPlayer | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private currentToolCallIdMap: Map<string, string> = new Map(); // name -> traceId

  constructor() {
    this.player = new AudioPlayer();
    
    // Initialize stream with a callback routing to WebSocket stream
    this.streamer = new AudioStreamer((base64) => {
      this.sendAudioChunk(base64);
    });
  }

  /**
   * Connect to server-side websocket bridge
   */
  connect() {
    if (this.ws || this.isConnecting) return;
    
    this.isConnecting = true;
    useMiraStore.getState().setStatus("connecting");
    useMiraStore.getState().setError(null);
    useMiraStore.getState().clearTranscripts();
    
    // Auto-detect endpoint protocol to support secure/unsecure connections adapting flawlessly
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wakeWord = useMiraStore.getState().wakeWord || localStorage.getItem("mira_user_wake_word") || "Hey ARIA";
    const wsUrl = `${protocol}//${window.location.host}/ws?wakeWord=${encodeURIComponent(wakeWord)}`;
    
    console.log(`[LiveSession] Connecting ws bridge: ${wsUrl} with wakeWord "${wakeWord}"`);
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = async () => {
        console.log(`[LiveSession] WebSocket connection established with wake word: "${wakeWord}"`);
        this.isConnecting = false;
        
        // Send initial session voice parameters
        try {
          const userName = localStorage.getItem("mira_user_name") || "";
          const gender = localStorage.getItem("mira_user_gender") || "male";
          this.ws?.send(JSON.stringify({
            type: "initSession",
            wakeWord: wakeWord,
            userName,
            gender,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn("[LiveSession] Could not send initSession parameters:", e);
        }

        // Start microphone streaming and high-speed local STT engine in parallel
        try {
          await this.streamer?.start();
          
          fastSTT.start({
            onWakeWordDetected: (word) => {
              console.log(`[LiveSession] ⚡ Fast Wake word detected: "${word}"`);
              useMiraStore.getState().setStatus("listening");
            },
            onInterimTranscript: (text) => {
              useMiraStore.getState().setUserTranscript(text);
              useMiraStore.getState().setStatus("listening");
            },
            onFinalTranscript: (text) => {
              this.handleVoiceSpeechFinal(text);
            },
            onError: (err) => {
              console.warn("[LiveSession] FastSTT notice:", err);
            }
          }, wakeWord);
        } catch (err: any) {
          console.error("[LiveSession] Failed to launch microphone stream:", err);
          const store = useMiraStore.getState();
          store.setIsMicDenied(true);
          // Keep status at listening so they can type instead of disconnecting
          store.setStatus("listening");
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (err) {
          console.error("[LiveSession] Error handling server socket message:", err);
        }
      };
      
      this.ws.onclose = () => {
        console.log("[LiveSession] WebSocket stream closed");
        this.isConnecting = false;
        
        const wasDisconnectedByUser = (useMiraStore.getState().status === "disconnected");
        this.disconnect();
        
        // Reconnect if connection dropped unexpectedly without explicit action
        if (!wasDisconnectedByUser) {
          console.log("[LiveSession] Stream drop detected, auto-reconnecting in 3s...");
          useMiraStore.getState().setStatus("connecting");
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, 3000);
        }
      };
      
      this.ws.onerror = (err) => {
        console.error("[LiveSession] WebSocket stream encountered error:", err);
        useMiraStore.getState().setError("Voice bridge stream failure.");
      };
      
    } catch (err: any) {
      this.isConnecting = false;
      useMiraStore.getState().setError("Failed to create voice connection: " + (err.message || err));
    }
  }

  /**
   * Close connection and release devices
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    fastSTT.stop();
    fastTTS.stop();
    this.streamer?.stop();
    this.player?.cleanup();
    
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      try {
        this.ws.close();
      } catch (e) {
        // Safe check
      }
      this.ws = null;
    }
    
    useMiraStore.getState().setStatus("disconnected");
    console.log("[LiveSession] Core service session stopped");
  }

  /**
   * Handles user speech turn completion from fast client-side STT
   */
  private async handleVoiceSpeechFinal(rawText: string) {
    if (!rawText || !rawText.trim()) return;

    const wakeWord = useMiraStore.getState().wakeWord || "Hey ARIA";
    const store = useMiraStore.getState();
    store.setUserTranscript(rawText);

    // 1. Intent Detection Phase
    latencyProfiler.markIntentDetectionStarted();
    const fastIntent = classifyFastIntent(rawText, wakeWord);

    if (fastIntent && fastIntent.isDeterministic) {
      // ⚡ FAST LOCAL ROUTER PATH (Deterministic Action: 0.2 - 0.8s)
      latencyProfiler.markIntentDetected(fastIntent.intent, true, {
        action: fastIntent.action,
        target: fastIntent.targetName
      });

      // 2. Action Execution Phase (Immediate Parallel Execution)
      latencyProfiler.markActionStarted(fastIntent.action, fastIntent.targetName);

      // Instant Client UI Reaction
      this.executeClientToolEffect(fastIntent.toolName, fastIntent.toolArgs);

      // Fast Native OS Execution Packet to Server
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: "fastCommand",
          rawQuery: rawText,
          intent: fastIntent,
          timestamp: Date.now()
        }));
      }

      latencyProfiler.markActionCompleted(fastIntent.action, true);

      // 3. TTS Confirmation Phase (Parallel audio output)
      store.setMiraTranscript(fastIntent.spokenResponse);
      fastTTS.speak(fastIntent.spokenResponse, { isHindi: fastIntent.isHindi });

      // 4. Generate Latency Report
      const report = latencyProfiler.endSession();
      store.setLatencyReport(report);
    } else {
      // 🤖 COMPLEX REQUEST OR CONVERSATION -> Forward to server AI Action Planner / Gemini Live
      latencyProfiler.markIntentDetected(fastIntent?.intent || "CONVERSATION", false);
      store.setStatus("thinking");
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: "text",
          text: rawText,
          isFastStt: true,
          timestamp: Date.now()
        }));
      }
    }
  }

  /**
   * Send mic data chunk to websocket
   */
  private sendAudioChunk(base64: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "audio", data: base64 }));
    }
  }

  /**
   * Send captured screen frame chunk to websocket
   */
  sendScreenFrame(base64: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "image", data: base64 }));
    }
  }

  /**
   * Send active website / application context metadata to websocket
   */
  sendScreenContext(appName: string, title: string, url: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "context", data: { appName, title, url } }));
    }
  }

  /**
   * Send click-focus coordinate details to websocket
   */
  sendScreenClick(x: number, y: number) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "click", data: { x, y } }));
    }
  }

  /**
   * Send a manual text message (with instant fast-path classification)
   */
  sendTextMessage(text: string) {
    if (!text || !text.trim()) return;

    const wakeWord = useMiraStore.getState().wakeWord || "Hey ARIA";
    const store = useMiraStore.getState();
    store.setUserTranscript(text);

    latencyProfiler.startSession(text);
    latencyProfiler.markSTTStarted("text_input");
    latencyProfiler.markSTTCompleted(text, "text_input");
    latencyProfiler.markIntentDetectionStarted();

    const fastIntent = classifyFastIntent(text, wakeWord);

    if (fastIntent && fastIntent.isDeterministic) {
      latencyProfiler.markIntentDetected(fastIntent.intent, true, {
        action: fastIntent.action,
        target: fastIntent.targetName
      });

      latencyProfiler.markActionStarted(fastIntent.action, fastIntent.targetName);
      this.executeClientToolEffect(fastIntent.toolName, fastIntent.toolArgs);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: "fastCommand",
          rawQuery: text,
          intent: fastIntent,
          timestamp: Date.now()
        }));
      }

      latencyProfiler.markActionCompleted(fastIntent.action, true);
      store.setMiraTranscript(fastIntent.spokenResponse);
      fastTTS.speak(fastIntent.spokenResponse, { isHindi: fastIntent.isHindi });

      const report = latencyProfiler.endSession();
      store.setLatencyReport(report);
    } else {
      latencyProfiler.markIntentDetected(fastIntent?.intent || "CONVERSATION", false);
      store.setStatus("thinking");
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "text", text, timestamp: Date.now() }));
      }
    }
  }

  /**
   * Send user's safety action decision (Confirm or Cancel) back to the server
   */
  sendActionConfirmation(actionId: string, confirmed: boolean) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "confirmAction", actionId, confirmed }));
    }
  }

  /**
   * Update voice listening parameters (e.g. custom wake word) during active connection
   */
  updateVoiceParams(params: { wakeWord?: string }) {
    const wakeWord = params.wakeWord || useMiraStore.getState().wakeWord || "Hey ARIA";
    fastSTT.setWakeWord(wakeWord);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "updateVoiceConfig",
        wakeWord: wakeWord,
        timestamp: Date.now()
      }));
      console.log(`[LiveSession] Sent updated voice-listening parameters to server: "${wakeWord}"`);
    }
  }

  /**
   * Request native power status data from server over WebSocket
   */
  getPowerStatus() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "getPowerStatus" }));
    }
  }

  /**
   * Set native power profile mode (Balanced, Battery Saver, High Performance)
   */
  setPowerMode(mode: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "setPowerMode", mode }));
    }
  }

  /**
   * Request power action execution (LOCK, SLEEP, RESTART, SHUTDOWN)
   */
  executePowerAction(action: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "executePowerAction", action }));
    }
  }

  /**
   * Process server message frames
   */
  private handleServerMessage(msg: any) {
    const store = useMiraStore.getState();
    
    switch (msg.type) {
      case "requestConfirmation":
        console.log("[LiveSession] Received requestConfirmation", msg);
        store.setPendingConfirmation({
          actionId: msg.actionId,
          action: msg.action,
          args: msg.args
        });
        break;

      case "confirmActionCompleted":
        console.log("[LiveSession] Action confirmation resolved:", msg);
        store.setPendingConfirmation(null);
        break;

      case "actionPlanStarted":
        console.log("[LiveSession] Action plan started:", msg.plan);
        store.setActionPlan(msg.plan);
        break;

      case "actionPlanStepProgress":
        console.log(`[LiveSession] Action plan step progress [${msg.stepNumber}/${msg.totalSteps}]`, msg);
        store.updateActionStep(msg.planId, msg.stepId, msg.status, msg.result, msg.error);
        break;

      case "actionPlanCompleted":
        console.log("[LiveSession] Action plan completed:", msg);
        if (msg.spokenSummary) {
          store.setMiraTranscript(msg.spokenSummary);
        }
        break;

      case "status":
        if (msg.status === "ready") {
          store.setStatus("listening");
        } else if (msg.status === "disconnected") {
          this.disconnect();
        }
        break;
        
      case "audio":
        // Relay voice samples directly to high-fidelity 24kHz output speaker
        this.player?.playChunk(msg.data);
        break;
        
      case "inputTranscript":
        // User speech voice caption stream
        store.setUserTranscript(msg.text);
        store.setStatus("thinking");
        break;
        
      case "outputTranscript":
        // Mira model speech voice caption stream
        store.setMiraTranscript(msg.text);
        break;
        
      case "interrupted":
        // Stop current speaker immediately on user barge-in
        this.player?.interrupt();
        store.setStatus("listening");
        break;
        
      case "turnComplete":
        if (store.status === "speaking") {
          store.setStatus("listening");
        }
        break;
        
      case "toolCallStarted": {
        console.log(`[LiveSession] Logging tool execution: ${msg.name}`, msg.args);
        const traceId = store.addToolCall(msg.name, msg.args);
        this.currentToolCallIdMap.set(msg.name, traceId);
        
        // Execute instant local browser UI reactions corresponding to tool calls
        this.executeClientToolEffect(msg.name, msg.args);
        break;
      }
        
      case "toolCallCompleted": {
        const traceId = this.currentToolCallIdMap.get(msg.name);
        if (traceId) {
          store.completeToolCall(traceId, msg.response);
          this.currentToolCallIdMap.delete(msg.name);
        }
        break;
      }

      case "memoriesUpdated":
        store.setMemories(msg.memories);
        break;

      case "powerStatusUpdate":
        console.log("[LiveSession] Received powerStatusUpdate:", msg.powerStatus);
        store.setPowerStatus(msg.powerStatus);
        break;

      case "openApp":
        if (msg.appName) {
          store.setActiveApp(msg.appName);
        }
        break;

      case "youtubeStateUpdate":
        console.log("[LiveSession] Received youtubeStateUpdate:", msg);
        store.setYouTubeState(msg.status, {
          searchQuery: msg.searchQuery !== undefined ? msg.searchQuery : store.youtube.searchQuery,
          selectedVideo: msg.video !== undefined ? msg.video : store.youtube.selectedVideo,
          isPlaying: msg.isPlaying !== undefined ? msg.isPlaying : store.youtube.isPlaying,
          errorMessage: msg.errorMessage !== undefined ? msg.errorMessage : null
        });
        break;

      case "youtubePlay":
        console.log("[LiveSession] Received youtubePlay:", msg);
        store.setYouTubePlaying(true);
        store.setYouTubeState("playing", { isPlaying: true });
        break;

      case "youtubeControl": {
        console.log("[LiveSession] Received youtubeControl:", msg);
        const action = msg.action;
        if (action === "pause") {
          store.setYouTubePlaying(false);
        } else if (action === "play" || action === "resume") {
          store.setYouTubePlaying(true);
        } else if (action === "set_volume" && typeof msg.volume === "number") {
          store.setYouTubeVolume(msg.volume);
        }
        break;
      }
        
      case "error":
        store.setError(msg.error);
        break;
        
      default:
        console.warn("[LiveSession] Received unknown message packet:", msg);
    }
  }

  /**
   * Run immediate browser-side layout impacts requested by Gemini function calls or local command pipeline
   */
  private executeClientToolEffect(name: string, args: any) {
    const store = useMiraStore.getState();
    console.log(`[LiveSession Client Effect] Performing context action for tool ${name}:`, args);
    
    try {
      const isAriaBrowser = Boolean(args.inAriaBrowser || args.inMiraBrowser || args.browserTarget === "internal");
      const activeId = store.activeTabId || (store.browserTabs[0]?.id) || "tab-home";

      if (name === "openWebsite" && args.url) {
        const allowNewTab = Boolean(args.allowNewTab || args.newTab || args.forceNewTab);
        console.log(`[ARIA BROWSER] openWebsite: url=${args.url}, isAriaBrowser=${isAriaBrowser}, allowNewTab=${allowNewTab}`);
        if (isAriaBrowser) {
          // Explicit ARIA built-in browser request: Single-tab navigation (reuse active tab unless user explicitly asked for new tab)
          if (allowNewTab) {
            store.openBrowserTab(args.url, args.title || args.url, true);
          } else {
            console.log(`[ARIA BROWSER] Reusing active tab: ${activeId} for URL: ${args.url}`);
            store.updateActiveTabUrl(args.url, args.title || args.url);
          }
          store.setActiveApp("browser");
        } else {
          // Default external browser: Handled by server native launch
          console.log(`[ARIA BROWSER] External browser request handled for: ${args.url}`);
        }
      }
      
      else if (name === "searchYouTube" && args.query) {
        const allowNewTab = Boolean(args.allowNewTab || args.newTab || args.forceNewTab);
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
        console.log(`[ARIA BROWSER] searchYouTube: query="${args.query}", activeTabId=${activeId}`);
        store.setYouTubeState("searching", { searchQuery: args.query });

        if (isAriaBrowser) {
          if (allowNewTab) {
            store.openBrowserTab(searchUrl, `YouTube: ${args.query}`, true);
          } else {
            console.log(`[ARIA BROWSER] Reusing active tab: ${activeId} for search`);
            store.updateActiveTabUrl(searchUrl, `YouTube: ${args.query}`);
          }
          store.setActiveApp("browser");
        }
      }

      else if (name === "selectYouTubeVideo") {
        const video = args.video || {
          id: args.videoId,
          title: args.videoTitle || args.title,
          url: args.playUrl || args.url,
          playUrl: args.playUrl || args.url
        };
        console.log(`[ARIA BROWSER] selectYouTubeVideo: Selected video "${video.title}" (ID: ${video.id})`);
        store.setYouTubeState("selecting_video", { selectedVideo: video });
      }

      else if (name === "openYouTubeVideo") {
        const allowNewTab = Boolean(args.allowNewTab || args.newTab || args.forceNewTab);
        const videoUrl = args.url || args.playUrl || (args.videoId ? `https://www.youtube.com/watch?v=${args.videoId}` : "https://www.youtube.com");
        const videoTitle = args.title || "YouTube Video";

        console.log(`[ARIA BROWSER] openYouTubeVideo: Loading in SAME active tab (${activeId}), URL=${videoUrl}`);
        store.setYouTubeState("opening_video", {
          selectedVideo: {
            id: args.videoId || "",
            title: videoTitle,
            url: videoUrl,
            playUrl: videoUrl
          }
        });

        if (isAriaBrowser) {
          if (allowNewTab) {
            store.openBrowserTab(videoUrl, videoTitle, true);
          } else {
            console.log(`[ARIA BROWSER] One Tab Policy: Loading video inside active tab ${activeId}`);
            store.updateActiveTabUrl(videoUrl, videoTitle);
          }
          store.setActiveApp("browser");
        }
      }

      else if (name === "waitForResults") {
        console.log(`[ARIA BROWSER] waitForResults: Search results loaded for query: "${args.query}"`);
        store.setYouTubeState("results_ready", { searchQuery: args.query });
      }

      else if (name === "waitForPlayer") {
        console.log(`[ARIA BROWSER] waitForPlayer: Video player element verified and ready`);
        store.setYouTubeState("player_ready");
      }

      else if (name === "playYouTubeVideo") {
        console.log(`[ARIA BROWSER] playYouTubeVideo: Starting video playback`);
        store.setYouTubePlaying(true);
        store.setYouTubeState("playing", { isPlaying: true });
      }

      else if (name === "verifyYouTubePlayback") {
        console.log(`[ARIA BROWSER] verifyYouTubePlayback: Video playback verified active, time advancing`);
        store.setYouTubePlaying(true);
        store.setYouTubeState("completed", { isPlaying: true });
      }

      else if (name === "controlYouTube") {
        const action = args.action || "resume";
        console.log(`[ARIA BROWSER] controlYouTube: action=${action}`);
        if (action === "pause") {
          store.setYouTubePlaying(false);
        } else if (action === "play" || action === "resume") {
          store.setYouTubePlaying(true);
        } else if (action === "set_volume" && typeof args.volume === "number") {
          store.setYouTubeVolume(args.volume);
        }
      }
      
      else if (name === "searchWeb" && args.query) {
        const queryUrl = `https://www.google.com/search?q=${encodeURIComponent(args.query)}`;
        const allowNewTab = Boolean(args.allowNewTab || args.newTab || args.forceNewTab);
        console.log(`[ARIA BROWSER] searchWeb: query="${args.query}", isAriaBrowser=${isAriaBrowser}`);
        if (isAriaBrowser) {
          // Explicit ARIA built-in browser search: Single-tab navigation (reuse active tab)
          if (allowNewTab) {
            store.openBrowserTab(queryUrl, `Search: ${args.query}`, true);
          } else {
            console.log(`[ARIA BROWSER] Reusing active tab: ${activeId} for Google search`);
            store.updateActiveTabUrl(queryUrl, `Search: ${args.query}`);
          }
          store.setActiveApp("browser");
        }
      }
      
      else if (name === "getCurrentTime") {
        store.setActiveApp("clock");
      }

      else if (name === "getWeather") {
        store.setActiveApp("weather");
      }

      else if (name === "controlMusic") {
        const action = args.action || "change_track";
        const genre = args.genre;
        store.setActiveApp("music");
        
        if (action === "pause") {
          store.setMusicPlaying(false);
        } else if (action === "play" || action === "resume") {
          store.setMusicPlaying(true);
        } else if (action === "previous" || action === "prev") {
          store.changeMusicTrack("prev");
        } else if (action === "play_custom" || (genre && genre.toLowerCase().includes("custom"))) {
          store.setMusicGenreFilter("custom");
          if (store.music.customTracks && store.music.customTracks.length > 0) {
            store.setMusicTrackIndex(9); // First custom uploaded track
          } else {
            store.changeMusicTrack("next");
          }
        } else if (action === "set_genre" && genre) {
          store.setMusicGenreFilter(genre.toLowerCase());
          store.changeMusicTrack("next");
        } else {
          // "change_track", "next", "shuffle", or default
          store.changeMusicTrack("next");
        }
      }
      
      else if (name === "controlSystem") {
        const action = args.action;
        if (action === "set_alarm" && args.time) {
          store.addAlarm(args.time, args.label || "Alarm");
          store.setActiveApp("clock");
        } else if (action === "set_timer") {
          const durationSec = args.durationSeconds || args.duration || 300;
          store.addTimer(durationSec, args.label || "Timer");
          store.setActiveApp("clock");
        } else if (action === "create_reminder") {
          store.addReminder(args.textToType || args.text || args.label || "Reminder", args.time || undefined);
          store.setActiveApp("clock");
        } else if (action === "create_calendar_event") {
          store.addCalendarEvent(args.title || "Scheduled Event", args.date || "Tomorrow", args.time || "19:00", args.description || args.label);
          store.setActiveApp("clock");
        } else if (action === "create_note") {
          store.addNote(args.text || args.textToType || "New Note");
          store.setActiveApp("notes");
        } else if (action === "take_screenshot") {
          store.setActiveApp("screen_share");
        } else if (action === "get_power_status" || action === "check_battery") {
          store.setActiveApp("power");
        } else if (action === "play_music" || action === "change_music") {
          store.setActiveApp("music");
          store.changeMusicTrack("next");
        } else if ((action === "launch_website" || action === "open_website") && args.url) {
          const allowNewTab = Boolean(args.allowNewTab || args.newTab || args.forceNewTab);
          if (allowNewTab) {
            store.openBrowserTab(args.url, args.title || args.url, true);
          } else {
            store.updateActiveTabUrl(args.url, args.title || args.url);
          }
          store.setActiveApp("browser");
        }
      }
      
      else if (name === "openApplication" && args.appName) {
        const appMapping: Record<string, any> = {
          "calculator": "calculator",
          "calc": "calculator",
          "notes": "notes",
          "notepad": "notes",
          "vscode": "notes",
          "vs code": "notes",
          "visual studio code": "notes",
          "editor": "notes",
          "clock": "clock",
          "alarm": "clock",
          "timer": "clock",
          "weather": "weather",
          "music": "music",
          "spotify": "music",
          "memory": "memory",
          "screen_share": "screen_share",
          "browser": "browser",
          "camera": "camera",
          "power": "power",
          "battery": "power",
          "battery status": "power",
          "power status": "power",
          "power widget": "power",
          "settings": "profile_settings"
        };
        const rawApp = String(args.appName).toLowerCase().trim();
        const targetApp = appMapping[rawApp] || "notes";
        store.setActiveApp(targetApp);
      }
      
      else if (name === "copyToClipboard" && args.text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(args.text)
            .then(() => console.log("Copied to keyboard successfully"))
            .catch((err) => console.error("Clipboard failed", err));
        } else {
          // Fallback legacy copying if required in older or embedded sandbox frames
          const textarea = document.createElement("textarea");
          textarea.value = args.text;
          textarea.style.position = "fixed";
          document.body.appendChild(textarea);
          textarea.select();
          try {
            document.execCommand("copy");
            console.log("Copied text via fallback text range selector");
          } catch (e) {
            console.error("Textarea fallback copying failed", e);
          }
          document.body.removeChild(textarea);
        }
      }
    } catch (e) {
      console.warn("[LiveSession Client Effect] Failed executing instant UI effect:", e);
    }
  }
}

// Singleton voice-bridge instance to preserve audio context stream states across hot updates
export const liveSessionInstance = new LiveSession();
export default liveSessionInstance;
