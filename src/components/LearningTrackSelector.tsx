"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import type { LevelTrackMeta } from "@/lib/types";

type LearningTrackSelectorProps = {
  tracks: LevelTrackMeta[];
  onSelectLevel: (slug: string) => void;
};

function formatResumeLabel(track: LevelTrackMeta): string {
  if (track.episodeCount === 0) return "No episodes yet";
  if (track.resumeEpisode == null) return "Start from episode 01";
  return `Resume episode ${String(track.resumeEpisode).padStart(2, "0")}`;
}

export default function LearningTrackSelector({
  tracks,
  onSelectLevel,
}: LearningTrackSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTrack = tracks.find((t) => t.isActive) ?? tracks[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!activeTrack) return null;

  const handleSelect = (slug: string) => {
    setIsOpen(false);
    if (slug !== activeTrack.slug) {
      onSelectLevel(slug);
    }
  };

  return (
    <div className="learning-track-selector" ref={containerRef}>
      <button
        type="button"
        className="learning-track-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select learning track"
      >
        <div className="learning-track-trigger-main">
          <div className="learning-track-trigger-title">
            <span className="learning-track-name">{activeTrack.name}</span>
            {activeTrack.cefr ? (
              <span className="learning-track-cefr">{activeTrack.cefr}</span>
            ) : null}
          </div>
          <div className="learning-track-trigger-meta">
            <span>
              {activeTrack.finishedCount} / {activeTrack.episodeCount} finished
            </span>
            <span className="learning-track-dot">·</span>
            <span>{formatResumeLabel(activeTrack)}</span>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`learning-track-chevron ${isOpen ? "open" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          className="learning-track-menu"
          role="listbox"
          aria-label="Learning tracks"
        >
          {tracks.map((track) => (
            <button
              key={track.slug}
              type="button"
              role="option"
              aria-selected={track.isActive}
              className={`learning-track-option ${track.isActive ? "active" : ""}`}
              onClick={() => handleSelect(track.slug)}
            >
              <div className="learning-track-option-header">
                <span className="learning-track-option-name">{track.name}</span>
                {track.cefr ? (
                  <span className="learning-track-cefr">{track.cefr}</span>
                ) : null}
                {track.isActive ? (
                  <Check size={14} className="learning-track-check" aria-hidden="true" />
                ) : null}
              </div>
              <div className="learning-track-option-meta">
                <span>
                  {track.finishedCount} / {track.episodeCount} finished
                </span>
                <span className="learning-track-dot">·</span>
                <span>{formatResumeLabel(track)}</span>
              </div>
              {track.episodeCount > 0 ? (
                <div className="learning-track-progress">
                  <div
                    className="learning-track-progress-fill"
                    style={{
                      width: `${Math.round((track.finishedCount / track.episodeCount) * 100)}%`,
                    }}
                  />
                </div>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
