import React, { useState, useEffect } from 'react';

export default function AdminLayout({ children, currentPage }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: 'fa-tachometer-alt', key: 'dashboard' },
    { href: '/admin/packs', label: 'Packs', icon: 'fa-box', key: 'packs' },
    { href: '/admin/concept_generations', label: 'Generate Concepts', icon: 'fa-wand-magic-sparkles', key: 'concept_generations' },
    { href: '/admin/users', label: 'Users', icon: 'fa-users', key: 'users' },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? '260px' : '0',
          background: '#e2e2e2',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: sidebarOpen ? 'var(--space-6)' : '0',
          boxShadow: sidebarOpen ? 'var(--shadow-sidebar)' : 'none',
          transition: 'all 0.3s ease',
          flexShrink: 0,
        }}
      >
        {sidebarOpen && (
          <>
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
                      color: isActive ? 'var(--neutral-900)' : 'var(--neutral-700)',
                      background: isActive ? 'var(--neutral-200)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--neutral-100)';
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
          </>
        )}
      </div>

      {/* Toggle tab */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'absolute',
          left: sidebarOpen ? '260px' : '0',
          top: '164px',
          width: '24px',
          height: '48px',
          background: 'var(--neutral-800)',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTopRightRadius: '4px',
          borderBottomRightRadius: '4px',
          transition: 'left 0.3s ease',
          zIndex: 10,
          boxShadow: '2px 0 4px rgba(0, 0, 0, 0.2)',
        }}
        title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      >
        <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`} style={{ fontSize: '12px' }}></i>
      </button>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'white',
        }}
      >
        {children}
      </main>
    </div>
  );
}
