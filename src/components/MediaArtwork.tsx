import React from 'react';

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 1 ? 2 : 0)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds === undefined || seconds === null || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const ShareDabbaLogo: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M12 2L3 7V17L12 22L21 17V7L12 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 7L12 12L21 7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 22V12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15.5 9.5L8.5 14.5"
      stroke="#1D4ED8"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

export const MediaThumbnail: React.FC<{
  type: string;
  title: string;
  resolution?: string;
  className?: string;
}> = ({ type, title, resolution = '1080p', className = 'w-full aspect-video' }) => {
  return (
    <div
      className={`relative overflow-hidden bg-neutral-950 text-white select-none flex flex-col justify-between p-4 ${className}`}
    >
      {type === 'architecture' && (
        <svg
          viewBox="0 0 640 360"
          className="absolute inset-0 w-full h-full object-cover opacity-85"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="archGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0A0A0A" />
              <stop offset="55%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#090D16" />
            </linearGradient>
          </defs>
          <rect width="640" height="360" fill="url(#archGrad)" />
          <polygon points="80,320 260,80 420,320" fill="#171717" stroke="#404040" strokeWidth="1.5" />
          <polygon points="260,80 540,120 420,320" fill="#262626" stroke="#525252" strokeWidth="1.5" />
          <rect x="140" y="210" width="360" height="34" fill="#0A0A0A" stroke="#1D4ED8" strokeWidth="1.5" />
          <line x1="0" y1="320" x2="640" y2="320" stroke="#404040" strokeWidth="1" />
          <circle cx="510" cy="80" r="24" fill="none" stroke="#60A5FA" strokeWidth="1" strokeDasharray="3 3" />
        </svg>
      )}

      {type === 'industrial' && (
        <svg
          viewBox="0 0 640 360"
          className="absolute inset-0 w-full h-full object-cover opacity-85"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <rect width="640" height="360" fill="#09090B" />
          <g stroke="#27272A" strokeWidth="1">
            <line x1="0" y1="60" x2="640" y2="60" />
            <line x1="0" y1="120" x2="640" y2="120" />
            <line x1="0" y1="180" x2="640" y2="180" />
            <line x1="0" y1="240" x2="640" y2="240" />
            <line x1="0" y1="300" x2="640" y2="300" />
            <line x1="128" y1="0" x2="128" y2="360" />
            <line x1="256" y1="0" x2="256" y2="360" />
            <line x1="384" y1="0" x2="384" y2="360" />
            <line x1="512" y1="0" x2="512" y2="360" />
          </g>
          <rect x="160" y="75" width="320" height="210" rx="12" fill="#18181B" stroke="#52525B" strokeWidth="2" />
          <circle cx="320" cy="180" r="68" fill="#09090B" stroke="#1D4ED8" strokeWidth="2" />
          <circle cx="320" cy="180" r="28" fill="none" stroke="#A1A1AA" strokeWidth="1.5" strokeDasharray="4 4" />
        </svg>
      )}

      {type !== 'architecture' && type !== 'industrial' && (
        <svg
          viewBox="0 0 640 360"
          className="absolute inset-0 w-full h-full object-cover opacity-85"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <rect width="640" height="360" fill="#0A0A0A" />
          <path d="M0 280 Q 180 180 360 250 T 640 190 L 640 360 L 0 360 Z" fill="#171717" />
          <rect x="190" y="88" width="260" height="165" rx="8" fill="#141414" stroke="#404040" strokeWidth="1.5" />
          <polygon points="300,145 300,195 348,170" fill="#1D4ED8" />
        </svg>
      )}

      <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-neutral-300">
        <span>SHAREDABBA MASTER</span>
        <span>{resolution}</span>
      </div>

      <div className="relative z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent -mx-4 -mb-4 p-4 pt-8">
        <p className="text-xs font-medium text-white line-clamp-1">{title}</p>
      </div>
    </div>
  );
};

export const QrCodeMatrix: React.FC<{ value: string; size?: number }> = ({
  value,
  size = 136,
}) => {
  // Deterministic 15x15 QR-like visual matrix from value string
  const cells = 15;
  const hash = Array.from(value).reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 1), 17);

  const isFinderPattern = (r: number, c: number) => {
    const topL = r < 4 && c < 4;
    const topR = r < 4 && c >= cells - 4;
    const botL = r >= cells - 4 && c < 4;
    return topL || topR || botL;
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cells} ${cells}`}
      className="bg-white p-2 border border-neutral-200 rounded-md"
      role="img"
      aria-label={`QR Code for ${value}`}
    >
      {Array.from({ length: cells }).map((_, r) =>
        Array.from({ length: cells }).map((__, c) => {
          const finder = isFinderPattern(r, c);
          const bit = ((hash + r * 31 + c * 17) % 3 === 0) || finder;
          return bit ? (
            <rect
              key={`${r}-${c}`}
              x={c}
              y={r}
              width={0.92}
              height={0.92}
              fill={finder ? '#0A0A0A' : '#1E293B'}
            />
          ) : null;
        })
      )}
    </svg>
  );
};
