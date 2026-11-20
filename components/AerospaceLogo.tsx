import React from "react";

export function AerospaceLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]"
        aria-hidden="true"
      >
        <circle cx="20" cy="20" r="18" stroke="#0284C7" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
        <circle cx="20" cy="20" r="13" stroke="#38BDF8" strokeWidth="0.8" opacity="0.4" />
        {/* Radar crosshairs */}
        <line x1="20" y1="3" x2="20" y2="7" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="33" x2="20" y2="37" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="3" y1="20" x2="7" y2="20" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="33" y1="20" x2="37" y2="20" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
        {/* Orbital sweep arc */}
        <path
          d="M 8 26 A 14 14 0 0 1 32 14"
          stroke="url(#arc-grad)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Modern supersonic delta wing aircraft */}
        <path
          d="M 20 8 L 26 23 L 20 20 L 14 23 Z"
          fill="url(#wing-grad)"
          stroke="#FFFFFF"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* Target blip / ping */}
        <circle cx="20" cy="19.5" r="1.5" fill="#38BDF8" />
        <defs>
          <linearGradient id="wing-grad" x1="14" y1="8" x2="26" y2="23" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset="1" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id="arc-grad" x1="8" y1="26" x2="32" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" stopOpacity="0" />
            <stop offset="0.6" stopColor="#38BDF8" />
            <stop offset="1" stopColor="#FFFFFF" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
