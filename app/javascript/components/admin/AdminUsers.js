import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/admin/users.json');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (user) => {
    try {
      const res = await fetch(`/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({ user: { admin: !user.admin } })
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers(users.map(u => u.id === user.id ? { ...u, admin: updated.admin } : u));
      }
    } catch (err) {
      alert('Failed to update user');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <AdminLayout currentPage="users">
      <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 700,
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#111',
          marginBottom: '20px',
        }}>
          Users
        </h1>

        {error && (
          <div style={{
            padding: '12px',
            background: '#fee',
            color: '#c00',
            borderRadius: '4px',
            marginBottom: '16px',
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ fontFamily: 'Inter, -apple-system, sans-serif', color: '#666' }}>Loading...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {users.map(user => (
              <div
                key={user.id}
                style={{
                  background: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  padding: '16px',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{
                      fontWeight: 500,
                      fontSize: '15px',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      color: '#111',
                      wordBreak: 'break-word',
                    }}>
                      {user.email}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#888',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      marginTop: '4px',
                    }}>
                      Joined {formatDate(user.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAdmin(user)}
                    style={{
                      background: user.admin ? '#111' : '#e0e0e0',
                      color: user.admin ? 'white' : '#666',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className={`fas ${user.admin ? 'fa-shield-alt' : 'fa-user'}`}></i>
                    {user.admin ? 'Admin' : 'User'}
                  </button>
                </div>

                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '16px',
                  fontSize: '13px',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  color: '#666',
                }}>
                  <span>
                    <i className="fas fa-lightbulb" style={{ marginRight: '4px', color: '#999' }}></i>
                    {user.concepts_count} concepts
                  </span>
                  <span>
                    <i className="fas fa-box" style={{ marginRight: '4px', color: '#999' }}></i>
                    {user.packs_count} packs
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
