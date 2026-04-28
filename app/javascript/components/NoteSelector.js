import React, { useState, useEffect } from 'react';

export default function NoteSelector({ selectedNoteIds = [], onChange, themeColor = 'var(--accent-teal)' }) {
  const [allNotes, setAllNotes] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await fetch('/notes.json');
      const data = await response.json();
      setAllNotes(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setLoading(false);
    }
  };

  const filteredNotes = filter
    ? allNotes.filter(note =>
        (note.title && note.title.toLowerCase().includes(filter.toLowerCase())) ||
        (note.body && note.body.toLowerCase().includes(filter.toLowerCase()))
      )
    : allNotes;

  const handleToggle = (noteId) => {
    if (selectedNoteIds.includes(noteId)) {
      onChange(selectedNoteIds.filter(id => id !== noteId));
    } else {
      onChange([...selectedNoteIds, noteId]);
    }
  };

  const selectedNotes = allNotes.filter(n => selectedNoteIds.includes(n.id));

  if (loading) {
    return (
      <div style={{
        fontSize: 'var(--text-sm)',
        color: 'var(--neutral-500)',
        fontFamily: 'var(--font-body)'
      }}>
        Loading notes...
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--neutral-300)',
      borderRadius: '4px',
      background: 'white',
      height: '100%',
      maxHeight: '400px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Search/Filter Input */}
      <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--neutral-200)' }}>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Type to filter notes..."
          className="form-input"
          style={{ width: '100%', fontSize: 'var(--text-sm)' }}
        />
      </div>

      {/* Selected Notes */}
      {selectedNotes.length > 0 && (
        <div style={{
          padding: 'var(--space-3)',
          borderBottom: '1px solid var(--neutral-200)',
          background: 'var(--neutral-50)'
        }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            marginBottom: 'var(--space-2)',
            color: 'var(--neutral-600)',
            fontFamily: 'var(--font-body)'
          }}>
            Selected:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {selectedNotes.map(note => (
              <span
                key={note.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-1) var(--space-2)',
                  background: themeColor,
                  color: 'white',
                  fontSize: 'var(--text-xs)',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-body)'
                }}
              >
                {note.title || `Note ${note.id}`}
                <button
                  type="button"
                  onClick={() => handleToggle(note.id)}
                  style={{
                    background: 'none',
                    padding: 0,
                    fontSize: '14px',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0.8
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable Notes List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)' }}>
        {filteredNotes.length === 0 ? (
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-500)',
            textAlign: 'center',
            padding: 'var(--space-4) 0',
            fontFamily: 'var(--font-body)'
          }}>
            {filter ? 'No matching notes.' : 'No notes yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {filteredNotes.map(note => (
              <label
                key={note.id}
                style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: 'var(--space-2)',
                  cursor: 'pointer',
                  padding: 'var(--space-2)',
                  borderRadius: '4px',
                  transition: 'background 0.15s',
                  fontFamily: 'var(--font-body)',
                  border: '1px solid var(--neutral-200)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-50)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={selectedNoteIds.includes(note.id)}
                  onChange={() => handleToggle(note.id)}
                  style={{
                    marginTop: '2px',
                    borderRadius: '4px',
                    border: '1px solid var(--neutral-300)',
                    accentColor: themeColor,
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'white',
                      background: themeColor,
                      padding: '2px var(--space-1)',
                      borderRadius: '3px',
                      fontWeight: 600
                    }}>
                      {note.note_type}
                    </span>
                    {note.created_at && (
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)'
                      }}>
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {note.title && (
                    <div style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: 'var(--neutral-900)',
                      marginBottom: 'var(--space-1)'
                    }}>
                      {note.title}
                    </div>
                  )}
                  {note.body && (
                    <div
                      className="note-content"
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-600)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                      dangerouslySetInnerHTML={{ __html: note.body }}
                    />
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
