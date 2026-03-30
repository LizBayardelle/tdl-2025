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
      padding: '24px',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '8px',
        background: '#333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '18px',
      }}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div>
        <div style={{
          fontSize: '28px',
          fontWeight: 700,
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#111',
        }}>
          {value}
        </div>
        <div style={{
          fontSize: '14px',
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
      <div style={{ padding: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#111',
          marginBottom: '24px',
        }}>
          Dashboard
        </h1>

        {loading ? (
          <p style={{ fontFamily: 'Inter, -apple-system, sans-serif', color: '#666' }}>Loading...</p>
        ) : stats ? (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '16px',
              marginBottom: '32px',
            }}>
              <StatCard label="Total Users" value={stats.total_users} icon="fa-users" />
              <StatCard label="Users This Month" value={stats.users_this_month} icon="fa-user-plus" />
              <StatCard label="Published Packs" value={stats.published_packs} icon="fa-box" />
              <StatCard label="Total Purchases" value={stats.total_purchases} icon="fa-shopping-cart" />
            </div>

            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              fontFamily: 'Inter, -apple-system, sans-serif',
              color: '#111',
              marginBottom: '16px',
            }}>
              Content Stats
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px',
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
