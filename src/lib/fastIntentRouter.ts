/**
 * ARIA High-Speed Local Intent Router
 * 
 * Classifies user voice and text queries in <1ms without network calls.
 * Deterministic commands bypass Gemini reasoning and execute native actions immediately.
 */

export type FastIntentType =
  | "OPEN_URL"
  | "OPEN_APPLICATION"
  | "LOCK_PC"
  | "SLEEP_PC"
  | "RESTART_PC"
  | "SHUTDOWN_PC"
  | "SYSTEM_VOLUME"
  | "SYSTEM_SCREENSHOT"
  | "PLAY_MUSIC"
  | "GET_POWER_STATUS"
  | "GET_TIME"
  | "GET_WEATHER"
  | "COMPLEX_ACTION_PLAN"
  | "CONVERSATION";

export interface FastIntentResult {
  intent: FastIntentType;
  isDeterministic: boolean; // True if can execute instantly without Gemini
  action: string;
  toolName: string;
  toolArgs: Record<string, any>;
  spokenResponse: string;
  targetName: string;
  rawQuery: string;
  cleanedQuery: string;
  isHindi: boolean;
  requiresConfirmation?: boolean;
}

// Map of common website domains and trigger aliases
const POPULAR_WEBSITES: Record<string, { url: string; name: string; spoken: string; spokenHindi: string }> = {
  "youtube": {
    url: "https://www.youtube.com",
    name: "YouTube",
    spoken: "Opening YouTube.",
    spokenHindi: "YouTube khol rahi hoon!"
  },
  "google": {
    url: "https://www.google.com",
    name: "Google",
    spoken: "Opening Google.",
    spokenHindi: "Google khol rahi hoon!"
  },
  "gmail": {
    url: "https://mail.google.com",
    name: "Gmail",
    spoken: "Opening Gmail.",
    spokenHindi: "Gmail khol rahi hoon!"
  },
  "chatgpt": {
    url: "https://chatgpt.com",
    name: "ChatGPT",
    spoken: "Opening ChatGPT.",
    spokenHindi: "ChatGPT khol rahi hoon!"
  },
  "github": {
    url: "https://github.com",
    name: "GitHub",
    spoken: "Opening GitHub.",
    spokenHindi: "GitHub khol rahi hoon!"
  },
  "spotify": {
    url: "https://open.spotify.com",
    name: "Spotify",
    spoken: "Opening Spotify.",
    spokenHindi: "Spotify khol rahi hoon!"
  },
  "twitter": {
    url: "https://x.com",
    name: "X Twitter",
    spoken: "Opening X.",
    spokenHindi: "Twitter khol rahi hoon!"
  },
  "x": {
    url: "https://x.com",
    name: "X",
    spoken: "Opening X.",
    spokenHindi: "X khol rahi hoon!"
  },
  "reddit": {
    url: "https://www.reddit.com",
    name: "Reddit",
    spoken: "Opening Reddit.",
    spokenHindi: "Reddit khol rahi hoon!"
  },
  "instagram": {
    url: "https://www.instagram.com",
    name: "Instagram",
    spoken: "Opening Instagram.",
    spokenHindi: "Instagram khol rahi hoon!"
  },
  "facebook": {
    url: "https://www.facebook.com",
    name: "Facebook",
    spoken: "Opening Facebook.",
    spokenHindi: "Facebook khol rahi hoon!"
  },
  "whatsapp": {
    url: "https://web.whatsapp.com",
    name: "WhatsApp Web",
    spoken: "Opening WhatsApp Web.",
    spokenHindi: "WhatsApp Web khol rahi hoon!"
  },
  "netflix": {
    url: "https://www.netflix.com",
    name: "Netflix",
    spoken: "Opening Netflix.",
    spokenHindi: "Netflix khol rahi hoon!"
  },
  "amazon": {
    url: "https://www.amazon.com",
    name: "Amazon",
    spoken: "Opening Amazon.",
    spokenHindi: "Amazon khol rahi hoon!"
  },
  "wikipedia": {
    url: "https://www.wikipedia.org",
    name: "Wikipedia",
    spoken: "Opening Wikipedia.",
    spokenHindi: "Wikipedia khol rahi hoon!"
  }
};

// Map of common local applications
const POPULAR_APPS: Record<string, { appKey: string; name: string; spoken: string; spokenHindi: string }> = {
  "notepad": {
    appKey: "notes",
    name: "Notepad",
    spoken: "Opening Notepad.",
    spokenHindi: "Notepad khol rahi hoon!"
  },
  "notes": {
    appKey: "notes",
    name: "Notes",
    spoken: "Opening Notes.",
    spokenHindi: "Notes khol rahi hoon!"
  },
  "text editor": {
    appKey: "notes",
    name: "Text Editor",
    spoken: "Opening Text Editor.",
    spokenHindi: "Editor khol rahi hoon!"
  },
  "calculator": {
    appKey: "calculator",
    name: "Calculator",
    spoken: "Opening Calculator.",
    spokenHindi: "Calculator khol rahi hoon!"
  },
  "calc": {
    appKey: "calculator",
    name: "Calculator",
    spoken: "Opening Calculator.",
    spokenHindi: "Calculator khol rahi hoon!"
  },
  "vscode": {
    appKey: "notes",
    name: "VS Code",
    spoken: "Opening Visual Studio Code.",
    spokenHindi: "VS Code khol rahi hoon!"
  },
  "vs code": {
    appKey: "notes",
    name: "VS Code",
    spoken: "Opening Visual Studio Code.",
    spokenHindi: "VS Code khol rahi hoon!"
  },
  "chrome": {
    appKey: "browser",
    name: "Google Chrome",
    spoken: "Opening Chrome.",
    spokenHindi: "Chrome khol rahi hoon!"
  },
  "browser": {
    appKey: "browser",
    name: "Browser",
    spoken: "Opening Browser.",
    spokenHindi: "Browser khol rahi hoon!"
  },
  "clock": {
    appKey: "clock",
    name: "Clock",
    spoken: "Opening Clock.",
    spokenHindi: "Clock khol rahi hoon!"
  },
  "alarm": {
    appKey: "clock",
    name: "Alarms & Timers",
    spoken: "Opening Alarms and Timers.",
    spokenHindi: "Alarm and Timer khol rahi hoon!"
  },
  "timer": {
    appKey: "clock",
    name: "Timer",
    spoken: "Opening Timer.",
    spokenHindi: "Timer khol rahi hoon!"
  },
  "weather": {
    appKey: "weather",
    name: "Weather",
    spoken: "Opening Weather.",
    spokenHindi: "Mausam ki jaankari khol rahi hoon!"
  },
  "camera": {
    appKey: "camera",
    name: "Camera",
    spoken: "Opening Camera.",
    spokenHindi: "Camera khol rahi hoon!"
  },
  "task manager": {
    appKey: "notes",
    name: "Task Manager",
    spoken: "Opening Task Manager.",
    spokenHindi: "Task Manager khol rahi hoon!"
  },
  "file explorer": {
    appKey: "notes",
    name: "File Explorer",
    spoken: "Opening File Explorer.",
    spokenHindi: "Files khol rahi hoon!"
  },
  "power": {
    appKey: "power",
    name: "Power & Battery Hub",
    spoken: "Opening Power and Battery Status.",
    spokenHindi: "Battery status khol rahi hoon!"
  },
  "battery": {
    appKey: "power",
    name: "Power & Battery Hub",
    spoken: "Opening Battery Hub.",
    spokenHindi: "Battery status khol rahi hoon!"
  },
  "settings": {
    appKey: "profile_settings",
    name: "Settings",
    spoken: "Opening Settings.",
    spokenHindi: "Settings khol rahi hoon!"
  },
  "memory": {
    appKey: "memory",
    name: "Memory Vault",
    spoken: "Opening Memory Vault.",
    spokenHindi: "Memory Vault khol rahi hoon!"
  }
};

/**
 * Normalizes input text and cleans wake words / polite prefixes
 */
export function normalizeQuery(rawText: string, customWakeWord?: string): { cleaned: string; isHindi: boolean } {
  if (!rawText || typeof rawText !== "string") {
    return { cleaned: "", isHindi: false };
  }

  let text = rawText.trim().toLowerCase().replace(/[.?!,;:]+$/g, "").trim();
  const isHindi = /\b(kholo|khol|karo|chalao|chala|batao|sunao|kijiye|dekhna|kya|mujhe|aawaz|badao|kam|lo|karna|dekh|chahiye|gaana|suno|bhai|lao|band)\b/i.test(text);

  // Strip custom wake word if set
  if (customWakeWord && customWakeWord.trim()) {
    const escaped = customWakeWord.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const customRegex = new RegExp(`^(?:hey|hi|ok|hello|listen)?\\s*(?:${escaped})\\b[,:]?\\s*`, "i");
    text = text.replace(customRegex, "").trim();
  }

  // Strip standard wake words
  const wakeWordRegex = /^(?:hey|hi|ok|hello|listen)?\s*(?:aria|mira|myraa|computer|jarvis|assistant)\b[,:]?\\s*/i;
  text = text.replace(wakeWordRegex, "").trim();

  // Strip polite prefixes
  text = text
    .replace(/^(?:please|can you|could you|would you|kya tum|mujhe|zarra|kindly|just|quickly)\s+/i, "")
    .trim();

  return { cleaned: text, isHindi };
}

/**
 * Classifies a user query in <1ms
 */
export function classifyFastIntent(rawText: string, customWakeWord?: string): FastIntentResult | null {
  const { cleaned, isHindi } = normalizeQuery(rawText, customWakeWord);
  if (!cleaned) return null;

  // Check if compound / multi-step query (e.g. "open youtube, search mrbeast and play video")
  const isCompound = /\b(and then|and also|then search|and search|search .+? and play|aur fir|aur search|and play)\b/i.test(cleaned);
  if (isCompound) {
    return {
      intent: "COMPLEX_ACTION_PLAN",
      isDeterministic: false,
      action: "execute_action_plan",
      toolName: "executeActionPlan",
      toolArgs: { query: cleaned },
      spokenResponse: isHindi ? "Action plan taiyar kar rahi hoon!" : "Executing your request.",
      targetName: "Multi-Step Action",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  // 1. PC POWER COMMANDS (Deterministic)
  // Lock PC
  if (/\b(lock\s+(?:my\s+)?(?:pc|computer|screen|laptop)|pc\s+lock\s+karo|screen\s+lock)\b/i.test(cleaned)) {
    return {
      intent: "LOCK_PC",
      isDeterministic: true,
      action: "lock_pc",
      toolName: "controlSystem",
      toolArgs: { action: "lock_pc" },
      spokenResponse: isHindi ? "Aapka PC lock kar diya hai!" : "Locking your PC now.",
      targetName: "Lock PC",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  // Sleep PC
  if (/\b(put\s+(?:my\s+)?(?:pc|computer|laptop)\s+to\s+sleep|sleep\s+(?:my\s+)?(?:pc|computer|laptop)|pc\s+(?:ko\s+)?sleep\s+mode|sleep\s+mode)\b/i.test(cleaned)) {
    return {
      intent: "SLEEP_PC",
      isDeterministic: true,
      action: "sleep_pc",
      toolName: "controlSystem",
      toolArgs: { action: "sleep_pc" },
      spokenResponse: isHindi ? "PC ko sleep mode me daal rahi hoon." : "Putting your PC to sleep.",
      targetName: "Sleep PC",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  // Shutdown PC (Requires Confirmation)
  if (/\b(shut\s*down\s+(?:my\s+)?(?:pc|computer|laptop)|turn\s+off\s+(?:my\s+)?(?:pc|computer|laptop)|pc\s+band\s+karo|computer\s+band\s+karo)\b/i.test(cleaned)) {
    return {
      intent: "SHUTDOWN_PC",
      isDeterministic: true,
      action: "shutdown_pc",
      toolName: "controlSystem",
      toolArgs: { action: "shutdown_pc" },
      spokenResponse: isHindi ? "Kya aap sach me apna PC shut down karna chahte hain?" : "Are you sure you want to shut down your PC?",
      targetName: "Shutdown PC",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi,
      requiresConfirmation: true
    };
  }

  // Restart PC (Requires Confirmation)
  if (/\b(restart\s+(?:my\s+)?(?:pc|computer|laptop)|reboot\s+(?:my\s+)?(?:pc|computer|laptop)|pc\s+restart\s+karo)\b/i.test(cleaned)) {
    return {
      intent: "RESTART_PC",
      isDeterministic: true,
      action: "restart_pc",
      toolName: "controlSystem",
      toolArgs: { action: "restart_pc" },
      spokenResponse: isHindi ? "Kya aap sach me apna PC restart karna chahte hain?" : "Are you sure you want to restart your PC?",
      targetName: "Restart PC",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi,
      requiresConfirmation: true
    };
  }

  // Battery / Power Status Check
  if (/\b(battery\s*(?:status|percentage|level|percent)?|power\s*(?:status|mode|level)|battery\s+kitni\s+hai|charge\s+kitna\s+hai|charging\s+status)\b/i.test(cleaned)) {
    return {
      intent: "GET_POWER_STATUS",
      isDeterministic: true,
      action: "get_power_status",
      toolName: "controlSystem",
      toolArgs: { action: "get_power_status" },
      spokenResponse: isHindi ? "Battery status check kar rahi hoon!" : "Checking your PC power and battery level.",
      targetName: "Power Status",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  // 2. OPEN WEBSITE COMMANDS (Deterministic)
  // Check for "open/launch/go to [website]" or "[website] kholo" or direct website names
  for (const [key, info] of Object.entries(POPULAR_WEBSITES)) {
    const pattern = new RegExp(`^(?:open|launch|go to|visit|start|browse)?\\s*${key}\\s*(?:kholo|khol do|kholiye|chalao|website|dot com|\\.com)?$`, "i");
    if (pattern.test(cleaned) || cleaned === key) {
      const isAriaBrowser = /\b(in\s+(?:aria|internal|built[- ]?in)\s+browser|inside\s+aria)\b/i.test(cleaned);
      return {
        intent: "OPEN_URL",
        isDeterministic: true,
        action: "open_website",
        toolName: "openWebsite",
        toolArgs: { url: info.url, inAriaBrowser: isAriaBrowser, browserTarget: isAriaBrowser ? "internal" : "external" },
        spokenResponse: isHindi ? info.spokenHindi : info.spoken,
        targetName: info.name,
        rawQuery: rawText,
        cleanedQuery: cleaned,
        isHindi
      };
    }
  }

  // General URL pattern (e.g. "open example.com", "open github.io")
  const urlMatch = cleaned.match(/^(?:open|launch|go to|visit)?\s*([a-zA-Z0-9-]+\.(?:com|org|net|io|dev|app|ai|co|in|edu|gov))(?:\/[^\s]*)?\s*(?:kholo)?$/i);
  if (urlMatch) {
    const domain = urlMatch[1];
    const fullUrl = domain.startsWith("http") ? domain : `https://${domain}`;
    return {
      intent: "OPEN_URL",
      isDeterministic: true,
      action: "open_website",
      toolName: "openWebsite",
      toolArgs: { url: fullUrl, inAriaBrowser: false, browserTarget: "external" },
      spokenResponse: isHindi ? `${domain} khol rahi hoon!` : `Opening ${domain}.`,
      targetName: domain,
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  // 3. OPEN LOCAL APPLICATION COMMANDS (Deterministic)
  for (const [key, info] of Object.entries(POPULAR_APPS)) {
    const pattern = new RegExp(`^(?:open|launch|start)?\\s*${key}\\s*(?:kholo|khol do|kholiye|app|application)?$`, "i");
    if (pattern.test(cleaned) || cleaned === key) {
      return {
        intent: "OPEN_APPLICATION",
        isDeterministic: true,
        action: "open_application",
        toolName: "openApplication",
        toolArgs: { appName: info.appKey, rawAppName: info.name },
        spokenResponse: isHindi ? info.spokenHindi : info.spoken,
        targetName: info.name,
        rawQuery: rawText,
        cleanedQuery: cleaned,
        isHindi
      };
    }
  }

  // 4. SYSTEM VOLUME & MEDIA COMMANDS (Deterministic)
  if (/\b(volume\s+up|increase\s+volume|turn\s+up\s+volume|volume\s+badao|aawaz\s+badao)\b/i.test(cleaned)) {
    return {
      intent: "SYSTEM_VOLUME",
      isDeterministic: true,
      action: "adjust_volume",
      toolName: "controlSystem",
      toolArgs: { action: "adjust_volume", direction: "up" },
      spokenResponse: isHindi ? "Volume bada rahi hoon!" : "Increasing volume.",
      targetName: "Volume Up",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  if (/\b(volume\s+down|decrease\s+volume|turn\s+down\s+volume|volume\s+kam\s+karo|aawaz\s+kam\s+karo)\b/i.test(cleaned)) {
    return {
      intent: "SYSTEM_VOLUME",
      isDeterministic: true,
      action: "adjust_volume",
      toolName: "controlSystem",
      toolArgs: { action: "adjust_volume", direction: "down" },
      spokenResponse: isHindi ? "Volume kam kar rahi hoon!" : "Decreasing volume.",
      targetName: "Volume Down",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  if (/\b(mute|mute\s+audio|mute\s+sound|aawaz\s+band\s+karo)\b/i.test(cleaned)) {
    return {
      intent: "SYSTEM_VOLUME",
      isDeterministic: true,
      action: "toggle_mute",
      toolName: "controlSystem",
      toolArgs: { action: "toggle_mute" },
      spokenResponse: isHindi ? "Audio mute kar diya!" : "Muting audio.",
      targetName: "Mute",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  // Screenshot
  if (/\b(take\s+(?:a\s+)?screenshot|screen\s+capture|capture\s+screen|screenshot\s+lo)\b/i.test(cleaned)) {
    return {
      intent: "SYSTEM_SCREENSHOT",
      isDeterministic: true,
      action: "take_screenshot",
      toolName: "controlSystem",
      toolArgs: { action: "take_screenshot" },
      spokenResponse: isHindi ? "Screenshot le rahi hoon!" : "Taking screenshot.",
      targetName: "Screenshot",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  // Music controls
  if (/\b(change\s+music|next\s+song|next\s+track|song\s+badlo|music\s+badlo|kuch\s+naya\s+sunao)\b/i.test(cleaned)) {
    return {
      intent: "PLAY_MUSIC",
      isDeterministic: true,
      action: "change_track",
      toolName: "controlMusic",
      toolArgs: { action: "change_track" },
      spokenResponse: isHindi ? "Song badal diya hai! Suniye yeh pyara sa track~" : "Playing next track for you!",
      targetName: "Music Player",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  if (/\b(pause\s+music|stop\s+music|gaana\s+roko|music\s+pause)\b/i.test(cleaned)) {
    return {
      intent: "PLAY_MUSIC",
      isDeterministic: true,
      action: "pause",
      toolName: "controlMusic",
      toolArgs: { action: "pause" },
      spokenResponse: isHindi ? "Music pause kar diya!" : "Pausing music.",
      targetName: "Music Pause",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  if (/\b(play\s+music|resume\s+music|gaana\s+chalao|music\s+play)\b/i.test(cleaned)) {
    return {
      intent: "PLAY_MUSIC",
      isDeterministic: true,
      action: "play",
      toolName: "controlMusic",
      toolArgs: { action: "play" },
      spokenResponse: isHindi ? "Music play kar rahi hoon!" : "Playing music.",
      targetName: "Music Play",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  // Time query
  if (/\b(what\s+time\s+is\s+it|current\s+time|time\s+kya\s+hua|time\s+batao|samay\s+kya\s+hai)\b/i.test(cleaned)) {
    return {
      intent: "GET_TIME",
      isDeterministic: true,
      action: "get_time",
      toolName: "getCurrentTime",
      toolArgs: {},
      spokenResponse: isHindi ? "Samay dekh rahi hoon!" : "Checking current time.",
      targetName: "Current Time",
      rawQuery: rawText,
      cleanedQuery: cleaned,
      isHindi
    };
  }

  return null;
}
