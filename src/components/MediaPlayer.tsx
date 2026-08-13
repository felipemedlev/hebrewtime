"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, Radio, Play, Pause, Volume2, VolumeX } from "lucide-react";

import { resolveEpisodeAudioSrc } from "@/lib/episodeAudio";
import { useT } from "@/lib/i18n/LanguageProvider";

type MediaPlayerProps = {
  audioUrl: string | null;
  episodeTitle: string | null;
  episodeNum: number | null;
  episodeLevel?: string | null;
  isSidebarOpen?: boolean;
  viewMode?: "episodes" | "vocabulary" | "flashcards";
  isMobile?: boolean;
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
  episodeLevel = null,
  isSidebarOpen = false,
  viewMode = "episodes",
  isMobile = false,
}: MediaPlayerProps) {
  const t = useT();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPreviewTime, setScrubPreviewTime] = useState<number | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);
  const lastHighlightDispatchRef = useRef(0);
  const HIGHLIGHT_INTERVAL_MS = 250;

  const isSecondaryView = viewMode === "vocabulary" || viewMode === "flashcards";
  const hideBar = isMobile && isSecondaryView;

  useEffect(() => {
    if (hideBar) {
      document.documentElement.style.setProperty("--media-player-height", "0px");
      return;
    }

    const height = isExpanded ? (isMobile ? "120px" : "108px") : "48px";
    document.documentElement.style.setProperty("--media-player-height", height);
  }, [hideBar, isExpanded, isMobile]);

  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty("--media-player-height");
    };
  }, []);

  useEffect(() => {
    if (isSecondaryView) {
      setIsExpanded(false);
    }
  }, [isSecondaryView, viewMode]);

  // When episode changes, reset playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.load();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setScrubPreviewTime(null);
    setPlaybackError(null);
  }, [audioUrl]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!isScrubbing) {
        const time = audio.currentTime;
        setCurrentTime(time);
        const now = Date.now();
        if (now - lastHighlightDispatchRef.current >= HIGHLIGHT_INTERVAL_MS) {
          lastHighlightDispatchRef.current = now;
          window.dispatchEvent(new CustomEvent("playerTimeUpdate", { detail: time }));
        }
      }
    };
    const onDurationChange = () => setDuration(audio.duration);
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    const onError = () => {
      setPlaybackError(t("noAudio"));
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("loadedmetadata", onDurationChange);
    audio.addEventListener("play",  onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("loadedmetadata", onDurationChange);
      audio.removeEventListener("play",  onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [isScrubbing, t]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaybackError(t("noAudio"));
      }
    } else {
      audio.pause();
    }
  }, [t]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
      window.dispatchEvent(new CustomEvent("playerTimeUpdate", { detail: time }));
    }
    setScrubPreviewTime(null);
    setIsScrubbing(false);
  }, []);



  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayTime = scrubPreviewTime !== null ? scrubPreviewTime : currentTime;

  if (!audioUrl) return null;

  const resolvedUrl = resolveEpisodeAudioSrc(audioUrl, episodeLevel, episodeNum);
  if (!resolvedUrl) return null;

  return (
    <div
      className={`media-player-bar ${isExpanded ? "expanded" : "collapsed"} ${isSidebarOpen ? "sidebar-open" : ""} ${hideBar ? "media-player-hidden" : ""}`}
      aria-hidden={hideBar}
    >
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
            <span className="media-player-title">
              {playbackError ?? episodeTitle ?? t("loading")}
            </span>
          </div>
        </div>
        <button
          className="media-player-toggle"
          aria-label={isExpanded ? t("close") : t("openSidebar")}
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
            aria-label={isPlaying ? t("pause") : t("play")}
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>

          {/* Time + Seek bar group */}
          <div className="mp-seek-group">
            {/* Time labels */}
            <div className="mp-time-row">
              <span className="mp-time">
                {formatTime(displayTime)}
              </span>
              <span className="mp-time mp-time-dur">{formatTime(duration)}</span>
            </div>

            {/* Seek bar */}
            <div className="mp-seek-track-wrap">
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
                aria-label="Seek"
              />
            </div>
          </div>

          {/* Mute */}
          <button
            className="mp-mute-btn"
            onClick={toggleMute}
            aria-label={isMuted ? t("unmute") : t("mute")}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}
