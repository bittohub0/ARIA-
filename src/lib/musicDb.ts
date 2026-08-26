// IndexedDB storage for persistent user-uploaded music tracks
export interface StoredAudioTrack {
  id: string;
  title: string;
  artist: string;
  genre: "custom";
  duration: number;
  description: string;
  color: string;
  isCustom: true;
  blob: Blob;
  fileSize: string;
  createdAt: number;
}

const DB_NAME = "mira_music_vault_db";
const STORE_NAME = "uploaded_tracks";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const RANDOM_COLORS = [
  "#f43f5e", // rose
  "#ec4899", // pink
  "#d946ef", // fuchsia
  "#8b5cf6", // violet
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f97316", // orange
];

export async function saveAudioFileToDB(file: File): Promise<{
  id: string;
  title: string;
  artist: string;
  genre: "custom";
  duration: number;
  description: string;
  color: string;
  isCustom: true;
  audioUrl: string;
  fileSize: string;
}> {
  const db = await openDB();

  // Clean title from filename
  const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
  const id = `user-track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const color = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];

  // Format file size
  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
  const fileSize = `${sizeMB} MB`;

  // Calculate duration using temporary Audio element
  const audioUrl = URL.createObjectURL(file);
  let duration = 180; // default fallback 3 min

  try {
    const tempAudio = new Audio(audioUrl);
    duration = await new Promise<number>((resolve) => {
      tempAudio.addEventListener("loadedmetadata", () => {
        const dur = Math.round(tempAudio.duration);
        resolve(dur > 0 && Number.isFinite(dur) ? dur : 180);
      });
      tempAudio.addEventListener("error", () => resolve(180));
      setTimeout(() => resolve(180), 3000); // 3s timeout guard
    });
  } catch (err) {
    console.warn("Could not calculate exact audio duration:", err);
  }

  const record: StoredAudioTrack = {
    id,
    title: cleanTitle || "User Uploaded Song",
    artist: "User Audio",
    genre: "custom",
    duration,
    description: `User-uploaded audio track (${fileSize})`,
    color,
    isCustom: true,
    blob: file,
    fileSize,
    createdAt: Date.now()
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return {
    id,
    title: record.title,
    artist: record.artist,
    genre: "custom",
    duration: record.duration,
    description: record.description,
    color: record.color,
    isCustom: true,
    audioUrl,
    fileSize: record.fileSize
  };
}

export async function loadAllAudioFromDB(): Promise<Array<{
  id: string;
  title: string;
  artist: string;
  genre: "custom";
  duration: number;
  description: string;
  color: string;
  isCustom: true;
  audioUrl: string;
  fileSize: string;
}>> {
  try {
    const db = await openDB();
    const records = await new Promise<StoredAudioTrack[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    return records.map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      genre: "custom",
      duration: r.duration,
      description: r.description,
      color: r.color,
      isCustom: true,
      audioUrl: URL.createObjectURL(r.blob),
      fileSize: r.fileSize
    }));
  } catch (err) {
    console.error("Failed to load tracks from IndexedDB:", err);
    return [];
  }
}

export async function deleteAudioFromDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to delete audio from IndexedDB:", err);
  }
}
