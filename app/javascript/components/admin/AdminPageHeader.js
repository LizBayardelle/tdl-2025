import React from 'react';
import useIsMobile from './useIsMobile';

export default function AdminPageHeader({ title, subtitle, actions, backHref, backLabel }) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        padding: isMobile ? 'var(--space-4) var(--space-5)' : 'var(--space-6) var(--space-8)',
        paddingLeft: isMobile ? 'calc(var(--space-5) + 28px)' : 'var(--space-8)',
        background: 'var(--paper)',
        borderBottom: '1px solid var(--ink-line)',
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
            color: 'var(--ink-3)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 700,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}
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
              fontSize: isMobile ? '24px' : '32px',
              fontWeight: 600,
              color: 'var(--primary)',
              letterSpacing: '-0.015em',
              marginBottom: 'var(--space-1)',
              marginTop: 0,
              wordBreak: 'break-word',
              lineHeight: 1.15,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--ink-3)',
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
