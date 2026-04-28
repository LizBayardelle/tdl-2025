import React from 'react';

// MagicSparkles — universal icon for actions Haiku does on the user's behalf.
// Use everywhere a button kicks off an AI call ("Suggest with Haiku",
// "Auto-tag Methods", etc.) so the symbol acquires the meaning "Magically
// done for me" across the product.
export default function MagicSparkles({ size = 14, className = '', spinning = false, style = {} }) {
  const s = spinning ? { ...style, animation: 'magic-sparkles-pulse 1.4s ease-in-out infinite' } : style;
  return (
    <>
      {spinning && (
        <style>{`
          @keyframes magic-sparkles-pulse {
            0%   { opacity: 0.45; transform: scale(0.92); }
            50%  { opacity: 1;    transform: scale(1.05); }
            100% { opacity: 0.45; transform: scale(0.92); }
          }
        `}</style>
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="currentColor"
        className={className}
        style={s}
        aria-hidden="true"
      >
        {/* main 4-point star */}
        <path d="M8 0.8 L9.4 6.6 L15.2 8 L9.4 9.4 L8 15.2 L6.6 9.4 L0.8 8 L6.6 6.6 Z" />
        {/* small sparkle, top-right */}
        <path d="M13.2 1.4 L13.6 2.8 L15 3.2 L13.6 3.6 L13.2 5 L12.8 3.6 L11.4 3.2 L12.8 2.8 Z" />
        {/* small sparkle, bottom-left */}
        <path d="M2.8 11 L3.2 12.4 L4.6 12.8 L3.2 13.2 L2.8 14.6 L2.4 13.2 L1 12.8 L2.4 12.4 Z" />
      </svg>
    </>
  );
}
