import React, { useState, useEffect } from 'react';

export default function AdminLayout({ children, currentPage }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: 'fa-tachometer-alt' },
    { href: '/admin/packs', label: 'Packs', icon: 'fa-box' },
    { href: '/admin/users', label: 'Users', icon: 'fa-users' },
  ];

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Mobile Header */}
      {isMobile && (
        <div style={{
          background: '#1a1a1a',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: 'Inter, -apple-system, sans-serif',
            color: 'white',
          }}>
            Admin
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            <i className={`fas ${sidebarOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
        </div>
      )}

      <div style={{ display: 'flex' }}>
        {/* Sidebar Overlay (mobile) */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 199,
            }}
          />
        )}

        {/* Sidebar */}
        <aside style={{
          width: '220px',
          background: '#1a1a1a',
          padding: '16px',
          flexShrink: 0,
          // Mobile styles
          ...(isMobile ? {
            position: 'fixed',
            top: 0,
            left: sidebarOpen ? 0 : '-220px',
            bottom: 0,
            zIndex: 200,
            transition: 'left 0.2s ease',
            paddingTop: '60px',
          } : {}),
        }}>
          {!isMobile && (
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'Inter, -apple-system, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#888',
              marginBottom: '16px',
              padding: '0 12px',
            }}>
              Admin
            </div>
          )}

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map(item => {
              const isActive = currentPage === item.label.toLowerCase();
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => isMobile && setSidebarOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    fontSize: '14px',
                    color: isActive ? 'white' : '#999',
                    background: isActive ? '#333' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <i className={`fas ${item.icon}`} style={{ width: '16px', textAlign: 'center' }}></i>
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div style={{
            paddingTop: '24px',
            borderTop: '1px solid #333',
            marginTop: '24px',
          }}>
            <a
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                textDecoration: 'none',
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontSize: '14px',
                color: '#666',
              }}
            >
              <i className="fas fa-arrow-left" style={{ width: '16px', textAlign: 'center' }}></i>
              Back to App
            </a>
          </div>
        </aside>

        {/* Main content */}
        <main style={{
          flex: 1,
          background: '#f5f5f5',
          overflow: 'auto',
          minHeight: isMobile ? 'calc(100vh - 64px - 48px)' : 'calc(100vh - 64px)',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
