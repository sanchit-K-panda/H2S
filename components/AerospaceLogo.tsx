import React from "react";

export function AerospaceLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        aria-hidden="true"
      >
        {/* Navigation orientation ring */}
        <circle cx="16" cy="16" r="14" stroke="#334155" strokeWidth="1" />
        <circle cx="16" cy="16" r="10" stroke="#1E293B" strokeWidth="0.75" strokeDasharray="2 2" />
        
        {/* Cardinal tick marks */}
        <line x1="16" y1="2" x2="16" y2="5" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
        <line x1="16" y1="27" x2="16" y2="30" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
        <line x1="2" y1="16" x2="5" y2="16" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
        <line x1="27" y1="16" x2="30" y2="16" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
        
        {/* Supersonic navigation glyph */}
        <path
          d="M 16 6 L 22 20 L 16 17 L 10 20 Z"
          fill="#38BDF8"
          stroke="#0F172A"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
        {/* Center waypoint */}
        <circle cx="16" cy="16.5" r="1" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
