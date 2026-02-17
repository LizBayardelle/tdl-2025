import React, { useState, useEffect } from 'react';
import SourceFormModal from './SourceFormModal';
import NoteFormModal from './NoteFormModal';

export default function SourceShow({ sourceId }) {
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [allSources, setAllSources] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    fetchSource();
    fetchAllSources();
  }, []);

  const fetchSource = async () => {
    try {
      const response = await fetch(`/sources/${sourceId}.json`);
      const data = await response.json();
      setSource(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching source:', error);
      setLoading(false);
    }
  };

  const fetchAllSources = async () => {
    try {
      const response = await fetch('/sources.json');
      const data = await response.json();
      const sources = Array.isArray(data) ? data : (data.sources || []);
      setAllSources(sources);
      setSourcesLoading(false);
    } catch (error) {
      console.error('Error fetching sources:', error);
      setSourcesLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--space-8) 0' }}>
        <p style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-body)', color: 'var(--neutral-600)' }}>Loading...</p>
      </div>
    );
  }

  if (!source) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
        <p style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-body)', color: 'var(--neutral-600)' }}>Source not found</p>
      </div>
    );
  }

  // Filter and sort sources
  const filteredSources = allSources
    .filter(s => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const authorsStr = typeof s.authors === 'string' ? s.authors : '';
      return s.title?.toLowerCase().includes(query) ||
             authorsStr.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return (a.title || '').localeCompare(b.title || '');
      } else if (sortBy === 'type') {
        return (a.kind || '').localeCompare(b.kind || '');
      } else {
        // recent (default)
        return new Date(b.updated_at) - new Date(a.updated_at);
      }
    });

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left Sidebar - Sources List */}
      <aside
        style={{
          width: sidebarOpen ? '280px' : '0',
          background: 'var(--sidebar-bg)',
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: 'width 0.3s ease',
          boxShadow: 'inset -8px 0 16px -8px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          flexShrink: 0
        }}
      >
        {sidebarOpen && (
          <div style={{ width: '280px', padding: 'var(--space-4)' }}>
            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sources..."
              className="form-input"
              style={{
                width: '100%',
                marginBottom: 'var(--space-3)',
                fontSize: 'var(--text-sm)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-blue)';
                e.currentTarget.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--neutral-300)';
              }}
            />

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="form-select"
              style={{
                width: '100%',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-xs)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-blue)';
                e.currentTarget.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--neutral-300)';
              }}
            >
              <option value="recent">Recently Updated</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="type">By Type</option>
            </select>

            {/* Sources List */}
            <div style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--neutral-500)',
              marginBottom: 'var(--space-2)',
              fontFamily: 'var(--font-body)'
            }}>
              All Sources ({filteredSources.length})
            </div>

            {sourcesLoading ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
                Loading...
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {filteredSources.map(s => (
                  <a
                    key={s.id}
                    href={`/sources/${s.id}`}
                    style={{
                      padding: 'var(--space-2)',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)',
                      lineHeight: 1.3,
                      color: s.id === parseInt(sourceId) ? 'var(--accent-blue)' : 'var(--neutral-700)',
                      background: s.id === parseInt(sourceId) ? 'var(--accent-blue-light)' : 'transparent',
                      fontWeight: s.id === parseInt(sourceId) ? 600 : 400,
                      transition: 'all 0.15s',
                      display: 'block'
                    }}
                    onMouseEnter={(e) => {
                      if (s.id !== parseInt(sourceId)) {
                        e.currentTarget.style.background = 'var(--neutral-100)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (s.id !== parseInt(sourceId)) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {s.title}
                    {s.kind && (
                      <div style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--neutral-500)',
                        marginTop: 'var(--space-1)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {s.kind.replace(/_/g, ' ')}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          left: sidebarOpen ? '280px' : '0',
          top: '100px',
          zIndex: 50,
          background: 'var(--accent-blue)',
          color: 'white',
          padding: 'var(--space-2)',
          borderRadius: '0 4px 4px 0',
          boxShadow: 'var(--shadow)',
          border: 'none',
          cursor: 'pointer',
          transition: 'left 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        aria-label="Toggle sources sidebar"
      >
        <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`}></i>
      </button>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'white' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 var(--space-6)', width: '100%' }}>
        {/* Header with Back and Edit */}
        <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--space-4)' }}>
          <a
            href="/sources"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--accent-blue)',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              transition: 'color 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue-dark)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
          >
            ← Back to Sources
          </a>
          <button
            onClick={() => setEditing(true)}
            className="icon-btn"
            style={{ color: 'var(--accent-blue)' }}
            title="Edit Source"
          >
            <i className="fas fa-pen"></i>
          </button>
        </div>

        <SourceFormModal
          isOpen={editing}
          onClose={() => setEditing(false)}
          item={source}
          onSuccess={(updatedSource) => {
            setSource(updatedSource);
            setEditing(false);
            fetchAllSources(); // Refresh sidebar
          }}
        />

        <div style={{ background: 'white', padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
          <SourceDisplay source={source} />
          <SourceNotes sourceId={source.id} />
        </div>
        </div>
      </div>
    </div>
  );
}

function SourceDisplay({ source }) {
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
          {source.kind && (
            <span style={{
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'var(--accent-blue-light)',
              color: 'var(--accent-blue)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: '4px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600
            }}>
              {source.kind.replace(/_/g, ' ')}
            </span>
          )}
          {source.methodologies && source.methodologies.length > 0 && source.methodologies.map((methodology, idx) => (
            <span key={idx} style={{
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'var(--neutral-100)',
              color: 'var(--neutral-700)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: '4px',
              fontFamily: 'var(--font-body)',
              fontWeight: 500
            }}>
              {methodology}
            </span>
          ))}
          {source.year && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
              {source.year}
            </span>
          )}
        </div>
        <h1 style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: 'var(--neutral-900)',
          lineHeight: 1.2,
          marginBottom: 'var(--space-2)'
        }}>
          {source.title}
        </h1>
        {source.authors && (
          <p style={{
            fontSize: 'var(--text-lg)',
            color: 'var(--neutral-700)',
            fontFamily: 'var(--font-body)',
            marginBottom: 'var(--space-1)'
          }}>
            {source.authors}
          </p>
        )}
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-500)', fontFamily: 'var(--font-body)' }}>
          Last updated: {new Date(source.updated_at).toLocaleDateString()}
        </p>
      </div>

      {/* Content */}
      <div>
        {source.summary && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              color: 'var(--accent-blue)',
              marginBottom: 'var(--space-3)'
            }}>
              Summary
            </h3>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.6,
                color: 'var(--neutral-700)'
              }}
              dangerouslySetInnerHTML={{ __html: source.summary }}
            />
          </div>
        )}

        {source.abstract && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              color: 'var(--accent-blue)',
              marginBottom: 'var(--space-3)'
            }}>
              Abstract
            </h3>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.6,
                color: 'var(--neutral-700)'
              }}
              dangerouslySetInnerHTML={{ __html: source.abstract }}
            />
          </div>
        )}

        {(source.url || source.doi) && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              color: 'var(--accent-blue)',
              marginBottom: 'var(--space-3)'
            }}>
              Link
            </h3>
            <a
              href={source.url || source.doi}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent-blue)',
                textDecoration: 'underline',
                wordBreak: 'break-all',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)'
              }}
            >
              {source.url || source.doi}
            </a>
          </div>
        )}

        {source.pdf_url && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <a
              href={source.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: 'var(--accent-blue)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--accent-blue)',
                borderRadius: '4px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-blue)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--accent-blue)';
              }}
            >
              <i className="fas fa-file-pdf"></i>
              View PDF
            </a>
          </div>
        )}

        {/* Metadata Tags */}
        {((source.concepts && source.concepts.length > 0) || (source.tags && source.tags.length > 0)) && (
          <div style={{ paddingTop: 'var(--space-6)', borderTop: '1px solid var(--neutral-200)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {source.concepts?.map((concept) => (
                <a
                  key={concept.id}
                  href={`/concepts/${concept.id}`}
                  style={{
                    fontSize: 'var(--text-xs)',
                    background: 'var(--accent-green-light)',
                    color: 'var(--accent-green)',
                    padding: 'var(--space-1) var(--space-3)',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-green)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--accent-green-light)';
                    e.currentTarget.style.color = 'var(--accent-green)';
                  }}
                >
                  {concept.label}
                </a>
              ))}
              {source.tags?.map((tag, idx) => (
                <a
                  key={idx}
                  href={`/tags/${tag.slug || tag.name}`}
                  style={{
                    fontSize: 'var(--text-xs)',
                    background: 'var(--accent-purple-light)',
                    color: 'var(--accent-purple)',
                    padding: 'var(--space-1) var(--space-3)',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-purple)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--accent-purple-light)';
                    e.currentTarget.style.color = 'var(--accent-purple)';
                  }}
                >
                  {tag.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Authors Section */}
        {source.people && source.people.length > 0 && (
          <div style={{ marginTop: 'var(--space-8)' }}>
            <h3 style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: 'var(--accent-gold)',
              margin: '0 0 var(--space-3) 0'
            }}>
              Authors
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {source.people.map((person) => (
                <a
                  key={person.id}
                  href={`/people/${person.id}`}
                  style={{
                    fontSize: 'var(--text-xs)',
                    background: 'var(--accent-gold-light)',
                    color: 'var(--accent-gold)',
                    padding: 'var(--space-1) var(--space-3)',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-gold)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--accent-gold-light)';
                    e.currentTarget.style.color = 'var(--accent-gold)';
                  }}
                >
                  {person.full_name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SourceNotes({ sourceId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingNote, setCreatingNote] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/notes.json?source_id=${sourceId}`);
      const data = await response.json();
      setNotes(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setLoading(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      const response = await fetch(`/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        fetchNotes();
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ marginTop: 'var(--space-8)' }}>
        <h2 style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: '#639CA1',
          margin: '0 0 var(--space-3) 0'
        }}>
          Notes
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
          Loading notes...
        </p>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <>
        <NoteFormModal
          isOpen={creatingNote}
          onClose={() => setCreatingNote(false)}
          sourceId={sourceId}
          onSuccess={(newNote) => {
            fetchNotes();
            setCreatingNote(false);
          }}
        />
        <div style={{ marginTop: 'var(--space-8)' }}>
          <h2 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: '#639CA1',
            margin: '0 0 var(--space-3) 0'
          }}>
            Notes
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
            No notes yet.{' '}
            <button
              onClick={() => setCreatingNote(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#639CA1',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)'
              }}
            >
              Create the first note
            </button>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <NoteFormModal
        isOpen={creatingNote}
        onClose={() => setCreatingNote(false)}
        sourceId={sourceId}
        onSuccess={(newNote) => {
          fetchNotes();
          setCreatingNote(false);
        }}
      />
      <NoteFormModal
        isOpen={!!editingNote}
        onClose={() => setEditingNote(null)}
        item={editingNote}
        sourceId={sourceId}
        onSuccess={(updatedNote) => {
          fetchNotes();
          setEditingNote(null);
        }}
        onDelete={(noteId) => {
          handleDeleteNote(noteId);
          setEditingNote(null);
        }}
      />
      <div style={{ marginTop: 'var(--space-8)' }}>
        {/* Notes Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)'
        }}>
          <h2 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: '#639CA1',
            margin: 0
          }}>
            Notes ({notes.length})
          </h2>
          <button
            onClick={() => setCreatingNote(true)}
            className="btn-secondary"
            style={{
              fontSize: 'var(--text-sm)',
              background: '#639CA1',
              color: 'white',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#527d81';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#639CA1';
            }}
          >
            <i className="fas fa-plus"></i>
            New Note
          </button>
        </div>

      {/* Notes Cards */}
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {notes.map(note => (
            <div key={note.id} className="card" style={{ overflow: 'hidden' }}>
              {note.title && (
                <div style={{
                  background: '#639CA1',
                  padding: 'var(--space-3) var(--space-4)',
                  borderBottom: '1px solid var(--neutral-200)'
                }}>
                  <h3 style={{
                    fontWeight: 600,
                    fontSize: 'var(--text-base)',
                    fontFamily: 'var(--font-display)',
                    color: 'white',
                    margin: 0
                  }}>
                    {note.title}
                  </h3>
                </div>
              )}
              <div style={{ padding: 'var(--space-4)' }}>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--neutral-700)',
                    fontFamily: 'var(--font-body)',
                    lineHeight: 1.6,
                    marginBottom: 'var(--space-3)',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                  dangerouslySetInnerHTML={{ __html: note.body }}
                />
                {(note.concepts?.length > 0 || note.tags?.length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                    {note.concepts?.map((concept) => (
                      <span key={concept.id} style={{
                        fontSize: 'var(--text-xs)',
                        background: 'var(--accent-green-light)',
                        color: 'var(--accent-green)',
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500
                      }}>
                        {concept.label}
                      </span>
                    ))}
                    {note.tags?.map((tag, idx) => (
                      <span key={idx} style={{
                        fontSize: 'var(--text-xs)',
                        background: 'var(--accent-purple-light)',
                        color: 'var(--accent-purple)',
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500
                      }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{
                padding: 'var(--space-2) var(--space-4)',
                background: 'var(--card-footer)',
                borderTop: '1px solid var(--neutral-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ fontSize: 'var(--text-xs)', color: '#639CA1', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                  {note.page_number && <span>Page {note.page_number}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <button
                    onClick={() => setEditingNote(note)}
                    className="icon-btn"
                    style={{
                      color: '#639CA1',
                      fontSize: 'var(--text-sm)',
                      padding: 'var(--space-1)'
                    }}
                    title="Edit Note"
                  >
                    <i className="fas fa-pen"></i>
                  </button>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)' }}>
                    {new Date(note.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
