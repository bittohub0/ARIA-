import { create } from "zustand";
import type { LatencyReport } from "../lib/latencyProfiler";
import { 
  DeviceLocation, 
  GeolocationPermissionState, 
  getCachedLocation, 
  acquirePreciseLocation, 
  isLocationPromptDismissed, 
  setLocationPromptDismissed,
  getGeolocationPermissionState
} from "../lib/geolocationService";

export type MiraStatus = "disconnected" | "connecting" | "listening" | "thinking" | "speaking" | "error";
export type ActiveAppType = "none" | "calculator" | "notes" | "clock" | "weather" | "music" | "memory" | "screen_share" | "browser" | "profile_settings" | "power";

export interface SystemConfirmation {
  actionId: string;
  action: string;
  args: any;
}

export interface ToolCallTrace {
  id: string;
  name: string;
  args: any;
  status: "running" | "completed" | "failed";
  response?: any;
  timestamp: number;
}

export interface NoteItem {
  id: string;
  text: string;
  createdAt: number;
}

export interface MemoryItem {
  id: string;
  key: string;
  content: string;
  timestamp: number;
}

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
}

export interface AlarmItem {
  id: string;
  time: string; // "HH:MM"
  label: string;
  enabled: boolean;
}

export interface TimerItem {
  id: string;
  duration: number; // seconds
  remaining: number; // seconds
  label: string;
  status: "running" | "paused" | "completed";
}

export interface ReminderItem {
  id: string;
  text: string;
  time?: string; // "HH:MM" or similar
  completed: boolean;
  createdAt: number;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  date: string; // "YYYY-MM-DD" or relative label
  time: string; // "HH:MM"
  description?: string;
  completed: boolean;
  createdAt: number;
}

export type YouTubeExecutionStatus = 
  | "idle" 
  | "opening_youtube" 
  | "searching" 
  | "results_ready" 
  | "selecting_video" 
  | "opening_video" 
  | "player_ready" 
  | "playing" 
  | "completed" 
  | "failed";

export interface YouTubeVideoDetails {
  id: string;
  title: string;
  url: string;
  playUrl: string;
  channelName?: string;
  duration?: string;
  thumbnail?: string;
}

export interface YouTubeState {
  status: YouTubeExecutionStatus;
  searchQuery: string;
  selectedVideo: YouTubeVideoDetails | null;
  isPlaying: boolean;
  volume: number; // 0 to 100
  isMuted: boolean;
  currentTime: number;
  duration: number;
  errorMessage: string | null;
}

export interface ActionPlanStep {
  id: string;
  stepNumber: number;
  totalSteps: number;
  toolName: string;
  toolArgs: any;
  description: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  result?: any;
  error?: string;
}

export interface ActionPlan {
  planId: string;
  originalQuery: string;
  title: string;
  steps: ActionPlanStep[];
  spokenSummary: string;
  status: "planning" | "in_progress" | "completed" | "failed";
  createdAt: number;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: "lofi" | "anime" | "synthwave" | "ambient" | "chill" | "bollywood" | "piano" | "custom";
  duration: number; // in seconds
  description: string;
  color: string;
  isCustom?: boolean;
  audioUrl?: string;
  fileSize?: string;
}

export interface MusicPlayerState {
  isPlaying: boolean;
  trackIndex: number;
  volume: number; // 0 to 1
  isMuted: boolean;
  genreFilter: string;
  customTracks: MusicTrack[];
}

export interface PowerStatusData {
  hasBattery: boolean;
  batteryPercent: number; // 0 - 100
  isCharging: boolean;
  powerSource: "AC" | "Battery" | "Direct Power" | "Unknown";
  statusText: string;
  timeRemainingMinutes: number | null;
  batteryHealth?: string;
  powerMode: "Balanced" | "Battery Saver" | "High Performance";
  voltageMv?: number;
  temperatureC?: number;
  system: {
    platform: string;
    platformName: string;
    arch: string;
    uptimeSeconds: number;
    hostname: string;
    cpuModel: string;
    cpuCores: number;
    cpuLoadPercent: number;
    totalMemBytes: number;
    freeMemBytes: number;
    usedMemPercent: number;
    osRelease: string;
  };
  timestamp: number;
}

interface MiraState {
  status: MiraStatus;
  errorMessage: string | null;
  userTranscript: string;
  miraTranscript: string;
  activeApp: ActiveAppType;
  toolCalls: ToolCallTrace[];
  isMuted: boolean;
  notes: NoteItem[];
  memories: MemoryItem[];
  isScreenSharing: boolean;
  isScreenSharingPaused: boolean;
  screenContext: {
    appName: string;
    title: string;
    url: string;
  } | null;
  clickCoordinates: { x: number; y: number } | null;
  isMicDenied: boolean;
  setIsMicDenied: (denied: boolean) => void;
  
  // Audio state
  inputVolume: number; // 0 to 1
  miraVolume: number; // 0 to 1

  // Voice Listening parameters
  wakeWord: string;
  setWakeWord: (wakeWord: string) => void;

  // Browser state
  browserTabs: BrowserTab[];
  activeTabId: string;
  browserHistory: string[];
  historyIndex: number;

  // Power & Battery Telemetry State
  powerStatus: PowerStatusData | null;
  setPowerStatus: (status: PowerStatusData | null) => void;

  // Assistant device scheduler state
  alarms: AlarmItem[];
  timers: TimerItem[];
  reminders: ReminderItem[];
  calendarEvents: CalendarEventItem[];

  // Action plan tracking state
  currentActionPlan: ActionPlan | null;

  // Music Player state
  music: MusicPlayerState;

  // YouTube Automation & State Tracking
  youtube: YouTubeState;

  // Device Geolocation & Local Context State
  userLocation: DeviceLocation | null;
  geolocationPermission: GeolocationPermissionState;
  isLocating: boolean;
  locationPromptDismissed: boolean;
  setUserLocation: (loc: DeviceLocation | null) => void;
  setGeolocationPermission: (perm: GeolocationPermissionState) => void;
  requestDeviceLocation: (forcePrompt?: boolean) => Promise<DeviceLocation | null>;
  dismissLocationPrompt: () => void;
  
  // Actions
  setStatus: (status: MiraStatus) => void;
  setError: (error: string | null) => void;
  setUserTranscript: (transcript: string) => void;
  setMiraTranscript: (transcript: string) => void;
  setActiveApp: (app: ActiveAppType) => void;
  addToolCall: (name: string, args: any) => string; // returns unique ID
  completeToolCall: (id: string, response: any, failed?: boolean) => void;
  setIsMuted: (isMuted: boolean) => void;
  setInputVolume: (vol: number) => void;
  setMiraVolume: (vol: number) => void;
  addNote: (text: string) => void;
  deleteNote: (id: string) => void;
  setMemories: (memories: MemoryItem[]) => void;
  setScreenSharing: (sharing: boolean) => void;
  setScreenSharingPaused: (paused: boolean) => void;
  setScreenContext: (context: { appName: string; title: string; url: string; } | null) => void;

  // Action Plan methods
  setActionPlan: (plan: ActionPlan | null) => void;
  updateActionStep: (planId: string, stepId: string, status: "running" | "completed" | "failed" | "cancelled", result?: any, error?: string) => void;

  // Music Player Actions
  setMusicPlaying: (isPlaying: boolean) => void;
  setMusicTrackIndex: (trackIndex: number) => void;
  changeMusicTrack: (target?: "next" | "prev" | "random" | number | string) => void;
  setMusicVolume: (volume: number) => void;
  setMusicMuted: (isMuted: boolean) => void;
  setMusicGenreFilter: (genreFilter: string) => void;
  addCustomTrack: (track: MusicTrack) => void;
  removeCustomTrack: (id: string) => void;
  setCustomTracks: (tracks: MusicTrack[]) => void;

  // YouTube Automation Actions
  setYouTubeState: (status: YouTubeExecutionStatus, updates?: Partial<YouTubeState>) => void;
  setYouTubePlaying: (isPlaying: boolean) => void;
  setYouTubeVideo: (video: YouTubeVideoDetails | null) => void;
  setYouTubeVolume: (volume: number) => void;
  setYouTubeMuted: (isMuted: boolean) => void;

  // Alarms, Timers, Reminders, Calendar actions
  addAlarm: (time: string, label?: string) => void;
  deleteAlarm: (id: string) => void;
  toggleAlarm: (id: string) => void;
  addTimer: (durationSeconds: number, label?: string) => void;
  deleteTimer: (id: string) => void;
  updateTimer: (id: string, updates: Partial<TimerItem>) => void;
  addReminder: (text: string, time?: string) => void;
  deleteReminder: (id: string) => void;
  toggleReminder: (id: string) => void;
  addCalendarEvent: (title: string, date: string, time: string, description?: string) => void;
  deleteCalendarEvent: (id: string) => void;
  toggleCalendarEvent: (id: string) => void;
  setClickCoordinates: (coords: { x: number; y: number } | null) => void;
  
  // Browser Actions
  openBrowserTab: (url?: string, title?: string, forceNewTab?: boolean) => void;
  closeBrowserTab: (id: string) => void;
  switchBrowserTab: (id: string) => void;
  updateActiveTabUrl: (url: string, title?: string) => void;
  navigateBrowserHistory: (dir: "back" | "forward") => void;

  clearTranscripts: () => void;
  resetAll: () => void;

  // System Control confirmation dialog states
  pendingConfirmation: SystemConfirmation | null;
  setPendingConfirmation: (conf: SystemConfirmation | null) => void;

  // Real-time Pipeline Latency Telemetry
  latencyReport: LatencyReport | null;
  setLatencyReport: (report: LatencyReport | null) => void;
}

export const useMiraStore = create<MiraState>((set) => ({
  status: "disconnected",
  errorMessage: null,
  userTranscript: "",
  miraTranscript: "",
  activeApp: "none",
  toolCalls: [],
  isMuted: false,
  latencyReport: null,
  setLatencyReport: (report) => set({ latencyReport: report }),
  notes: [
    { id: "1", text: "Ask Mira to open the calculator or check the web!", createdAt: Date.now() - 60000 }
  ],
  memories: [],
  isScreenSharing: false,
  isScreenSharingPaused: false,
  screenContext: null,
  clickCoordinates: null,
  isMicDenied: false,
  inputVolume: 0,
  miraVolume: 0,
  wakeWord: (typeof window !== "undefined" && localStorage.getItem("mira_user_wake_word")) || "Hey ARIA",
  pendingConfirmation: null,

  // Browser state defaults
  browserTabs: [
    { id: "tab-home", url: "https://www.google.com", title: "Google Search" }
  ],
  activeTabId: "tab-home",
  browserHistory: ["https://www.google.com"],
  historyIndex: 0,

  // Device Geolocation & Local Context State
  userLocation: getCachedLocation(),
  geolocationPermission: "prompt",
  isLocating: false,
  locationPromptDismissed: isLocationPromptDismissed(),

  setUserLocation: (userLocation) => set({ userLocation }),
  setGeolocationPermission: (geolocationPermission) => set({ geolocationPermission }),
  dismissLocationPrompt: () => {
    setLocationPromptDismissed(true);
    set({ locationPromptDismissed: true });
  },

  requestDeviceLocation: async (forcePrompt = false) => {
    set({ isLocating: true });
    try {
      console.log(`[ARIA Geolocation] Requesting device GPS coordinates (forcePrompt=${forcePrompt})...`);
      const location = await acquirePreciseLocation();
      console.log(`[ARIA Geolocation] Successfully acquired device location: ${location.city}, ${location.country} (accuracy: ±${location.accuracyMeters}m)`);
      set({ 
        userLocation: location, 
        geolocationPermission: "granted", 
        isLocating: false,
        locationPromptDismissed: false
      });
      return location;
    } catch (err: any) {
      console.warn(`[ARIA Geolocation] Geolocation acquisition failed/denied:`, err.message || err);
      const isDenied = err.code === 1 || String(err).includes("denied");
      set({ 
        geolocationPermission: isDenied ? "denied" : "prompt", 
        isLocating: false 
      });
      return null;
    }
  },

  // Assistant device scheduler state defaults
  alarms: [],
  timers: [],
  reminders: [],
  calendarEvents: [
    {
      id: "cal-welcome",
      title: "Team Sync & System Review",
      date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      time: "19:00",
      description: "Automated event created for tomorrow at 7 PM",
      completed: false,
      createdAt: Date.now()
    }
  ],

  // Action plan tracking state
  currentActionPlan: null,

  // Power & Battery Telemetry default state
  powerStatus: null,
  setPowerStatus: (powerStatus) => set({ powerStatus }),

  // YouTube state defaults
  youtube: {
    status: "idle",
    searchQuery: "",
    selectedVideo: null,
    isPlaying: false,
    volume: 85,
    isMuted: false,
    currentTime: 0,
    duration: 0,
    errorMessage: null
  },

  // Music Player default state
  music: {
    isPlaying: false,
    trackIndex: 0,
    volume: 0.8,
    isMuted: false,
    genreFilter: "all",
    customTracks: []
  },

  setStatus: (status) => set({ status }),
  setPendingConfirmation: (pendingConfirmation) => set({ pendingConfirmation }),
  setError: (error) => set({ errorMessage: error, status: error ? "error" : "disconnected" }),
  setUserTranscript: (transcript) => set({ userTranscript: transcript }),
  setMiraTranscript: (transcript) => set({ miraTranscript: transcript }),
  setActiveApp: (app) => set({ activeApp: app }),
  setIsMicDenied: (denied) => set({ isMicDenied: denied }),
  setWakeWord: (wakeWord) => set({ wakeWord }),

  // Music Player actions implementation
  setMusicPlaying: (isPlaying) => set((state) => ({
    music: { ...state.music, isPlaying }
  })),
  setMusicTrackIndex: (trackIndex) => set((state) => ({
    music: { ...state.music, trackIndex, isPlaying: true }
  })),
  changeMusicTrack: (target = "next") => set((state) => {
    const totalTracks = 9 + (state.music.customTracks ? state.music.customTracks.length : 0);
    let nextIndex = state.music.trackIndex;
    if (typeof target === "number") {
      nextIndex = (target + totalTracks) % totalTracks;
    } else if (target === "next") {
      nextIndex = (state.music.trackIndex + 1) % totalTracks;
    } else if (target === "prev") {
      nextIndex = (state.music.trackIndex - 1 + totalTracks) % totalTracks;
    } else if (target === "random") {
      let rand = Math.floor(Math.random() * totalTracks);
      if (rand === state.music.trackIndex) rand = (rand + 1) % totalTracks;
      nextIndex = rand;
    }
    return {
      activeApp: "music",
      music: { ...state.music, trackIndex: nextIndex, isPlaying: true }
    };
  }),
  setMusicVolume: (volume) => set((state) => ({
    music: { ...state.music, volume: Math.max(0, Math.min(1, volume)), isMuted: false }
  })),
  setMusicMuted: (isMuted) => set((state) => ({
    music: { ...state.music, isMuted }
  })),
  setMusicGenreFilter: (genreFilter) => set((state) => ({
    music: { ...state.music, genreFilter }
  })),
  addCustomTrack: (track) => set((state) => ({
    music: {
      ...state.music,
      customTracks: [track, ...(state.music.customTracks || [])],
      trackIndex: 9, // First custom track index is right after the 9 presets
      isPlaying: true
    },
    activeApp: "music"
  })),
  removeCustomTrack: (id) => set((state) => {
    const updated = (state.music.customTracks || []).filter((t) => t.id !== id);
    const total = 9 + updated.length;
    return {
      music: {
        ...state.music,
        customTracks: updated,
        trackIndex: state.music.trackIndex >= total ? Math.max(0, total - 1) : state.music.trackIndex
      }
    };
  }),
  setCustomTracks: (tracks) => set((state) => ({
    music: { ...state.music, customTracks: tracks }
  })),

  // YouTube Automation actions implementations
  setYouTubeState: (status, updates = {}) => set((state) => ({
    youtube: {
      ...state.youtube,
      status,
      ...updates
    }
  })),
  setYouTubePlaying: (isPlaying) => set((state) => ({
    youtube: { ...state.youtube, isPlaying, status: isPlaying ? "playing" : state.youtube.status }
  })),
  setYouTubeVideo: (video) => set((state) => ({
    youtube: { ...state.youtube, selectedVideo: video }
  })),
  setYouTubeVolume: (volume) => set((state) => ({
    youtube: { ...state.youtube, volume: Math.max(0, Math.min(100, volume)), isMuted: false }
  })),
  setYouTubeMuted: (isMuted) => set((state) => ({
    youtube: { ...state.youtube, isMuted }
  })),

  // Alarms, Timers, Reminders actions implementations
  addAlarm: (time, label = "Alarm") => set((state) => ({
    alarms: [...state.alarms, { id: Math.random().toString(36).substring(7), time, label, enabled: true }]
  })),
  deleteAlarm: (id) => set((state) => ({
    alarms: state.alarms.filter((a) => a.id !== id)
  })),
  toggleAlarm: (id) => set((state) => ({
    alarms: state.alarms.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a)
  })),

  addTimer: (duration, label = "Timer") => set((state) => ({
    timers: [...state.timers, { id: Math.random().toString(36).substring(7), duration, remaining: duration, label, status: "running" }]
  })),
  deleteTimer: (id) => set((state) => ({
    timers: state.timers.filter((t) => t.id !== id)
  })),
  updateTimer: (id, updates) => set((state) => ({
    timers: state.timers.map((t) => t.id === id ? { ...t, ...updates } : t)
  })),

  addReminder: (text, time) => set((state) => ({
    reminders: [...state.reminders, { id: Math.random().toString(36).substring(7), text, time, completed: false, createdAt: Date.now() }]
  })),
  deleteReminder: (id) => set((state) => ({
    reminders: state.reminders.filter((r) => r.id !== id)
  })),
  toggleReminder: (id) => set((state) => ({
    reminders: state.reminders.map((r) => r.id === id ? { ...r, completed: !r.completed } : r)
  })),

  // Calendar Event implementations
  addCalendarEvent: (title, date, time, description) => set((state) => ({
    calendarEvents: [
      ...state.calendarEvents,
      {
        id: "cal-" + Math.random().toString(36).substring(7),
        title,
        date,
        time,
        description: description || `Scheduled for ${date} at ${time}`,
        completed: false,
        createdAt: Date.now()
      }
    ]
  })),
  deleteCalendarEvent: (id) => set((state) => ({
    calendarEvents: state.calendarEvents.filter((e) => e.id !== id)
  })),
  toggleCalendarEvent: (id) => set((state) => ({
    calendarEvents: state.calendarEvents.map((e) => e.id === id ? { ...e, completed: !e.completed } : e)
  })),

  // Action plan tracking methods
  setActionPlan: (currentActionPlan) => set({ currentActionPlan }),
  updateActionStep: (planId, stepId, status, result, error) => set((state) => {
    if (!state.currentActionPlan || state.currentActionPlan.planId !== planId) return {};
    const updatedSteps = state.currentActionPlan.steps.map((s) => {
      if (s.id === stepId) {
        return { ...s, status, result, error };
      }
      return s;
    });
    const allDone = updatedSteps.every((s) => s.status === "completed");
    const anyFailed = updatedSteps.some((s) => s.status === "failed");
    return {
      currentActionPlan: {
        ...state.currentActionPlan,
        steps: updatedSteps,
        status: anyFailed ? "failed" : allDone ? "completed" : "in_progress"
      }
    };
  }),
  
  addToolCall: (name, args) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toolCalls: [
        {
          id,
          name,
          args,
          status: "running",
          timestamp: Date.now()
        },
        ...state.toolCalls.slice(0, 19) // limit to recent 20
      ]
    }));
    return id;
  },

  completeToolCall: (id, response, failed) => {
    set((state) => ({
      toolCalls: state.toolCalls.map((call) => 
        call.id === id 
          ? { ...call, status: failed ? "failed" : "completed", response }
          : call
      )
    }));
  },

  setIsMuted: (isMuted) => set({ isMuted }),
  setInputVolume: (inputVolume) => set({ inputVolume }),
  setMiraVolume: (miraVolume) => set({ miraVolume }),
  
  addNote: (text) => set((state) => ({
    notes: [{ id: Math.random().toString(36).substring(7), text, createdAt: Date.now() }, ...state.notes]
  })),
  
  deleteNote: (id) => set((state) => ({
    notes: state.notes.filter((n) => n.id !== id)
  })),

  setMemories: (memories) => set({ memories }),

  setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
  setScreenSharingPaused: (isScreenSharingPaused) => set({ isScreenSharingPaused }),
  setScreenContext: (screenContext) => set((state) => {
    if (
      (!state.screenContext && !screenContext) ||
      (state.screenContext &&
        screenContext &&
        state.screenContext.appName === screenContext.appName &&
        state.screenContext.title === screenContext.title &&
        state.screenContext.url === screenContext.url)
    ) {
      return state;
    }
    return { screenContext };
  }),
  setClickCoordinates: (clickCoordinates) => set((state) => {
    if (
      (!state.clickCoordinates && !clickCoordinates) ||
      (state.clickCoordinates &&
        clickCoordinates &&
        state.clickCoordinates.x === clickCoordinates.x &&
        state.clickCoordinates.y === clickCoordinates.y)
    ) {
      return state;
    }
    return { clickCoordinates };
  }),

  // Browser Actions Implementation
  openBrowserTab: (url = "https://www.google.com", title = "Google Search", forceNewTab = false) => set((state) => {
    // Single-Tab Rule: If forceNewTab is not explicitly true and an active tab exists, navigate within the existing tab
    if (!forceNewTab && state.browserTabs.length > 0) {
      const activeId = state.activeTabId || state.browserTabs[0].id;
      console.log(`[ARIA BROWSER] Reusing active tab: ${activeId} for URL: ${url} (One Tab Policy: forceNewTab=false)`);
      const updatedTabs = state.browserTabs.map(t => 
        t.id === activeId 
          ? { ...t, url, title: title || t.title || "Web Page" } 
          : t
      );
      const currentUrl = state.browserHistory[state.historyIndex];
      const isNew = currentUrl !== url;
      const history = isNew 
        ? [...state.browserHistory.slice(0, state.historyIndex + 1), url]
        : state.browserHistory;
      const historyIndex = isNew ? history.length - 1 : state.historyIndex;
      
      return {
        browserTabs: updatedTabs,
        activeTabId: activeId,
        browserHistory: history,
        historyIndex,
        activeApp: "browser"
      };
    }

    // Explicit new tab requested or no existing tab present
    const newId = "tab-" + Math.random().toString(36).substring(7);
    console.log(`[ARIA BROWSER] Creating new browser tab: ${newId} for URL: ${url} (forceNewTab=${forceNewTab})`);
    const newTab = { id: newId, url, title: title || "Web Page" };
    return {
      browserTabs: [...state.browserTabs, newTab],
      activeTabId: newId,
      browserHistory: [...state.browserHistory.slice(0, state.historyIndex + 1), url],
      historyIndex: state.historyIndex + 1,
      activeApp: "browser" // Auto-focus browser
    };
  }),

  closeBrowserTab: (id) => set((state) => {
    console.log(`[ARIA BROWSER] Closing tab: ${id}`);
    const filteredTabs = state.browserTabs.filter(t => t.id !== id);
    let activeTabId = state.activeTabId;
    if (activeTabId === id) {
      if (filteredTabs.length > 0) {
        activeTabId = filteredTabs[filteredTabs.length - 1].id;
      } else {
        const fallbackId = "tab-home";
        filteredTabs.push({ id: fallbackId, url: "https://www.google.com", title: "Google Search" });
        activeTabId = fallbackId;
      }
    }
    console.log(`[ARIA BROWSER] Active tab after close: ${activeTabId} (Total tabs: ${filteredTabs.length})`);
    return {
      browserTabs: filteredTabs,
      activeTabId
    };
  }),

  switchBrowserTab: (id) => set((state) => {
    const targetTab = state.browserTabs.find(t => t.id === id);
    if (!targetTab) return {};
    console.log(`[ARIA BROWSER] Switched active tab to: ${id} (${targetTab.title || targetTab.url})`);
    return {
      activeTabId: id,
      browserHistory: [...state.browserHistory.slice(0, state.historyIndex + 1), targetTab.url],
      historyIndex: state.historyIndex + 1
    };
  }),

  updateActiveTabUrl: (url, title) => set((state) => {
    if (state.browserTabs.length === 0) {
      const fallbackId = "tab-home";
      const initialTab = { id: fallbackId, url, title: title || "Web Page" };
      console.log(`[ARIA BROWSER] Initialized single browser tab: ${fallbackId} for ${url}`);
      return {
        browserTabs: [initialTab],
        activeTabId: fallbackId,
        browserHistory: [url],
        historyIndex: 0,
        activeApp: "browser"
      };
    }

    const activeId = state.activeTabId || state.browserTabs[0].id;
    console.log(`[ARIA BROWSER] Updating active tab [${activeId}] URL: ${url} (One Tab Policy active)`);
    const updatedTabs = state.browserTabs.map(t => 
      t.id === activeId 
        ? { ...t, url, title: title || t.title } 
        : t
    );
    const currentUrl = state.browserHistory[state.historyIndex];
    const isNew = currentUrl !== url;
    const history = isNew 
      ? [...state.browserHistory.slice(0, state.historyIndex + 1), url]
      : state.browserHistory;
    const historyIndex = isNew ? history.length - 1 : state.historyIndex;
    
    return {
      browserTabs: updatedTabs,
      activeTabId: activeId,
      browserHistory: history,
      historyIndex,
      activeApp: "browser"
    };
  }),

  navigateBrowserHistory: (dir) => set((state) => {
    let newIndex = state.historyIndex;
    if (dir === "back" && state.historyIndex > 0) {
      newIndex--;
    } else if (dir === "forward" && state.historyIndex < state.browserHistory.length - 1) {
      newIndex++;
    }
    
    if (newIndex === state.historyIndex) return {};
    const targetUrl = state.browserHistory[newIndex];
    const updatedTabs = state.browserTabs.map(t => 
      t.id === state.activeTabId 
        ? { ...t, url: targetUrl } 
        : t
    );
    return {
      historyIndex: newIndex,
      browserTabs: updatedTabs
    };
  }),

  clearTranscripts: () => set({ userTranscript: "", miraTranscript: "" }),

  resetAll: () => set({
    status: "disconnected",
    errorMessage: null,
    userTranscript: "",
    miraTranscript: "",
    activeApp: "none",
    toolCalls: [],
    isMuted: false,
    memories: [],
    isScreenSharing: false,
    isScreenSharingPaused: false,
    screenContext: null,
    clickCoordinates: null,
    isMicDenied: false,
    inputVolume: 0,
    miraVolume: 0,
    alarms: [],
    timers: [],
    reminders: [],
    calendarEvents: [],
    currentActionPlan: null
  })
}));
