import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  X, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Disc, 
  Shuffle, 
  Repeat, 
  Volume2, 
  VolumeX, 
  Upload, 
  Sparkles, 
  ListMusic, 
  Radio, 
  Waves,
  Heart,
  Trash2,
  FileAudio,
  Check,
  Plus,
  Loader2
} from "lucide-react";
import { useMiraStore, MusicTrack } from "../../store/useMiraStore";
import { saveAudioFileToDB, loadAllAudioFromDB, deleteAudioFromDB } from "../../lib/musicDb";

interface MusicWidgetProps {
  onClose: () => void;
}

export const PRESET_TRACKS: MusicTrack[] = [
  {
    id: "track-1",
    title: "Monsoon Chai & Sitar Chill",
    artist: "ARIA & Sitar.Chill",
    genre: "bollywood",
    duration: 180,
    description: "Mellow Indian sitar tones with warm vinyl hum & acoustic tabla cadence",
    color: "#f59e0b" // amber
  },
  {
    id: "track-2",
    title: "Sakura Rain Piano",
    artist: "Anime.Nocturne",
    genre: "anime",
    duration: 165,
    description: "Emotional anime grand piano chords with gentle high rain sparkles",
    color: "#ec4899" // pink
  },
  {
    id: "track-3",
    title: "Cozy Lo-Fi Study Beat",
    artist: "Aero.Coffee",
    genre: "lofi",
    duration: 195,
    description: "Smooth jazz electric Rhodes chords with tape flutter & warm sub-groove",
    color: "#8b5cf6" // violet
  },
  {
    id: "track-4",
    title: "Midnight Cyber Tokyo",
    artist: "Neon.Drifter",
    genre: "synthwave",
    duration: 170,
    description: "Punchy retro 80s analog bassline with neon outrun synth arpeggios",
    color: "#06b6d4" // cyan
  },
  {
    id: "track-5",
    title: "432Hz Zen Meditation",
    artist: "ARIA.healing",
    genre: "ambient",
    duration: 240,
    description: "Deep crystal singing bowl harmonics with alpha wave calming drone",
    color: "#10b981" // emerald
  },
  {
    id: "track-6",
    title: "Bollywood Nostalgia Guitar",
    artist: "Sufi.Strings",
    genre: "bollywood",
    duration: 185,
    description: "Indian acoustic nylon guitar fingerpicking with soulful cadence",
    color: "#f97316" // orange
  },
  {
    id: "track-7",
    title: "Synthetic Dreams",
    artist: "Aero.Grid",
    genre: "synthwave",
    duration: 160,
    description: "Lush dreamy analog pad sweeps with warm low-pass filter motion",
    color: "#6366f1" // indigo
  },
  {
    id: "track-8",
    title: "Solar Echoes",
    artist: "Neon.Siren",
    genre: "chill",
    duration: 150,
    description: "Pentatonic melody waterfall cascades with stereo ping-pong shimmer",
    color: "#38bdf8" // sky
  },
  {
    id: "track-9",
    title: "Quantum Pulse",
    artist: "ARIA.synth",
    genre: "synthwave",
    duration: 140,
    description: "Cyber sub-bass heartbeat pulse with celestial digital sparkles",
    color: "#a855f7" // purple
  }
];

const GENRES = [
  { id: "all", label: "All Tracks" },
  { id: "custom", label: "Uploaded Songs 📁" },
  { id: "bollywood", label: "Desi & Chai Chill" },
  { id: "lofi", label: "Lo-Fi Beats" },
  { id: "anime", label: "Anime & Piano" },
  { id: "synthwave", label: "Synthwave" },
  { id: "ambient", label: "Zen Ambient" }
];

export default function MusicWidget({ onClose }: MusicWidgetProps) {
  const music = useMiraStore((state) => state.music);
  const setMusicPlaying = useMiraStore((state) => state.setMusicPlaying);
  const setMusicTrackIndex = useMiraStore((state) => state.setMusicTrackIndex);
  const changeMusicTrack = useMiraStore((state) => state.changeMusicTrack);
  const setMusicVolume = useMiraStore((state) => state.setMusicVolume);
  const setMusicMuted = useMiraStore((state) => state.setMusicMuted);
  const setMusicGenreFilter = useMiraStore((state) => state.setMusicGenreFilter);
  const addCustomTrack = useMiraStore((state) => state.addCustomTrack);
  const removeCustomTrack = useMiraStore((state) => state.removeCustomTrack);
  const setCustomTracks = useMiraStore((state) => state.setCustomTracks);

  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Combined tracks: Preset + Uploaded
  const allTracks = useMemo(() => {
    return [...PRESET_TRACKS, ...(music.customTracks || [])];
  }, [music.customTracks]);

  const activeTrack = allTracks[music.trackIndex % allTracks.length] || PRESET_TRACKS[0];
  const isCustomTrack = Boolean(activeTrack.isCustom && activeTrack.audioUrl);

  const [likedTracks, setLikedTracks] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("mira_liked_tracks");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Web Audio Context refs for real procedural synthesis & visualizer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeNodesRef = useRef<any[]>([]);
  const schedulerIntervalRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  // Frequency wave visualizer bars state
  const [visualizerHeights, setVisualizerHeights] = useState<number[]>([
    20, 45, 75, 50, 90, 60, 85, 40, 65, 30, 80, 55, 70, 35, 60, 40
  ]);

  // Load custom uploaded songs from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;
    loadAllAudioFromDB().then((tracks) => {
      if (isMounted && tracks.length > 0) {
        setCustomTracks(tracks);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [setCustomTracks]);

  // Handle Likes
  const toggleLike = (trackId: string) => {
    setLikedTracks((prev) => {
      const updated = { ...prev, [trackId]: !prev[trackId] };
      localStorage.setItem("mira_liked_tracks", JSON.stringify(updated));
      return updated;
    });
  };

  // Filtered tracks list
  const filteredTracks = useMemo(() => {
    if (music.genreFilter === "all") return allTracks;
    if (music.genreFilter === "custom") return allTracks.filter((t) => t.isCustom);
    return allTracks.filter((t) => t.genre === music.genreFilter);
  }, [allTracks, music.genreFilter]);

  // File Upload Handler (for both file picker and drag-and-drop)
  const processUploadedFiles = async (files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter((file) => 
      file.type.startsWith("audio/") || 
      /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)
    );

    if (audioFiles.length === 0) {
      setUploadMessage("Please select a valid audio file (MP3, WAV, M4A, AAC, FLAC, OGG).");
      setTimeout(() => setUploadMessage(null), 4000);
      return;
    }

    setIsUploading(true);
    setUploadMessage(`Processing ${audioFiles.length} audio song(s)...`);

    try {
      for (const file of audioFiles) {
        const customTrack = await saveAudioFileToDB(file);
        addCustomTrack(customTrack);
      }
      setUploadMessage(`Uploaded "${audioFiles[0].name.replace(/\.[^/.]+$/, "")}" successfully!`);
      setShowPlaylist(false);
    } catch (err: any) {
      console.error("Audio upload error:", err);
      setUploadMessage("Failed to upload audio file. Please try again.");
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadMessage(null), 4500);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFiles(e.target.files);
    }
    // Reset file input value
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(e.dataTransfer.files);
    }
  };

  const handleDeleteCustomTrack = async (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    await deleteAudioFromDB(trackId);
    removeCustomTrack(trackId);
  };

  // Clean up procedural synthesizer nodes
  const stopSynthesizer = () => {
    if (schedulerIntervalRef.current) {
      clearInterval(schedulerIntervalRef.current);
      schedulerIntervalRef.current = null;
    }

    activeNodesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch (e) {
        // Safe ignore
      }
    });
    activeNodesRef.current = [];

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  // Web Audio Synthesis Engine for preset songs
  const startSynthesizer = (trackIdx: number) => {
    stopSynthesizer();

    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") {
      ctx.resume().catch((err) => console.log("Context resume error:", err));
    }

    // Master Volume Gain node
    if (!masterGainRef.current) {
      const master = ctx.createGain();
      master.connect(ctx.destination);
      masterGainRef.current = master;
    }

    const effectiveGain = music.isMuted ? 0 : music.volume * 0.7;
    masterGainRef.current.gain.setValueAtTime(effectiveGain, ctx.currentTime);

    const safeTrackIdx = trackIdx % PRESET_TRACKS.length;

    // Track 0: Monsoon Chai & Sitar Chill
    if (safeTrackIdx === 0) {
      const ragaScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
      const ragaMelody = [0, 2, 4, 3, 5, 4, 2, 0, 4, 5, 7, 5, 4, 2, 0];
      let melIdx = 0;

      const droneOsc1 = ctx.createOscillator();
      const droneOsc2 = ctx.createOscillator();
      const droneGain = ctx.createGain();
      droneOsc1.type = "sawtooth";
      droneOsc1.frequency.setValueAtTime(130.81, ctx.currentTime);
      droneOsc2.type = "triangle";
      droneOsc2.frequency.setValueAtTime(196.00, ctx.currentTime);
      
      const droneFilter = ctx.createBiquadFilter();
      droneFilter.type = "lowpass";
      droneFilter.frequency.setValueAtTime(450, ctx.currentTime);

      droneGain.gain.setValueAtTime(0.04, ctx.currentTime);
      droneOsc1.connect(droneFilter);
      droneOsc2.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(masterGainRef.current);

      droneOsc1.start();
      droneOsc2.start();
      activeNodesRef.current.push(droneOsc1, droneOsc2, droneGain);

      const playSitarNote = () => {
        const now = ctx.currentTime;
        const freq = ragaScale[ragaMelody[melIdx]];
        melIdx = (melIdx + 1) % ragaMelody.length;

        const sitarOsc = ctx.createOscillator();
        sitarOsc.type = "triangle";
        sitarOsc.frequency.setValueAtTime(freq, now);

        const overtoneOsc = ctx.createOscillator();
        overtoneOsc.type = "sawtooth";
        overtoneOsc.frequency.setValueAtTime(freq * 2, now);

        const pluckGain = ctx.createGain();
        pluckGain.gain.setValueAtTime(0, now);
        pluckGain.gain.linearRampToValueAtTime(0.16, now + 0.015);
        pluckGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        const sitarFilter = ctx.createBiquadFilter();
        sitarFilter.type = "bandpass";
        sitarFilter.frequency.setValueAtTime(freq * 1.8, now);
        sitarFilter.Q.setValueAtTime(3.5, now);

        sitarOsc.connect(pluckGain);
        overtoneOsc.connect(pluckGain);
        pluckGain.connect(sitarFilter);
        sitarFilter.connect(masterGainRef.current!);

        sitarOsc.start(now);
        overtoneOsc.start(now);
        sitarOsc.stop(now + 0.7);
        overtoneOsc.stop(now + 0.7);

        activeNodesRef.current.push(sitarOsc, overtoneOsc, pluckGain);
      };

      playSitarNote();
      schedulerIntervalRef.current = setInterval(playSitarNote, 380);

    // Track 1: Sakura Rain Piano
    } else if (safeTrackIdx === 1) {
      const pianoChords = [
        [220.00, 261.63, 329.63, 392.00],
        [174.61, 261.63, 329.63, 440.00],
        [261.63, 329.63, 392.00, 493.88],
        [196.00, 246.94, 293.66, 392.00]
      ];
      let pChordIdx = 0;

      const playPiano = () => {
        const now = ctx.currentTime;
        const chord = pianoChords[pChordIdx];
        pChordIdx = (pChordIdx + 1) % pianoChords.length;

        chord.forEach((freq, idx) => {
          const noteTime = now + idx * 0.18;
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, noteTime);

          const harmonic = ctx.createOscillator();
          harmonic.type = "triangle";
          harmonic.frequency.setValueAtTime(freq * 2, noteTime);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0, noteTime);
          gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 3.2);

          const pianoFilter = ctx.createBiquadFilter();
          pianoFilter.type = "lowpass";
          pianoFilter.frequency.setValueAtTime(1400, noteTime);

          osc.connect(gain);
          harmonic.connect(gain);
          gain.connect(pianoFilter);
          pianoFilter.connect(masterGainRef.current!);

          osc.start(noteTime);
          harmonic.start(noteTime);
          osc.stop(noteTime + 3.3);
          harmonic.stop(noteTime + 3.3);

          activeNodesRef.current.push(osc, harmonic, gain);
        });

        if (Math.random() > 0.4) {
          const rainTime = now + 1.2;
          const sparkle = ctx.createOscillator();
          sparkle.type = "sine";
          sparkle.frequency.setValueAtTime(1046.50 + Math.random() * 500, rainTime);

          const sGain = ctx.createGain();
          sGain.gain.setValueAtTime(0, rainTime);
          sGain.gain.linearRampToValueAtTime(0.04, rainTime + 0.01);
          sGain.gain.exponentialRampToValueAtTime(0.001, rainTime + 0.9);

          sparkle.connect(sGain);
          sGain.connect(masterGainRef.current!);
          sparkle.start(rainTime);
          sparkle.stop(rainTime + 0.95);
          activeNodesRef.current.push(sparkle, sGain);
        }
      };

      playPiano();
      schedulerIntervalRef.current = setInterval(playPiano, 3800);

    // Track 2: Cozy Lo-Fi Study Beat
    } else if (safeTrackIdx === 2) {
      const lofiChords = [
        [277.18, 329.63, 415.30, 493.88],
        [185.00, 277.18, 329.63, 440.00],
        [246.94, 311.13, 369.99, 493.88],
        [164.81, 246.94, 329.63, 392.00]
      ];
      let lofiIdx = 0;

      const playLofi = () => {
        const now = ctx.currentTime;
        const notes = lofiChords[lofiIdx];
        lofiIdx = (lofiIdx + 1) % lofiChords.length;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(800, now);
        filter.connect(masterGainRef.current!);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.14, now + 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 3.6);
        gainNode.connect(filter);

        notes.forEach((freq) => {
          const osc = ctx.createOscillator();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now);
          osc.connect(gainNode);
          osc.start(now);
          osc.stop(now + 3.7);
          activeNodesRef.current.push(osc);
        });

        const bass = ctx.createOscillator();
        bass.type = "sine";
        bass.frequency.setValueAtTime(notes[0] / 2, now);
        const bassGain = ctx.createGain();
        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(0.18, now + 0.05);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
        bass.connect(bassGain);
        bassGain.connect(masterGainRef.current!);
        bass.start(now);
        bass.stop(now + 2.9);

        activeNodesRef.current.push(bass, bassGain, gainNode);
      };

      playLofi();
      schedulerIntervalRef.current = setInterval(playLofi, 3600);

    // Track 3: Midnight Cyber Tokyo
    } else if (safeTrackIdx === 3) {
      const synthScale = [146.83, 174.61, 196.00, 220.00, 261.63, 293.66, 349.23, 392.00];
      const bassSeq = [73.42, 73.42, 87.31, 87.31, 65.41, 65.41, 98.00, 98.00];
      const leadSeq = [3, 5, 4, 6, 5, 7, 6, 4, 3, 2, 4, 5];
      let step = 0;

      const playSynthwave = () => {
        const now = ctx.currentTime;
        const bFreq = bassSeq[step % bassSeq.length];
        const lFreq = synthScale[leadSeq[step % leadSeq.length]];
        step++;

        const bassOsc = ctx.createOscillator();
        bassOsc.type = "sawtooth";
        bassOsc.frequency.setValueAtTime(bFreq, now);

        const bFilter = ctx.createBiquadFilter();
        bFilter.type = "lowpass";
        bFilter.frequency.setValueAtTime(320, now);

        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(0, now);
        bGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        bassOsc.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(masterGainRef.current!);
        bassOsc.start(now);
        bassOsc.stop(now + 0.3);
        activeNodesRef.current.push(bassOsc, bGain);

        const leadOsc = ctx.createOscillator();
        leadOsc.type = "square";
        leadOsc.frequency.setValueAtTime(lFreq, now);

        const lFilter = ctx.createBiquadFilter();
        lFilter.type = "lowpass";
        lFilter.frequency.setValueAtTime(1200, now);

        const lGain = ctx.createGain();
        lGain.gain.setValueAtTime(0, now);
        lGain.gain.linearRampToValueAtTime(0.06, now + 0.02);
        lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        leadOsc.connect(lFilter);
        lFilter.connect(lGain);
        lGain.connect(masterGainRef.current!);
        leadOsc.start(now);
        leadOsc.stop(now + 0.25);
        activeNodesRef.current.push(leadOsc, lGain);
      };

      playSynthwave();
      schedulerIntervalRef.current = setInterval(playSynthwave, 220);

    // Track 4: 432Hz Zen Meditation
    } else if (safeTrackIdx === 4) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const droneGain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(216.00, ctx.currentTime);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(218.50, ctx.currentTime);

      droneGain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc1.connect(droneGain);
      osc2.connect(droneGain);
      droneGain.connect(masterGainRef.current!);

      osc1.start();
      osc2.start();
      activeNodesRef.current.push(osc1, osc2, droneGain);

      const playBowl = () => {
        const now = ctx.currentTime;
        const bowlFreq = 432.00;

        const bOsc = ctx.createOscillator();
        bOsc.type = "sine";
        bOsc.frequency.setValueAtTime(bowlFreq, now);

        const bHarmonic = ctx.createOscillator();
        bHarmonic.type = "sine";
        bHarmonic.frequency.setValueAtTime(bowlFreq * 2.76, now);

        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(0, now);
        bGain.gain.linearRampToValueAtTime(0.14, now + 0.1);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 7.5);

        bOsc.connect(bGain);
        bHarmonic.connect(bGain);
        bGain.connect(masterGainRef.current!);

        bOsc.start(now);
        bHarmonic.start(now);
        bOsc.stop(now + 8.0);
        bHarmonic.stop(now + 8.0);

        activeNodesRef.current.push(bOsc, bHarmonic, bGain);
      };

      playBowl();
      schedulerIntervalRef.current = setInterval(playBowl, 6500);

    // Track 5: Bollywood Nostalgia Guitar
    } else if (safeTrackIdx === 5) {
      const guitarScale = [164.81, 196.00, 220.00, 246.94, 293.66, 329.63, 392.00, 440.00];
      const guitarPattern = [0, 2, 4, 3, 5, 4, 2, 1, 0, 3, 5, 7, 6, 4, 2];
      let gIdx = 0;

      const playGuitar = () => {
        const now = ctx.currentTime;
        const freq = guitarScale[guitarPattern[gIdx]];
        gIdx = (gIdx + 1) % guitarPattern.length;

        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);

        const harm = ctx.createOscillator();
        harm.type = "sine";
        harm.frequency.setValueAtTime(freq * 3, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        const gFilter = ctx.createBiquadFilter();
        gFilter.type = "lowpass";
        gFilter.frequency.setValueAtTime(1800, now);

        osc.connect(gain);
        harm.connect(gain);
        gain.connect(gFilter);
        gFilter.connect(masterGainRef.current!);

        osc.start(now);
        harm.start(now);
        osc.stop(now + 0.9);
        harm.stop(now + 0.9);

        activeNodesRef.current.push(osc, harm, gain);
      };

      playGuitar();
      schedulerIntervalRef.current = setInterval(playGuitar, 320);

    // Track 6: Synthetic Dreams
    } else if (safeTrackIdx === 6) {
      const chords = [
        [261.63, 329.63, 392.00, 493.88],
        [349.23, 440.00, 523.25, 659.25],
        [220.00, 329.63, 392.00, 440.00],
        [196.00, 293.66, 392.00, 440.00],
      ];
      let chordIdx = 0;

      const playChord = () => {
        const now = ctx.currentTime;
        const notes = chords[chordIdx];
        chordIdx = (chordIdx + 1) % chords.length;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(650, now);
        filter.connect(masterGainRef.current!);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.12, now + 1.2);
        gainNode.gain.setValueAtTime(0.12, now + 2.5);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 4.2);
        gainNode.connect(filter);

        notes.forEach((freq) => {
          const osc = ctx.createOscillator();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now);
          osc.connect(gainNode);
          osc.start(now);
          osc.stop(now + 4.2);
          activeNodesRef.current.push(osc);
        });

        activeNodesRef.current.push(gainNode);
      };

      playChord();
      schedulerIntervalRef.current = setInterval(playChord, 4500);

    // Track 7: Solar Echoes
    } else if (safeTrackIdx === 7) {
      const pentatonic = [293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];
      const seq = [0, 2, 4, 3, 5, 4, 6, 5, 7, 6, 4, 2];
      let seqIdx = 0;

      const playNote = () => {
        const now = ctx.currentTime;
        const freq = pentatonic[seq[seqIdx]];
        seqIdx = (seqIdx + 1) % seq.length;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        const delay = ctx.createDelay();
        delay.delayTime.value = 0.2;

        const feedback = ctx.createGain();
        feedback.gain.value = 0.35;

        gainNode.connect(masterGainRef.current!);
        gainNode.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(masterGainRef.current!);

        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(gainNode);

        osc.start(now);
        osc.stop(now + 0.45);

        activeNodesRef.current.push(osc, gainNode);
      };

      playNote();
      schedulerIntervalRef.current = setInterval(playNote, 250);

    // Track 8: Quantum Pulse
    } else {
      let beatToggle = false;

      const playBeat = () => {
        const now = ctx.currentTime;
        const bassOsc = ctx.createOscillator();
        const bassFreq = beatToggle ? 55.00 : 73.42;
        const bassDecay = beatToggle ? 0.75 : 0.55;
        beatToggle = !beatToggle;

        bassOsc.type = "sine";
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        const bassGain = ctx.createGain();
        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(0.25, now + 0.05);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + bassDecay);

        bassOsc.connect(bassGain);
        bassGain.connect(masterGainRef.current!);

        bassOsc.start(now);
        bassOsc.stop(now + bassDecay);

        activeNodesRef.current.push(bassOsc, bassGain);

        if (Math.random() > 0.35) {
          const sparkle = ctx.createOscillator();
          sparkle.type = "sine";
          sparkle.frequency.setValueAtTime(1100 + Math.random() * 1200, now);

          const sparkleGain = ctx.createGain();
          sparkleGain.gain.setValueAtTime(0, now);
          sparkleGain.gain.linearRampToValueAtTime(0.03, now + 0.01);
          sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

          sparkle.connect(sparkleGain);
          sparkleGain.connect(masterGainRef.current!);

          sparkle.start(now);
          sparkle.stop(now + 0.22);

          activeNodesRef.current.push(sparkle, sparkleGain);
        }
      };

      playBeat();
      schedulerIntervalRef.current = setInterval(playBeat, 750);
    }
  };

  // Setup Audio playback routing (Handles both synth and custom uploaded audio)
  useEffect(() => {
    const audioEl = audioElementRef.current;

    // Visualizer animator loop
    const animateVisualizer = () => {
      if (music.isPlaying) {
        setVisualizerHeights((prev) => 
          prev.map(() => Math.floor(Math.random() * 75) + 20)
        );
      }
      animFrameRef.current = requestAnimationFrame(animateVisualizer);
    };

    if (music.isPlaying) {
      animFrameRef.current = requestAnimationFrame(animateVisualizer);

      if (isCustomTrack && activeTrack.audioUrl) {
        // Stop synthesizer
        stopSynthesizer();

        if (audioEl) {
          if (audioEl.src !== activeTrack.audioUrl) {
            audioEl.src = activeTrack.audioUrl;
            audioEl.load();
          }
          audioEl.volume = music.isMuted ? 0 : music.volume;
          audioEl.play().catch((err) => {
            console.log("Audio play error (waiting for user interaction):", err);
          });
        }
      } else {
        // Pause custom audio element
        if (audioEl) {
          audioEl.pause();
        }
        // Start procedural synthesizer
        startSynthesizer(music.trackIndex);
      }
    } else {
      // Paused state
      stopSynthesizer();
      if (audioEl) {
        audioEl.pause();
      }
    }

    return () => {
      stopSynthesizer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music.isPlaying, music.trackIndex, isCustomTrack, activeTrack.audioUrl]);

  // Sync volume & mute changes
  useEffect(() => {
    const effectiveVol = music.isMuted ? 0 : music.volume;

    // Sync custom audio element volume
    if (audioElementRef.current) {
      audioElementRef.current.volume = effectiveVol;
    }

    // Sync master synth gain
    if (masterGainRef.current && audioCtxRef.current) {
      const gain = effectiveVol * 0.7;
      masterGainRef.current.gain.setValueAtTime(gain, audioCtxRef.current.currentTime);
    }
  }, [music.volume, music.isMuted]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopSynthesizer();
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = "";
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch((err) => console.log("Error closing context:", err));
        audioCtxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress ticker effect (For synth procedural tracks)
  useEffect(() => {
    let interval: any = null;
    if (music.isPlaying && !isCustomTrack) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            if (isLooping) {
              changeMusicTrack("next");
              return 0;
            } else {
              setMusicPlaying(false);
              return 100;
            }
          }
          return prev + 1;
        });
      }, (activeTrack.duration * 10)); // 100 steps across total track duration
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [music.isPlaying, isCustomTrack, activeTrack.duration, isLooping, changeMusicTrack, setMusicPlaying]);

  // Audio element event listeners for uploaded tracks
  const handleAudioTimeUpdate = () => {
    if (isCustomTrack && audioElementRef.current) {
      const cur = audioElementRef.current.currentTime;
      const dur = audioElementRef.current.duration || activeTrack.duration;
      if (dur > 0) {
        setProgress(Math.min(100, Math.round((cur / dur) * 100)));
      }
    }
  };

  const handleAudioEnded = () => {
    if (isLooping) {
      changeMusicTrack("next");
      setProgress(0);
    } else {
      setMusicPlaying(false);
      setProgress(100);
    }
  };

  // Playback Control Handlers
  const handlePlayPause = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch((e) => console.log(e));
    }
    setMusicPlaying(!music.isPlaying);
  };

  const handleNextTrack = () => {
    setProgress(0);
    changeMusicTrack("next");
  };

  const handlePrevTrack = () => {
    setProgress(0);
    changeMusicTrack("prev");
  };

  const handleShuffleChange = () => {
    setProgress(0);
    changeMusicTrack("random");
  };

  const handleSelectTrack = (index: number) => {
    setProgress(0);
    setMusicTrackIndex(index);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const posX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, Math.round((posX / rect.width) * 100)));
    setProgress(pct);

    if (isCustomTrack && audioElementRef.current) {
      const dur = audioElementRef.current.duration || activeTrack.duration;
      audioElementRef.current.currentTime = (pct / 100) * dur;
    }
  };

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const currentSeconds = Math.floor((progress / 100) * activeTrack.duration);

  return (
    <div 
      id="mira-music-widget" 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-[#0c0d14]/95 border backdrop-blur-[35px] rounded-[32px] w-[94vw] max-w-md shadow-[0_24px_60px_rgba(0,0,0,0.85)] relative text-white flex flex-col overflow-hidden max-h-[85vh] transition-all ${
        isDragOver ? "border-cyan-400/80 ring-4 ring-cyan-500/20" : "border-white/[0.08]"
      }`}
    >
      {/* Hidden Audio Player for Custom User Uploaded Audio */}
      <audio
        ref={audioElementRef}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
        preload="metadata"
        className="hidden"
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-[#070913]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in border-2 border-dashed border-cyan-400 rounded-[32px]">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(6,182,212,0.4)]">
            <Upload className="w-8 h-8 animate-bounce" />
          </div>
          <h3 className="text-lg font-bold text-white font-sans">Drop your songs here!</h3>
          <p className="text-xs text-cyan-200/70 font-mono mt-1">Supports MP3, WAV, AAC, M4A, FLAC, OGG</p>
        </div>
      )}

      {/* Background glow accent matched to current song */}
      <div 
        className="absolute top-[-20%] left-[-20%] w-[70%] h-[60%] blur-[110px] rounded-full pointer-events-none transition-all duration-700 opacity-25"
        style={{ backgroundColor: activeTrack.color }}
      />
      <div 
        className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[60%] blur-[110px] rounded-full pointer-events-none transition-all duration-700 opacity-20"
        style={{ backgroundColor: activeTrack.color }}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] z-10">
        <div className="flex items-center gap-2.5">
          <div 
            className="p-2 rounded-xl border border-white/10 shadow-inner"
            style={{ backgroundColor: `${activeTrack.color}15`, borderColor: `${activeTrack.color}30` }}
          >
            <Radio className="w-4 h-4" style={{ color: activeTrack.color }} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wider font-mono uppercase text-white leading-none">ARIA Acoustic Engine</h3>
            <span className="text-[9px] text-zinc-400 font-mono tracking-widest mt-0.5 block leading-none">
              {isCustomTrack ? `USER AUDIO • ${activeTrack.fileSize || "CUSTOM"}` : `aria.synth_stream • ${activeTrack.genre.toUpperCase()}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Upload Song Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 rounded-xl border bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-[11px] font-mono font-bold"
            title="Upload audio song (MP3, WAV, AAC, M4A, FLAC)"
            aria-label="Upload Song"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Upload</span>
              </>
            )}
          </button>

          {/* Playlist Drawer Toggle */}
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              showPlaylist 
                ? "bg-white/15 border-white/30 text-white" 
                : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.08]"
            }`}
            title="Browse all tracks & custom uploads"
            aria-label="Toggle Playlist View"
          >
            <ListMusic className="w-4 h-4" />
          </button>

          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer bg-white/[0.03] p-2 rounded-xl hover:bg-white/[0.08] border border-white/[0.06]"
            aria-label="Close Music Selector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Upload Toast Message */}
      {uploadMessage && (
        <div className="px-6 py-2 bg-cyan-950/70 border-b border-cyan-500/30 text-cyan-200 text-xs font-mono flex items-center justify-between z-20 animate-fade-in">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{uploadMessage}</span>
          </div>
          <button onClick={() => setUploadMessage(null)} className="text-cyan-400 hover:text-white ml-2">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-6 space-y-4 overflow-y-auto z-10 custom-scrollbar">

        {/* Category Pills Header */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {GENRES.map((g) => {
            const count = g.id === "custom" ? (music.customTracks?.length || 0) : null;
            return (
              <button
                key={g.id}
                onClick={() => setMusicGenreFilter(g.id)}
                className={`text-[10px] font-mono px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  music.genreFilter === g.id
                    ? "bg-white/15 border-white/30 text-white font-bold shadow-[0_0_12px_rgba(255,255,255,0.15)]"
                    : "bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                }`}
              >
                <span>{g.label}</span>
                {count !== null && count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-200 text-[9px] font-mono font-bold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Toggle between Main Player View vs Playlist Drawer */}
        {!showPlaylist ? (
          <div className="flex flex-col items-center justify-center py-2 space-y-4">
            
            {/* Holographic Vinyl Turntable & Wave Visualizer */}
            <div className="relative my-2 flex items-center justify-center">
              {/* Outer Glowing Visualizer Ring */}
              <div 
                className={`w-36 h-36 rounded-full border border-white/10 flex items-center justify-center shadow-2xl relative transition-all duration-700 ${
                  music.isPlaying ? "animate-spin" : ""
                }`} 
                style={{ 
                  animationDuration: isCustomTrack ? "6s" : "9s",
                  boxShadow: music.isPlaying ? `0 0 35px ${activeTrack.color}35` : "none"
                }}
              >
                {/* Vinyl Grooves */}
                <div className="w-32 h-32 rounded-full border border-white/5 bg-[#07080c] flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border border-white/10 bg-[#090a10] flex items-center justify-center">
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center shadow-inner border"
                      style={{ 
                        backgroundColor: `${activeTrack.color}20`,
                        borderColor: `${activeTrack.color}40`
                      }}
                    >
                      {isCustomTrack ? (
                        <FileAudio className="w-8 h-8 transition-colors" style={{ color: activeTrack.color }} />
                      ) : (
                        <Disc className="w-9 h-9 transition-colors" style={{ color: activeTrack.color }} />
                      )}
                    </div>
                  </div>
                </div>
                {/* Center Spindle */}
                <div className="w-4 h-4 rounded-full bg-[#050508] absolute border border-white/30" />
              </div>

              {/* Dynamic Live Wave Bars on bottom */}
              <div className="absolute -bottom-2 flex items-center gap-1">
                {visualizerHeights.slice(0, 8).map((h, i) => (
                  <div
                    key={`vbar-${i}`}
                    className="w-1 rounded-full transition-all duration-100"
                    style={{
                      height: music.isPlaying ? `${Math.max(4, h * 0.25)}px` : "3px",
                      backgroundColor: activeTrack.color,
                      opacity: music.isPlaying ? 0.85 : 0.3
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Song Meta & Like Button */}
            <div className="text-center w-full px-4">
              <div className="flex items-center justify-center gap-2">
                <h4 className="font-bold font-sans text-base tracking-wide text-white truncate max-w-[260px]">
                  {activeTrack.title}
                </h4>
                <button
                  onClick={() => toggleLike(activeTrack.id)}
                  className="text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title={likedTracks[activeTrack.id] ? "Liked" : "Like Song"}
                  aria-label="Like Track"
                >
                  <Heart 
                    className={`w-4 h-4 ${likedTracks[activeTrack.id] ? "fill-rose-500 text-rose-500" : ""}`} 
                  />
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-400 font-mono tracking-wider">
                  {activeTrack.artist}
                </span>
                {isCustomTrack && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase font-bold">
                    Custom Upload
                  </span>
                )}
              </div>

              <p className="text-[11px] text-zinc-400 mt-1.5 line-clamp-2 px-2">
                {activeTrack.description}
              </p>
            </div>

            {/* Seekable Progress Bar */}
            <div className="w-full px-2">
              <div 
                className="h-1.5 bg-white/10 rounded-full overflow-hidden relative cursor-pointer group" 
                onClick={handleSeek}
              >
                <div 
                  className="h-full rounded-full transition-all relative" 
                  style={{ 
                    width: `${progress}%`,
                    backgroundColor: activeTrack.color,
                    boxShadow: `0 0 10px ${activeTrack.color}80`
                  }} 
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400 font-mono mt-1.5">
                <span>{formatTime(currentSeconds)}</span>
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider">{activeTrack.genre}</span>
                <span>{formatTime(activeTrack.duration)}</span>
              </div>
            </div>

            {/* Master Playback Controls */}
            <div className="flex items-center justify-between w-full px-4 pt-1">
              
              {/* Shuffle / Change Track Button */}
              <button 
                onClick={handleShuffleChange}
                className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.06] transition-all cursor-pointer flex items-center gap-1 text-[11px] font-mono"
                title="Change to random song"
                aria-label="Change Song"
              >
                <Shuffle className="w-4 h-4" />
                <span className="hidden sm:inline">Change</span>
              </button>

              {/* Center Playback Trio */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={handlePrevTrack} 
                  className="p-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer" 
                  aria-label="Previous Track"
                  title="Previous Track"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                
                <button 
                  onClick={handlePlayPause} 
                  className="w-12 h-12 rounded-2xl text-black flex items-center justify-center cursor-pointer shadow-lg transition-all transform active:scale-95 font-bold"
                  style={{ 
                    backgroundColor: activeTrack.color,
                    boxShadow: `0 0 20px ${activeTrack.color}60`
                  }}
                  aria-label={music.isPlaying ? "Pause Track" : "Play Track"}
                  title={music.isPlaying ? "Pause" : "Play"}
                >
                  {music.isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <button 
                  onClick={handleNextTrack} 
                  className="p-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer" 
                  aria-label="Next Track"
                  title="Next Track"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              {/* Loop Toggle */}
              <button 
                onClick={() => setIsLooping(!isLooping)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isLooping 
                    ? "bg-white/10 border-white/20 text-white" 
                    : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200"
                }`}
                title={isLooping ? "Loop Enabled" : "Loop Disabled"}
                aria-label="Toggle Repeat"
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            {/* Volume Control Bar */}
            <div className="w-full bg-white/[0.02] border border-white/[0.04] rounded-2xl p-3 flex items-center gap-3">
              <button
                onClick={() => setMusicMuted(!music.isMuted)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title={music.isMuted ? "Unmute" : "Mute"}
                aria-label="Toggle Mute"
              >
                {music.isMuted || music.volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-zinc-300" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={music.isMuted ? 0 : music.volume}
                onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                title="Master Volume"
              />

              <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">
                {music.isMuted ? "0%" : `${Math.round(music.volume * 100)}%`}
              </span>
            </div>

          </div>
        ) : (
          /* Track List & Upload Area Drawer */
          <div className="space-y-3 py-1">

            {/* Drag and drop upload banner in playlist */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 rounded-2xl p-3.5 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
            >
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono font-bold group-hover:text-white">
                <Plus className="w-4 h-4" />
                <span>Upload Song from Computer (MP3, WAV, M4A)</span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono mt-1">
                Drag & drop any audio file here or click to browse
              </p>
            </div>

            <div className="flex items-center justify-between px-1 text-xs text-zinc-400 font-mono">
              <span className="uppercase tracking-wider">Tracks Library ({filteredTracks.length})</span>
              <button
                onClick={handleShuffleChange}
                className="text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Shuffle className="w-3 h-3" />
                <span>Shuffle Play</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {filteredTracks.map((t) => {
                const originalIndex = allTracks.findIndex((item) => item.id === t.id);
                const isCurrent = music.trackIndex === originalIndex;

                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      handleSelectTrack(originalIndex);
                      setShowPlaylist(false);
                    }}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer group ${
                      isCurrent
                        ? "bg-white/10 border-white/20 shadow-lg text-white"
                        : "bg-white/[0.02] border-white/[0.04] text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate pr-2">
                      <div 
                        className="w-8 h-8 rounded-xl flex items-center justify-center border font-mono text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: `${t.color}20`,
                          borderColor: `${t.color}40`,
                          color: t.color
                        }}
                      >
                        {isCurrent && music.isPlaying ? (
                          <Waves className="w-4 h-4 animate-pulse" />
                        ) : t.isCustom ? (
                          <FileAudio className="w-4 h-4" />
                        ) : (
                          <span>{originalIndex + 1}</span>
                        )}
                      </div>

                      <div className="truncate">
                        <div className="text-xs font-bold font-sans text-white truncate group-hover:text-white flex items-center gap-1.5">
                          <span>{t.title}</span>
                          {likedTracks[t.id] && <Heart className="w-3 h-3 fill-rose-500 text-rose-500 inline shrink-0" />}
                          {t.isCustom && (
                            <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase font-bold shrink-0">
                              Uploaded
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">
                          {t.artist} • <span className="capitalize">{t.genre}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-400">
                        {formatTime(t.duration)}
                      </span>
                      {isCurrent && (
                        <div className="p-1 rounded-full bg-cyan-400/20 text-cyan-300">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                      {t.isCustom && (
                        <button
                          onClick={(e) => handleDeleteCustomTrack(e, t.id)}
                          className="p-1 text-zinc-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10 cursor-pointer"
                          title="Delete uploaded song"
                          aria-label="Delete Song"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom ARIA Voice Sync Status */}
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-2.5 text-center text-[10px] text-indigo-300 font-mono flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>Say &ldquo;ARIA music change karo&rdquo; or &ldquo;Play my uploaded song&rdquo; anytime!</span>
        </div>

      </div>
    </div>
  );
}
