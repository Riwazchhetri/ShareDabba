import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Share2,
  Flag,
  Subtitles,
  Check,
  SkipForward,
  Sliders,
} from 'lucide-react';
import { FileRecord, MonetizationRulesRecord } from '../types';
import { AdPreferenceMode, getAdFrequencyCapForPreference } from '../utils/monetization';
import { ShareDabbaLogo, formatDuration, QrCodeMatrix } from './MediaArtwork';

interface ShareDabbaPlayerProps {
  file: FileRecord;
  rules: MonetizationRulesRecord | null;
  adPreference: AdPreferenceMode;
  onChangeAdPreference: (pref: AdPreferenceMode) => void;
  onPlaybackVerified?: (updatedStats: {
    viewsCount: number;
    monetizedViewsCount: number;
    estimatedEarningsUsd: string;
  }) => void;
  onReportFile?: (file: FileRecord) => void;
  onOpenCreatorProfile?: (username: string) => void;
}

export const ShareDabbaPlayer: React.FC<ShareDabbaPlayerProps> = ({
  file,
  rules,
  adPreference,
  onChangeAdPreference,
  onPlaybackVerified,
  onReportFile,
  onOpenCreatorProfile,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const totalDuration = file.durationSeconds > 0 ? file.durationSeconds : 300;
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [quality, setQuality] = useState<string>('1080p');
  const [captionsOn, setCaptionsOn] = useState<boolean>(true);

  // VAST Ad State
  const [adActive, setAdActive] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [adCompletedInSession, setAdCompletedInSession] = useState(false);
  const [verifiedImpressionBanner, setVerifiedImpressionBanner] = useState<string | null>(null);
  const [verifyingServer, setVerifyingServer] = useState(false);

  // Modals / Popovers
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showAdPrefPanel, setShowAdPrefPanel] = useState(false);

  const prefCap = getAdFrequencyCapForPreference(adPreference);

  // Reset player state when file changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setAdActive(false);
    setAdCompletedInSession(false);
    setVerifiedImpressionBanner(null);
  }, [file.slug]);

  // Draw procedural cinema frame on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#09090B';
    ctx.fillRect(0, 0, w, h);

    // Subtle architectural grid & animated geometry based on currentTime
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    const offset = (currentTime * 24) % 64;
    for (let x = -offset; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Center studio focal frame
    ctx.strokeStyle = adActive ? '#F59E0B' : '#1D4ED8';
    ctx.lineWidth = 2;
    const pulse = Math.sin(currentTime * 1.8) * 14;
    ctx.strokeRect(w * 0.22 - pulse * 0.5, h * 0.2, w * 0.56 + pulse, h * 0.56);

    // Waveform bars at bottom of frame
    ctx.fillStyle = adActive ? '#F59E0B' : '#3B82F6';
    for (let i = 0; i < 36; i++) {
      const barH =
        isPlaying || adActive
          ? 10 + Math.abs(Math.sin(currentTime * 4 + i * 0.45)) * 38
          : 6 + (i % 3) * 4;
      ctx.fillRect(w * 0.22 + i * ((w * 0.56) / 36), h * 0.72 - barH, 8, barH);
    }

    // Timecode watermark
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '500 13px "IBM Plex Mono", monospace';
    ctx.fillText(
      `TC ${formatDuration(currentTime)} / ${formatDuration(totalDuration)} · ${quality} · ${playbackSpeed}x`,
      24,
      34
    );
  }, [currentTime, isPlaying, adActive, quality, playbackSpeed, totalDuration]);

  // Timer loop for VAST Pre-Roll or Main Video Playback
  useEffect(() => {
    if (!isPlaying && !adActive) return;

    const timer = window.setInterval(() => {
      if (adActive) {
        setAdCountdown((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      } else if (isPlaying) {
        setCurrentTime((prev) => {
          if (prev + playbackSpeed >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return prev + playbackSpeed;
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying, adActive, playbackSpeed, totalDuration]);

  const triggerServerVerifiedImpression = async (watchSec: number) => {
    if (verifyingServer) return;
    setVerifyingServer(true);
    try {
      const res = await fetch('/api/playback/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: file.slug,
          watchDurationSeconds: Math.max(6, watchSec),
          verifiedAdImpression: true,
          placement: 'pre_roll',
          viewerCountry: 'IN',
          adPreference,
          deviceCategory: window.innerWidth < 768 ? 'Mobile' : 'Desktop',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (onPlaybackVerified) {
          onPlaybackVerified({
            viewsCount: data.viewsCount,
            monetizedViewsCount: data.monetizedViewsCount,
            estimatedEarningsUsd: data.estimatedEarningsUsd,
          });
        }
        const earned = data.calculation?.creatorEarnedUsd ?? 0.002;
        const modeLabel =
          data.calculation?.modeApplied === 'revenue_share' ? 'Revenue Share' : 'Fixed CPM';
        setVerifiedImpressionBanner(
          `Verified VAST 4.2 Impression recorded (${modeLabel}: +$${Number(earned).toFixed(4)} USD credited to creator ledger)`
        );
      }
    } catch (e) {
      console.error('Playback verification error:', e);
    } finally {
      setVerifyingServer(false);
    }
  };

  const handlePlayToggle = () => {
    if (adActive) return;
    if (!isPlaying && !adCompletedInSession) {
      // Trigger VAST Pre-Roll Ad before content playback
      setAdActive(true);
      setAdCountdown(prefCap.countdownSeconds);
      return;
    }
    setIsPlaying((prev) => !prev);
  };

  const handleCompleteOrSkipAd = async () => {
    setAdActive(false);
    setAdCompletedInSession(true);
    setIsPlaying(true);
    await triggerServerVerifiedImpression(Math.max(6, Math.round(currentTime + 6)));
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const shareUrl = `${window.location.origin}/?v=${encodeURIComponent(file.slug)}`;

  const handleCopyShareLink = () => {
    navigator.clipboard?.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ') {
            e.preventDefault();
            handlePlayToggle();
          } else if (e.key.toLowerCase() === 'm') {
            setIsMuted((m) => !m);
          } else if (e.key.toLowerCase() === 'f') {
            handleFullscreen();
          } else if (e.key === 'ArrowRight' && !adActive) {
            setCurrentTime((t) => Math.min(totalDuration, t + 10));
          } else if (e.key === 'ArrowLeft' && !adActive) {
            setCurrentTime((t) => Math.max(0, t - 10));
          }
        }}
        aria-label={`ShareDabba Video Player: ${file.title}`}
        className="relative bg-neutral-950 text-white rounded-lg overflow-hidden border border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
      >
        {/* Top Player Brand Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-black/80 border-b border-neutral-800/80 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShareDabbaLogo className="w-4 h-4 text-white shrink-0" />
            <span className="font-semibold tracking-tight text-white truncate">{file.title}</span>
            <span className="text-neutral-500 hidden sm:inline">·</span>
            <button
              type="button"
              onClick={() => onOpenCreatorProfile && onOpenCreatorProfile('arjunmehta')}
              className="text-neutral-300 hover:text-white underline-offset-4 hover:underline hidden sm:inline whitespace-nowrap"
            >
              @arjunmehta
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAdPrefPanel((s) => !s)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 transition-colors whitespace-nowrap"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>Plan: {adPreference === 'more' ? 'Max Ads ($3.00)' : 'Balanced ($2.00)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowShareModal((s) => !s)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 transition-colors whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            {onReportFile && (
              <button
                type="button"
                onClick={() => onReportFile(file)}
                aria-label="Report video"
                className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors whitespace-nowrap"
              >
                <Flag className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Report</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Video Surface */}
        <div className="relative aspect-video w-full bg-neutral-950 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            className="w-full h-full object-cover cursor-pointer"
            onClick={handlePlayToggle}
          />

          {/* Pre-Roll VAST Advertisement Overlay */}
          {adActive && (
            <div className="absolute inset-0 bg-black/90 flex flex-col justify-between p-6 z-20">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono text-amber-400">
                  Advertisement · VAST 4.2 Verified Placement ({adPreference.toUpperCase()} MODE)
                </div>
                <div className="text-xs font-mono tabular-nums text-neutral-300">
                  {adCountdown > 0 ? `Ad ends in ${adCountdown}s` : 'Eligible to skip or continue'}
                </div>
              </div>

              <div className="max-w-lg mx-auto text-center space-y-3 my-auto">
                <p className="text-xs font-mono text-neutral-400">SPONSORED INFRASTRUCTURE SPOTLIGHT</p>
                <h4 className="text-xl font-bold text-white">
                  Cloudflare R2 + ShareDabba Edge Media Delivery
                </h4>
                <p className="text-sm text-neutral-300">
                  Zero-egress multi-region video distribution with verified creator CPM monetization.
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-neutral-800 pt-4">
                <span className="text-xs text-neutral-400">
                  Target Creator Rate: ${rules?.targetCpmUsd || '2.00'} eCPM ({rules?.activeMode === 'revenue_share' ? `${rules?.revenueSharePercent}% RevShare` : 'Fixed Creator CPM'})
                </span>
                <button
                  type="button"
                  onClick={handleCompleteOrSkipAd}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-white text-neutral-950 font-semibold text-xs hover:bg-neutral-200 transition-colors whitespace-nowrap"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>
                    {adCountdown > 0
                      ? `Complete Ad Impression (${adCountdown}s)`
                      : 'Continue to Video & Credit View'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Center Play Button when paused */}
          {!isPlaying && !adActive && (
            <button
              type="button"
              onClick={handlePlayToggle}
              aria-label="Play video"
              className="absolute z-10 flex items-center gap-3 px-6 py-3.5 rounded-lg bg-white text-neutral-950 font-semibold text-sm shadow-lg hover:bg-neutral-100 transition-transform active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Play Video ({formatDuration(totalDuration)})</span>
            </button>
          )}

          {/* Closed Captions Overlay */}
          {captionsOn && isPlaying && !adActive && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded bg-black/85 text-white text-xs font-medium pointer-events-none max-w-md text-center">
              [CC] Streaming "{file.title}" in {quality} adaptive bitrate via ShareDabba CDN.
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="px-4 py-3 bg-neutral-950 border-t border-neutral-800 space-y-2.5">
          {/* Seek Bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tabular-nums text-neutral-400 w-12">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              aria-label="Seek video timeline"
              min={0}
              max={totalDuration}
              value={currentTime}
              disabled={adActive}
              onChange={(e) => setCurrentTime(Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-mono tabular-nums text-neutral-400 w-12 text-right">
              {formatDuration(totalDuration)}
            </span>
          </div>

          {/* Primary Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePlayToggle}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 font-medium flex items-center gap-1.5 whitespace-nowrap"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="p-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                aria-label="Volume"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  setIsMuted(false);
                }}
                className="w-20 accent-blue-600 h-1 bg-neutral-800 rounded cursor-pointer hidden sm:block"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCaptionsOn((c) => !c)}
                aria-label="Toggle captions"
                className={`px-2.5 py-1 rounded border text-xs font-medium flex items-center gap-1 whitespace-nowrap ${
                  captionsOn
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span>CC</span>
              </button>

              <select
                aria-label="Playback speed"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                className="bg-neutral-900 border border-neutral-800 text-neutral-200 rounded px-2 py-1 text-xs font-mono"
              >
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2.0x</option>
              </select>

              <select
                aria-label="Video quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 text-neutral-200 rounded px-2 py-1 text-xs font-mono"
              >
                <option value="4K">4K UHD</option>
                <option value="1080p">1080p HD</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>

              <button
                type="button"
                onClick={handleFullscreen}
                aria-label="Fullscreen"
                className="p-1.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Impression Feedback Banner */}
      {verifiedImpressionBanner && (
        <div className="mt-3 px-4 py-2.5 rounded-md bg-neutral-900 text-white border border-neutral-800 flex items-center justify-between text-xs font-mono">
          <span>{verifiedImpressionBanner}</span>
          <button
            type="button"
            onClick={() => setVerifiedImpressionBanner(null)}
            className="text-neutral-400 hover:text-white ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Viewer Ad-Preference Configuration Drawer */}
      {showAdPrefPanel && (
        <div className="mt-3 p-4 rounded-xl color-graded-panel space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Active Monetization Plan ($2.00 Balanced vs $3.00 Max Ads)
              </h4>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Choose between Balanced Plan ($2.00 CPM) for zero mid-roll interruptions or Max Ads Plan ($3.00 CPM) for maximum creator earnings.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdPrefPanel(false)}
              className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['balanced', 'more'] as AdPreferenceMode[]).map((mode) => {
              const info = getAdFrequencyCapForPreference(mode);
              const active = adPreference === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeAdPreference(mode)}
                  className={`p-3.5 rounded-lg border text-left transition-colors ${
                    active
                      ? 'border-blue-600 dark:border-blue-400 bg-blue-50/40 dark:bg-blue-950/30'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 bg-white dark:bg-neutral-950'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-900 dark:text-white">
                    <span>
                      {mode === 'more' ? 'Max Ads Plan ($3.00 CPM)' : 'Balanced Plan ($2.00 CPM)'}
                    </span>
                    {active && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {info.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Share & QR Code Drawer */}
      {showShareModal && (
        <div className="mt-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Share Monetized Link & QR Code
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Every eligible verified view on this link credits the creator under the active monetization model.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                aria-label="Shareable URL"
                className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-md"
              />
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-3 py-1.5 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-medium whitespace-nowrap"
              >
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
          <div className="shrink-0">
            <QrCodeMatrix value={shareUrl} size={96} />
          </div>
        </div>
      )}
    </div>
  );
};
