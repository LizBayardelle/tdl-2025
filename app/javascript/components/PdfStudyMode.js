import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import ColorSchemeManager from './ColorSchemeManager';
import NoteFormModal from './NoteFormModal';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfStudyMode({ sourceId, sourceTitle, pdfUrl }) {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [notes, setNotes] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    note_type: 'note',
    page_number: 1
  });
  const [editingNote, setEditingNote] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isDragging, setIsDragging] = useState(false);
  const mainContentRef = useRef(null);
  const containerRef = useRef(null);

  // Handle sidebar resize drag
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newWidth = Math.min(Math.max(200, e.clientX), 500);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  useEffect(() => {
    fetchNotes();
  }, [sourceId]);

  useEffect(() => {
    // Update form page number when current page changes
    setFormData(prev => ({ ...prev, page_number: currentPage }));
  }, [currentPage]);

  useEffect(() => {
    // Track scroll position to update current page
    const mainContent = mainContentRef.current;
    if (!mainContent) return;

    const handleScroll = () => {
      const scrollTop = mainContent.scrollTop;
      const pages = mainContent.querySelectorAll('[data-page-number]');

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const rect = page.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
          const pageNum = parseInt(page.getAttribute('data-page-number'));
          if (pageNum !== currentPage) {
            setCurrentPage(pageNum);
          }
          break;
        }
      }
    };

    mainContent.addEventListener('scroll', handleScroll);
    return () => mainContent.removeEventListener('scroll', handleScroll);
  }, [currentPage]);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/sources/${sourceId}/notes.json`);
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error('Error fetching notes:', error);
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

  const handleSubmitNote = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({
          note: {
            title: formData.title,
            body: formData.body,
            note_type: formData.note_type,
            page_number: formData.page_number,
            source_id: sourceId
          }
        }),
      });

      if (response.ok) {
        // Reset form
        setFormData({
          title: '',
          body: '',
          note_type: 'note',
          page_number: currentPage
        });

        // Refresh notes list
        fetchNotes();
      } else {
        const data = await response.json();
        alert(data.errors?.join(', ') || 'Failed to create note');
      }
    } catch (error) {
      console.error('Error creating note:', error);
      alert('An error occurred while creating the note');
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  // Check if we have a PDF
  const hasPdf = !!pdfUrl;

  return (
    <>
    <div ref={containerRef} style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', position: 'relative' }}>
        {/* Left Sidebar - Notes */}
        {sidebarOpen && (
          <>
          <aside style={{
            width: `${sidebarWidth}px`,
            background: 'var(--sidebar-bg)',
            overflowY: 'auto',
            padding: 'var(--space-4)',
            boxShadow: 'var(--shadow-sidebar)',
            flexShrink: 0
          }}>
            {/* Sidebar Section: Create Note */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--neutral-500)',
                marginBottom: 'var(--space-3)',
                fontFamily: 'var(--font-body)'
              }}>
                Create Note{hasPdf ? ` (Page ${currentPage})` : ''}
              </div>
              <form onSubmit={handleSubmitNote} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <style>{`
                  .study-form-input:focus,
                  .study-form-select:focus,
                  .study-form-textarea:focus {
                    outline: none;
                    border-color: var(--accent-teal);
                    box-shadow: 0 0 0 3px rgba(99, 156, 161, 0.1);
                  }
                `}</style>

                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>Type</label>
                  <select
                    value={formData.note_type}
                    onChange={(e) => setFormData({ ...formData, note_type: e.target.value })}
                    className="form-select study-form-select"
                    style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2)' }}
                  >
                    <option value="note">Note</option>
                    <option value="question">Question</option>
                    <option value="synthesis">Synthesis</option>
                    <option value="connection">Connection</option>
                    <option value="todo">To Do</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="form-input study-form-input"
                    style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2)' }}
                    placeholder="Optional..."
                  />
                </div>

                <div>
                  <label className="form-label teal" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>Note</label>
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    className="form-textarea study-form-textarea"
                    rows="4"
                    style={{ fontSize: 'var(--text-sm)', padding: 'var(--space-2)' }}
                    placeholder="Write your note..."
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    background: 'var(--accent-teal)',
                    fontSize: 'var(--text-sm)',
                    padding: 'var(--space-2) var(--space-3)',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#4a8187'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-teal)'}
                >
                  Create Note
                </button>
              </form>
            </div>

            {/* Sidebar Section: Notes List */}
            <div>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--neutral-500)',
                marginBottom: 'var(--space-3)',
                fontFamily: 'var(--font-body)'
              }}>
                Notes ({notes.length})
              </div>
              {notes.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--neutral-600)', fontFamily: 'var(--font-body)', margin: 0 }}>
                  No notes yet for this source
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {notes.map(note => (
                    <div key={note.id} className="card" style={{ overflow: 'hidden' }}>
                      {note.title && (
                        <div style={{
                          background: 'var(--accent-teal)',
                          padding: 'var(--space-2) var(--space-3)',
                          borderBottom: '1px solid var(--neutral-200)'
                        }}>
                          <h3 style={{
                            fontWeight: 600,
                            fontSize: 'var(--text-sm)',
                            fontFamily: 'var(--font-display)',
                            color: 'white',
                            margin: 0
                          }}>
                            {note.title}
                          </h3>
                        </div>
                      )}
                      <div style={{ padding: 'var(--space-3)' }}>
                        <div
                          className="note-content"
                          style={{
                            fontSize: 'var(--text-sm)',
                            color: 'var(--neutral-700)',
                            fontFamily: 'var(--font-body)',
                            lineHeight: 1.6,
                            marginBottom: 'var(--space-2)',
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
                                background: 'var(--accent-green)',
                                color: 'white',
                                padding: 'var(--space-1) var(--space-2)',
                                borderRadius: '4px',
                                fontFamily: 'var(--font-body)'
                              }}>
                                {concept.label}
                              </span>
                            ))}
                            {note.tags?.map((tag, idx) => (
                              <span key={idx} style={{
                                fontSize: 'var(--text-xs)',
                                background: 'var(--accent-purple)',
                                color: 'white',
                                padding: 'var(--space-1) var(--space-2)',
                                borderRadius: '4px',
                                fontFamily: 'var(--font-body)'
                              }}>
                                {typeof tag === 'string' ? tag : tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{
                        padding: 'var(--space-1) var(--space-3)',
                        background: 'var(--card-footer)',
                        borderTop: '1px solid var(--neutral-200)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--accent-teal)',
                          fontFamily: 'var(--font-body)',
                          fontWeight: 600
                        }}>
                          {note.page_number && <span>Page {note.page_number}</span>}
                          {note.page_number && <span style={{ color: 'var(--neutral-400)' }}>•</span>}
                          <span style={{ color: 'var(--neutral-600)', fontWeight: 400 }}>
                            {new Date(note.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            console.log('Editing note:', note);
                            setEditingNote(note);
                            setShowNoteModal(true);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-teal)',
                            cursor: 'pointer',
                            padding: 'var(--space-1)',
                            fontSize: 'var(--text-sm)',
                            fontFamily: 'var(--font-body)',
                            transition: 'opacity 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
          {/* Draggable Divider */}
          <div
            onMouseDown={() => setIsDragging(true)}
            style={{
              width: '6px',
              cursor: 'col-resize',
              background: isDragging ? 'var(--accent-blue)' : '#d4cfc4',
              transition: 'background 0.15s',
              flexShrink: 0,
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              if (!isDragging) e.currentTarget.style.background = '#c4bfb4';
            }}
            onMouseLeave={(e) => {
              if (!isDragging) e.currentTarget.style.background = '#d4cfc4';
            }}
          />
          </>
        )}

        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="sidebar-toggle"
          style={{
            position: 'absolute',
            left: sidebarOpen ? `${sidebarWidth + 6}px` : '0',
            top: '100px',
            zIndex: 20,
            background: 'var(--accent-blue)',
            color: 'white',
            border: 'none',
            padding: 'var(--space-2)',
            cursor: 'pointer',
            transition: 'left 0.2s',
            borderRadius: '0 4px 4px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '48px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-blue-dark)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-blue)'}
        >
          <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`} style={{ fontSize: '12px' }}></i>
        </button>

        {/* Main Content - PDF Viewer or Notes-Only Mode */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', overflow: 'hidden' }}>
          {/* Fixed Header Section */}
          <div style={{ flexShrink: 0, background: 'white', zIndex: 5 }}>
            {/* Breadcrumbs */}
            <div style={{ padding: 'var(--space-4) var(--space-6) var(--space-4) 48px', borderBottom: '1px solid var(--neutral-200)' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto auto 1fr',
                gap: 'var(--space-2)',
                alignItems: 'center',
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-600)',
                fontFamily: 'var(--font-body)'
              }}>
                <a href="/sources" style={{ color: 'var(--neutral-600)', textDecoration: 'none', fontWeight: 600 }}>Sources</a>
                <span style={{ padding: '0 var(--space-2)' }}><i className="fas fa-chevron-right"></i></span>
                <a href={`/sources/${sourceId}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600, lineHeight: 1.1 }}>
                  {sourceTitle}
                </a>
              </div>
            </div>

            {/* Main Header */}
            <div style={{
              padding: 'var(--space-4) var(--space-6) var(--space-4) 48px',
              background: 'white',
              borderBottom: '1px solid var(--neutral-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)'
            }}>
              <h1 style={{
                fontSize: 'var(--text-3xl)',
                fontWeight: 700,
                color: 'var(--neutral-900)',
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em',
                margin: 0
              }}>
                {sourceTitle}
              </h1>
              {hasPdf && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: '200px' }}>
                  <span style={{
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--neutral-600)',
                    fontWeight: 600
                  }}>
                    Page {currentPage} of {numPages || '...'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    <button
                      onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--neutral-300)',
                        borderRadius: '4px',
                        padding: 'var(--space-1) var(--space-2)',
                        cursor: 'pointer',
                        color: 'var(--neutral-700)',
                        transition: 'all 0.15s',
                        lineHeight: 1
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-100)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <i className="fas fa-minus" style={{ fontSize: '10px' }}></i>
                    </button>
                    <span style={{ fontSize: 'var(--text-xs)', width: '3rem', textAlign: 'center', fontFamily: 'var(--font-body)' }}>
                      {Math.round(scale * 100)}%
                    </span>
                    <button
                      onClick={() => setScale(s => Math.min(2.0, s + 0.1))}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--neutral-300)',
                        borderRadius: '4px',
                        padding: 'var(--space-1) var(--space-2)',
                        cursor: 'pointer',
                        color: 'var(--neutral-700)',
                        transition: 'all 0.15s',
                        lineHeight: 1
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--neutral-100)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <i className="fas fa-plus" style={{ fontSize: '10px' }}></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable PDF Content */}
          <div ref={mainContentRef} style={{ flex: 1, overflowY: 'auto' }}>
          {/* PDF Document or Notes-Only View */}
          {hasPdf ? (
            <div style={{
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-4)',
              background: 'var(--neutral-100)'
            }}>
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
              >
                {Array.from(new Array(numPages), (el, index) => (
                  <div
                    key={`page_${index + 1}`}
                    data-page-number={index + 1}
                    style={{
                      boxShadow: 'var(--shadow-card)',
                      marginBottom: 'var(--space-4)',
                      position: 'relative'
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '-24px',
                      left: '0',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--neutral-500)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600
                    }}>
                      Page {index + 1}
                    </div>
                    <Page
                      pageNumber={index + 1}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                  </div>
                ))}
              </Document>
            </div>
          ) : (
            <div style={{
              padding: 'var(--space-8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              background: 'var(--neutral-100)',
              textAlign: 'center'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: 'var(--space-8)',
                boxShadow: 'var(--shadow-card)',
                maxWidth: '500px'
              }}>
                <i className="fas fa-sticky-note" style={{
                  fontSize: '48px',
                  color: 'var(--accent-teal)',
                  marginBottom: 'var(--space-4)',
                  display: 'block'
                }}></i>
                <h2 style={{
                  fontSize: 'var(--text-xl)',
                  fontWeight: 600,
                  color: 'var(--neutral-800)',
                  fontFamily: 'var(--font-display)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Notes-Only Mode
                </h2>
                <p style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--neutral-600)',
                  fontFamily: 'var(--font-body)',
                  lineHeight: 1.6,
                  margin: 0
                }}>
                  No PDF is attached to this source. Use the sidebar to create and manage notes directly.
                </p>
              </div>
            </div>
          )}
          </div>
        </main>
    </div>

      <NoteFormModal
        isOpen={showNoteModal}
        onClose={() => {
          setShowNoteModal(false);
          setEditingNote(null);
        }}
        onSuccess={() => {
          fetchNotes();
          setShowNoteModal(false);
          setEditingNote(null);
        }}
        onDelete={(noteId) => {
          handleDeleteNote(noteId);
          setShowNoteModal(false);
          setEditingNote(null);
        }}
        item={editingNote}
        sourceId={sourceId}
      />
    </>
  );
}
