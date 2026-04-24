import React, { useState, useEffect, useRef } from 'react';
import useIsMobile from './useIsMobile';

const TOGGLE_Y_KEY = 'adminSidebarToggleY';
const TOGGLE_HEIGHT = 48;
const DRAG_THRESHOLD = 4;
const SIDEBAR_WIDTH = 260;

export default function AdminLayout({ children, currentPage }) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768;
  });
  const [toggleY, setToggleY] = useState(() => {
    if (typeof window === 'undefined') return 164;
    const stored = parseInt(window.localStorage.getItem(TOGGLE_Y_KEY), 10);
    return Number.isFinite(stored) ? stored : 164;
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ active: false, startPointerY: 0, startToggleY: 0, moved: false });

  // Auto-close on resize to mobile, auto-open on resize to desktop
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  // Clamp toggle Y on window resize
  useEffect(() => {
    const onResize = () => {
      setToggleY((y) => {
        const max = Math.max(0, window.innerHeight - TOGGLE_HEIGHT - 64);
        return Math.min(Math.max(0, y), max);
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const clampY = (y) => {
    const max = Math.max(0, window.innerHeight - TOGGLE_HEIGHT - 64);
    return Math.min(Math.max(0, y), max);
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startPointerY: e.clientY,
      startToggleY: toggleY,
      moved: false,
    };
    setDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.active) return;
    const delta = e.clientY - dragRef.current.startPointerY;
    if (!dragRef.current.moved && Math.abs(delta) > DRAG_THRESHOLD) {
      dragRef.current.moved = true;
    }
    if (dragRef.current.moved) {
      setToggleY(clampY(dragRef.current.startToggleY + delta));
    }
  };

  const handlePointerUp = (e) => {
    if (!dragRef.current.active) return;
    const wasDrag = dragRef.current.moved;
    dragRef.current.active = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    if (wasDrag) {
      setToggleY((y) => {
        try {
          window.localStorage.setItem(TOGGLE_Y_KEY, String(y));
        } catch (_) {}
        return y;
      });
    } else {
      setSidebarOpen((open) => !open);
    }
  };

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: 'fa-tachometer-alt', key: 'dashboard' },
    { href: '/admin/packs', label: 'Packs', icon: 'fa-box', key: 'packs' },
    { href: '/admin/concept_generations', label: 'Concept Creator', icon: 'fa-wand-magic-sparkles', key: 'concept_generations' },
    { href: '/admin/users', label: 'Users', icon: 'fa-users', key: 'users' },
  ];

  const sidebarStyle = isMobile
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: `${SIDEBAR_WIDTH}px`,
        background: '#e2e2e2',
        overflowY: 'auto',
        padding: 'var(--space-6)',
        boxShadow: 'var(--shadow-sidebar)',
        transform: sidebarOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH + 4}px)`,
        transition: 'transform 0.3s ease',
        zIndex: 200,
      }
    : {
        width: sidebarOpen ? `${SIDEBAR_WIDTH}px` : '0',
        background: '#e2e2e2',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: sidebarOpen ? 'var(--space-6)' : '0',
        boxShadow: sidebarOpen ? 'var(--shadow-sidebar)' : 'none',
        transition: 'width 0.3s ease, padding 0.3s ease',
        flexShrink: 0,
      };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', position: 'relative' }}>
      {/* Backdrop (mobile only, when sidebar open) */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            zIndex: 150,
            animation: 'fadeIn 0.15s ease',
          }}
        />
      )}

      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--neutral-500)',
            marginBottom: 'var(--space-4)',
            padding: '0 var(--space-2)',
          }}
        >
          Admin
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: 'var(--space-6)' }}>
          {navItems.map((item) => {
            const isActive = currentPage === item.key;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => isMobile && setSidebarOpen(false)}
                style={{
                  fontFamily: 'var(--font-body)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius)',
                  textDecoration: 'none',
                  fontSize: 'var(--text-sm)',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'white' : 'var(--neutral-900)',
                  background: isActive ? 'var(--admin-brown-dark)' : 'transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <i className={`fas ${item.icon}`} style={{ width: '16px', textAlign: 'center', fontSize: '13px' }}></i>
                {item.label}
              </a>
            );
          })}
        </nav>

        <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--neutral-200)' }}>
          <a
            href="/"
            style={{
              fontFamily: 'var(--font-body)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              textDecoration: 'none',
              fontSize: 'var(--text-sm)',
              color: 'var(--neutral-500)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--neutral-800)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--neutral-500)')}
          >
            <i className="fas fa-arrow-left" style={{ width: '16px', textAlign: 'center', fontSize: '13px' }}></i>
            Back to App
          </a>
        </div>
      </div>

      {/* Toggle tab (click to toggle, drag vertically to reposition) */}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: isMobile ? 'fixed' : 'absolute',
          left: sidebarOpen ? `${SIDEBAR_WIDTH}px` : '0',
          top: `${toggleY}px`,
          width: '24px',
          height: `${TOGGLE_HEIGHT}px`,
          background: 'var(--admin-brown-dark)',
          border: 'none',
          color: 'white',
          cursor: dragging ? 'grabbing' : 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTopRightRadius: '4px',
          borderBottomRightRadius: '4px',
          transition: dragging ? 'none' : 'left 0.3s ease',
          zIndex: 210,
          boxShadow: '2px 0 4px rgba(0, 0, 0, 0.2)',
          touchAction: 'none',
          userSelect: 'none',
        }}
        title={sidebarOpen ? 'Click to hide · drag to move' : 'Click to show · drag to move'}
      >
        <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`} style={{ fontSize: '12px', pointerEvents: 'none' }}></i>
      </button>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'white',
          width: '100%',
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}
