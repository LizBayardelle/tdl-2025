import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import AdminPageHeader from './AdminPageHeader';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/admin.json')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const StatCard = ({ label, value, icon }) => (
    <div
      style={{
        background: 'white',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--neutral-200)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: 'var(--radius)',
          background: 'var(--admin-brown-dark)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '16px',
          flexShrink: 0,
        }}
      >
        <i className={`fas ${icon}`}></i>
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: 'var(--neutral-900)',
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--neutral-500)',
            marginTop: '2px',
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );

  const SectionLabel = ({ children }) => (
    <div
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--neutral-700)',
        marginBottom: 'var(--space-3)',
        paddingBottom: 'var(--space-2)',
        borderBottom: '1px solid var(--neutral-200)',
      }}
    >
      {children}
    </div>
  );

  return (
    <AdminLayout currentPage="dashboard">
      <AdminPageHeader title="Dashboard" subtitle="System overview and key metrics" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) clamp(var(--space-4), 4vw, var(--space-8))' }}>
        {loading ? (
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-500)' }}>Loading...</p>
        ) : stats ? (
          <>
            <SectionLabel>Users &amp; Purchases</SectionLabel>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-8)',
              }}
            >
              <StatCard label="Total Users" value={stats.total_users} icon="fa-users" />
              <StatCard label="Users This Month" value={stats.users_this_month} icon="fa-user-plus" />
            </div>

            <SectionLabel>Content</SectionLabel>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              <StatCard label="Total Concepts" value={stats.total_concepts} icon="fa-lightbulb" />
              <StatCard label="Total Sources" value={stats.total_sources} icon="fa-book" />
            </div>
          </>
        ) : (
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--error)' }}>Failed to load stats</p>
        )}
      </div>
    </AdminLayout>
  );
}
