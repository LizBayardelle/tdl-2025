import React, { useState, useEffect, useMemo } from 'react';

function csrfToken() {
  return document.querySelector('[name="csrf-token"]')?.content;
}

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  dismissed: 'Dismissed',
};

export default function NotificationsIndex() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('pending');
  const [busy, setBusy] = useState({});

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/notifications.json');
      if (res.ok) setNotifications(await res.json());
      else setError('Failed to load notifications');
    } catch {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const act = async (id, action, body) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`/notifications/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: body ? JSON.stringify(body) : null,
      });
      if (res.ok) {
        const updated = await res.json();
        setNotifications((ns) => ns.map((n) => (n.id === id ? updated : n)));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed to ${action}`);
      }
    } catch {
      setError(`Failed to ${action}`);
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const counts = useMemo(() => {
    return notifications.reduce(
      (acc, n) => {
        acc[n.status] = (acc[n.status] || 0) + 1;
        return acc;
      },
      { pending: 0, approved: 0, dismissed: 0 }
    );
  }, [notifications]);

  const visible = useMemo(
    () => notifications.filter((n) => n.status === filter),
    [notifications, filter]
  );

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <h1>Notifications</h1>
        <p className="notifications-sub">
          Concept merges and other suggestions that need your review.
        </p>
      </header>

      <div className="notifications-tabs">
        {Object.keys(STATUS_LABELS).map((s) => (
          <button
            key={s}
            type="button"
            className={`notifications-tab ${filter === s ? 'is-active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {STATUS_LABELS[s]}
            {counts[s] > 0 && <span className="notifications-tab-count">{counts[s]}</span>}
          </button>
        ))}
      </div>

      {error && <div className="notifications-error">{error}</div>}

      {loading ? (
        <div className="notifications-empty">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="notifications-empty">Nothing {filter}.</div>
      ) : (
        <ul className="notifications-list">
          {visible.map((n) => (
            <NotificationRow key={n.id} notification={n} busy={!!busy[n.id]} act={act} />
          ))}
        </ul>
      )}

      <style>{`
        .notifications-page { max-width: 880px; margin: 0 auto; padding: 32px 24px; }
        .notifications-header h1 { font-family: var(--font-display); margin: 0 0 4px; }
        .notifications-sub { color: var(--ink-3); font-size: 14px; margin: 0 0 24px; }
        .notifications-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--ink-line); margin-bottom: 16px; }
        .notifications-tab {
          background: transparent; border: none; padding: 10px 14px;
          font-family: var(--font-body); font-size: 13.5px; color: var(--ink-3);
          cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;
        }
        .notifications-tab:hover { color: var(--ink); }
        .notifications-tab.is-active { color: var(--ink); border-bottom-color: var(--ink); font-weight: 600; }
        .notifications-tab-count {
          margin-left: 6px; padding: 1px 7px; border-radius: 10px;
          background: var(--paper-warm); font-size: 11px; font-weight: 600;
        }
        .notifications-error { padding: 10px 14px; background: var(--error-soft, #fee); color: var(--error, #c00); border-radius: 6px; margin-bottom: 12px; }
        .notifications-empty { padding: 40px; text-align: center; color: var(--ink-3); }
        .notifications-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
      `}</style>
    </div>
  );
}

function NotificationRow({ notification, busy, act }) {
  if (notification.kind === 'concept_alias_suggestion') {
    const payload = notification.payload || {};
    if (payload.concept_a_id) {
      return <AliasPairRow notification={notification} busy={busy} act={act} />;
    }
    return <AliasSuggestionRow notification={notification} busy={busy} act={act} />;
  }
  return (
    <li className="notification-row">
      <div>{notification.kind}</div>
    </li>
  );
}

function AliasPairRow({ notification, busy, act }) {
  const { payload, status } = notification;
  const a = { id: payload.concept_a_id, label: payload.concept_a_label };
  const b = { id: payload.concept_b_id, label: payload.concept_b_label };
  const isPending = status === 'pending';

  const useAsCanonical = (winner, loser) =>
    act(notification.id, 'approve', { winner_id: winner.id });

  return (
    <li className="notification-row">
      <div className="notification-row-head">
        <span className="notification-row-label">These two look like the same thing:</span>
      </div>
      <div className="notification-pair">
        <a className="notification-pair-side" href={`/concepts/${a.id}`}>{a.label}</a>
        <span className="notification-pair-divider">↔</span>
        <a className="notification-pair-side" href={`/concepts/${b.id}`}>{b.label}</a>
        {payload.confidence && <span className="notification-conf">{payload.confidence}</span>}
      </div>
      {payload.reasoning && <div className="notification-reasoning">{payload.reasoning}</div>}

      {isPending && (
        <>
          <div className="notification-helper">
            Picking one keeps that name; the other concept is merged into it (its notes, sources, people, and relationships move over) and its label becomes an alias.
          </div>
          <div className="notification-actions">
            <button
              type="button"
              className="notification-btn notification-btn-primary"
              disabled={busy}
              onClick={() => useAsCanonical(a, b)}
              title={`Keep "${a.label}". Merge "${b.label}" into it (becomes an alias).`}
            >
              Use "{a.label}"
            </button>
            <button
              type="button"
              className="notification-btn notification-btn-primary"
              disabled={busy}
              onClick={() => useAsCanonical(b, a)}
              title={`Keep "${b.label}". Merge "${a.label}" into it (becomes an alias).`}
            >
              Use "{b.label}"
            </button>
            <button
              type="button"
              className="notification-btn"
              disabled={busy}
              onClick={() => act(notification.id, 'mark_different')}
              title="Record that these are distinct concepts. You won't be asked about this pair again."
            >
              These are different things
            </button>
          </div>
        </>
      )}

      <style>{`
        .notification-row { background: var(--paper); border: 1px solid var(--ink-line); border-radius: 8px; padding: 16px; }
        .notification-row-label { color: var(--ink-3); font-size: 13px; }
        .notification-pair { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 6px 0 4px; font-size: 15px; }
        .notification-pair-side { font-weight: 600; color: var(--ink); text-decoration: none; padding: 2px 8px; border-radius: 4px; background: var(--paper-soft); }
        .notification-pair-side:hover { background: var(--paper-warm); text-decoration: underline; }
        .notification-pair-divider { color: var(--ink-3); font-weight: 500; }
        .notification-conf {
          margin-left: 4px; font-size: 11px; padding: 1px 6px; border-radius: 10px;
          background: var(--paper-warm); color: var(--ink-3);
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .notification-reasoning { font-size: 12.5px; color: var(--ink-3); margin: 4px 0 8px; line-height: 1.4; }
        .notification-helper { font-size: 12.5px; color: var(--ink-3); margin: 8px 0 10px; line-height: 1.45; padding: 8px 10px; background: var(--paper-soft); border-radius: 6px; }
        .notification-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .notification-btn {
          padding: 7px 14px; border-radius: 6px; border: 1px solid var(--ink-line);
          background: var(--paper); color: var(--ink); font-size: 13px; cursor: pointer;
        }
        .notification-btn:hover:not(:disabled) { background: var(--hover); }
        .notification-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .notification-btn-primary {
          background: var(--ink); color: var(--paper); border-color: var(--ink);
        }
        .notification-btn-primary:hover:not(:disabled) { background: var(--ink-2); }
      `}</style>
    </li>
  );
}

function AliasSuggestionRow({ notification, busy, act }) {
  const { payload, status } = notification;
  const candidate = payload?.candidate_label || `Concept #${payload?.candidate_concept_id}`;
  const suggestions = payload?.suggestions || [];
  const [winnerId, setWinnerId] = useState(suggestions[0]?.id);

  const isPending = status === 'pending';

  return (
    <li className="notification-row">
      <div className="notification-row-head">
        <strong>{candidate}</strong>
        <span className="notification-row-meta">looks like an alias of:</span>
      </div>

      <ul className="notification-suggestions">
        {suggestions.map((s) => (
          <li key={s.id} className="notification-suggestion">
            {isPending && (
              <input
                type="radio"
                name={`winner-${notification.id}`}
                checked={winnerId === s.id}
                onChange={() => setWinnerId(s.id)}
              />
            )}
            <div>
              <div className="notification-suggestion-label">
                <a href={`/concepts/${s.id}`}>{s.label}</a>
                {s.confidence && <span className="notification-conf">{s.confidence}</span>}
              </div>
              {s.reasoning && <div className="notification-reasoning">{s.reasoning}</div>}
            </div>
          </li>
        ))}
      </ul>

      {isPending && (
        <div className="notification-actions">
          <button
            type="button"
            className="notification-btn notification-btn-primary"
            disabled={busy || !winnerId}
            onClick={() => act(notification.id, 'approve', { winner_id: winnerId })}
          >
            {busy ? 'Merging…' : 'Merge'}
          </button>
          <button
            type="button"
            className="notification-btn"
            disabled={busy}
            onClick={() => act(notification.id, 'dismiss')}
          >
            Dismiss
          </button>
        </div>
      )}

      <style>{`
        .notification-row {
          background: var(--paper); border: 1px solid var(--ink-line);
          border-radius: 8px; padding: 16px;
        }
        .notification-row-head { font-size: 14px; margin-bottom: 8px; }
        .notification-row-meta { color: var(--ink-3); margin-left: 8px; font-size: 13px; }
        .notification-suggestions { list-style: none; padding: 0; margin: 8px 0 12px; display: flex; flex-direction: column; gap: 8px; }
        .notification-suggestion { display: flex; gap: 10px; align-items: flex-start; padding: 8px; border-radius: 6px; background: var(--paper-soft); }
        .notification-suggestion-label { font-size: 14px; }
        .notification-suggestion-label a { color: var(--ink); text-decoration: none; font-weight: 500; }
        .notification-suggestion-label a:hover { text-decoration: underline; }
        .notification-conf {
          margin-left: 8px; font-size: 11px; padding: 1px 6px;
          border-radius: 10px; background: var(--paper-warm); color: var(--ink-3);
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .notification-reasoning { font-size: 12.5px; color: var(--ink-3); margin-top: 2px; }
        .notification-actions { display: flex; gap: 8px; }
        .notification-btn {
          padding: 7px 14px; border-radius: 6px; border: 1px solid var(--ink-line);
          background: var(--paper); color: var(--ink); font-size: 13px; cursor: pointer;
        }
        .notification-btn:hover:not(:disabled) { background: var(--hover); }
        .notification-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .notification-btn-primary {
          background: var(--ink); color: var(--paper); border-color: var(--ink);
        }
        .notification-btn-primary:hover:not(:disabled) { background: var(--ink-2); }
      `}</style>
    </li>
  );
}
