import React from 'react';

export default function AdminPageHeader({ title, subtitle, actions, backHref, backLabel }) {
  return (
    <div
      style={{
        padding: 'var(--space-6) var(--space-8)',
        background: 'var(--neutral-600)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        position: 'relative',
        zIndex: 5,
      }}
    >
      {backHref && (
        <a
          href={backHref}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            color: 'rgba(255,255,255,0.6)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 600,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
        >
          <i className="fas fa-arrow-left"></i>
          {backLabel || 'Back'}
        </a>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-3xl)',
              fontWeight: 700,
              color: 'white',
              letterSpacing: '-0.02em',
              marginBottom: 'var(--space-1)',
              marginTop: 0,
              wordBreak: 'break-word',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'rgba(255,255,255,0.65)',
                margin: 0,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
