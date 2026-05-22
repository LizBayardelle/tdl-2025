import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import NoteFormModal from './NoteFormModal';
import HighlightModal from './HighlightModal';
import ShowNoteModal from './ShowNoteModal';
import NoteCard, { NoteCardStyles } from './NoteCard';
import AskThisPaperPanel from './AskThisPaperPanel';
import MobileSidebarBackdrop from './MobileSidebarBackdrop';
import MethodologyTags from './MethodologyTags';
import HighlightNudge from './HighlightNudge';
import useIsMobile from '../hooks/useIsMobile';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Zoom bounds — shared by the +/- buttons and pinch gestures.
const SCALE_MIN = 0.5;
const SCALE_MAX = 3.0;
const clampScale = (s) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));

// Remembers the collapsed/expanded header choice across visits.
const HEADER_KEY = 'tdl_psm_header_collapsed';

export default function PdfStudyMode({ sourceId, sourceTitle, pdfUrl, userUnlimited = false, userAdmin = false }) {
  const canAsk = userUnlimited || userAdmin;
  const isMobile = useIsMobile();
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [notes, setNotes] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    note_type: 'note',
    page_number: 1,
  });
  const sidebarFormRef = useRef(null);
  const [editingNote, setEditingNote] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [notePrefill, setNotePrefill] = useState(null);
  const [viewingNote, setViewingNote] = useState(null); // for read-only ShowNoteModal
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const mainContentRef = useRef(null);
  const containerRef = useRef(null);

  // Pinch-to-zoom — trackpad (ctrl+wheel) and touch (two fingers).
  const stageRef = useRef(null);       // the .psm-pdf-stage we CSS-transform live
  const zoomValueRef = useRef(null);   // the % readout, updated imperatively mid-gesture
  const pinchRef = useRef({ active: false, startScale: 1, liveScale: 1 });
  const pendingFocalRef = useRef(null); // focal anchor to restore scroll after a commit
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Floating selection toolbar state
  const [selection, setSelection] = useState(null); // { text, page, rect, bounds }
  const toolbarRef = useRef(null);

  // HighlightModal — single modal that owns the entire highlight-to-note flow.
  const [hlModal, setHlModal] = useState(null); // null | { selection, mode: 'quote' | 'wire-in' }

  // Source metadata (for header chips + AI calls)
  const [source, setSource] = useState(null);
  useEffect(() => {
    fetch(`/sources/${sourceId}.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setSource)
      .catch(err => console.error('Failed to load source metadata:', err));
  }, [sourceId]);

  // Abstract panel
  const [abstractOpen, setAbstractOpen] = useState(false);

  // Collapsible header — defaults collapsed on mobile to free up PDF space.
  const [headerCollapsed, setHeaderCollapsed] = useState(() => {
    try {
      const raw = typeof window !== 'undefined' && localStorage.getItem(HEADER_KEY);
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch (_) {}
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });
  const toggleHeader = () => {
    setHeaderCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(HEADER_KEY, next ? '1' : '0'); } catch (_) {}
      return next;
    });
  };

  // Ask this Paper panel
  const [askOpen, setAskOpen] = useState(false);

  // Reading-position memory
  const [resumePage, setResumePage] = useState(null);
  const POS_KEY = `tdl_pdf_pos_${sourceId}`;

  // Restore on mount: if a saved page > 1 exists, surface a resume toast
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' && localStorage.getItem(POS_KEY);
      if (!raw) return;
      const { page } = JSON.parse(raw);
      if (Number.isInteger(page) && page > 1) setResumePage(page);
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  // Save current page (debounced)
  useEffect(() => {
    if (!sourceId || currentPage <= 1) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(POS_KEY, JSON.stringify({ page: currentPage, ts: Date.now() })); } catch (_) {}
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, sourceId]);

  const goToPage = (n) => {
    const el = mainContentRef.current?.querySelector(`[data-page-number="${n}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setResumePage(null);
  };

  // Deep-link: ?page=N in the URL — coming from a note card or external link.
  // Pages render asynchronously, so poll for the target then scroll once,
  // and clean the param so a refresh doesn't re-jump.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const target = parseInt(params.get('page'), 10);
    if (!Number.isInteger(target) || target <= 1) return;
    let cancelled = false;
    let attempts = 0;
    const tick = () => {
      if (cancelled) return;
      const el = mainContentRef.current?.querySelector(`[data-page-number="${target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'auto' });
        setCurrentPage(target);
        setResumePage(null);
        const url = new URL(window.location);
        url.searchParams.delete('page');
        window.history.replaceState(null, '', url);
        return;
      }
      if (attempts++ < 80) setTimeout(tick, 100); // ~8s window
    };
    tick();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  // Saved highlights for this source — re-fetched after each note save
  const [highlights, setHighlights] = useState([]);
  const fetchHighlights = async () => {
    try {
      const r = await fetch(`/highlights.json?source_id=${sourceId}`);
      if (r.ok) setHighlights(await r.json());
    } catch (e) { console.error('Failed to load highlights:', e); }
  };
  useEffect(() => { fetchHighlights(); }, [sourceId]);

  // ---- Pinch-to-zoom ----
  // Re-rendering react-pdf on every gesture frame is jank (all pages are
  // mounted), so during a pinch we just CSS-transform the stage for instant
  // feedback, then commit the real `scale` to react-pdf when it settles.
  useEffect(() => {
    if (!pdfUrl) return;
    const scroller = mainContentRef.current;
    if (!scroller) return;
    const pinch = pinchRef.current;

    // Snapshot the gesture: committed scale, the focal point, and which page
    // (+ fractional Y within it) sits under the focal point so we can pin the
    // scroll position there once react-pdf reflows at the new scale.
    const beginGesture = (focalX, focalY) => {
      const stage = stageRef.current;
      if (!stage) return false;
      const stageRect = stage.getBoundingClientRect();
      pinch.active = true;
      pinch.startScale = scaleRef.current;
      pinch.liveScale = 1;
      pinch.anchor = null;
      for (const p of scroller.querySelectorAll('[data-page-number]')) {
        const r = p.getBoundingClientRect();
        if (focalY >= r.top && focalY <= r.bottom) {
          pinch.anchor = {
            page: p.getAttribute('data-page-number'),
            fracY: (focalY - r.top) / r.height,
            focalY,
          };
          break;
        }
      }
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      pinch.fallbackFrac = maxScroll > 0 ? scroller.scrollTop / maxScroll : 0;
      stage.style.transformOrigin = `${focalX - stageRect.left}px ${focalY - stageRect.top}px`;
      stage.style.willChange = 'transform';
      return true;
    };

    // `liveScale` is the absolute multiplier vs. the gesture's start scale.
    const applyGesture = (liveScale) => {
      const stage = stageRef.current;
      if (!stage || !pinch.active) return;
      const target = clampScale(pinch.startScale * liveScale);
      pinch.liveScale = target / pinch.startScale; // re-derive so clamping sticks
      stage.style.transform = `scale(${pinch.liveScale})`;
      if (zoomValueRef.current) zoomValueRef.current.textContent = `${Math.round(target * 100)}%`;
    };

    const commitGesture = () => {
      if (!pinch.active) return;
      pinch.active = false;
      const stage = stageRef.current;
      const newScale = clampScale(pinch.startScale * pinch.liveScale);
      if (stage) {
        // Drop the transform now so the upcoming render isn't double-scaled.
        stage.style.transform = '';
        stage.style.transformOrigin = '';
        stage.style.willChange = '';
      }
      if (newScale !== scaleRef.current) {
        pendingFocalRef.current = pinch.anchor || { fallbackFrac: pinch.fallbackFrac };
        setScale(newScale);
      }
    };

    // Trackpad pinch arrives as a wheel event with ctrlKey set. There's no
    // gesture-end event, so we commit on a short idle timeout.
    let wheelIdle = null;
    const onWheel = (e) => {
      if (!e.ctrlKey) return; // plain scroll — leave it alone
      e.preventDefault();
      if (!pinch.active && !beginGesture(e.clientX, e.clientY)) return;
      applyGesture(pinch.liveScale * Math.exp(-e.deltaY * 0.01));
      clearTimeout(wheelIdle);
      wheelIdle = setTimeout(commitGesture, 220);
    };

    // Touch pinch: two fingers. Track the distance between them.
    let startDist = 0;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e) => {
      if (e.touches.length !== 2) return;
      const [a, b] = e.touches;
      if (beginGesture((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)) {
        startDist = dist(e.touches);
      }
    };
    const onTouchMove = (e) => {
      if (!pinch.active || e.touches.length !== 2) return;
      e.preventDefault(); // block native scroll while pinching
      if (startDist > 0) applyGesture(dist(e.touches) / startDist);
    };
    const onTouchEnd = (e) => {
      if (pinch.active && e.touches.length < 2) commitGesture();
    };

    scroller.addEventListener('wheel', onWheel, { passive: false });
    scroller.addEventListener('touchstart', onTouchStart, { passive: false });
    scroller.addEventListener('touchmove', onTouchMove, { passive: false });
    scroller.addEventListener('touchend', onTouchEnd);
    scroller.addEventListener('touchcancel', onTouchEnd);
    return () => {
      clearTimeout(wheelIdle);
      scroller.removeEventListener('wheel', onWheel);
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
      scroller.removeEventListener('touchend', onTouchEnd);
      scroller.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [pdfUrl]);

  // After a pinch commits, react-pdf reflows at the new scale — pull the scroll
  // position back so the page under the user's fingers stays put.
  useEffect(() => {
    const focal = pendingFocalRef.current;
    if (!focal) return;
    pendingFocalRef.current = null;
    const scroller = mainContentRef.current;
    if (!scroller) return;
    if (focal.page) {
      const pageEl = scroller.querySelector(`[data-page-number="${focal.page}"]`);
      if (pageEl) {
        const r = pageEl.getBoundingClientRect();
        scroller.scrollTop += (r.top + focal.fracY * r.height) - focal.focalY;
        return;
      }
    }
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollTop = (focal.fallbackFrac || 0) * maxScroll;
  }, [scale]);

  // Sidebar resize drag
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      const newWidth = Math.min(Math.max(220, e.clientX), 520);
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

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
    setFormData(prev => ({ ...prev, page_number: currentPage }));
  }, [currentPage]);

  // Track scroll position to update current page
  useEffect(() => {
    const mainContent = mainContentRef.current;
    if (!mainContent) return;

    const handleScroll = () => {
      const pages = mainContent.querySelectorAll('[data-page-number]');
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const rect = page.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
          const pageNum = parseInt(page.getAttribute('data-page-number'));
          if (pageNum !== currentPage) setCurrentPage(pageNum);
          break;
        }
      }
    };

    mainContent.addEventListener('scroll', handleScroll);
    return () => mainContent.removeEventListener('scroll', handleScroll);
  }, [currentPage]);

  // Detect text selection inside the PDF and surface a floating toolbar.
  // Listens for mouse + touch.
  useEffect(() => {
    const mainContent = mainContentRef.current;
    if (!mainContent) return;

    const captureSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 3) {
        setSelection(null);
        return;
      }
      const anchor = sel.anchorNode;
      if (!anchor || !mainContent.contains(anchor.nodeType === 1 ? anchor : anchor.parentNode)) {
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || rect.width === 0) return;

      // Walk to the page wrapper
      let node = anchor.nodeType === 1 ? anchor : anchor.parentNode;
      let pageEl = null;
      let pageNumber = currentPage;
      while (node && node !== mainContent) {
        if (node.dataset?.pageNumber) {
          pageEl = node;
          pageNumber = parseInt(node.dataset.pageNumber, 10);
          break;
        }
        node = node.parentNode;
      }

      // Convert each line-rect to page-relative scale-1 coords so we can
      // re-render the highlight at any zoom level later.
      let bounds = null;
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect();
        const lineRects = Array.from(range.getClientRects()).filter(r => r.width > 1 && r.height > 1);
        bounds = lineRects.map(r => ({
          x: (r.left - pageRect.left) / scale,
          y: (r.top - pageRect.top) / scale,
          w: r.width / scale,
          h: r.height / scale,
        }));
      }

      setSelection({ text, page: pageNumber, rect, bounds });
    };

    const handleEnd = () => setTimeout(captureSelection, 10);

    mainContent.addEventListener('mouseup', handleEnd);
    mainContent.addEventListener('touchend', handleEnd);
    return () => {
      mainContent.removeEventListener('mouseup', handleEnd);
      mainContent.removeEventListener('touchend', handleEnd);
    };
  }, [currentPage, scale]);

  // Dismiss toolbar on scroll, Esc, or click outside
  useEffect(() => {
    if (!selection) return;

    const dismiss = () => {
      setSelection(null);
    };

    const handleKey = (e) => { if (e.key === 'Escape') dismiss(); };
    const handleScrollDismiss = () => dismiss();
    const handleClickOutside = (e) => {
      if (toolbarRef.current && toolbarRef.current.contains(e.target)) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().trim() !== selection.text) {
        dismiss();
      }
    };

    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClickOutside);
    const mainContent = mainContentRef.current;
    mainContent?.addEventListener('scroll', handleScrollDismiss);

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
      mainContent?.removeEventListener('scroll', handleScrollDismiss);
    };
  }, [selection]);

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
        headers: { 'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content },
      });
      if (response.ok) { fetchNotes(); fetchHighlights(); }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const openNoteFromHighlight = (highlight) => {
    const note = notes.find(n => n.id === highlight.note_id);
    if (!note) return;
    setViewingNote(note);
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
            source_id: sourceId,
          }
        }),
      });
      if (response.ok) {
        setFormData({ title: '', body: '', note_type: 'note', page_number: currentPage });
        fetchNotes();
        fetchHighlights();
      } else {
        const data = await response.json();
        alert(data.errors?.join(', ') || 'Failed to create note');
      }
    } catch (error) {
      console.error('Error creating note:', error);
      alert('An error occurred while creating the note');
    }
  };

  // Section index: built from the PDF's embedded outline if present, otherwise
  // populated lazily via a Haiku-backed backend endpoint.
  const [sections, setSections] = useState([]);
  const [sectionsState, setSectionsState] = useState('idle'); // idle | loading | error

  const loadSectionsFromAi = async () => {
    setSectionsState('loading');
    try {
      const r = await fetch(`/sources/${sourceId}/sections.json`);
      if (!r.ok) { setSectionsState('error'); return; }
      const data = await r.json();
      const list = (data.sections || []).filter(s => s.label && s.page);
      setSections(list);
      setSectionsState('idle');
    } catch (e) {
      console.error('Sections fetch error:', e);
      setSectionsState('error');
    }
  };

  const onDocumentLoadSuccess = async (pdf) => {
    setNumPages(pdf.numPages);

    // Try the embedded outline first; resolve each item's destination to a 1-indexed page.
    try {
      const outline = await pdf.getOutline();
      if (Array.isArray(outline) && outline.length > 0) {
        const resolved = await Promise.all(outline.map(async (item) => {
          let dest = item.dest;
          if (typeof dest === 'string') {
            try { dest = await pdf.getDestination(dest); } catch { dest = null; }
          }
          let page = null;
          if (Array.isArray(dest) && dest[0]) {
            try {
              const idx = await pdf.getPageIndex(dest[0]);
              page = idx + 1;
            } catch { /* unresolvable */ }
          }
          return { label: (item.title || '').trim(), page };
        }));
        const usable = resolved.filter(s => s.label && s.page);
        if (usable.length > 0) {
          setSections(usable);
          return;
        }
      }
    } catch (e) {
      console.warn('PDF outline read failed:', e);
    }

    // Embedded outline missing or unresolvable — fall back to AI.
    loadSectionsFromAi();
  };

  // Pill button → open the HighlightModal.  Quote opens it cold; Wire In
  // also tells the modal to fire the AI fetch on open.
  const openHighlight = (mode) => {
    if (!selection) return;
    setHlModal({
      selection: { text: selection.text, page: selection.page, bounds: selection.bounds },
      mode,
    });
    setSelection(null);
  };

  const hasPdf = !!pdfUrl;

  return (
    <>
      <PsmStyles />
      <NoteCardStyles />
      <div ref={containerRef} className="psm psm-shell">
        <MobileSidebarBackdrop isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <aside
              className="psm-sidebar"
              style={{
                width: isMobile ? 'min(320px, 85vw)' : `${sidebarWidth}px`,
                ...(isMobile ? { position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200 } : {}),
              }}
            >
              <SidebarSection
                label={hasPdf ? `New Note on Page ${currentPage}` : 'New Note'}
                sub={hasPdf ? '…or highlight a passage in the PDF for the magic toolbar.' : 'Free-form note for this source.'}
              >
                <form onSubmit={handleSubmitNote} className="psm-form">
                  <div className="sp-field">
                    <label className="sp-label">Type</label>
                    <select
                      className="sp-input"
                      value={formData.note_type}
                      onChange={(e) => setFormData({ ...formData, note_type: e.target.value })}
                    >
                      <option value="note">Note</option>
                      <option value="question">Question</option>
                      <option value="synthesis">Synthesis</option>
                      <option value="connection">Connection</option>
                      <option value="todo">To Do</option>
                    </select>
                  </div>

                  <div className="sp-field">
                    <label className="sp-label">Title <span className="sp-help" style={{ marginLeft: 4 }}>optional</span></label>
                    <input
                      type="text"
                      className="sp-input"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Untitled"
                    />
                  </div>

                  <div className="sp-field">
                    <label className="sp-label">Body</label>
                    <textarea
                      className="sp-textarea"
                      rows={4}
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      placeholder="Write your note…"
                    />
                  </div>

                  <button type="submit" className="sp-action sp-action-primary" style={{ width: '100%' }}>
                    Add note
                  </button>
                </form>
              </SidebarSection>

              <SidebarSection label="Notes" count={notes.length}>
                {notes.length === 0 ? (
                  <div className="sp-empty" style={{ padding: '12px 0' }}>
                    <div className="sp-empty-sub">No notes yet.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {notes.map(note => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onView={() => setViewingNote(note)}
                        onEdit={() => { setEditingNote(note); setShowNoteModal(true); }}
                        onDelete={() => handleDeleteNote(note.id)}
                        omitChips={['source']}
                      />
                    ))}
                  </div>
                )}
              </SidebarSection>
            </aside>

            {!isMobile && (
              <div
                className={`psm-divider${isDragging ? ' is-dragging' : ''}`}
                onMouseDown={() => setIsDragging(true)}
              />
            )}
          </>
        )}

        {/* Sidebar toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="psm-sidebar-toggle"
          style={{
            left: sidebarOpen ? (isMobile ? 'min(320px, 85vw)' : `${sidebarWidth + 1}px`) : '0',
          }}
          title={sidebarOpen ? 'Hide notes' : 'Show notes'}
        >
          <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`} style={{ fontSize: 11 }}></i>
        </button>

        {/* Main */}
        <main className="psm-main">
          <header className={`psm-header${headerCollapsed ? ' is-collapsed' : ''}`}>
            <div className="psm-topbar">
              <nav className="cs-breadcrumb" aria-label="Source path">
                <a href="/sources" className="cs-breadcrumb-link">Sources</a>
                <span className="cs-breadcrumb-sep">›</span>
                <a href={`/sources/${sourceId}`} className="cs-breadcrumb-link">
                  {inTextCitation(source) || sourceTitle}
                </a>
              </nav>

              <div className="psm-header-tools">
                <button
                  type="button"
                  className="psm-collapse-btn"
                  onClick={toggleHeader}
                  aria-expanded={!headerCollapsed}
                  title={headerCollapsed ? 'Show source details' : 'Hide source details'}
                >
                  <i className={`fas fa-chevron-${headerCollapsed ? 'down' : 'up'}`} style={{ fontSize: 11 }}></i>
                </button>
                <HighlightNudge />
              </div>
            </div>

            {!headerCollapsed && (
              <div className="psm-header-body">
                <h1 className="psm-title">{sourceTitle}</h1>
                {source && (
                  <div className="psm-meta-row">
                    {source.kind && <span className="psm-kind">{String(source.kind).replace(/_/g, ' ')}</span>}
                    {source.year && <span className="psm-year">{source.year}</span>}
                    <MethodologyTags source={source} onUpdate={setSource} />
                    {source.abstract && (
                      <button
                        type="button"
                        className="psm-abstract-toggle"
                        onClick={() => setAbstractOpen(o => !o)}
                        aria-expanded={abstractOpen}
                      >
                        <i className={`fas fa-chevron-${abstractOpen ? 'down' : 'right'}`} style={{ fontSize: 9 }}></i>
                        {abstractOpen ? 'Hide abstract' : 'Show abstract'}
                      </button>
                    )}
                  </div>
                )}
                {abstractOpen && source?.abstract && (
                  <div className="psm-abstract">{source.abstract}</div>
                )}
              </div>
            )}
          </header>

          <div ref={mainContentRef} className="psm-scroll">
            {hasPdf && (
              <SectionIndex
                sections={sections}
                state={sectionsState}
                onJump={goToPage}
                isMobile={isMobile}
              />
            )}
            {resumePage && (
              <div className="psm-resume-toast" role="status">
                <i className="fas fa-bookmark" style={{ fontSize: 12 }}></i>
                <span>Last read p. {resumePage}</span>
                <button type="button" className="psm-resume-go" onClick={() => goToPage(resumePage)}>
                  Resume <i className="fas fa-arrow-right" style={{ fontSize: 10 }}></i>
                </button>
                <button type="button" className="psm-resume-x" onClick={() => setResumePage(null)} title="Dismiss">
                  <i className="fas fa-times" style={{ fontSize: 10 }}></i>
                </button>
              </div>
            )}
            {hasPdf && (
              <div className="psm-pdf-bar">
                <span className="psm-page-indicator">
                  <span className="psm-page-num">{currentPage}</span>
                  <span className="psm-page-of"> / {numPages || '…'}</span>
                </span>
                <div className="psm-zoom">
                  <button
                    type="button"
                    className="sp-icon-action-quiet"
                    onClick={() => setScale(s => clampScale(s - 0.1))}
                    title="Zoom out"
                  >
                    <i className="fas fa-minus" style={{ fontSize: 11 }}></i>
                  </button>
                  <span className="psm-zoom-value" ref={zoomValueRef} title="Pinch to zoom">{Math.round(scale * 100)}%</span>
                  <button
                    type="button"
                    className="sp-icon-action-quiet"
                    onClick={() => setScale(s => clampScale(s + 0.1))}
                    title="Zoom in"
                  >
                    <i className="fas fa-plus" style={{ fontSize: 11 }}></i>
                  </button>
                </div>
                <a
                  href={pdfUrl}
                  download
                  className="psm-download-btn"
                  title="Download PDF"
                >
                  <i className="fas fa-download"></i>
                  <span>PDF</span>
                </a>
                <button
                  type="button"
                  onClick={() => canAsk && setAskOpen(true)}
                  className={`psm-ask-btn${canAsk ? '' : ' is-locked'}`}
                  disabled={!canAsk}
                  title={canAsk ? 'Ask Haiku a question about this paper' : 'Ask this Paper requires the Unlimited tier'}
                >
                  <i className={`fas ${canAsk ? 'fa-comments' : 'fa-lock'}`}></i>
                  <span>Ask</span>
                </button>
              </div>
            )}
            {hasPdf ? (
              <div className="psm-pdf-stage" ref={stageRef}>
                <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess}>
                  {Array.from(new Array(numPages), (el, index) => {
                    const pageNum = index + 1;
                    const pageHighlights = highlights.filter(h => h.page_number === pageNum);
                    return (
                      <div
                        key={`page_${pageNum}`}
                        data-page-number={pageNum}
                        className="psm-page-wrap"
                      >
                        <div className="psm-page-tag">Page {pageNum}</div>
                        <Page
                          pageNumber={pageNum}
                          scale={scale}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                        />
                        <HighlightLayer
                          highlights={pageHighlights}
                          scale={scale}
                          onClick={openNoteFromHighlight}
                        />
                      </div>
                    );
                  })}
                </Document>
              </div>
            ) : (
              <div className="psm-empty-stage">
                <div className="sp-empty">
                  <div className="sp-empty-art">
                    <svg width="44" height="44" viewBox="0 0 44 44" className="sp-empty-stroke">
                      <rect x="9" y="6" width="26" height="32" rx="2"/>
                      <line x1="14" y1="14" x2="30" y2="14"/>
                      <line x1="14" y1="20" x2="30" y2="20"/>
                      <line x1="14" y1="26" x2="24" y2="26"/>
                    </svg>
                  </div>
                  <h2 className="sp-empty-title">Notes-only mode</h2>
                  <p className="sp-empty-sub">
                    No PDF attached to this source. Use the sidebar to capture and manage notes directly.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <NoteFormModal
        isOpen={showNoteModal}
        onClose={() => { setShowNoteModal(false); setEditingNote(null); setNotePrefill(null); }}
        onSuccess={() => { fetchNotes(); fetchHighlights(); setShowNoteModal(false); setEditingNote(null); setNotePrefill(null); }}
        onDelete={(noteId) => { handleDeleteNote(noteId); setShowNoteModal(false); setEditingNote(null); setNotePrefill(null); }}
        item={editingNote}
        sourceId={sourceId}
        prefill={notePrefill}
      />

      <ShowNoteModal
        isOpen={!!viewingNote}
        note={viewingNote}
        onClose={() => setViewingNote(null)}
        onEdit={() => {
          const n = viewingNote;
          setViewingNote(null);
          setEditingNote(n);
          setShowNoteModal(true);
        }}
      />

      <AskThisPaperPanel
        isOpen={askOpen}
        onClose={() => setAskOpen(false)}
        sourceId={sourceId}
        userUnlimited={canAsk}
        onJumpToPage={goToPage}
      />

      {selection && (
        <SelectionToolbar
          ref={toolbarRef}
          selection={selection}
          onQuote={() => openHighlight('quote')}
          onWireIn={() => openHighlight('wire-in')}
          onDismiss={() => setSelection(null)}
        />
      )}

      {hlModal && (
        <HighlightModal
          isOpen={true}
          onClose={() => setHlModal(null)}
          onSaved={() => { fetchNotes(); fetchHighlights(); setHlModal(null); }}
          sourceId={sourceId}
          sourceTitle={sourceTitle}
          selection={hlModal.selection}
          initialMode={hlModal.mode}
        />
      )}
    </>
  );
}

function WiredPreview({ preview, onClear }) {
  const { concepts = [], people = [], sources = [] } = preview;
  if (!concepts.length && !people.length && !sources.length) return null;
  return (
    <div className="psm-wired">
      <div className="psm-wired-head">
        <span><i className="fas fa-wand-magic-sparkles" style={{ fontSize: 10, marginRight: 4 }} /> Wired into your library</span>
        <button type="button" className="psm-quote-clear" onClick={onClear} title="Detach all">
          <i className="fas fa-times"></i>
        </button>
      </div>
      {concepts.length > 0 && (
        <WiredRow label="Concepts" tone="concept">
          {concepts.map((c, i) => (
            <WiredBadge key={`c-${i}`} tone="concept" href={c.id ? `/concepts/${c.id}` : null} isNew={c.isNew}>
              {c.label}
            </WiredBadge>
          ))}
        </WiredRow>
      )}
      {people.length > 0 && (
        <WiredRow label="People" tone="person">
          {people.map((p, i) => (
            <WiredBadge key={`p-${i}`} tone="person" href={p.id ? `/people/${p.id}` : null} isNew={p.isNew}>
              {p.name}
            </WiredBadge>
          ))}
        </WiredRow>
      )}
      {sources.length > 0 && (
        <WiredRow label="Sources" tone="source">
          {sources.map((s, i) => (
            <WiredBadge key={`s-${i}`} tone="source" href={s.id ? `/sources/${s.id}` : null} title={s.title} isNew={true}>
              {s.title.length > 36 ? s.title.slice(0, 36) + '…' : s.title}
            </WiredBadge>
          ))}
        </WiredRow>
      )}
    </div>
  );
}

function WiredRow({ label, tone, children }) {
  return (
    <div className="psm-wired-group">
      <div className={`psm-wired-grouplabel is-${tone}`}>{label}</div>
      <div className="psm-wired-row">{children}</div>
    </div>
  );
}

function WiredBadge({ tone, href, isNew, title, children }) {
  const cls = `psm-wired-badge is-${tone}${isNew ? ' is-new' : ''}`;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} title={title}>
        {children}
        <i className="fas fa-arrow-up-right-from-square psm-wired-badge-icon"></i>
      </a>
    );
  }
  return <span className={cls} title={title}>{children}</span>;
}

function ChipGroup({ label, children }) {
  return (
    <div className="psm-chip-group">
      <div className="psm-chip-group-label">{label}</div>
      <div className="psm-chip-row">{children}</div>
    </div>
  );
}

function InsightChip({ tone, active, isNew, onClick, children, title }) {
  const klass = `psm-ichip is-${tone}${active ? ' is-active' : ''}${isNew ? ' is-new' : ''}`;
  return (
    <button type="button" className={klass} onClick={onClick} title={title}>
      {children}{isNew && <span className="psm-ichip-flag"> +</span>}
    </button>
  );
}

function SectionIndex({ sections, state, onJump, isMobile }) {
  const [open, setOpen] = useState(false);

  // Hide on mobile to keep the PDF area uncluttered.
  if (isMobile) return null;
  if (state === 'error') return null;
  if (state === 'idle' && sections.length === 0) return null;

  return (
    <div className="psm-sections" onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="psm-sections-btn"
        onClick={() => setOpen(o => !o)}
        title={open ? 'Hide sections' : 'Show sections'}
        disabled={state === 'loading'}
      >
        <i className="fas fa-list-ul" style={{ fontSize: 11 }}></i>
        <span>
          {state === 'loading' ? 'Detecting sections…' : `Sections · ${sections.length}`}
        </span>
        {state !== 'loading' && (
          <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 9 }}></i>
        )}
      </button>
      {open && (
        <ul className="psm-sections-list">
          {sections.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className="psm-section-item"
                onClick={() => { onJump(s.page); setOpen(false); }}
              >
                <span className="psm-section-label">{s.label}</span>
                <span className="psm-section-page">p.{s.page}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HighlightLayer({ highlights, scale, onClick }) {
  if (!highlights?.length) return null;
  return (
    <div className="psm-highlight-layer" aria-hidden="false">
      {highlights.map(h => {
        const bounds = Array.isArray(h.bounds) ? h.bounds : [];
        if (bounds.length === 0) return null;
        const stripes = stripeColors(h);
        // Stacked stripes via inset box-shadow.  Width per stripe = STRIPE_W.
        const STRIPE_W = 3;
        const totalStripeW = Math.max(STRIPE_W, stripes.length * STRIPE_W);
        const stripeShadow = stripes.length === 0
          ? `inset ${STRIPE_W}px 0 0 var(--ink-line)`
          : stripes.map((c, i) => `inset ${(i + 1) * STRIPE_W}px 0 0 ${c}`).join(', ');

        const firstLine = bounds[0];
        return (
          <React.Fragment key={h.id}>
            {/* Yellow marker bands — selection passes through (pointer-events: none) */}
            {bounds.map((b, i) => (
              <span
                key={`band-${i}`}
                className="psm-highlight-band"
                style={{
                  left: `${b.x * scale}px`,
                  top: `${b.y * scale}px`,
                  width: `${b.w * scale}px`,
                  height: `${b.h * scale}px`,
                  boxShadow: stripeShadow,
                }}
              />
            ))}
            {/* Click target: a thin stripe-shaped pin at the left edge of the
                first line.  Clicking opens the linked note. */}
            <button
              type="button"
              className="psm-highlight-pin"
              onClick={() => onClick(h)}
              title={h.text_content?.slice(0, 120)}
              style={{
                left: `${(firstLine.x * scale) - 6}px`,
                top: `${firstLine.y * scale}px`,
                width: `${totalStripeW + 6}px`,
                height: `${firstLine.h * scale}px`,
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

// In-text citation derived from a Source's authors+year string.
// Examples:
//   "Smith, J."                          → "Smith (2020)"
//   "Smith, J. & Jones, A."              → "Smith & Jones (2020)"
//   "Smith, J., Jones, A., & Doe, B."    → "Smith et al. (2020)"
//   "John Smith and Anne Jones"          → "Smith & Jones (2020)"
function inTextCitation(source) {
  if (!source) return null;
  const raw = String(source.authors || '').trim();
  const year = source.year;

  if (!raw) return year ? `(${year})` : null;

  // Split into author entries.  If the string uses semicolons, those are the
  // separators.  Otherwise look for " & " / " and " plus comma-separated entries.
  let entries;
  if (raw.includes(';')) {
    entries = raw.split(/\s*;\s*/);
  } else if (/\s(?:&|and)\s/i.test(raw)) {
    // Split on " & ", " and ", or comma followed by space
    entries = raw.split(/\s+(?:&|and)\s+|,\s+/i);
  } else {
    // Tricky case: "Smith, John" (1 author, comma in name) vs "Smith, Jones" (2 authors)
    // Heuristic: if 2+ commas present, treat each as an author entry.
    const commaCount = (raw.match(/,/g) || []).length;
    entries = commaCount >= 2 ? raw.split(/,\s*/) : [raw];
  }

  // Collapse fragments that look like initials ("J.", "A. M.") into the prior entry.
  const cleaned = [];
  for (const e of entries) {
    const t = e.trim();
    if (!t) continue;
    if (/^[A-Z]\.?( [A-Z]\.?)*$/.test(t) && cleaned.length) {
      // initials fragment — drop, it belonged to the previous name
      continue;
    }
    cleaned.push(t);
  }

  // Extract last name from each entry
  const lastNames = cleaned.map(e => {
    if (e.includes(',')) return e.split(',')[0].trim();
    const tokens = e.split(/\s+/);
    return tokens[tokens.length - 1];
  }).filter(Boolean);

  let citation;
  if (lastNames.length === 0) citation = null;
  else if (lastNames.length === 1) citation = lastNames[0];
  else if (lastNames.length === 2) citation = `${lastNames[0]} & ${lastNames[1]}`;
  else citation = `${lastNames[0]} et al.`;

  if (!citation) return year ? `(${year})` : null;
  return year ? `${citation} (${year})` : citation;
}

// Last-name match.  Conservative: requires the person's last name (>=3 chars)
// to appear as a word in the citation's author string after diacritic strip.
function authorMatches(authorsStr, personName) {
  const a = String(authorsStr || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  if (!a) return false;
  const name = String(personName || '').trim();
  if (!name) return false;
  const parts = name.split(/\s+/);
  const last = parts[parts.length - 1].toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  if (last.length < 3) return false;
  const escaped = last.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(a);
}

function stripeColors(h) {
  // Order: concept (green), person (purple), source (blue).  Untagged falls
  // through to no stripe (just the marker-yellow body).
  const stripes = [];
  if (h.has_concept)      stripes.push('var(--concept)');
  if (h.has_person)       stripes.push('var(--person)');
  if (h.has_cited_source) stripes.push('var(--source)');
  return stripes;
}

function SidebarSection({ label, count, sub, children }) {
  return (
    <div className="psm-section">
      <div className="psm-section-head">
        <h2 className="psm-section-heading">
          {label}
          {count != null && <span className="psm-section-count">{count}</span>}
        </h2>
        {sub && <p className="psm-section-sub">{sub}</p>}
      </div>
      {children}
    </div>
  );
}


const SelectionToolbar = React.forwardRef(function SelectionToolbar({
  selection, onQuote, onWireIn, onDismiss
}, ref) {
  const { rect, page } = selection;
  const TOOLBAR_HEIGHT_ESTIMATE = 36;
  const margin = 8;
  const tbW = Math.min(300, window.innerWidth - 16);
  const placeAbove = rect.top > TOOLBAR_HEIGHT_ESTIMATE + margin;
  let top = placeAbove ? rect.top - TOOLBAR_HEIGHT_ESTIMATE - margin : rect.bottom + margin;
  top = Math.max(8, Math.min(top, window.innerHeight - TOOLBAR_HEIGHT_ESTIMATE - 8));
  const left = Math.max(8, Math.min(window.innerWidth - tbW - 8, rect.left + (rect.width / 2) - tbW / 2));

  return (
    <div
      ref={ref}
      className="psm-toolbar"
      style={{ top: `${top}px`, left: `${left}px` }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="psm-toolbar-row">
        <button type="button" className="psm-pill-btn psm-pill-quote" onClick={onQuote} title="Open the highlight modal with this passage">
          <i className="fas fa-quote-left" style={{ fontSize: 10 }}></i> Quote
        </button>
        <button
          type="button"
          className="psm-pill-btn psm-pill-insights"
          onClick={onWireIn}
          title="Open the highlight modal and run Haiku to extract concepts, people, and cited sources"
        >
          <i className="fas fa-wand-magic-sparkles" style={{ fontSize: 10 }}></i> Summarize &amp; Wire In
        </button>
        <span className="psm-toolbar-meta">p.{page}</span>
        <button
          type="button"
          className="psm-pill-x"
          onClick={onDismiss}
          title="Dismiss (Esc)"
        >
          <i className="fas fa-times" style={{ fontSize: 11 }}></i>
        </button>
      </div>
    </div>
  );
});

function PsmStyles() {
  return (
    <style>{`
      .psm-shell {
        display: flex;
        height: calc(100vh - 64px);
        overflow: hidden;
        position: relative;
        background: var(--paper);
        font-family: var(--font-body);
      }

      /* ---- Sidebar ---- */
      .psm-sidebar {
        background: var(--paper);
        border-right: 1px solid var(--ink-line);
        overflow-y: auto;
        flex-shrink: 0;
      }
      .psm-section { padding: 22px 18px; border-bottom: 1px solid var(--ink-line-soft); }
      .psm-section:last-child { border-bottom: none; }
      .psm-section-head { margin-bottom: 14px; }
      .psm-section-heading {
        font-family: var(--font-display);
        font-size: 18px;
        font-weight: 600;
        color: var(--source);
        letter-spacing: -0.01em;
        margin: 0;
        line-height: 1.2;
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .psm-section-count {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--ink-3);
        font-weight: 400;
      }
      .psm-section-sub {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--ink-3);
        line-height: 1.5;
        margin: 4px 0 0;
      }
      .psm-form { display: flex; flex-direction: column; gap: 12px; }
      .psm-quote-preview {
        background: var(--paper-warm);
        border-left: 3px solid var(--source);
        border-radius: 0 var(--r-sm) var(--r-sm) 0;
        padding: 6px 8px 8px 10px;
      }
      .psm-quote-preview-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ink-3);
        margin-bottom: 4px;
      }
      .psm-quote-clear {
        background: transparent;
        border: none;
        color: var(--ink-3);
        cursor: pointer;
        font-size: 11px;
        padding: 2px 4px;
        border-radius: var(--r-sm);
      }
      .psm-quote-clear:hover { color: var(--ink); background: var(--hover); }
      .psm-quote-preview-body {
        margin: 0;
        font-size: 12px;
        font-style: italic;
        line-height: 1.45;
        color: var(--ink-2);
        max-height: 84px;
        overflow-y: auto;
      }

      .psm-wired {
        background: var(--paper-warm);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 8px 10px;
      }
      .psm-wired-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ink-3);
        margin-bottom: 6px;
      }
      .psm-wired-group { margin-top: 8px; }
      .psm-wired-group:first-of-type { margin-top: 0; }
      .psm-wired-grouplabel {
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 4px;
      }
      .psm-wired-grouplabel.is-concept { color: var(--concept-2); }
      .psm-wired-grouplabel.is-person  { color: var(--person-2);  }
      .psm-wired-grouplabel.is-source  { color: var(--source-2);  }

      .psm-wired-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .psm-wired-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-family: var(--font-body);
        font-size: 11.5px;
        font-weight: 500;
        line-height: 1.3;
        padding: 3px 8px;
        border-radius: var(--r-sm);
        text-decoration: none;
        border: 1px solid;
        transition: background var(--transition-fast), border-color var(--transition-fast);
        cursor: pointer;
      }
      .psm-wired-badge.is-concept { background: var(--concept-tint); color: var(--concept-2); border-color: var(--concept); }
      .psm-wired-badge.is-person  { background: var(--person-tint);  color: var(--person-2);  border-color: var(--person);  }
      .psm-wired-badge.is-source  { background: var(--source-tint);  color: var(--source-2);  border-color: var(--source);  }
      .psm-wired-badge.is-concept:hover { background: color-mix(in srgb, var(--concept-tint) 60%, var(--concept) 40%); }
      .psm-wired-badge.is-person:hover  { background: color-mix(in srgb, var(--person-tint)  60%, var(--person)  40%); }
      .psm-wired-badge.is-source:hover  { background: color-mix(in srgb, var(--source-tint)  60%, var(--source)  40%); }

      .psm-wired-badge-icon {
        font-size: 8px;
        opacity: 0.7;
      }

      /* ---- Sidebar divider (drag handle) ---- */
      .psm-divider {
        width: 4px;
        cursor: col-resize;
        background: var(--ink-line);
        flex-shrink: 0;
        z-index: 10;
        transition: background var(--transition-fast);
      }
      .psm-divider:hover, .psm-divider.is-dragging { background: var(--ink-3); }

      /* ---- Sidebar toggle ---- */
      .psm-sidebar-toggle {
        position: absolute;
        top: 96px;
        z-index: 210;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-left: none;
        color: var(--ink-2);
        padding: 0;
        cursor: pointer;
        transition: left var(--transition-base), background var(--transition-fast), color var(--transition-fast);
        border-radius: 0 var(--r-md) var(--r-md) 0;
        width: 22px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .psm-sidebar-toggle:hover { background: var(--hover); color: var(--ink); }

      /* ---- Main column ---- */
      .psm-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: var(--paper);
        overflow: hidden;
        min-width: 0;
      }
      .psm-header {
        flex-shrink: 0;
        background: var(--paper);
        border-bottom: 1px solid var(--ink-line);
        padding: 14px 28px 14px 20px;
        position: relative;
        z-index: 5;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .psm-header.is-collapsed { padding-top: 9px; padding-bottom: 9px; }
      /* Title + meta clear the absolutely-positioned sidebar toggle; the
         breadcrumb row sits above it, so it stays flush left. */
      .psm-header-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-left: 36px;
      }
      .psm-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      /* Breadcrumb — these classes are otherwise only styled in ConceptShow,
         which isn't mounted here, so the study view needs its own copy. */
      .cs-breadcrumb {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: 12px;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink-3);
      }
      .cs-breadcrumb-link {
        color: var(--ink-3);
        text-decoration: none;
      }
      .cs-breadcrumb-link:hover { color: var(--ink); border-bottom: 1px solid var(--ink-3); }
      .cs-breadcrumb-sep { color: var(--ink-4); }
      .psm-title {
        font-family: var(--font-display);
        font-size: 28px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: var(--source);
        margin: 0;
        line-height: 1.15;
      }
      .psm-meta-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }
      .psm-kind {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--source-2);
        background: var(--source-tint);
        padding: 1px 8px;
        border-radius: var(--r-sm);
      }
      .psm-year {
        font-family: var(--font-mono);
        font-size: 11.5px;
        color: var(--ink-3);
        font-variant-numeric: tabular-nums;
        padding: 0 4px;
      }
      .psm-abstract-toggle {
        background: transparent;
        border: 1px dashed var(--ink-line);
        color: var(--ink-3);
        font-family: var(--font-body);
        font-size: 11.5px;
        padding: 3px 10px;
        border-radius: var(--r-sm);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
      }
      .psm-abstract-toggle:hover {
        color: var(--source-2);
        border-color: var(--source);
        background: var(--source-tint);
      }
      .psm-abstract {
        background: transparent;
        padding: 4px 0 0;
        font-family: var(--font-body);
        font-size: 13.5px;
        line-height: 1.6;
        color: var(--ink-2);
      }
      .psm-header-tools {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .psm-collapse-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        flex-shrink: 0;
        background: transparent;
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        color: var(--ink-3);
        cursor: pointer;
        transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
      }
      .psm-collapse-btn:hover {
        background: var(--hover);
        color: var(--ink);
        border-color: var(--ink-3);
      }
      .psm-page-indicator {
        font-family: var(--font-mono);
        font-size: 12.5px;
        color: var(--ink-2);
        font-variant-numeric: tabular-nums;
      }
      .psm-page-num { color: var(--ink); font-weight: 600; }
      .psm-page-of { color: var(--ink-3); }

      .psm-zoom {
        display: flex;
        align-items: center;
        gap: 4px;
        background: var(--paper-soft);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-sm);
        padding: 2px;
      }
      .psm-zoom-value {
        font-family: var(--font-mono);
        font-size: 11.5px;
        color: var(--ink-2);
        min-width: 36px;
        text-align: center;
        font-variant-numeric: tabular-nums;
      }

      .psm-scroll {
        flex: 1;
        overflow-y: auto;
        background: color-mix(in srgb, var(--source) 5%, var(--paper-soft));
        position: relative;
        /* Allow one-finger scroll, but hand two-finger pinch to our JS. */
        touch-action: pan-y;
      }
      .psm-pdf-stage { transform-origin: top center; }
      .psm-pdf-bar {
        position: sticky;
        top: 12px;
        z-index: 4;
        margin: 12px auto 0;
        width: fit-content;
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: 999px;
        padding: 4px 6px 4px 14px;
        box-shadow: var(--shadow-md);
        font-family: var(--font-body);
      }
      .psm-pdf-stage {
        padding: 16px 16px 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 44px;
      }
      .psm-download-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 500;
        color: var(--ink-2);
        background: transparent;
        border: none;
        padding: 4px 10px;
        border-radius: 999px;
        text-decoration: none;
        transition: background var(--transition-fast), color var(--transition-fast);
      }
      .psm-download-btn:hover { background: var(--source-tint); color: var(--source-2); }

      .psm-ask-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 600;
        color: var(--paper);
        background: var(--source);
        border: none;
        padding: 5px 12px;
        border-radius: 999px;
        cursor: pointer;
        transition: background var(--transition-fast);
      }
      .psm-ask-btn:hover:not(:disabled) { background: var(--source-2); }
      .psm-ask-btn.is-locked {
        background: var(--paper-warm);
        color: var(--ink-3);
        cursor: not-allowed;
      }

      .psm-sections {
        position: sticky;
        top: 12px;
        left: 12px;
        z-index: 5;
        margin: 12px 0 -36px 12px;
        width: fit-content;
        max-width: 280px;
        font-family: var(--font-body);
      }
      .psm-sections-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        color: var(--ink-2);
        font-family: var(--font-body);
        font-size: 12px;
        padding: 6px 12px;
        border-radius: 999px;
        cursor: pointer;
        box-shadow: var(--shadow-md);
        transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
      }
      .psm-sections-btn:hover { background: var(--source-tint); color: var(--source-2); border-color: var(--source); }
      .psm-sections-btn:disabled { opacity: 0.7; cursor: default; }
      .psm-sections-list {
        list-style: none;
        margin: 6px 0 0;
        padding: 6px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-lg);
        max-height: 50vh;
        overflow-y: auto;
        min-width: 220px;
      }
      .psm-section-item {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        background: transparent;
        border: none;
        padding: 6px 10px;
        border-radius: var(--r-sm);
        cursor: pointer;
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--ink);
        text-align: left;
        transition: background var(--transition-fast), color var(--transition-fast);
      }
      .psm-section-item:hover { background: var(--source-tint); color: var(--source-2); }
      .psm-section-label { flex: 1; }
      .psm-section-page {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--ink-3);
      }

      .psm-resume-toast {
        position: sticky;
        top: 12px;
        z-index: 5;
        margin: 12px auto 0;
        width: fit-content;
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--source);
        color: var(--paper);
        font-family: var(--font-body);
        font-size: 12.5px;
        padding: 6px 8px 6px 14px;
        border-radius: 999px;
        box-shadow: var(--shadow-lg);
      }
      .psm-resume-go {
        background: rgba(255,255,255,0.18);
        border: none;
        color: var(--paper);
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 500;
        padding: 4px 12px;
        border-radius: 999px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        transition: background var(--transition-fast);
      }
      .psm-resume-go:hover { background: rgba(255,255,255,0.30); }
      .psm-resume-x {
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.75);
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 999px;
      }
      .psm-resume-x:hover { color: var(--paper); }
      .psm-page-wrap {
        position: relative;
        box-shadow: var(--shadow-lg);
        border-radius: 2px;
        background: var(--paper);
        scroll-margin-top: 90px;
      }
      .psm-highlight-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .psm-highlight-band {
        position: absolute;
        background: rgba(255, 220, 90, 0.22);
        pointer-events: none;
        border-radius: 1px;
      }
      .psm-highlight-pin {
        position: absolute;
        background: transparent;
        border: none;
        padding: 0;
        margin: 0;
        cursor: pointer;
        pointer-events: auto;
        transition: background var(--transition-fast);
        z-index: 1;
      }
      .psm-highlight-pin:hover { background: rgba(0, 0, 0, 0.04); }
      .psm-highlight-pin:focus { outline: 1px solid var(--ink); outline-offset: 1px; }
      .psm-page-tag {
        position: absolute;
        top: -22px;
        left: 0;
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--ink-3);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .psm-empty-stage {
        min-height: 360px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
      }

      /* Note cards in the sidebar render via the shared NoteCard
         component; see NoteCard.js / NoteCardStyles for their styles. */

      /* ---- Floating selection toolbar ---- */
      .psm-toolbar {
        position: fixed;
        z-index: 300;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        box-shadow: var(--shadow-xl);
        border-radius: 999px;
        padding: 4px;
        font-family: var(--font-body);
      }
      .psm-toolbar.is-expanded {
        border-radius: var(--r-lg);
        padding: 8px;
        min-width: min(320px, calc(100vw - 16px));
        max-width: min(360px, calc(100vw - 16px));
      }
      .psm-toolbar-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .psm-toolbar.is-expanded .psm-toolbar-row { gap: 6px; }
      .psm-toolbar-meta {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--ink-3);
        padding: 0 6px;
        font-variant-numeric: tabular-nums;
      }
      .psm-toolbar.is-expanded .psm-toolbar-meta { flex: 1; text-align: right; padding: 0 4px; }

      /* Pill buttons */
      .psm-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-family: var(--font-body);
        font-size: 11.5px;
        font-weight: 500;
        padding: 5px 10px;
        border: none;
        border-radius: 999px;
        cursor: pointer;
        line-height: 1;
        white-space: nowrap;
        transition: background var(--transition-fast), color var(--transition-fast);
      }
      .psm-pill-btn:disabled { opacity: 0.55; cursor: default; }
      .psm-pill-quote {
        background: var(--paper-warm);
        color: var(--ink);
      }
      .psm-pill-quote:hover { background: var(--hover); }
      .psm-pill-insights {
        background: var(--source);
        color: var(--paper);
      }
      .psm-pill-insights:hover:not(:disabled) { background: var(--source-2); }
      .psm-pill-x {
        background: transparent;
        border: none;
        color: var(--ink-3);
        cursor: pointer;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background var(--transition-fast), color var(--transition-fast);
      }
      .psm-pill-x:hover { background: var(--hover); color: var(--ink); }
      .psm-toolbar-error {
        margin-top: 8px;
        padding: 8px 10px;
        background: rgba(122, 46, 46, 0.06);
        color: var(--error);
        font-size: 12px;
        border-radius: var(--r-sm);
      }
      .psm-toolbar-panel {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--ink-line);
      }
      .psm-toolbar-summary {
        font-size: 13px;
        color: var(--ink);
        line-height: 1.55;
        margin: 0 0 10px;
        max-height: 130px;
        overflow-y: auto;
      }

      /* Insight chip groups (concepts / people / cited sources) */
      .psm-chip-group { margin-bottom: 10px; }
      .psm-chip-group-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 4px;
      }
      .psm-ichip {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 3px 8px;
        font-size: 11.5px;
        font-weight: 500;
        font-family: var(--font-body);
        border-radius: var(--r-sm);
        background: var(--paper-warm);
        color: var(--ink-3);
        border: 1px solid transparent;
        cursor: pointer;
        transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
      }
      .psm-ichip.is-concept.is-active { background: var(--concept-tint); color: var(--concept-2); }
      .psm-ichip.is-person.is-active  { background: var(--person-tint);  color: var(--person-2); }
      .psm-ichip.is-source.is-active  { background: var(--source-tint);  color: var(--source-2); }
      .psm-ichip.is-concept.is-new { border-color: var(--concept); border-style: dashed; }
      .psm-ichip.is-person.is-new  { border-color: var(--person);  border-style: dashed; }
      .psm-ichip.is-source.is-new  { border-color: var(--source);  border-style: dashed; }
      .psm-ichip.is-active.is-new { border-style: solid; }
      .psm-ichip-flag {
        font-family: var(--font-mono);
        font-size: 9.5px;
        opacity: 0.75;
      }

      /* ---- Page-scoped: source-themed primaries on this view ---- */
      .psm .sp-action-primary {
        background: var(--source);
        border-color: var(--source);
      }
      .psm .sp-action-primary:hover:not(:disabled) {
        background: var(--source-2);
        border-color: var(--source-2);
      }

      @media (max-width: 768px) {
        .psm-header { padding: 14px 16px 12px 20px; }
        .psm-header.is-collapsed { padding-top: 8px; padding-bottom: 8px; }
        .psm-title { font-size: 22px; }
        .psm-pdf-stage { padding: 18px 8px 28px; }
      }
    `}</style>
  );
}
