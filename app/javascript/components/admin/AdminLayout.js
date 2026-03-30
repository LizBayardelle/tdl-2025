import React from 'react';

export default function AdminLayout({ children, currentPage }) {
  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: 'fa-tachometer-alt' },
    { href: '/admin/packs', label: 'Packs', icon: 'fa-box' },
    { href: '/admin/users', label: 'Users', icon: 'fa-users' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px',
        background: '#1a1a1a',
        padding: '16px',
        flexShrink: 0,
      }}>
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

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map(item => {
            const isActive = currentPage === item.label.toLowerCase();
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 12px',
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
              padding: '8px 12px',
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
      <main style={{ flex: 1, background: '#f5f5f5', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
