import React, { useEffect, useState } from 'react';

export default function SlidePanel({ isOpen, onClose, children }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Trigger animation after mount
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Wait for animation to complete before hiding
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      overflow: 'hidden'
    }}>
      {/* Background overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          opacity: isAnimating ? 1 : 0,
          transition: 'opacity 0.3s ease-out'
        }}
      ></div>

      {/* Slide panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          background: 'white',
          boxShadow: 'var(--shadow-xl)',
          zIndex: 9999,
          width: '100%',
          maxWidth: '90vw',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isAnimating ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-out'
        }}
        className="slide-panel"
      >
        {children}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .slide-panel {
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
