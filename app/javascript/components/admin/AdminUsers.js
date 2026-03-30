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
      <div style={{ padding: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#111',
          marginBottom: '24px',
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
          <div style={{
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, -apple-system, sans-serif' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Concepts</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Packs</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111' }}>
                      {user.email}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
                      {user.concepts_count}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
                      {user.packs_count}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => toggleAdmin(user)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: user.admin ? '#111' : '#ccc',
                          fontSize: '18px',
                        }}
                        title={user.admin ? 'Remove admin' : 'Make admin'}
                      >
                        <i className={user.admin ? 'fas fa-toggle-on' : 'fas fa-toggle-off'}></i>
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#888' }}>
                      {formatDate(user.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
