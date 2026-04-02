"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Radio } from "lucide-react";

type MediaPlayerProps = {
  audioUrl: string | null;
  episodeTitle: string | null;
  episodeNum: number | null;
};

export default function MediaPlayer({
  audioUrl,
  episodeTitle,
  episodeNum,
}: MediaPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  // When episode changes, reset playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.load();
  }, [audioUrl]);

  if (!audioUrl) return null;

  return (
    <div className={`media-player-bar ${isExpanded ? "expanded" : "collapsed"}`}>
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

      {/* Native HTML5 audio player */}
      {isExpanded && (
        <div className="media-player-body">
          <audio
            ref={audioRef}
            key={audioUrl}
            src={audioUrl.includes("drive.google.com") ? `/api/audio?url=${encodeURIComponent(audioUrl)}` : audioUrl}
            controls
            className="media-audio"
            preload="metadata"
          />
        </div>
      )}
    </div>
  );
}
