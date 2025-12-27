import React from 'react';

export default function Modal({ isOpen, onClose, title, children, size = 'medium', titleColor = 'var(--neutral-900)' }) {
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
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid var(--neutral-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: titleColor,
            margin: 0
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--neutral-500)',
              fontSize: 'var(--text-2xl)',
              cursor: 'pointer',
              padding: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--neutral-100)';
              e.currentTarget.style.color = 'var(--neutral-900)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--neutral-500)';
            }}
            type="button"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: 'var(--space-6)',
          overflowY: 'auto',
          flex: 1
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
