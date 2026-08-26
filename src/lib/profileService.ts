import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import fbConfig from "../../firebase-applet-config.json";

// --- FIRESTORE DIAGNOSTICS & SYSTEM TROUBLESHOOTING ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  const stringified = JSON.stringify(errInfo);
  console.error("Firestore System Error info payload: ", stringified);
  throw new Error(stringified);
}


// Initialize Firebase App
const app = initializeApp(fbConfig);
export const firestore = getFirestore(app, fbConfig.firestoreDatabaseId);

export interface UserProfile {
  name: string;
  gender: "male" | "female";
  onboardingCompleted: boolean;
  enableTypingMode?: boolean;
  wakeWord?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Get or generate a persistent device-specific / user device ID
export function getOrCreateUserId(): string {
  let userId = localStorage.getItem("mira_user_id");
  if (!userId) {
    userId = "usr_" + Math.random().toString(36).substring(2, 17);
    localStorage.setItem("mira_user_id", userId);
  }
  return userId;
}

// --- INDEXEDDB HELPER ---
const DB_NAME = "MiraDB";
const STORE_NAME = "profile_cache";
const DB_VERSION = 1;

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };
    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

export async function saveToIndexedDB(key: string, value: any): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = (event: any) => reject(event.target.error);
    });
  } catch (err) {
    console.error("[IndexedDB] Save error:", err);
  }
}

export async function getFromIndexedDB(key: string): Promise<any> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = (event: any) => resolve(event.target.result);
      request.onerror = (event: any) => reject(event.target.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Error reading key:", key, err);
    return null;
  }
}

// --- SYNC ASSISTANT MEMORIES ---
// Push name, gender, and wakeWord as keys to `/api/memories` so ARIA remembers them on server-side
async function syncToAriaBrain(profile: UserProfile): Promise<void> {
  try {
    const memoriesToSync = [
      { key: "User Name", content: `My name is ${profile.name}` },
      { key: "User Gender", content: `My gender is ${profile.gender}` },
      { key: "Custom Wake Word", content: `My custom wake word / trigger phrase is "${profile.wakeWord || "Hey ARIA"}"` }
    ];

    for (const mem of memoriesToSync) {
      await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mem)
      });
    }
    console.log("[ARIA Brain Sync] Successfully synced profile elements into ARIA memory vault.");
  } catch (err) {
    console.error("[ARIA Brain Sync] Failed to update server-side memory keys:", err);
  }
}

// --- MASTER PROFILE SAVE FUNCTION ---
// Saves synchronously to Firestore, LocalStorage, IndexedDB and Assistant Memory API
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const userId = getOrCreateUserId();
  const timestamp = new Date().toISOString();

  // Explicitly sanitize the profile object to discard any stale/invalid keys
  // from previous app versions (which would violate Firestore security rules)
  const sanitizedProfile: UserProfile = {
    name: profile.name,
    gender: profile.gender,
    onboardingCompleted: profile.onboardingCompleted,
    wakeWord: profile.wakeWord?.trim() || "Hey ARIA"
  };

  if (profile.enableTypingMode !== undefined) {
    sanitizedProfile.enableTypingMode = !!profile.enableTypingMode;
  }
  
  sanitizedProfile.createdAt = profile.createdAt || timestamp;
  sanitizedProfile.updatedAt = timestamp;

  // 1. LocalStorage save
  localStorage.setItem("mira_user_name", sanitizedProfile.name);
  localStorage.removeItem("mira_user_age");
  localStorage.setItem("mira_user_gender", sanitizedProfile.gender);
  localStorage.setItem("mira_user_onboarding_completed", String(sanitizedProfile.onboardingCompleted));
  localStorage.setItem("mira_user_wake_word", sanitizedProfile.wakeWord || "Hey ARIA");
  if (sanitizedProfile.enableTypingMode !== undefined) {
    localStorage.setItem("mira_user_enable_typing_mode", String(sanitizedProfile.enableTypingMode));
  } else {
    localStorage.removeItem("mira_user_enable_typing_mode");
  }

  // 2. IndexedDB write
  await saveToIndexedDB("cached_profile", sanitizedProfile);

  // 3. Firestore save
  try {
    const userDocRef = doc(firestore, "users", userId);
    await setDoc(userDocRef, sanitizedProfile);
    console.log("[Firestore] Synced sanitized user profile document successfully.");
  } catch (firestoreError) {
    console.error("[Firestore] Network sync error (offline caching active):", firestoreError);
    handleFirestoreError(firestoreError, OperationType.WRITE, `users/${userId}`);
  }

  // 4. Update memory endpoint
  await syncToAriaBrain(sanitizedProfile);
}

// --- MASTER PROFILE LOAD FUNCTION ---
export async function loadUserProfile(): Promise<UserProfile | null> {
  // Check LocalStorage first for high-speed delivery
  const localCompleted = localStorage.getItem("mira_user_onboarding_completed") === "true";
  if (localCompleted) {
    const name = localStorage.getItem("mira_user_name") || "";
    const gender = (localStorage.getItem("mira_user_gender") || "male") as "male" | "female";
    const enableTypingMode = localStorage.getItem("mira_user_enable_typing_mode") === "true";
    const wakeWord = localStorage.getItem("mira_user_wake_word") || "Hey ARIA";
    return {
      name,
      gender,
      onboardingCompleted: true,
      enableTypingMode,
      wakeWord
    };
  }

  // Check IndexedDB
  const cached = await getFromIndexedDB("cached_profile");
  if (cached && cached.onboardingCompleted) {
    if (!cached.wakeWord) cached.wakeWord = "Hey ARIA";
    return cached;
  }

  // Check Firestore
  const userId = getOrCreateUserId();
  try {
    const userDocRef = doc(firestore, "users", userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      const wakeWord = data.wakeWord || "Hey ARIA";
      // Populate local caches
      localStorage.setItem("mira_user_name", data.name);
      localStorage.removeItem("mira_user_age");
      localStorage.setItem("mira_user_gender", data.gender);
      localStorage.setItem("mira_user_onboarding_completed", String(data.onboardingCompleted));
      localStorage.setItem("mira_user_wake_word", wakeWord);
      if (data.enableTypingMode !== undefined) {
        localStorage.setItem("mira_user_enable_typing_mode", String(data.enableTypingMode));
      }
      const completeData = { ...data, wakeWord };
      await saveToIndexedDB("cached_profile", completeData);
      return completeData;
    }
  } catch (err) {
    console.error("[Firestore] Load failed:", err);
    handleFirestoreError(err, OperationType.GET, `users/${userId}`);
  }

  return null;
}
