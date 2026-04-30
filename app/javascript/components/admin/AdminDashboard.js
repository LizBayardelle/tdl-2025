import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from './AdminLayout';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/admin.json')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load dashboard');
        setLoading(false);
      });
  }, []);

  return (
    <AdminLayout currentPage="dashboard">
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-8) clamp(var(--space-4), 4vw, var(--space-8))',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <DashboardHero />

          {loading && (
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-3)' }}>Loading.</p>
          )}

          {error && (
            <p style={{ fontFamily: 'var(--font-body)', color: 'var(--error)' }}>{error}</p>
          )}

          {stats && (
            <>
              <NeedsYouBand counts={stats.needs_you} />

              <SectionHead title="What's happening" />
              <KPIStrip kpis={stats.kpis} />
              <SignupsChart series={stats.signups_chart} />

              <SectionHead title="Who's doing what" />
              <TopUsersTable users={stats.top_users} />
              <InventoryGrid inventory={stats.inventory} />
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

// ---------- Hero ----------

function DashboardHero() {
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
        Dashboard
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
        What needs you, what's happening, and who's doing what.
      </p>
    </header>
  );
}

// ---------- Section head ----------

function SectionHead({ title }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: '24px',
        fontWeight: 600,
        color: 'var(--primary)',
        letterSpacing: '-0.005em',
        lineHeight: 1.2,
        paddingBottom: 'var(--space-3)',
        borderBottom: '1px solid var(--ink-line)',
        margin: '0 0 var(--space-5)',
      }}
    >
      {title}
    </h2>
  );
}

// ---------- Needs you ----------

function NeedsYouBand({ counts }) {
  const items = [
    counts.ready_for_review > 0 && {
      key: 'review',
      icon: 'fa-clipboard-check',
      tone: 'concept',
      text: <><strong>{counts.ready_for_review}</strong>{' '}{counts.ready_for_review === 1 ? 'concept generation is' : 'concept generations are'} ready for review.</>,
      href: '/admin/concept_generations',
    },
    counts.failed_generations > 0 && {
      key: 'failed',
      icon: 'fa-triangle-exclamation',
      tone: 'error',
      text: <><strong>{counts.failed_generations}</strong>{' '}{counts.failed_generations === 1 ? 'generation has' : 'generations have'} failed and need a retry.</>,
      href: '/admin/concept_generations',
    },
    counts.users_near_quota > 0 && {
      key: 'quota',
      icon: 'fa-gauge-high',
      tone: 'source',
      text: <><strong>{counts.users_near_quota}</strong>{' '}{counts.users_near_quota === 1 ? 'user is' : 'users are'} at or near their monthly generation cap.</>,
      href: '/admin/users',
    },
  ].filter(Boolean);

  const hasItems = items.length > 0;

  return (
    <section style={{ marginBottom: 'var(--space-8)' }}>
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
        Needs you
      </div>

      {!hasItems ? (
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            background: 'var(--paper-soft)',
            border: '1px solid var(--ink-line-soft)',
            borderRadius: 'var(--r-md)',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--ink-3)',
            fontStyle: 'italic',
          }}
        >
          Nothing waiting on you.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {items.map((item) => (
            <NeedsYouRow key={item.key} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function NeedsYouRow({ item }) {
  const toneColors = {
    concept: { bg: 'var(--concept-tint)', fg: 'var(--concept-2)' },
    source:  { bg: 'var(--source-tint)',  fg: 'var(--source-2)' },
    error:   { bg: 'rgba(122, 46, 46, 0.10)', fg: 'var(--error)' },
  }[item.tone] || { bg: 'var(--paper-warm)', fg: 'var(--ink-2)' };

  return (
    <a
      href={item.href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--paper)',
        border: '1px solid var(--ink-line)',
        borderRadius: 'var(--r-md)',
        textDecoration: 'none',
        color: 'var(--ink)',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        fontFamily: 'var(--font-body)',
        fontSize: '14px',
        lineHeight: 1.5,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--ink-line)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <span
        style={{
          width: '28px',
          height: '28px',
          borderRadius: 'var(--r-sm)',
          background: toneColors.bg,
          color: toneColors.fg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          flexShrink: 0,
        }}
      >
        <i className={`fas ${item.icon}`}></i>
      </span>
      <span style={{ flex: 1, color: 'var(--ink)' }}>{item.text}</span>
      <i className="fas fa-arrow-right" style={{ color: 'var(--ink-3)', fontSize: '11px' }}></i>
    </a>
  );
}

// ---------- KPI strip ----------

function KPIStrip({ kpis }) {
  const cards = [
    { label: 'Total users',         value: kpis.total_users,           tone: 'navy' },
    { label: 'New this week',       value: kpis.new_users_this_week,   tone: 'navy' },
    { label: 'Paid users',          value: kpis.paid_users,            tone: 'navy' },
    { label: 'Generations / week',  value: kpis.generations_this_week, tone: 'concept' },
    { label: 'Sources / week',      value: kpis.sources_this_week,     tone: 'source' },
    { label: 'Notes / week',        value: kpis.notes_this_week,       tone: 'navy' },
  ];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
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
  const valueColor = {
    concept: 'var(--concept)',
    source:  'var(--source)',
    person:  'var(--person)',
    navy:    'var(--primary)',
  }[tone] || 'var(--primary)';
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

// ---------- Signups chart ----------

function SignupsChart({ series }) {
  const max = useMemo(() => {
    const m = Math.max(0, ...series.map((d) => d.count));
    return m === 0 ? 1 : m;
  }, [series]);

  const total = useMemo(
    () => series.reduce((s, d) => s + d.count, 0),
    [series]
  );

  const W = 680;
  const H = 140;
  const padX = 4;
  const padY = 4;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const barWidth = innerW / series.length;

  return (
    <div
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--ink-line)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--space-5) var(--space-6)',
        marginBottom: 'var(--space-8)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-4)',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              marginBottom: '4px',
            }}
          >
            Signups · last 30 days
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--primary)',
              fontVariantNumeric: 'tabular-nums lining-nums',
              letterSpacing: '-0.005em',
              lineHeight: 1.05,
            }}
          >
            {total.toLocaleString()}
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--ink-3)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          peak {max}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: H, display: 'block' }}
        role="img"
        aria-label="Signups per day for the last 30 days"
      >
        {series.map((d, i) => {
          const h = (d.count / max) * innerH;
          const x = padX + i * barWidth;
          const y = padY + (innerH - h);
          const w = Math.max(1, barWidth - 2);
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={1}
              fill="var(--primary)"
              opacity={d.count === 0 ? 0.12 : 0.85}
            >
              <title>
                {d.date}: {d.count} signup{d.count === 1 ? '' : 's'}
              </title>
            </rect>
          );
        })}
      </svg>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 'var(--space-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10.5px',
          color: 'var(--ink-3)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{formatChartDate(series[0]?.date)}</span>
        <span>{formatChartDate(series[Math.floor(series.length / 2)]?.date)}</span>
        <span>{formatChartDate(series[series.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function formatChartDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------- Top users table ----------

function TopUsersTable({ users }) {
  if (!users || users.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-5)',
          background: 'var(--paper-soft)',
          border: '1px dashed var(--ink-line)',
          borderRadius: 'var(--r-md)',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          color: 'var(--ink-3)',
          textAlign: 'center',
          marginBottom: 'var(--space-6)',
        }}
      >
        No user activity in the last 7 days.
      </div>
    );
  }
  return (
    <div
      style={{
        border: '1px solid var(--ink-line)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        marginBottom: 'var(--space-6)',
      }}
    >
      <table className="sp-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Plan</th>
            <th className="sp-th-num">Concepts</th>
            <th className="sp-th-num">Sources</th>
            <th className="sp-th-num">Notes</th>
            <th className="sp-th-num">Total</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <UserCell user={u} />
              </td>
              <td>
                <PlanBadge plan={u.plan} />
              </td>
              <td className="sp-td-num">{u.concepts}</td>
              <td className="sp-td-num">{u.sources}</td>
              <td className="sp-td-num">{u.notes}</td>
              <td className="sp-td-num" style={{ color: 'var(--ink)', fontWeight: 600 }}>
                {u.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

// ---------- Inventory ----------

const INVENTORY_META = [
  { key: 'concepts',  label: 'Concepts',  icon: 'fa-lightbulb',     tone: 'concept' },
  { key: 'sources',   label: 'Sources',   icon: 'fa-book',          tone: 'source' },
  { key: 'people',    label: 'People',    icon: 'fa-user',          tone: 'person' },
  { key: 'notes',     label: 'Notes',     icon: 'fa-pen-fancy',     tone: 'navy' },
  { key: 'tabletops', label: 'Tabletops', icon: 'fa-table-cells',   tone: 'navy' },
];

function InventoryGrid({ inventory }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-8)',
      }}
    >
      {INVENTORY_META.map((m) => {
        const row = inventory[m.key] || { total: 0, avg_per_user: 0 };
        return (
          <InventoryCard
            key={m.key}
            label={m.label}
            icon={m.icon}
            tone={m.tone}
            total={row.total}
            avgPerUser={row.avg_per_user}
          />
        );
      })}
    </div>
  );
}

function InventoryCard({ label, icon, tone, total, avgPerUser }) {
  const valueColor = {
    concept: 'var(--concept)',
    source:  'var(--source)',
    person:  'var(--person)',
    navy:    'var(--primary)',
  }[tone] || 'var(--primary)';
  const tintBg = {
    concept: 'var(--concept-tint)',
    source:  'var(--source-tint)',
    person:  'var(--person-tint)',
    navy:    'var(--paper-warm)',
  }[tone] || 'var(--paper-warm)';
  return (
    <div
      style={{
        background: 'var(--paper)',
        padding: 'var(--space-4) var(--space-5)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--ink-line)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontFamily: 'var(--font-body)',
          fontSize: '10.5px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        <span
          style={{
            width: '20px',
            height: '20px',
            borderRadius: 'var(--r-sm)',
            background: tintBg,
            color: valueColor,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
          }}
        >
          <i className={`fas ${icon}`}></i>
        </span>
        {label}
      </div>
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
        {total.toLocaleString()}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          color: 'var(--ink-3)',
          marginTop: '-2px',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>
          {avgPerUser}
        </span>{' '}
        avg per user
      </div>
    </div>
  );
}
