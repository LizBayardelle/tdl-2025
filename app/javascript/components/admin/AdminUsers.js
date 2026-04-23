import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import AdminPageHeader from './AdminPageHeader';

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
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ user: { admin: !user.admin } }),
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers(users.map((u) => (u.id === user.id ? { ...u, admin: updated.admin } : u)));
      }
    } catch (err) {
      alert('Failed to update user');
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <AdminLayout currentPage="users">
      <AdminPageHeader title="Users" subtitle="Manage accounts and admin privileges" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)' }}>
        {error && (
          <div
            style={{
              padding: 'var(--space-3)',
              background: 'var(--accent-red-light)',
              color: 'var(--accent-red)',
              borderRadius: 'var(--radius)',
              marginBottom: 'var(--space-4)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-500)' }}>Loading...</p>
        ) : users.length === 0 ? (
          <div
            style={{
              background: 'white',
              padding: 'var(--space-8)',
              borderRadius: 'var(--radius)',
              textAlign: 'center',
              color: 'var(--neutral-500)',
              fontFamily: 'var(--font-body)',
              border: '1px solid var(--neutral-200)',
            }}
          >
            No users yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {users.map((user) => (
              <div
                key={user.id}
                style={{
                  background: 'white',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--neutral-200)',
                  padding: 'var(--space-4)',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    marginBottom: 'var(--space-2)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: 'var(--text-base)',
                        color: 'var(--neutral-900)',
                        wordBreak: 'break-word',
                      }}
                    >
                      {user.email}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                        marginTop: '4px',
                      }}
                    >
                      Joined {formatDate(user.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAdmin(user)}
                    style={{
                      background: user.admin ? 'var(--neutral-800)' : 'white',
                      color: user.admin ? 'white' : 'var(--neutral-600)',
                      border: user.admin ? 'none' : '1px solid var(--neutral-300)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-display)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s',
                    }}
                    title="Toggle admin"
                  >
                    <i className={`fas ${user.admin ? 'fa-shield-alt' : 'fa-user'}`}></i>
                    {user.admin ? 'Admin' : 'User'}
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-4)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--neutral-600)',
                  }}
                >
                  <span>
                    <i className="fas fa-lightbulb" style={{ marginRight: '4px', color: 'var(--neutral-400)' }}></i>
                    {user.concepts_count} concepts
                  </span>
                  <span>
                    <i className="fas fa-box" style={{ marginRight: '4px', color: 'var(--neutral-400)' }}></i>
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
