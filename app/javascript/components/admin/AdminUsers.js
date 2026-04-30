import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from './AdminLayout';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/admin/users.json');
      const data = await res.json();
      setUsers(data.users || []);
      setSummary(data.summary || null);
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
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, admin: updated.admin } : u)));
      }
    } catch {
      alert('Failed to update user');
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !u.email.toLowerCase().includes(q)) return false;
      if (planFilter === 'all') return true;
      if (planFilter === 'admin') return !!u.admin;
      return u.effective_plan === planFilter;
    });
  }, [users, query, planFilter]);

  return (
    <AdminLayout currentPage="users">
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-8) clamp(var(--space-4), 4vw, var(--space-8))',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <UsersHero />

          {error && (
            <Banner tone="error">{error}</Banner>
          )}

          {loading && !summary && (
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-3)' }}>Loading.</p>
          )}

          {summary && (
            <>
              <KPIStrip summary={summary} />
              <PlanDistribution byPlan={summary.by_plan} total={summary.total} />
            </>
          )}

          {summary && (
            <FilterBar
              query={query}
              onQueryChange={setQuery}
              planFilter={planFilter}
              onPlanFilterChange={setPlanFilter}
              counts={summary.by_plan}
              admins={summary.admins}
              total={summary.total}
              filteredCount={filtered.length}
            />
          )}

          {summary && (
            <UsersTable users={filtered} onToggleAdmin={toggleAdmin} />
          )}

          {summary && summary.total > summary.listed && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--ink-3)',
                textAlign: 'center',
                marginTop: 'var(--space-4)',
                fontStyle: 'italic',
              }}
            >
              Showing the {summary.listed} most recent of {summary.total.toLocaleString()} users.
            </p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

// ---------- Hero ----------

function UsersHero() {
  return (
    <header
      style={{
        marginBottom: 'var(--space-8)',
        paddingBottom: 'var(--space-7)',
        borderBottom: '1px solid var(--ink-line)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginBottom: '12px',
        }}
      >
        Linchpin Industries · Map My Research
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '44px',
          fontWeight: 600,
          color: 'var(--primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          margin: 0,
        }}
      >
        Users
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          color: 'var(--ink-2)',
          lineHeight: 1.65,
          maxWidth: '680px',
          marginTop: '14px',
          marginBottom: 0,
        }}
      >
        Accounts, plans, generation quota, and what each user has built so far.
      </p>
    </header>
  );
}

// ---------- KPI strip ----------

function KPIStrip({ summary }) {
  const cards = [
    { label: 'Total users', value: summary.total,             tone: 'navy' },
    { label: 'Free',        value: summary.by_plan.free,      tone: 'navy' },
    { label: 'Storage',     value: summary.by_plan.storage,   tone: 'source' },
    { label: 'Unlimited',   value: summary.by_plan.unlimited, tone: 'concept' },
  ];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-6)',
      }}
    >
      {cards.map((c) => (
        <KPICard key={c.label} label={c.label} value={c.value} tone={c.tone} />
      ))}
    </div>
  );
}

function KPICard({ label, value, tone }) {
  const valueColor = TONE_COLOR[tone] || 'var(--primary)';
  return (
    <div
      style={{
        background: 'var(--paper)',
        padding: 'var(--space-4) var(--space-5)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--ink-line)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px',
          fontWeight: 600,
          color: valueColor,
          fontVariantNumeric: 'tabular-nums lining-nums',
          letterSpacing: '-0.01em',
          lineHeight: 1.05,
        }}
      >
        {value.toLocaleString()}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10.5px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginTop: '6px',
        }}
      >
        {label}
      </div>
    </div>
  );
}

const TONE_COLOR = {
  navy:    'var(--primary)',
  concept: 'var(--concept)',
  source:  'var(--source)',
  person:  'var(--person)',
};

// ---------- Plan distribution chart ----------

function PlanDistribution({ byPlan, total }) {
  const safeTotal = total > 0 ? total : 1;
  const segments = [
    { key: 'free',      label: 'Free',      count: byPlan.free,      color: 'var(--ink-line)',  text: 'var(--ink-3)' },
    { key: 'storage',   label: 'Storage',   count: byPlan.storage,   color: 'var(--source)',    text: 'var(--source-2)' },
    { key: 'unlimited', label: 'Unlimited', count: byPlan.unlimited, color: 'var(--concept)',   text: 'var(--concept-2)' },
  ];
  return (
    <div
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--ink-line)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--space-4) var(--space-5)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10.5px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginBottom: 'var(--space-3)',
        }}
      >
        Plan distribution
      </div>

      <div
        style={{
          display: 'flex',
          height: '14px',
          borderRadius: 'var(--r-sm)',
          overflow: 'hidden',
          background: 'var(--paper-warm)',
        }}
        role="img"
        aria-label="Plan distribution"
      >
        {segments.map((s) => {
          const w = (s.count / safeTotal) * 100;
          if (w === 0) return null;
          return (
            <div
              key={s.key}
              style={{
                width: `${w}%`,
                background: s.color,
              }}
              title={`${s.label}: ${s.count} (${Math.round(w)}%)`}
            />
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4) var(--space-5)',
          marginTop: 'var(--space-3)',
        }}
      >
        {segments.map((s) => (
          <div
            key={s.key}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--ink-2)',
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: s.color,
                display: 'inline-block',
                alignSelf: 'center',
              }}
            />
            <span style={{ fontWeight: 600, color: s.text }}>{s.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
              {s.count.toLocaleString()} · {Math.round((s.count / safeTotal) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Filter / search bar ----------

function FilterBar({
  query, onQueryChange,
  planFilter, onPlanFilterChange,
  counts, admins, total, filteredCount,
}) {
  const tabs = [
    { key: 'all',       label: 'All',       count: total },
    { key: 'free',      label: 'Free',      count: counts.free },
    { key: 'storage',   label: 'Storage',   count: counts.storage },
    { key: 'unlimited', label: 'Unlimited', count: counts.unlimited },
    { key: 'admin',     label: 'Admins',    count: admins },
  ];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '36px',
          padding: '0 12px',
          background: 'var(--paper)',
          border: '1px solid var(--ink-line)',
          borderRadius: 'var(--r-md)',
          color: 'var(--ink-3)',
          flex: '1 1 280px',
          maxWidth: '420px',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--ink-line)')}
      >
        <i className="fas fa-magnifying-glass" style={{ fontSize: '12px' }}></i>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by email."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--ink)',
            minWidth: 0,
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-3)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: 0,
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <FilterTab
            key={t.key}
            active={planFilter === t.key}
            count={t.count}
            label={t.label}
            onClick={() => onPlanFilterChange(t.key)}
          />
        ))}
      </div>

      <div
        style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          color: 'var(--ink-3)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {filteredCount.toLocaleString()} shown
      </div>
    </div>
  );
}

function FilterTab({ active, count, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '36px',
        padding: '0 12px',
        background: active ? 'var(--primary)' : 'var(--paper)',
        color: active ? 'var(--paper)' : 'var(--ink-2)',
        border: `1px solid ${active ? 'var(--primary)' : 'var(--ink-line)'}`,
        borderRadius: 'var(--r-md)',
        fontFamily: 'var(--font-body)',
        fontSize: '12.5px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10.5px',
          opacity: active ? 0.85 : 0.7,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ---------- Users table ----------

function UsersTable({ users, onToggleAdmin }) {
  if (users.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-8)',
          background: 'var(--paper-soft)',
          border: '1px dashed var(--ink-line)',
          borderRadius: 'var(--r-md)',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          color: 'var(--ink-3)',
          textAlign: 'center',
          marginBottom: 'var(--space-8)',
        }}
      >
        No users match this filter.
      </div>
    );
  }
  return (
    <div
      style={{
        border: '1px solid var(--ink-line)',
        borderRadius: 'var(--r-md)',
        overflowX: 'auto',
        overflowY: 'hidden',
        marginBottom: 'var(--space-6)',
      }}
    >
      <table className="sp-table" style={{ minWidth: '1280px' }}>
        <thead>
          <tr>
            <th>User</th>
            <th>Plan</th>
            <th className="sp-th-num">Monthly</th>
            <th className="sp-th-num">Lifetime</th>
            <th>Joined</th>
            <th className="sp-th-num">Concepts</th>
            <th className="sp-th-num">Sources</th>
            <th className="sp-th-num">Notes</th>
            <th>Quota</th>
            <th>Stripe</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} onToggleAdmin={onToggleAdmin} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ user, onToggleAdmin }) {
  return (
    <tr>
      <td>
        <UserCell user={user} />
      </td>
      <td>
        <PlanCell user={user} />
      </td>
      <td className="sp-td-num">
        <MoneyCell cents={user.monthly_cents} />
      </td>
      <td className="sp-td-num">
        <MoneyCell cents={user.lifetime_cents} emphasize />
      </td>
      <td
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--ink-3)',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
        title={new Date(user.created_at).toLocaleString()}
      >
        {relativeJoinedDate(user.created_at)}
      </td>
      <td className="sp-td-num">{user.activity.concepts}</td>
      <td className="sp-td-num">{user.activity.sources}</td>
      <td className="sp-td-num">{user.activity.notes}</td>
      <td>
        <QuotaCell user={user} />
      </td>
      <td>
        <StripeCell user={user} />
      </td>
      <td style={{ textAlign: 'right' }}>
        <AdminToggle user={user} onToggle={() => onToggleAdmin(user)} />
      </td>
    </tr>
  );
}

function UserCell({ user }) {
  const isAdmin = !!user.admin;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '1px 8px',
        background: isAdmin ? 'var(--paper-warm)' : 'var(--person-tint)',
        color: isAdmin ? 'var(--ink-2)' : 'var(--person-2)',
        borderRadius: 'var(--r-sm)',
        fontSize: '12px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        maxWidth: '320px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
      title={`${user.email}${isAdmin ? ' · admin' : ''}`}
    >
      {isAdmin && <i className="fas fa-shield-halved" style={{ fontSize: '9px', opacity: 0.7 }}></i>}
      {user.email}
    </span>
  );
}

function PlanCell({ user }) {
  const plan = user.effective_plan;
  const through = user.plan_through;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <PlanBadge plan={plan} />
      {plan !== 'free' && through && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            color: 'var(--ink-3)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          through {formatShortDate(through)}
        </div>
      )}
    </div>
  );
}

function PlanBadge({ plan }) {
  const styles = {
    free:      { bg: 'var(--paper-warm)',  fg: 'var(--ink-3)' },
    storage:   { bg: 'var(--source-tint)', fg: 'var(--source-2)' },
    unlimited: { bg: 'var(--concept-tint)',fg: 'var(--concept-2)' },
  }[plan] || { bg: 'var(--paper-warm)', fg: 'var(--ink-3)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        padding: '1px 8px',
        background: styles.bg,
        color: styles.fg,
        borderRadius: 'var(--r-sm)',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
      }}
    >
      {plan}
    </span>
  );
}

function QuotaCell({ user }) {
  const used = user.concept_generations_used;
  const limit = user.concept_generation_limit; // null = unlimited
  if (limit === null) {
    return (
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--concept-2)', fontSize: '12px' }}>
        ∞
      </span>
    );
  }
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const near = pct >= 80;
  const full = pct >= 100;
  const trackColor = full ? 'var(--error)' : near ? 'var(--source)' : 'var(--ink-3)';
  return (
    <div style={{ minWidth: '90px' }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          color: 'var(--ink-2)',
          fontVariantNumeric: 'tabular-nums',
          marginBottom: '3px',
        }}
      >
        {used} / {limit}
      </div>
      <div
        style={{
          height: '4px',
          background: 'var(--paper-warm)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: trackColor,
            transition: 'width 0.2s',
          }}
        />
      </div>
    </div>
  );
}

function StripeCell({ user }) {
  if (!user.stripe_customer_id) {
    return <span style={{ color: 'var(--ink-4)' }}>—</span>;
  }
  return (
    <a
      href={`https://dashboard.stripe.com/customers/${user.stripe_customer_id}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '2px 8px',
        background: 'var(--paper-warm)',
        color: 'var(--ink-2)',
        borderRadius: 'var(--r-sm)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        textDecoration: 'none',
        fontVariantNumeric: 'tabular-nums',
        maxWidth: '140px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      title={user.stripe_customer_id}
    >
      <i className="fab fa-stripe-s" style={{ fontSize: '10px', color: 'var(--source)' }}></i>
      {user.stripe_customer_id.replace(/^cus_/, '')}
      <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '8px', opacity: 0.6 }}></i>
    </a>
  );
}

function AdminToggle({ user, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        padding: '4px 10px',
        borderRadius: 'var(--r-sm)',
        fontSize: '11px',
        fontWeight: 700,
        fontFamily: 'var(--font-body)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        background: user.admin ? 'var(--primary)' : 'var(--paper)',
        color: user.admin ? 'var(--paper)' : 'var(--ink-3)',
        border: `1px solid ${user.admin ? 'var(--primary)' : 'var(--ink-line)'}`,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      }}
      title={user.admin ? 'Revoke admin' : 'Grant admin'}
    >
      <i className={`fas ${user.admin ? 'fa-shield-halved' : 'fa-user'}`}></i>
      {user.admin ? 'Admin' : 'User'}
    </button>
  );
}

// ---------- Banner ----------

function Banner({ tone, children }) {
  const styles = tone === 'error'
    ? {
        background: 'rgba(122, 46, 46, 0.06)',
        color: 'var(--error)',
        border: '1px solid rgba(122, 46, 46, 0.20)',
      }
    : {
        background: 'var(--paper-soft)',
        color: 'var(--ink)',
        border: '1px solid var(--ink-line)',
        borderLeft: '3px solid var(--primary)',
      };
  return (
    <div
      style={{
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--r-md)',
        marginBottom: 'var(--space-4)',
        fontFamily: 'var(--font-body)',
        fontSize: '13.5px',
        ...styles,
      }}
    >
      {children}
    </div>
  );
}

// ---------- Money cell ----------

function MoneyCell({ cents, emphasize }) {
  if (!cents || cents <= 0) {
    return <span style={{ color: 'var(--ink-4)' }}>—</span>;
  }
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '12.5px',
        fontVariantNumeric: 'tabular-nums',
        color: emphasize ? 'var(--primary)' : 'var(--ink-2)',
        fontWeight: emphasize ? 600 : 500,
        whiteSpace: 'nowrap',
      }}
    >
      {formatMoney(cents)}
    </span>
  );
}

function formatMoney(cents) {
  const dollars = cents / 100;
  // Hide cents on round amounts (e.g. $20 not $20.00); keep them otherwise.
  const isRound = Math.abs(dollars - Math.round(dollars)) < 0.005;
  if (dollars >= 1000) {
    return dollars.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: isRound ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// ---------- Helpers ----------

function relativeJoinedDate(input) {
  if (!input) return '';
  const ts = new Date(input).getTime();
  if (!ts) return '';
  const days = (Date.now() - ts) / 86400000;
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 30) return `${Math.floor(days)}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return formatShortDate(input);
}

function formatShortDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
