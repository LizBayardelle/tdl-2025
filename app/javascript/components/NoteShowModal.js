import React from 'react';
import SlidePanel from './SlidePanel';

const noteTypeLabels = {
  note: 'Note',
  question: 'Question',
  synthesis: 'Synthesis',
  connection: 'Connection',
  todo: 'To Do'
};

const noteTypeIcons = {
  note: 'fa-sticky-note',
  question: 'fa-question-circle',
  synthesis: 'fa-lightbulb',
  connection: 'fa-project-diagram',
  todo: 'fa-check-circle'
};

export default function NoteShowModal({ isOpen, onClose, note, onEdit, onDelete, onTogglePin }) {
  if (!note) return null;

  return (
    <SlidePanel isOpen={isOpen} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{
          background: 'var(--accent-teal)',
          padding: 'var(--space-6)',
          paddingRight: 'var(--space-8)',
          position: 'relative',
          flexShrink: 0,
        }}>
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 'var(--space-4)',
              right: 'var(--space-4)',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              fontSize: 'var(--text-xl)',
              cursor: 'pointer',
              padding: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            ×
          </button>

          {/* Type badge + pin */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.15)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: '4px',
            }}>
              <i className={`fas ${noteTypeIcons[note.note_type] || 'fa-sticky-note'}`} style={{ fontSize: '10px' }}></i>
              {noteTypeLabels[note.note_type] || 'Note'}
            </span>

            {note.pinned && (
              <span style={{
                fontSize: 'var(--text-xs)',
                color: 'rgba(255,255,255,0.85)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <i className="fas fa-thumbtack"></i> Pinned
              </span>
            )}
          </div>

          {/* Title or fallback */}
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: note.title ? 'var(--text-2xl)' : 'var(--text-lg)',
            fontWeight: 700,
            color: 'white',
            margin: 0,
            lineHeight: 1.3,
          }}>
            {note.title || 'Untitled Note'}
          </h2>

          {/* Date */}
          <div style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            color: 'rgba(255,255,255,0.7)',
            fontFamily: 'var(--font-body)',
          }}>
            {new Date(note.noted_on || note.created_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'white' }}>
          {/* Connections bar */}
          {(note.source || note.concepts?.length > 0 || note.tags?.length > 0) && (
            <div style={{
              padding: 'var(--space-3) var(--space-6)',
              background: 'white',
              borderBottom: '1px solid var(--neutral-200)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              alignItems: 'center',
            }}>
              {note.source && (
                <a href={`/sources/${note.source.id}`} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  fontSize: 'var(--text-xs)',
                  background: 'var(--accent-blue-light)',
                  color: 'var(--accent-blue)',
                  padding: 'var(--space-1) var(--space-2)',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-blue-light)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                >
                  <i className="fas fa-book" style={{ fontSize: '10px' }}></i>
                  {note.source.title}
                </a>
              )}
              {note.concepts?.map(concept => (
                <a
                  key={concept.id}
                  href={`/concepts/${concept.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    fontSize: 'var(--text-xs)',
                    background: 'var(--accent-green-light)',
                    color: 'var(--accent-green)',
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    textDecoration: 'none',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-green)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-green-light)'; e.currentTarget.style.color = 'var(--accent-green)'; }}
                >
                  {concept.label}
                </a>
              ))}
              {note.tags?.map((tag, idx) => (
                <span key={idx} style={{
                  fontSize: 'var(--text-xs)',
                  background: 'var(--accent-purple-light)',
                  color: 'var(--accent-purple)',
                  padding: 'var(--space-1) var(--space-2)',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}>
                  {typeof tag === 'string' ? tag : tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Body content */}
          <div className="p-6 md:p-8 lg:px-12">
            <div
              className="note-content prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_ul_ul]:ml-6 [&_ol_ol]:ml-6 [&_ul_ol]:ml-6 [&_ol_ul]:ml-6 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100 [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto [&_hr]:my-4 [&_hr]:border-gray-300"
              style={{
                fontSize: 'var(--text-base)',
                color: 'var(--neutral-700)',
                fontFamily: 'var(--font-body)',
                lineHeight: 1.7,
              }}
              dangerouslySetInnerHTML={{ __html: note.body }}
            />
          </div>

          {/* Context section */}
          {note.context && (
            <div style={{
              margin: '0 var(--space-6) var(--space-6)',
              padding: 'var(--space-4)',
              background: 'var(--neutral-50)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--neutral-200)',
            }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--neutral-500)',
                fontFamily: 'var(--font-body)',
                marginBottom: 'var(--space-2)',
              }}>
                Context
              </div>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-600)',
                fontFamily: 'var(--font-body)',
                lineHeight: 1.6,
                margin: 0,
              }}>
                {note.context}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          borderTop: '1px solid var(--neutral-200)',
          background: 'white',
          padding: 'var(--space-4) var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={() => onTogglePin && onTogglePin(note)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--neutral-300)',
                background: note.pinned ? 'var(--accent-teal)' : 'white',
                color: note.pinned ? 'white' : 'var(--neutral-600)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!note.pinned) e.currentTarget.style.background = 'var(--neutral-50)';
              }}
              onMouseLeave={(e) => {
                if (!note.pinned) e.currentTarget.style.background = 'white';
              }}
            >
              <i className="fas fa-thumbtack" style={{ fontSize: '12px' }}></i>
              {note.pinned ? 'Unpin' : 'Pin'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={() => onEdit && onEdit(note)}
              className="btn-primary"
              style={{
                background: 'var(--accent-teal)',
                color: 'white',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#4a8187'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-teal)'}
            >
              <i className="fas fa-edit" style={{ fontSize: '12px' }}></i>
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete && onDelete(note.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--error)',
                background: 'white',
                color: 'var(--error)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--error)'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = 'var(--error)'; }}
            >
              <i className="fas fa-trash" style={{ fontSize: '12px' }}></i>
              Delete
            </button>
          </div>
        </div>
      </div>
    </SlidePanel>
  );
}
