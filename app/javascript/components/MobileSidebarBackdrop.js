import React from 'react';

// Dark backdrop for mobile sidebar overlays. Clicking it closes the sidebar.
// Use alongside an overlayed sidebar (position: fixed) on viewports below 768px.
export default function MobileSidebarBackdrop({ isMobile, open, onClose, zIndex = 150 }) {
  if (!isMobile || !open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        zIndex,
      }}
    />
  );
}
