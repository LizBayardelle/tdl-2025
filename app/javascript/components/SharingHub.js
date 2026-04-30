import React, { useState, useEffect, useMemo } from 'react';

const TABS = [
  { id: 'collections',     label: 'Collections',     icon: 'fa-folder' },
  { id: 'shared-with-me',  label: 'Shared with me',  icon: 'fa-inbox' },
  { id: 'my-shares',       label: 'My shares',       icon: 'fa-share' },
];

const PERMISSION_OPTIONS = [
  { value: 'viewer',       label: 'Viewer',       description: 'Can view only' },
  { value: 'editor',       label: 'Editor',       description: 'Can view and edit' },
  { value: 'collaborator', label: 'Collaborator', description: 'Can view, edit, and add items' },
];

const TYPE_ORDER = ['Collection', 'Source', 'Concept', 'Person', 'Note'];

const TYPE_META = {
  Collection: { icon: 'fa-folder',      tone: 'neutral' },
  Source:     { icon: 'fa-book',        tone: 'source' },
  Concept:    { icon: 'fa-lightbulb',   tone: 'concept' },
  Person:     { icon: 'fa-user',        tone: 'person' },
  Note:       { icon: 'fa-pen-fancy',   tone: 'neutral' },
};

const csrf = () => document.querySelector('[name="csrf-token"]')?.content;

export default function SharingHub() {
  const [activeTab, setActiveTab] = useState('collections');
  const [collections, setCollections] = useState([]);
  const [receivedShares, setReceivedShares] = useState([]);
  const [outgoingShares, setOutgoingShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Collection creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Expanded collection
  const [expandedCollection, setExpandedCollection] = useState(null);
  const [collectionDetails, setCollectionDetails] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [collectionsRes, receivedRes, outgoingRes] = await Promise.all([
        fetch('/collections.json'),
        fetch('/shares/received.json'),
        fetch('/shares.json'),
      ]);
      if (collectionsRes.ok) setCollections(await collectionsRes.json());
      if (receivedRes.ok)    setReceivedShares(await receivedRes.json());
      if (outgoingRes.ok)    setOutgoingShares(await outgoingRes.json());
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({
          collection: {
            name: newCollectionName.trim(),
            description: newCollectionDescription.trim(),
          },
        }),
      });
      if (res.ok) {
        const newCollection = await res.json();
        setCollections([...collections, newCollection]);
        setNewCollectionName('');
        setNewCollectionDescription('');
        setShowCreateForm(false);
      } else {
        const data = await res.json();
        setError(data.errors?.join(', ') || 'Failed to create collection');
      }
    } catch {
      setError('Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCollection = async (collectionId) => {
    if (!window.confirm('Delete this collection?  Items inside it will not be deleted.')) return;
    try {
      const res = await fetch(`/collections/${collectionId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf() },
      });
      if (res.ok) {
        setCollections((cs) => cs.filter((c) => c.id !== collectionId));
        if (expandedCollection === collectionId) {
          setExpandedCollection(null);
          setCollectionDetails(null);
        }
      }
    } catch {
      setError('Failed to delete collection');
    }
  };

  const handleExpandCollection = async (collectionId) => {
    if (expandedCollection === collectionId) {
      setExpandedCollection(null);
      setCollectionDetails(null);
      return;
    }
    try {
      const res = await fetch(`/collections/${collectionId}.json`);
      if (res.ok) {
        setCollectionDetails(await res.json());
        setExpandedCollection(collectionId);
      }
    } catch {
      console.error('Failed to load collection details');
    }
  };

  const handleRevokeShare = async (shareId) => {
    if (!window.confirm('Revoke this share?  The recipient will lose access immediately.')) return;
    try {
      const res = await fetch(`/shares/${shareId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrf() },
      });
      if (res.ok) {
        setOutgoingShares((shares) => shares.filter((s) => s.id !== shareId));
      }
    } catch {
      console.error('Failed to revoke share');
    }
  };

  const handleUpdatePermission = async (shareId, newPermission) => {
    try {
      const res = await fetch(`/shares/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ share: { permission: newPermission } }),
      });
      if (res.ok) {
        setOutgoingShares((shares) =>
          shares.map((s) => (s.id === shareId ? { ...s, permission: newPermission } : s))
        );
      }
    } catch {
      console.error('Failed to update permission');
    }
  };

  const getItemLink = (type, id) => {
    switch (type) {
      case 'Collection': return `/collections/${id}`;
      case 'Source':     return `/sources/${id}`;
      case 'Concept':    return `/concepts/${id}`;
      case 'Person':     return `/people/${id}`;
      case 'Note':       return `/notes/${id}`;
      default:           return '#';
    }
  };

  const tabCounts = {
    collections:      collections.length,
    'shared-with-me': receivedShares.length,
    'my-shares':      outgoingShares.length,
  };

  return (
    <div className="sh-shell">
      <SharingHubStyles />
      <div className="sh-container">
        <SharingHero
          collections={collections.length}
          received={receivedShares.length}
          sent={outgoingShares.length}
        />

        {error && (
          <Banner tone="error" onDismiss={() => setError('')}>{error}</Banner>
        )}

        <Tabs activeTab={activeTab} onChange={setActiveTab} counts={tabCounts} />

        {loading ? (
          <p className="sh-loading">Loading.</p>
        ) : (
          <>
            {activeTab === 'collections' && (
              <CollectionsTab
                collections={collections}
                showCreateForm={showCreateForm}
                onShowCreateForm={() => setShowCreateForm(true)}
                onCancelCreateForm={() => {
                  setShowCreateForm(false);
                  setNewCollectionName('');
                  setNewCollectionDescription('');
                }}
                newCollectionName={newCollectionName}
                onNewCollectionNameChange={setNewCollectionName}
                newCollectionDescription={newCollectionDescription}
                onNewCollectionDescriptionChange={setNewCollectionDescription}
                creating={creating}
                onCreateCollection={handleCreateCollection}
                onDeleteCollection={handleDeleteCollection}
                expandedCollection={expandedCollection}
                onExpandCollection={handleExpandCollection}
                collectionDetails={collectionDetails}
                getItemLink={getItemLink}
              />
            )}
            {activeTab === 'shared-with-me' && (
              <SharedWithMeTab shares={receivedShares} getItemLink={getItemLink} />
            )}
            {activeTab === 'my-shares' && (
              <MySharesTab
                shares={outgoingShares}
                onUpdatePermission={handleUpdatePermission}
                onRevokeShare={handleRevokeShare}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Hero
// =====================================================================
function SharingHero({ collections, received, sent }) {
  return (
    <header className="sh-hero">
      <div className="sh-hero-eyebrow">Linchpin Industries · Map My Research</div>
      <h1 className="sh-hero-title">Sharing</h1>
      <p className="sh-hero-lead">
        Group sources, concepts, people, and notes into collections — then share them
        with collaborators.  Permissions update immediately; revoking a share removes
        access on the recipient's next page load.
      </p>
      <div className="sh-hero-stats">
        <HeroStat label="Collections"     value={collections} />
        <HeroStat label="Shared with you" value={received} />
        <HeroStat label="You've shared"   value={sent} />
      </div>
    </header>
  );
}

function HeroStat({ label, value }) {
  return (
    <div className="sh-hero-stat">
      <div className="sh-hero-stat-value">{value}</div>
      <div className="sh-hero-stat-label">{label}</div>
    </div>
  );
}

// =====================================================================
// Tabs
// =====================================================================
function Tabs({ activeTab, onChange, counts }) {
  return (
    <nav className="sh-tabs" role="tablist">
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        const count = counts[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`sh-tab ${active ? 'is-active' : ''}`}
          >
            <i className={`fas ${tab.icon} sh-tab-icon`} aria-hidden="true"></i>
            {tab.label}
            {count > 0 && <span className="sh-tab-count">{count}</span>}
          </button>
        );
      })}
    </nav>
  );
}

// =====================================================================
// Collections tab
// =====================================================================
function CollectionsTab({
  collections,
  showCreateForm, onShowCreateForm, onCancelCreateForm,
  newCollectionName, onNewCollectionNameChange,
  newCollectionDescription, onNewCollectionDescriptionChange,
  creating, onCreateCollection,
  onDeleteCollection,
  expandedCollection, onExpandCollection,
  collectionDetails, getItemLink,
}) {
  return (
    <div>
      {showCreateForm ? (
        <CreateCollectionForm
          name={newCollectionName}
          onNameChange={onNewCollectionNameChange}
          description={newCollectionDescription}
          onDescriptionChange={onNewCollectionDescriptionChange}
          creating={creating}
          onSubmit={onCreateCollection}
          onCancel={onCancelCreateForm}
        />
      ) : (
        <button
          type="button"
          onClick={onShowCreateForm}
          className="sp-action sp-action-primary sh-create-trigger"
        >
          + New collection
        </button>
      )}

      {collections.length === 0 ? (
        <EmptyState
          icon="fa-folder-open"
          title="No collections yet"
          body="Create one to organize sources, concepts, people, and notes that go together — and share the whole bundle in one go."
        />
      ) : (
        <ul className="sh-list">
          {collections.map((collection) => (
            <CollectionRow
              key={collection.id}
              collection={collection}
              expanded={expandedCollection === collection.id}
              details={expandedCollection === collection.id ? collectionDetails : null}
              onExpand={() => onExpandCollection(collection.id)}
              onDelete={() => onDeleteCollection(collection.id)}
              getItemLink={getItemLink}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateCollectionForm({
  name, onNameChange,
  description, onDescriptionChange,
  creating, onSubmit, onCancel,
}) {
  return (
    <form onSubmit={onSubmit} className="sh-create-form">
      <div className="sh-create-eyebrow">New collection</div>
      <div className="sp-field">
        <label className="sp-label">Name</label>
        <input
          type="text"
          className="sp-input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g., Attachment theory papers"
          autoFocus
          required
        />
      </div>
      <div className="sp-field">
        <label className="sp-label">Description</label>
        <textarea
          className="sp-textarea"
          rows={2}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Optional.  A short note about what belongs here."
        />
      </div>
      <div className="sh-create-actions">
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="sp-action sp-action-primary"
        >
          {creating ? 'Creating.' : 'Create collection'}
        </button>
        <button type="button" onClick={onCancel} className="sp-action sp-action-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function CollectionRow({ collection, expanded, details, onExpand, onDelete, getItemLink }) {
  return (
    <li className={`sh-row ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="sh-row-head"
        onClick={onExpand}
        aria-expanded={expanded}
      >
        <i
          className={`fas ${expanded ? 'fa-folder-open' : 'fa-folder'} sh-row-icon`}
          aria-hidden="true"
        ></i>
        <div className="sh-row-text">
          <div className="sh-row-title">{collection.name}</div>
          {collection.description && (
            <div className="sh-row-desc">{collection.description}</div>
          )}
          <div className="sh-row-meta">
            {collection.items_count || 0} {(collection.items_count || 0) === 1 ? 'item' : 'items'}
          </div>
        </div>
        <button
          type="button"
          className="sh-row-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={`Delete ${collection.name}`}
        >
          <i className="fas fa-trash" aria-hidden="true"></i>
        </button>
        <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} sh-row-caret`} aria-hidden="true"></i>
      </button>

      {expanded && (
        <CollectionDetails details={details} getItemLink={getItemLink} />
      )}
    </li>
  );
}

function CollectionDetails({ details, getItemLink }) {
  if (!details) {
    return <div className="sh-row-body sh-row-empty">Loading.</div>;
  }
  const groups = ['sources', 'concepts', 'people', 'notes'];
  const empty = groups.every((g) => !(details[g]?.length));
  if (empty) {
    return (
      <div className="sh-row-body sh-row-empty">
        This collection is empty.  Add items from their detail pages.
      </div>
    );
  }
  return (
    <div className="sh-row-body">
      {groups.map((groupKey) => {
        const items = details[groupKey] || [];
        if (items.length === 0) return null;
        const Type = groupKey.charAt(0).toUpperCase() + groupKey.slice(1, -1);
        const tone = TYPE_META[Type]?.tone || 'neutral';
        return (
          <div key={groupKey} className="sh-row-group">
            <div className="sh-row-group-label">{groupKey}</div>
            <div className="sh-row-group-chips">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={getItemLink(Type, item.id)}
                  className={`sp-chip is-${tone}`}
                >
                  {item.title || item.label || item.full_name || (item.body || '').substring(0, 30)}
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// Shared with me / My shares
// =====================================================================

function SharedWithMeTab({ shares, getItemLink }) {
  const grouped = useMemo(() => groupByType(shares), [shares]);
  if (shares.length === 0) {
    return (
      <EmptyState
        icon="fa-inbox"
        title="Nothing shared with you yet"
        body="When a collaborator shares an item, it'll show up here.  You'll see the same item from their library, with the permission they granted."
      />
    );
  }
  return (
    <div className="sh-groups">
      {TYPE_ORDER.map((type) => {
        const list = grouped[type];
        if (!list || list.length === 0) return null;
        return (
          <ShareGroup key={type} type={type} count={list.length}>
            {list.map((share) => (
              <a
                key={share.id}
                href={getItemLink(share.shareable_type, share.shareable_id)}
                className="sh-share"
              >
                <div className="sh-share-text">
                  <div className="sh-share-name">{share.shareable_name}</div>
                  <div className="sh-share-meta">Shared by {share.email}</div>
                </div>
                <PermissionBadge permission={share.permission} />
              </a>
            ))}
          </ShareGroup>
        );
      })}
    </div>
  );
}

function MySharesTab({ shares, onUpdatePermission, onRevokeShare }) {
  const grouped = useMemo(() => groupByType(shares), [shares]);
  return (
    <div>
      <Banner tone="info">
        To share an item, open its detail page and click the Share button.  Permissions
        are managed here once a share exists.
      </Banner>

      {shares.length === 0 ? (
        <EmptyState
          icon="fa-share"
          title="You haven't shared anything yet"
          body="Open a source, concept, person, or collection and click Share to grant a collaborator access."
        />
      ) : (
        <div className="sh-groups">
          {TYPE_ORDER.map((type) => {
            const list = grouped[type];
            if (!list || list.length === 0) return null;
            return (
              <ShareGroup key={type} type={type} count={list.length}>
                {list.map((share) => (
                  <div key={share.id} className="sh-share is-mine">
                    <div className="sh-share-text">
                      <div className="sh-share-name">{share.shareable_name}</div>
                      <div className="sh-share-meta">
                        Shared with {share.email}
                        {share.pending && <span className="sh-pending">Pending</span>}
                      </div>
                    </div>
                    <div className="sh-share-actions">
                      <select
                        className="sh-perm-select"
                        value={share.permission}
                        onChange={(e) => onUpdatePermission(share.id, e.target.value)}
                      >
                        {PERMISSION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onRevokeShare(share.id)}
                        className="sp-action sp-action-quiet sp-action-danger sh-revoke"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </ShareGroup>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShareGroup({ type, count, children }) {
  const meta = TYPE_META[type] || { icon: 'fa-file', tone: 'neutral' };
  const label = type === 'Person' ? 'People' : `${type}s`;
  return (
    <section className="sh-group">
      <h2 className="sh-group-title">
        <i className={`fas ${meta.icon} sh-group-icon`} data-tone={meta.tone} aria-hidden="true"></i>
        {label}
        <span className="sh-group-count">{count}</span>
      </h2>
      <div className="sh-group-body">{children}</div>
    </section>
  );
}

function PermissionBadge({ permission }) {
  const tone = {
    viewer:       'neutral',
    editor:       'source',
    collaborator: 'concept',
  }[permission] || 'neutral';
  return <span className={`sp-chip is-${tone}`} style={{ textTransform: 'capitalize' }}>{permission}</span>;
}

function groupByType(shares) {
  return shares.reduce((acc, share) => {
    const t = share.shareable_type;
    if (!acc[t]) acc[t] = [];
    acc[t].push(share);
    return acc;
  }, {});
}

// =====================================================================
// Empty + Banner
// =====================================================================
function EmptyState({ icon, title, body }) {
  return (
    <div className="sh-empty">
      <i className={`fas ${icon} sh-empty-icon`} aria-hidden="true"></i>
      <div className="sh-empty-title">{title}</div>
      <p className="sh-empty-body">{body}</p>
    </div>
  );
}

function Banner({ tone, children, onDismiss }) {
  return (
    <div className={`sh-banner sh-banner-${tone || 'info'}`}>
      <div>{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="sh-banner-dismiss"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}

// =====================================================================
// Styles
// =====================================================================
function SharingHubStyles() {
  return (
    <style>{`
      .sh-shell {
        flex: 1;
        background: var(--paper-soft);
        padding: 32px 20px 80px;
      }
      .sh-container {
        max-width: 920px;
        margin: 0 auto;
      }
      .sh-loading {
        font-family: var(--font-body);
        color: var(--ink-3);
        padding: 32px 0;
      }

      /* Hero */
      .sh-hero {
        margin-bottom: 28px;
        padding-bottom: 28px;
        border-bottom: 1px solid var(--ink-line);
      }
      .sh-hero-eyebrow {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 12px;
      }
      .sh-hero-title {
        font-family: var(--font-display);
        font-size: 44px;
        font-weight: 600;
        color: var(--primary);
        letter-spacing: -0.02em;
        line-height: 1.05;
        margin: 0;
      }
      .sh-hero-lead {
        font-family: var(--font-body);
        font-size: 16px;
        color: var(--ink-2);
        line-height: 1.65;
        max-width: 680px;
        margin: 14px 0 20px;
      }
      .sh-hero-stats {
        display: flex;
        gap: 32px;
        flex-wrap: wrap;
      }
      .sh-hero-stat-value {
        font-family: var(--font-display);
        font-size: 24px;
        font-weight: 600;
        color: var(--primary);
        font-variant-numeric: tabular-nums lining-nums;
        letter-spacing: -0.005em;
        line-height: 1.05;
      }
      .sh-hero-stat-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-top: 4px;
      }

      /* Tabs */
      .sh-tabs {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--ink-line);
        margin-bottom: 24px;
        flex-wrap: wrap;
      }
      .sh-tab {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 14px;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        font-family: var(--font-body);
        font-size: 13px;
        font-weight: 500;
        color: var(--ink-3);
        cursor: pointer;
        margin-bottom: -1px;
        transition: color 0.15s, border-color 0.15s;
      }
      .sh-tab:hover { color: var(--ink); }
      .sh-tab.is-active {
        color: var(--primary);
        border-bottom-color: var(--primary);
        font-weight: 600;
      }
      .sh-tab-icon { font-size: 12px; opacity: 0.85; }
      .sh-tab-count {
        font-family: var(--font-mono);
        font-size: 10.5px;
        font-variant-numeric: tabular-nums;
        background: var(--paper-warm);
        color: var(--ink-3);
        padding: 1px 7px;
        border-radius: var(--r-pill);
      }
      .sh-tab.is-active .sh-tab-count {
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        color: var(--primary);
      }

      /* Banner */
      .sh-banner {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 12px 14px;
        border-radius: var(--r-md);
        font-family: var(--font-body);
        font-size: 13.5px;
        line-height: 1.55;
        margin-bottom: 16px;
      }
      .sh-banner-info {
        background: var(--paper-soft);
        color: var(--ink-2);
        border: 1px solid var(--ink-line);
        border-left: 3px solid var(--primary);
      }
      .sh-banner-error {
        background: rgba(122, 46, 46, 0.06);
        color: var(--error);
        border: 1px solid rgba(122, 46, 46, 0.20);
      }
      .sh-banner > div { flex: 1; min-width: 0; }
      .sh-banner-dismiss {
        background: transparent;
        border: none;
        color: inherit;
        opacity: 0.7;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 0 4px;
      }
      .sh-banner-dismiss:hover { opacity: 1; }

      /* Empty */
      .sh-empty {
        background: var(--paper-soft);
        border: 1px dashed var(--ink-line);
        border-radius: var(--r-md);
        padding: 40px 24px;
        text-align: center;
      }
      .sh-empty-icon {
        font-size: 28px;
        color: var(--ink-4);
        margin-bottom: 10px;
        display: block;
      }
      .sh-empty-title {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--primary);
        margin-bottom: 6px;
        letter-spacing: -0.005em;
      }
      .sh-empty-body {
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink-3);
        line-height: 1.6;
        max-width: 460px;
        margin: 0 auto;
      }

      /* Create form */
      .sh-create-trigger {
        margin-bottom: 18px;
      }
      .sh-create-form {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 18px 20px;
        margin-bottom: 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .sh-create-eyebrow {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
      }
      .sh-create-actions {
        display: flex;
        gap: 8px;
      }

      /* Collection list */
      .sh-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .sh-row {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        overflow: hidden;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .sh-row:hover { border-color: var(--ink-3); }
      .sh-row.is-expanded { border-color: var(--primary); }

      .sh-row-head {
        display: flex;
        align-items: center;
        gap: 14px;
        width: 100%;
        padding: 14px 16px;
        background: transparent;
        border: none;
        text-align: left;
        cursor: pointer;
        font-family: var(--font-body);
        color: inherit;
      }
      .sh-row-icon {
        font-size: 16px;
        color: var(--primary);
        flex-shrink: 0;
        width: 18px;
        text-align: center;
      }
      .sh-row-text {
        flex: 1;
        min-width: 0;
      }
      .sh-row-title {
        font-family: var(--font-display);
        font-size: 16px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: -0.005em;
      }
      .sh-row-desc {
        font-size: 13px;
        color: var(--ink-2);
        margin-top: 2px;
        line-height: 1.5;
      }
      .sh-row-meta {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
        margin-top: 4px;
        font-variant-numeric: tabular-nums;
      }
      .sh-row-delete {
        background: transparent;
        border: none;
        color: var(--ink-3);
        cursor: pointer;
        padding: 6px 8px;
        font-size: 12px;
        border-radius: var(--r-sm);
        transition: color 0.15s, background 0.15s;
      }
      .sh-row-delete:hover {
        color: var(--error);
        background: rgba(122, 46, 46, 0.06);
      }
      .sh-row-caret {
        color: var(--ink-3);
        font-size: 11px;
      }

      .sh-row-body {
        border-top: 1px solid var(--ink-line-soft);
        padding: 16px 18px;
        background: var(--paper-soft);
      }
      .sh-row-empty {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-3);
        font-style: italic;
      }
      .sh-row-group + .sh-row-group {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--ink-line-soft);
      }
      .sh-row-group-label {
        font-family: var(--font-body);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 8px;
      }
      .sh-row-group-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      /* Share groups */
      .sh-groups {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .sh-group-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--primary);
        margin: 0 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--ink-line);
        letter-spacing: -0.005em;
      }
      .sh-group-icon {
        font-size: 12px;
      }
      .sh-group-icon[data-tone="source"]  { color: var(--source); }
      .sh-group-icon[data-tone="concept"] { color: var(--concept); }
      .sh-group-icon[data-tone="person"]  { color: var(--person); }
      .sh-group-icon[data-tone="neutral"] { color: var(--ink-3); }
      .sh-group-count {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
        font-weight: 400;
      }
      .sh-group-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      /* Share row */
      .sh-share {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 12px 14px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
        flex-wrap: wrap;
      }
      .sh-share:hover {
        border-color: var(--primary);
        box-shadow: var(--shadow-md);
        transform: translateY(-1px);
      }
      .sh-share.is-mine { cursor: default; }
      .sh-share.is-mine:hover { transform: none; box-shadow: none; }

      .sh-share-text {
        flex: 1;
        min-width: 0;
      }
      .sh-share-name {
        font-family: var(--font-body);
        font-size: 14px;
        font-weight: 600;
        color: var(--ink);
        line-height: 1.35;
      }
      .sh-share-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 3px;
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
      }
      .sh-pending {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        background: rgba(139, 90, 60, 0.10);
        color: var(--warning);
        padding: 2px 8px;
        border-radius: var(--r-sm);
      }

      .sh-share-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .sh-perm-select {
        height: 32px;
        padding: 0 10px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink);
        cursor: pointer;
      }
      .sh-perm-select:focus {
        outline: none;
        border-color: var(--primary);
      }

      @media (max-width: 600px) {
        .sh-hero-title { font-size: 32px; }
        .sh-hero-stats { gap: 20px; }
        .sh-row-head { flex-wrap: wrap; }
      }
    `}</style>
  );
}
