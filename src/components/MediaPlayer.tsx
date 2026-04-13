"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, Radio, Play, Pause, Volume2, VolumeX } from "lucide-react";

type MediaPlayerProps = {
  audioUrl: string | null;
  episodeTitle: string | null;
  episodeNum: number | null;
  isSidebarOpen?: boolean;
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MediaPlayer({
  audioUrl,
  episodeTitle,
  episodeNum,
  isSidebarOpen = false,
}: MediaPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  // Fine-scrub mode: long-press activates it on mobile for precision seeking
  const [fineScrubMode, setFineScrubMode] = useState(false);
  const [scrubPreviewTime, setScrubPreviewTime] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fineScrubAnchorX = useRef<number>(0);
  const fineScrubAnchorTime = useRef<number>(0);
  const fineScrubModeRef = useRef<boolean>(false);

  useEffect(() => {
    fineScrubModeRef.current = fineScrubMode;
  }, [fineScrubMode]);

  // Prevent native range slider jump during fine scrub
  useEffect(() => {
    const input = seekRef.current;
    if (!input) return;
    const preventNative = (e: TouchEvent) => {
      if (fineScrubModeRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    input.addEventListener("touchmove", preventNative, { passive: false });
    return () => input.removeEventListener("touchmove", preventNative);
  }, []);

  // When episode changes, reset playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.load();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setFineScrubMode(false);
    setScrubPreviewTime(null);
  }, [audioUrl]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!isScrubbing) setCurrentTime(audio.currentTime);
    };
    const onDurationChange = () => setDuration(audio.duration);
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("loadedmetadata", onDurationChange);
    audio.addEventListener("play",  onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("loadedmetadata", onDurationChange);
      audio.removeEventListener("play",  onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [isScrubbing]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Normal seek (desktop / coarse touch)
  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (fineScrubModeRef.current) return;
    const time = Number(e.target.value);
    setCurrentTime(time);
    setScrubPreviewTime(time);
  }, []);

  const handleSeekStart = useCallback(() => {
    setIsScrubbing(true);
  }, []);

  const handlePointerUp = useCallback(() => {
    const audio = audioRef.current;
    const seekInput = seekRef.current;
    if (audio && seekInput) {
      const time = Number(seekInput.value);
      audio.currentTime = time;
      setCurrentTime(time);
    }
    setScrubPreviewTime(null);
    setIsScrubbing(false);
    setFineScrubMode(false);
  }, []);

  // ── Fine-scrub (long-press on iOS) ─────────────────────────────────────
  // When user long-presses the seek bar, activate fine-scrub mode.
  // In this mode, horizontal finger movement maps to 10× slower time change,
  // enabling very precise positioning without a thick thumb.

  const activateFineScrub = useCallback((clientX: number) => {
    setFineScrubMode(true);
    fineScrubAnchorX.current = clientX;
    fineScrubAnchorTime.current = currentTime;
  }, [currentTime]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    setIsScrubbing(true);
    const touch = e.touches[0];
    fineScrubAnchorX.current = touch.clientX; // Store initial tap X so we can measure distance
    
    // Start long-press timer → 300 ms activates fine-scrub mode
    longPressTimer.current = setTimeout(() => {
      activateFineScrub(fineScrubAnchorX.current);
    }, 300);
  }, [activateFineScrub]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    const touch = e.touches[0];
    if (fineScrubMode) {
      // Fine-scrub: 1px = 0.1s (10× precision vs normal)
      const deltaX = touch.clientX - fineScrubAnchorX.current;
      const sliderWidth = seekRef.current?.clientWidth ?? 300;
      // Normal: full slider width = duration. Fine: full slider width = duration/10
      const secondsPerPx = duration / sliderWidth / 10;
      const newTime = Math.max(0, Math.min(duration, fineScrubAnchorTime.current + deltaX * secondsPerPx));
      setCurrentTime(newTime);
      setScrubPreviewTime(newTime);
    }
    // Non-fine mode: cancel timer if they move too much before 300ms
    if (longPressTimer.current && Math.abs(touch.clientX - fineScrubAnchorX.current) > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, [fineScrubMode, duration]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    const audio = audioRef.current;
    if (audio) audio.currentTime = currentTime;
    setScrubPreviewTime(null);
    setIsScrubbing(false);
    setFineScrubMode(false);
  }, [currentTime]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayTime = scrubPreviewTime !== null ? scrubPreviewTime : currentTime;

  if (!audioUrl) return null;

  const resolvedUrl = audioUrl.includes("drive.google.com")
    ? `/api/audio?url=${encodeURIComponent(audioUrl)}`
    : audioUrl;

  return (
    <div className={`media-player-bar ${isExpanded ? "expanded" : "collapsed"} ${isSidebarOpen ? "sidebar-open" : ""}`}>
      {/* Hidden native audio element for playback control */}
      <audio
        ref={audioRef}
        src={resolvedUrl}
        preload="metadata"
        style={{ display: "none" }}
      />

      {/* Header strip — always visible */}
      <div className="media-player-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="media-player-info">
          <div className="media-player-icon">
            <Radio size={14} />
          </div>
          <div className="media-player-text">
            {episodeNum !== null && (
              <span className="media-player-ep-num">
                EP {String(episodeNum).padStart(2, "0")}
              </span>
            )}
            <span className="media-player-title">{episodeTitle ?? "Loading…"}</span>
          </div>
        </div>
        <button
          className="media-player-toggle"
          aria-label={isExpanded ? "Collapse player" : "Expand player"}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {/* Custom controls body */}
      {isExpanded && (
        <div className="media-player-body">
          {/* Play / Pause */}
          <button
            className="mp-play-btn"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>

          {/* Time + Seek bar group */}
          <div className="mp-seek-group">
            {/* Time labels */}
            <div className="mp-time-row">
              <span className="mp-time">
                {fineScrubMode && <span className="mp-fine-badge">🔍</span>}
                {formatTime(displayTime)}
              </span>
              <span className="mp-time mp-time-dur">{formatTime(duration)}</span>
            </div>

            {/* Seek bar */}
            <div className={`mp-seek-track-wrap ${fineScrubMode ? "fine-scrub-active" : ""}`}>
              <div
                className="mp-seek-fill"
                style={{ width: `${progress}%` }}
              />
              <input
                ref={seekRef}
                type="range"
                className="mp-seek-input"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeekChange}
                onPointerDown={handleSeekStart}
                onPointerUp={handlePointerUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                aria-label="Seek"
              />
            </div>

            {fineScrubMode && (
              <div className="mp-fine-hint">Precision mode — slide slowly for exact time</div>
            )}
          </div>

          {/* Mute */}
          <button
            className="mp-mute-btn"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}
