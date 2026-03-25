import React, { useState } from 'react';
import BulkUploadItemCard from './BulkUploadItemCard';
import BulkActionBar from './BulkActionBar';

export default function BulkUploadItemList({ batch, onItemApproved, onBulkApprove, onRetryFailed, onNewBatch }) {
  const [filter, setFilter] = useState('all');
  const [expandedItemId, setExpandedItemId] = useState(null);

  const items = batch.items || [];
  const stats = batch.stats || {};

  // Filter items
  const filteredItems = items.filter(item => {
    switch (filter) {
      case 'review':
        return item.status === 'review_needed' || item.status === 'extracted';
      case 'created':
        return item.status === 'created' || item.status === 'approved';
      case 'failed':
        return item.status === 'failed';
      default:
        return true;
    }
  });

  const reviewCount = items.filter(i => i.status === 'review_needed' || i.status === 'extracted').length;
  const createdCount = items.filter(i => i.status === 'created' || i.status === 'approved').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  return (
    <div>
      {/* Summary header */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        border: '1px solid var(--neutral-200)',
        padding: 'var(--space-6)',
        marginBottom: 'var(--space-4)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-4)',
        }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              color: 'var(--neutral-800)',
              marginBottom: 'var(--space-1)',
            }}>
              {batch.status === 'completed' ? (
                <>
                  <i className="fas fa-check-circle" style={{ marginRight: 'var(--space-2)', color: 'var(--accent-blue)' }}></i>
                  Processing Complete
                </>
              ) : (
                <>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: 'var(--space-2)', color: 'var(--accent-blue)' }}></i>
                  Processing Finished with Issues
                </>
              )}
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              color: 'var(--neutral-500)',
            }}>
              {createdCount} created, {reviewCount} need review, {failedCount} failed
            </p>
          </div>
          <button
            onClick={onNewBatch}
            className="btn-outline-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
          >
            <i className="fas fa-plus"></i>
            New Upload
          </button>
        </div>

        {/* Stats grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--space-4)',
        }}>
          <StatCard
            label="Total"
            count={batch.total_count}
            icon="fas fa-file-pdf"
            color="var(--accent-blue)"
          />
          <StatCard
            label="Created"
            count={createdCount}
            icon="fas fa-check-double"
            color="var(--accent-blue)"
          />
          <StatCard
            label="Need Review"
            count={reviewCount}
            icon="fas fa-edit"
            color="var(--accent-blue)"
          />
          <StatCard
            label="Failed"
            count={failedCount}
            icon="fas fa-times"
            color="#dc2626"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {(reviewCount > 0 || failedCount > 0) && (
        <BulkActionBar
          reviewCount={reviewCount}
          failedCount={failedCount}
          onBulkApprove={onBulkApprove}
          onRetryFailed={onRetryFailed}
        />
      )}

      {/* Filter tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
      }}>
        <FilterTab
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="All"
          count={items.length}
        />
        <FilterTab
          active={filter === 'review'}
          onClick={() => setFilter('review')}
          label="Needs Review"
          count={reviewCount}
          color="var(--accent-blue)"
        />
        <FilterTab
          active={filter === 'created'}
          onClick={() => setFilter('created')}
          label="Created"
          count={createdCount}
          color="var(--accent-blue)"
        />
        <FilterTab
          active={filter === 'failed'}
          onClick={() => setFilter('failed')}
          label="Failed"
          count={failedCount}
          color="#dc2626"
        />
      </div>

      {/* Item list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {filteredItems.map(item => (
          <BulkUploadItemCard
            key={item.id}
            item={item}
            isExpanded={expandedItemId === item.id}
            onToggle={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
            onApproved={() => onItemApproved(item.id)}
          />
        ))}

        {filteredItems.length === 0 && (
          <div style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            color: 'var(--neutral-500)',
            fontFamily: 'var(--font-body)',
          }}>
            No items match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, count, icon, color }) {
  return (
    <div style={{
      padding: 'var(--space-4)',
      background: '#e2e2e2',
      borderRadius: '8px',
      textAlign: 'center',
    }}>
      <i className={icon} style={{ fontSize: '1.5rem', color, marginBottom: 'var(--space-2)', display: 'block' }}></i>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-2xl)',
        fontWeight: 700,
        color: 'var(--neutral-800)',
      }}>
        {count}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        color: 'var(--neutral-500)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </div>
    </div>
  );
}

function FilterTab({ active, onClick, label, count, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 'var(--space-2) var(--space-4)',
        background: active ? (color || 'var(--accent-blue)') : 'white',
        color: active ? 'white' : 'var(--neutral-700)',
        border: `1px solid ${active ? (color || 'var(--accent-blue)') : 'var(--neutral-300)'}`,
        borderRadius: '20px',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        transition: 'all 0.15s',
      }}
    >
      {label}
      <span style={{
        background: active ? 'rgba(255,255,255,0.3)' : '#e2e2e2',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: 'var(--text-xs)',
      }}>
        {count}
      </span>
    </button>
  );
}
