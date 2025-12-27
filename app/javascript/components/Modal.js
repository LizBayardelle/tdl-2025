import React from 'react';

export default function Modal({ isOpen, onClose, children, size = 'medium' }) {
  if (!isOpen) return null;

  const maxWidths = {
    small: '400px',
    medium: '600px',
    large: '800px',
    xlarge: '1000px'
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      {/* Background overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998
        }}
      ></div>

      {/* Modal panel */}
      <div
        style={{
          position: 'relative',
          background: 'white',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-xl)',
          zIndex: 9999,
          width: '100%',
          maxWidth: maxWidths[size],
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {children}
      </div>
    </div>
  );
}
