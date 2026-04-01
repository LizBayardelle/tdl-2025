import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/admin.json')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const StatCard = ({ label, value, icon }) => (
    <div style={{
      background: 'white',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '8px',
        background: '#333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '16px',
        flexShrink: 0,
      }}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 700,
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#111',
        }}>
          {value}
        </div>
        <div style={{
          fontSize: '13px',
          color: '#666',
          fontFamily: 'Inter, -apple-system, sans-serif',
        }}>
          {label}
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout currentPage="dashboard">
      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 700,
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#111',
          marginBottom: '20px',
        }}>
          Dashboard
        </h1>

        {loading ? (
          <p style={{ fontFamily: 'Inter, -apple-system, sans-serif', color: '#666' }}>Loading...</p>
        ) : stats ? (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '12px',
              marginBottom: '24px',
            }}>
              <StatCard label="Total Users" value={stats.total_users} icon="fa-users" />
              <StatCard label="Users This Month" value={stats.users_this_month} icon="fa-user-plus" />
              <StatCard label="Published Packs" value={stats.published_packs} icon="fa-box" />
              <StatCard label="Total Purchases" value={stats.total_purchases} icon="fa-shopping-cart" />
            </div>

            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              fontFamily: 'Inter, -apple-system, sans-serif',
              color: '#111',
              marginBottom: '16px',
            }}>
              Content Stats
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '12px',
            }}>
              <StatCard label="Total Concepts" value={stats.total_concepts} icon="fa-lightbulb" />
              <StatCard label="Total Sources" value={stats.total_sources} icon="fa-book" />
              <StatCard label="Purchases This Month" value={stats.purchases_this_month} icon="fa-chart-line" />
            </div>
          </>
        ) : (
          <p style={{ fontFamily: 'Inter, -apple-system, sans-serif', color: '#c00' }}>Failed to load stats</p>
        )}
      </div>
    </AdminLayout>
  );
}
