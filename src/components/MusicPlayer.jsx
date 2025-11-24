// MusicPlayer.jsx

import React, { useEffect, useRef, useState, useCallback } from "react";
import "./MusicPlayer.css";

/* ---------------------
   Initial songs
   --------------------- */
const initialSampleSongs = [
  { id: "1", title: "SoundHelix Song 1", artist: "SoundHelix", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", color: "#10b981" },
  { id: "2", title: "SoundHelix Song 2", artist: "SoundHelix", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", color: "#f97316" },
];

/* ---------------------
   Helpers
   --------------------- */
const shadeColor = (color, percent) => {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  R = parseInt(R * (1 + percent / 100));
  G = parseInt(G * (1 + percent / 100));
  B = parseInt(B * (1 + percent / 100));

  R = (R < 255) ? R : 255;
  G = (G < 255) ? G : 255;
  B = (B < 255) ? B : 255;

  const RR = ((R.toString(16).length === 1) ? "0" + R.toString(16) : R.toString(16));
  const GG = ((G.toString(16).length === 1) ? "0" + G.toString(16) : G.toString(16));
  const BB = ((B.toString(16).length === 1) ? "0" + B.toString(16) : B.toString(16));

  return "#" + RR + GG + BB;
};

/* ---------------------
   IndexedDB tiny wrapper
   --------------------- */
const idbName = "SandeepMusicPlayerDB";
const idbStoreName = "files";

function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(idbName, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(idbStoreName)) db.createObjectStore(idbStoreName);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbPut(key, value) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(idbStoreName, "readwrite");
    tx.objectStore(idbStoreName).put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(idbStoreName, "readonly");
    const req = tx.objectStore(idbStoreName).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function idbDelete(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(idbStoreName, "readwrite");
    tx.objectStore(idbStoreName).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

/* ---------------------
   Visualizer (unchanged, polished)
   --------------------- */
function Visualizer({ audioRef, primaryColor = "#6366f1", secondaryColor = "#ec4899" }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let mounted = true;

    function setupAnalyser() {
      if (!audioRef?.current) return null;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const source = audioCtxRef.current.createMediaElementSource(audioRef.current);
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.75;
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
        return analyserRef.current;
      } catch {
        return null;
      }
    }

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let analyser = setupAnalyser();
    resizeCanvas();

    const draw = () => {
      if (!mounted) return;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      if (!analyser) {
        const now = Date.now() / 800;
        const g = ctx.createLinearGradient(0, 0, canvas.clientWidth, canvas.clientHeight);
        g.addColorStop(0, hexToRgba(primaryColor, 0.06));
        g.addColorStop(1, hexToRgba(secondaryColor, 0.04));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        ctx.fillStyle = hexToRgba("#ffffff", 0.02 + 0.01 * Math.sin(now));
        ctx.fillRect((canvas.clientWidth / 4) * (Math.sin(now) + 1), 0, canvas.clientWidth / 3, canvas.clientHeight);
      } else {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const barCount = 28;
        const step = Math.floor(bufferLength / barCount);
        const barWidth = canvas.clientWidth / (barCount + 1);
        const gap = barWidth * 0.35;
        const usableBarWidth = barWidth - gap;

        const bg = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight);
        bg.addColorStop(0, hexToRgba(primaryColor, 0.06));
        bg.addColorStop(1, hexToRgba(secondaryColor, 0.04));
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

        for (let i = 0; i < barCount; i++) {
          const idx = i * step;
          const value = dataArray[idx] || 0;
          const percent = value / 255;
          const barHeight = Math.max(6, percent * canvas.clientHeight * 0.86);

          const x = i * (usableBarWidth + gap) + gap / 2;
          const y = canvas.clientHeight - barHeight;

          const grd = ctx.createLinearGradient(x, y, x, canvas.clientHeight);
          grd.addColorStop(0, hexToRgba(secondaryColor, 1));
          grd.addColorStop(0.5, hexToRgba(primaryColor, 1));
          grd.addColorStop(1, hexToRgba("#000000", 0.14));
          ctx.fillStyle = grd;

          const radius = usableBarWidth * 0.35;
          roundRect(ctx, x, y, usableBarWidth, barHeight, radius);
          ctx.fill();

          ctx.shadowColor = hexToRgba(primaryColor, 0.14);
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    const trySetupInterval = setInterval(() => {
      if (!analyser && audioRef && audioRef.current) {
        analyser = setupAnalyser();
      }
    }, 400);

    rafRef.current = requestAnimationFrame(draw);

    let rtid;
    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      if (rtid) clearTimeout(rtid);
      rtid = setTimeout(() => {
        resizeCanvas();
        rafRef.current = requestAnimationFrame(draw);
      }, 120);
    };
    window.addEventListener("resize", onResize);

    return () => {
      mounted = false;
      clearInterval(trySetupInterval);
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (analyserRef.current) {
        try { analyserRef.current.disconnect(); } catch {}
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        try { audioCtxRef.current.close(); } catch {}
      }
    };
  }, [audioRef, primaryColor, secondaryColor]);

  function hexToRgba(hex, alpha = 1) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  return (
    <div className="mp-visualizer glass">
      <canvas ref={canvasRef} className="mp-visual-canvas" style={{ width: "100%", height: "100%" }} />
      <div className="mp-visual-label">Now Playing</div>
    </div>
  );
}

/* ---------------------
   Main Player
   --------------------- */
export default function MusicPlayer() {
  const audioRef = useRef(null);
  const createdBlobUrlsRef = useRef(new Set());
  const [playlist, setPlaylist] = useState(() => {
    try {
      const raw = localStorage.getItem("music_playlist");
      if (!raw) return initialSampleSongs.slice();
      const parsed = JSON.parse(raw);
      // parsed entries may already include storageKey or remote url
      return parsed.map((t) => ({ ...t, color: t.color || "#6366f1" }));
    } catch {
      return initialSampleSongs.slice();
    }
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.9);
  const [shuffle, setShuffle] = useState(false);
  const [loop, setLoop] = useState(false);

  const current = playlist[currentIndex] || null;
  const audio = audioRef.current;

  // dynamic theming from current track
  const primaryColor = current?.color || "#6366f1";
  const secondaryColor = shadeColor(primaryColor, 20);
  useEffect(() => {
    document.documentElement.style.setProperty("--dynamic-primary", primaryColor);
    document.documentElement.style.setProperty("--dynamic-secondary", secondaryColor);
  }, [primaryColor, secondaryColor]);

  // Save playlist to localStorage — but do NOT store large blob URLs.
  useEffect(() => {
    try {
      const safeToStore = playlist.map((item) => {
        if (item.storageKey) {
          // store pointer to IndexedDB file
          return { id: item.id, title: item.title, artist: item.artist, color: item.color, storageKey: item.storageKey, local: true };
        }
        // If item has a remote URL (http/https) store as-is.
        if (item.url && typeof item.url === "string" && (item.url.startsWith("http://") || item.url.startsWith("https://"))) {
          return { ...item };
        }
        // Otherwise store metadata only.
        return { id: item.id, title: item.title, artist: item.artist, color: item.color };
      });
      localStorage.setItem("music_playlist", JSON.stringify(safeToStore));
    } catch {}
  }, [playlist]);

  // On mount: try to rehydrate any storageKey entries from IndexedDB
  useEffect(() => {
    let mounted = true;
    (async () => {
      // iterate playlist, restore files where storageKey exists but url is missing
      for (let i = 0; i < playlist.length; i++) {
        const item = playlist[i];
        if (item.storageKey && !item.url) {
          try {
            const file = await idbGet(item.storageKey);
            if (mounted && file instanceof Blob) {
              const url = URL.createObjectURL(file);
              createdBlobUrlsRef.current.add(url);
              setPlaylist((cur) => {
                const copy = cur.slice();
                const idx = copy.findIndex((x) => x.id === item.id);
                if (idx > -1) copy[idx] = { ...copy[idx], url };
                return copy;
              });
            }
          } catch {
            // ignore missing file in idb
          }
        }
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ensure audio reloads when current changes (important for blob URLs)
  useEffect(() => {
    if (!audio) return;
    audio.pause();
    if (current?.url) {
      if (audio.src !== current.url) {
        try { audio.src = current.url; } catch {}
      }
    } else {
      audio.removeAttribute("src");
    }
    try { audio.load(); } catch {}
    if (isPlaying) {
      const p = audio.play();
      if (p && typeof p.then === "function") p.catch(() => setIsPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.url]);

  // timeupdate, loadedmetadata, ended
  useEffect(() => {
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;

    const onTime = () => setProgress(audio.currentTime);
    const onLoadedMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (loop) {
        audio.currentTime = 0;
        audio.play();
      } else {
        handleNext();
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("ended", onEnded);

    if (!isNaN(audio.duration) && audio.duration > 0) setDuration(audio.duration);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, loop, isMuted, volume, audio]);

  // cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      createdBlobUrlsRef.current.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch {}
      });
      createdBlobUrlsRef.current.clear();
    };
  }, []);

  function togglePlay() {
    setIsPlaying((s) => !s);
  }

  function selectAndPlay(idx) {
    if (idx === currentIndex) {
      togglePlay();
    } else {
      setCurrentIndex(idx);
      setIsPlaying(true);
      setProgress(0);
    }
  }

  const handlePrev = useCallback(() => {
    if (!playlist.length) return;
    if (progress > 5 && audio) { audio.currentTime = 0; setProgress(0); return; }
    setCurrentIndex((i) => (i > 0 ? i - 1 : playlist.length - 1));
    setIsPlaying(true);
  }, [playlist.length, progress, audio]);

  const handleNext = useCallback(() => {
    if (!playlist.length) return;
    setCurrentIndex((i) => {
      if (shuffle) {
        let newIndex = Math.floor(Math.random() * playlist.length);
        while (playlist.length > 1 && newIndex === i) newIndex = Math.floor(Math.random() * playlist.length);
        return newIndex;
      }
      return i < playlist.length - 1 ? i + 1 : 0;
    });
    setIsPlaying(true);
  }, [playlist.length, shuffle]);

  function onSeek(e) {
    const val = parseFloat(e.target.value);
    if (audio) audio.currentTime = val;
    setProgress(val);
  }

  function onVolume(e) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setIsMuted(v === 0);
  }

  function toggleMute() {
    if (isMuted) { setVolume(prevVolume > 0 ? prevVolume : 0.1); setIsMuted(false); }
    else { setPrevVolume(volume); setVolume(0); setIsMuted(true); }
  }

  // Add file: save to IndexedDB and create blob URL for immediate playback
  async function addLocalFile(file) {
    const id = Date.now().toString() + "-" + Math.floor(Math.random() * 1000);
    const storageKey = `file-${id}`;
    try {
      await idbPut(storageKey, file);
    } catch (err) {
      console.warn("IndexedDB put failed, file won't persist:", err);
    }
    const url = URL.createObjectURL(file);
    if (url.startsWith("blob:")) createdBlobUrlsRef.current.add(url);

    setPlaylist((p) => [...p, {
      id,
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Local",
      url,
      storageKey,
      color: "#f97316",
    }]);
    // select the newly added item
    setTimeout(() => {
      setCurrentIndex((prev) => {
        // new item index is old length (state update asynchronous, but setTimeout ensures playlist updated)
        return playlist.length;
      });
      setIsPlaying(true);
    }, 50);
  }

  // file input handler — add all files and select first
  function handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // add files in order
    files.forEach((f) => addLocalFile(f));
    e.target.value = null;
  }

  // remove track: revoke blob + delete idb entry if present
  function removeTrack(id) {
    setPlaylist((p) => {
      const removed = p.find((s) => s.id === id);
      const newPlaylist = p.filter((s) => s.id !== id);

      if (removed) {
        if (removed.url && typeof removed.url === "string" && removed.url.startsWith("blob:")) {
          try { URL.revokeObjectURL(removed.url); createdBlobUrlsRef.current.delete(removed.url); } catch {}
        }
        if (removed.storageKey) {
          idbDelete(removed.storageKey).catch(() => {/* ignore */});
        }
      }

      const removedIndex = p.findIndex((s) => s.id === id);
      if (removedIndex === currentIndex) {
        const newIndex = Math.min(removedIndex, newPlaylist.length - 1);
        setCurrentIndex(newIndex < 0 ? 0 : newIndex);
        if (newPlaylist.length === 0) setIsPlaying(false);
      } else if (removedIndex < currentIndex) {
        setCurrentIndex((i) => Math.max(0, i - 1));
      }

      return newPlaylist;
    });
  }

  function formatTime(sec) {
    if (!sec || isNaN(sec) || sec === Infinity) return "N/A";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4.2 3.6L2.9 4.9l.6.6l.8.8L21 21l-1.4 1.4L18 20.3v-2.1l-2-2v4h-4V9h-1.4l-4-4L4.2 3.6zm15.1 8l-2.4-2.4l.7-.7l1.7 1.7L16.5 13H21v-2h-3.4zm-1.8 0L14.7 9.5l-.7-.7l1.7 1.7L18.9 13H21v-2h-3.4zM16 4v1.8l-4-4V3H9.4l-3.5 3.5l1.4 1.4L9 8.3v4.4l3 3V12h3v8h-4v-4H8v-2.3l-2-2V16H4V8h1.4l-4-4L0 4.2L4.2 0L19.8 15.6L21 17l.7-.7L19.3 4z"/></svg>);
    if (volume < 0.5) return (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3.23v2.06c2.89 1.13 5 3.99 5 7.71s-2.11 6.58-5 7.71v2.06c4.01-1.39 7-5.18 7-9.77s-2.99-8.38-7-9.77zM9 16h3v-8H9V4H5v16h4v-4z"/></svg>);
    return (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 7.91v8.18c2.47-1.14 4-3.66 4-6.09s-1.53-4.95-4-6.09zm-2-5.46v2.06c2.89 1.13 5 3.99 5 7.71s-2.11 6.58-5 7.71v2.06c4.01-1.39 7-5.18 7-9.77s-2.99-8.38-7-9.77zM9 16h3v-8H9V4H5v16h4v-4z"/></svg>);
  };

  /* -------------------------
     Render (variables only)
     ------------------------- */
  const headerBrand = (
    <div className="mp-brand">
      <div className="mp-logo">🎵</div>
      <div>
        <div className="mp-title">Sandeep's </div>
        <div className="mp-sub"> Music </div>
      </div>
    </div>
  );

  const prevButton = (
    <button className="icon-btn" onClick={handlePrev} title="Previous (←)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M11 18V6l-8 6 8 6zM13 6v12h2V6h-2z" fill="currentColor"/></svg>
    </button>
  );

  const playCircleButton = (
    <button className={`play-circle ${isPlaying ? "is-playing" : ""}`} onClick={() => selectAndPlay(currentIndex)} title={isPlaying ? "Pause (Space)" : "Play (Space)"} aria-label={isPlaying ? "Pause" : "Play"}>
      {isPlaying ? (<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>) : (<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>)}
    </button>
  );

  const nextButton = (
    <button className="icon-btn" onClick={handleNext} title="Next (→)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 6v12l8-6-8-6zM3 6v12h2V6H3z" fill="currentColor"/></svg>
    </button>
  );

  const headerMeta = (
    <div className="mp-meta">
      <div className="mp-current-title" title={current?.title || "No track selected"}>{current?.title || "No track selected"}</div>
      <div className="mp-current-artist" title={current?.artist || "—"}>{current?.artist || "—"}</div>
    </div>
  );

  const headerNav = (
    <nav className="mp-controls">
      {prevButton}
      {playCircleButton}
      {nextButton}
      {headerMeta}
    </nav>
  );

  // audio element: playsInline + crossOrigin
  const audioElement = (
    <audio ref={audioRef} src={current?.url} playsInline crossOrigin="anonymous" />
  );

  const seekerRange = (
    <input className="range" type="range" min={0} max={duration || 0} step="0.01" value={progress || 0} onChange={onSeek} disabled={!audio || isNaN(duration) || duration === 0} />
  );

  const seekerTime = (
    <div className="mp-time">
      <span>{formatTime(progress)}</span>
      <span>{formatTime(duration)}</span>
    </div>
  );

  const muteButton = (<button className="icon-btn vol-icon" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>{getVolumeIcon()}</button>);
  const volumeRange = (<input className="range small" type="range" min={0} max={1} step="0.01" value={volume} onChange={onVolume} title={`Volume: ${Math.round(volume * 100)}%`} />);
  const shuffleChip = (<button className={`chip ${shuffle ? "active" : ""}`} onClick={() => setShuffle((s) => !s)} title="Toggle Shuffle">Shuffle</button>);
  const loopChip = (<button className={`chip ${loop ? "active" : ""}`} onClick={() => setLoop((l) => !l)} title="Toggle Loop">Loop</button>);
  const equalizer = <Equalizer playing={isPlaying} />;

  const playerBottomLeft = (<div className="mp-left">{muteButton}{volumeRange}<div className="mp-toggle">{shuffleChip}{loopChip}</div></div>);
  const playerBottomRight = (<div className="mp-eq">{equalizer}</div>);

  const playerSection = (
    <section className="mp-player glass">
      {audioElement}
      <div className="mp-seeker">{seekerRange}{seekerTime}</div>
      <div className="mp-bottom">{playerBottomLeft}{playerBottomRight}</div>
    </section>
  );

  const playlistHeader = (<div className="playlist-head"><h3>Playlist</h3><div className="playlist-meta">Total: {playlist.length} tracks</div></div>);

  const playlistRows = playlist.map((t, i) => {
    const active = i === currentIndex;
    const playingThis = active && isPlaying;
    const isPlayable = !!t.url;
    return (
      <div key={t.id} className={`playlist-row ${active ? "active" : ""}`} style={active ? { '--row-accent': t.color } : {}}>
        <div className="track-info" onClick={() => isPlayable && selectAndPlay(i)} title={t.title}>
          <div className="track-index">#{i + 1}</div>
          <div className="track-meta">
            <div className="track-title">{t.title}{!t.url && <span className="missing-note"> • upload to play</span>}</div>
            <div className="track-artist">{t.artist}</div>
          </div>
        </div>

        <div className="track-actions">
          <button className={`small-btn ${playingThis ? "stop" : "play"} ${!isPlayable ? "disabled" : ""}`} onClick={() => isPlayable ? selectAndPlay(i) : null} aria-label={playingThis ? "Pause" : (isPlayable ? "Play" : "Missing")} title={isPlayable ? (playingThis ? "Pause" : "Play") : "File not available — re-upload to play"} disabled={!isPlayable}>
            {playingThis ? (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>) : (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>)}
          </button>

          <button className="small-btn remove" onClick={() => removeTrack(t.id)} title="Remove Track">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
    );
  });

  const playlistFooter = (
    <div className="playlist-footer">
      <label className="file-label">
        <input type="file" accept="audio/*" multiple onChange={handleFileUpload} />
        <span>ADD SONG⬆️</span>
      </label>
      <div className="small-muted">Tip: Uploaded files persist (saved in your browser).</div>
    </div>
  );

  const playlistSection = (<aside className="mp-playlist glass">{playlistHeader}<div className="playlist-list">{playlistRows}</div>{playlistFooter}</aside>);

  const headerSection = (<header className="mp-header">{headerBrand}{headerNav}</header>);
  const mainSection = (<main className="mp-main">{playerSection}{playlistSection}</main>);

  return (<div className="mp-root">{headerSection}{mainSection}</div>);
}

/* small animated equalizer */
function Equalizer({ playing }) {
  return (
    <div className={`eq ${playing ? "eq-play" : ""}`} aria-hidden>
      <span className="bar" style={{ animationDelay: "0s" }} />
      <span className="bar" style={{ animationDelay: "0.12s" }} />
      <span className="bar" style={{ animationDelay: "0.22s" }} />
      <span className="bar" style={{ animationDelay: "0.06s" }} />
    </div>
  );
}