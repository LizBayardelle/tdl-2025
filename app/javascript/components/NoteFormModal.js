import React, { useState, useEffect, useRef, useCallback } from 'react';
import SlidePanel from './SlidePanel';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import ConceptSelector from './ConceptSelector';
import TagSelector from './TagSelector';
import SourceSelector from './SourceSelector';
import PeopleSelector from './PeopleSelector';
import CollectionSelector from './CollectionSelector';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBold, faItalic, faUnderline, faStrikethrough,
  faAlignLeft, faAlignCenter, faAlignRight,
  faListUl, faListOl, faLink, faUnlink,
  faQuoteLeft, faMinus, faTable, faImage,
  faIndent, faOutdent, faCode, faExpand, faCompress,
} from '@fortawesome/free-solid-svg-icons';

// Notes are cross-cutting (attach to anything) so they share the navy
// chrome with the other non-categorical surfaces (Tags, Collections).
// Selectors inside the modal still get teal-ish bones via themeColor below.
const NOTE_ACCENT      = '#1F3B73'; // var(--primary)
const NOTE_ACCENT_DARK = '#142A57'; // var(--primary-dark)
const NOTE_ACCENT_TINT = 'rgba(31, 59, 115, 0.10)';

const NOTE_TYPES = [
  { value: 'note',       label: 'Note' },
  { value: 'question',   label: 'Question' },
  { value: 'synthesis',  label: 'Synthesis' },
  { value: 'connection', label: 'Connection' },
  { value: 'todo',       label: 'To-Do Item' },
];

export default function NoteFormModal({
  isOpen, onClose, onSuccess, onDelete,
  item, conceptId, sourceId, prefill,
  defaultTags,
  floatable = false,
}) {
  const [floating, setFloating] = useState(floatable);
  const [floatPos, setFloatPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 540) : 0,
    y: 96,
  }));
  const [dragOrigin, setDragOrigin] = useState(null);
  const [activeTab, setActiveTab] = useState('content');
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | pending | saving | saved | error
  const saveTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);
  const lastSavedData = useRef(null);
  // Most recent autosave response from the server. Surfaced via onSuccess
  // when the modal closes so the parent's note list can refresh in place.
  const lastAutosaveResponse = useRef(null);

  const [formData, setFormData] = useState({
    title: '', body: '', note_type: 'note', context: '', pinned: false,
    noted_on: new Date().toISOString().split('T')[0],
    concept_ids: [], source_ids: [], tags: [],
    quote_text: '', page_number: null, person_ids: [], collection_ids: [],
  });

  // ---------------------------------------------------------------------
  // Drag handlers (floating mode)
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!dragOrigin) return;
    const onMove = (e) => {
      const p = e.touches ? e.touches[0] : e;
      setFloatPos({
        x: Math.max(0, Math.min(window.innerWidth  - 200, p.clientX - dragOrigin.dx)),
        y: Math.max(0, Math.min(window.innerHeight -  80, p.clientY - dragOrigin.dy)),
      });
    };
    const onUp = () => setDragOrigin(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend',  onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onUp);
    };
  }, [dragOrigin]);

  const beginDrag = (e) => {
    if (!floating) return;
    const p = e.touches ? e.touches[0] : e;
    setDragOrigin({ dx: p.clientX - floatPos.x, dy: p.clientY - floatPos.y });
  };

  // ---------------------------------------------------------------------
  // Autosave (existing notes only)
  // ---------------------------------------------------------------------
  const performAutosave = useCallback(async (dataToSave) => {
    if (!item?.id) return null;
    setSaveStatus('saving');
    const payload = {
      ...dataToSave,
      concept_ids: dataToSave.concept_ids || [],
      source_ids:  dataToSave.source_ids  || [],
      tags:        dataToSave.tags        || [],
    };
    try {
      const r = await fetch(`/notes/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrfToken(),
        },
        body: JSON.stringify({ note: payload }),
      });
      if (r.ok) {
        const data = await r.json();
        lastSavedData.current = JSON.stringify(dataToSave);
        lastAutosaveResponse.current = data;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        return data;
      } else {
        setSaveStatus('error');
        return null;
      }
    } catch (e) {
      console.error('Autosave error:', e);
      setSaveStatus('error');
      return null;
    }
  }, [item?.id]);

  const handleClose = useCallback(async () => {
    let latest = lastAutosaveResponse.current;
    if (saveStatus === 'pending' && item?.id) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const fresh = await performAutosave(formData);
      if (fresh) latest = fresh;
    } else if (saveStatus === 'saving') {
      // Wait for an in-flight autosave so we capture its response below.
      await new Promise((r) => setTimeout(r, 500));
      latest = lastAutosaveResponse.current || latest;
    }
    // Edit mode: tell the parent so its card list refreshes. New-note
    // creation already calls onSuccess from handleSubmit.
    if (item?.id && latest && onSuccess) onSuccess(latest);
    onClose();
  }, [saveStatus, item?.id, formData, performAutosave, onClose, onSuccess]);

  useEffect(() => {
    if (!isOpen || !item?.id) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedData.current = JSON.stringify(formData);
      return;
    }
    if (JSON.stringify(formData) === lastSavedData.current) return;
    setSaveStatus('pending');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => performAutosave(formData), 1000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [formData, isOpen, item?.id, performAutosave]);

  // ---------------------------------------------------------------------
  // TipTap editor
  // ---------------------------------------------------------------------
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ HTMLAttributes: { class: 'max-w-full h-auto' } }),
    ],
    content: formData.body,
    onUpdate: ({ editor }) => {
      setFormData((prev) => ({ ...prev, body: editor.getHTML() }));
    },
  });

  // ---------------------------------------------------------------------
  // Init / reset on open
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('content');
    setSaveStatus('idle');
    isInitialMount.current = true;
    lastAutosaveResponse.current = null;

    if (item) {
      // source_ids prefers the canonical multi-source list returned by the
      // server; falls back to the legacy single source_id when an older
      // payload only carries that.
      const initialSourceIds = item.source_ids?.length
        ? item.source_ids
        : (item.source_id ? [item.source_id] : (sourceId ? [sourceId] : []));
      const newFormData = {
        title:        item.title || '',
        body:         item.body || '',
        note_type:    item.note_type || 'note',
        context:      item.context || '',
        pinned:       item.pinned || false,
        noted_on:     item.noted_on || new Date().toISOString().split('T')[0],
        concept_ids:  item.concepts?.map((c) => c.id) || (conceptId ? [conceptId] : []),
        source_ids:   initialSourceIds,
        tags:         item.tags?.map((t) => t.name) || [],
        quote_text:   item.quote_text || '',
        quote_bounds: item.quote_bounds || null,
        page_number:  item.page_number ?? null,
        person_ids:   item.people?.map((p) => p.id) || [],
        collection_ids: item.collections?.map((c) => c.id) || [],
      };
      setFormData(newFormData);
      lastSavedData.current = JSON.stringify(newFormData);
      if (editor) editor.commands.setContent(newFormData.body);
    } else {
      const newFormData = {
        title:        prefill?.title || '',
        body:         prefill?.body || '',
        note_type:    prefill?.note_type || 'note',
        context:      prefill?.context || '',
        pinned:       false,
        noted_on:     new Date().toISOString().split('T')[0],
        concept_ids:  prefill?.concept_ids || (conceptId ? [conceptId] : []),
        source_ids:   prefill?.source_ids || (sourceId ? [sourceId] : []),
        tags:         prefill?.tags || defaultTags || [],
        quote_text:   prefill?.quote_text || '',
        quote_bounds: prefill?.quote_bounds || null,
        page_number:  prefill?.page_number ?? null,
        person_ids:   prefill?.person_ids || [],
        collection_ids: prefill?.collection_ids || [],
        cited_source_ids: prefill?.cited_source_ids || [],
      };
      setFormData(newFormData);
      lastSavedData.current = null;
      if (editor) editor.commands.setContent(newFormData.body);
    }
    setError('');
  }, [isOpen, item, conceptId, sourceId, defaultTags, editor]);

  // ---------------------------------------------------------------------
  // Submit (new notes go through here; edits autosave)
  // ---------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...formData,
      concept_ids: formData.concept_ids || [],
      source_ids:  formData.source_ids  || [],
      tags:        formData.tags        || [],
    };
    try {
      const url    = item ? `/notes/${item.id}` : '/notes';
      const method = item ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrfToken(),
        },
        body: JSON.stringify({ note: payload }),
      });
      if (r.ok) {
        onSuccess(await r.json());
        onClose();
      } else {
        const data = await r.json();
        setError(data.errors?.join(', ') || 'Failed to save note');
      }
    } catch (e) {
      console.error('Save error:', e);
      setError('An error occurred while saving the note');
    }
  };

  // ---------------------------------------------------------------------
  // Renders
  // ---------------------------------------------------------------------
  if (!isOpen) return null;

  if (fullscreenMode) {
    return (
      <div className="nfm-fullscreen">
        <NfmStyles />
        <header className="nfm-fs-head">
          <div className="nfm-fs-head-left">
            <button type="button" className="nfm-fs-exit" onClick={() => setFullscreenMode(false)}>
              <i className="fas fa-compress" /> Exit
            </button>
            <span className="nfm-fs-title">{formData.title || 'Untitled Note'}</span>
          </div>
          {item && <SaveStatus status={saveStatus} />}
        </header>
        <EditorToolbar editor={editor} onFullscreenToggle={() => setFullscreenMode(false)} fullscreenIcon={faCompress} />
        <div className="nfm-fs-body">
          <EditorContent editor={editor} className="nfm-prose nfm-prose-fs" />
        </div>
      </div>
    );
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="nfm">
      <NfmStyles />

      {/* Header */}
      <header
        className={`nfm-head${floating ? ' is-draggable' : ''}`}
        onMouseDown={floating ? beginDrag : undefined}
        onTouchStart={floating ? beginDrag : undefined}
      >
        <div className="nfm-head-left">
          {floating && <i className="fas fa-grip-vertical nfm-grip" title="Drag to move" />}
          <h2 className="nfm-title">
            <i className="fas fa-sticky-note" />
            {item ? (formData.title || item.title || 'Untitled Note') : 'New Note'}
          </h2>
          <button
            type="button"
            className="nfm-head-pill"
            onClick={() => setFullscreenMode(true)}
            title="Focus mode"
          >
            <FontAwesomeIcon icon={faExpand} /> <span>Focus</span>
          </button>
          {floatable && (
            <button
              type="button"
              className="nfm-head-pill"
              onClick={() => setFloating((f) => !f)}
              title={floating ? 'Dock back to side panel' : 'Pop out into a draggable window'}
            >
              <i className={`fas ${floating ? 'fa-window-restore' : 'fa-up-right-from-square'}`} />
              <span>{floating ? 'Dock' : 'Pop out'}</span>
            </button>
          )}
        </div>
        <div className="nfm-head-right">
          {item && onDelete && (
            <button
              type="button"
              className="nfm-head-icon nfm-head-icon-danger"
              onClick={() => {
                if (window.confirm('Delete this note?  It can\'t be undone.')) onDelete(item.id);
              }}
              title="Delete note"
              aria-label="Delete note"
            >
              <i className="fas fa-trash-alt" />
            </button>
          )}
          {item && <SaveStatus status={saveStatus} />}
          <button
            type="button"
            className="nfm-head-icon"
            onClick={handleClose}
            title="Close"
            aria-label="Close"
          >
            <i className="fas fa-times" />
          </button>
        </div>
      </header>

      {error && (
        <div className="nfm-error">
          <i className="fas fa-times-circle" /> {error}
        </div>
      )}

      <div className="nfm-body">
        <nav className="nfm-nav">
          <span className="nfm-nav-label">Sections</span>
          <button
            type="button"
            className={`nfm-tab${activeTab === 'content' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            <i className="fas fa-file-alt" />
            <span>Content</span>
          </button>
          <button
            type="button"
            className={`nfm-tab${activeTab === 'connections' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('connections')}
          >
            <i className="fas fa-project-diagram" />
            <span>Connections</span>
          </button>
        </nav>

        <div className="nfm-content">
          {activeTab === 'content' && (
            <ContentTab
              formData={formData}
              setFormData={setFormData}
              editor={editor}
              onFullscreenToggle={() => setFullscreenMode(true)}
            />
          )}
          {activeTab === 'connections' && (
            <ConnectionsTab
              formData={formData}
              setFormData={setFormData}
              sourceId={sourceId}
              conceptId={conceptId}
            />
          )}
        </div>
      </div>

      {!item && (
        <footer className="nfm-foot">
          <button type="button" className="sp-action sp-action-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="sp-action sp-action-primary nfm-foot-create">Create Note</button>
        </footer>
      )}
    </form>
  );

  if (floating) {
    return (
      <div
        className="nfm-floating"
        style={{
          top: `${floatPos.y}px`,
          left: `${floatPos.x}px`,
          userSelect: dragOrigin ? 'none' : 'auto',
        }}
      >
        {formContent}
      </div>
    );
  }

  return (
    <SlidePanel isOpen={isOpen} onClose={handleClose}>
      {formContent}
    </SlidePanel>
  );
}

// =====================================================================
// Save status pill
// =====================================================================
function SaveStatus({ status }) {
  if (status === 'pending') return <span className="nfm-save is-pending"><i className="fas fa-circle-notch fa-spin" /> Save pending…</span>;
  if (status === 'saving')  return <span className="nfm-save is-saving"><i className="fas fa-circle-notch fa-spin" /> Saving…</span>;
  if (status === 'saved')   return <span className="nfm-save is-saved"><i className="fas fa-check" /> Saved</span>;
  if (status === 'error')   return <span className="nfm-save is-error"><i className="fas fa-exclamation-circle" /> Error</span>;
  return <span className="nfm-save is-idle">Auto-save on</span>;
}

// =====================================================================
// Tab — Content
// =====================================================================
function ContentTab({ formData, setFormData, editor, onFullscreenToggle }) {
  return (
    <section className="nfm-section">
      <Field label="Title">
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Optional title for this note"
          className="form-input"
        />
      </Field>

      <Field label="Type" required>
        <select
          value={formData.note_type}
          onChange={(e) => setFormData({ ...formData, note_type: e.target.value })}
          className="form-select"
        >
          {NOTE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>

      {formData.quote_text && (
        <Field
          label={`Quoted passage${formData.page_number ? ` (p. ${formData.page_number})` : ''}`}
          trailing={
            <button
              type="button"
              className="nfm-quote-detach"
              onClick={() => setFormData((prev) => ({ ...prev, quote_text: '' }))}
              title="Detach quoted passage"
            >
              <i className="fas fa-times" /> Detach
            </button>
          }
        >
          <blockquote className="nfm-quote">{formData.quote_text}</blockquote>
        </Field>
      )}

      <Field label="Body" required>
        <div className="nfm-editor">
          <EditorToolbar editor={editor} onFullscreenToggle={onFullscreenToggle} fullscreenIcon={faExpand} />
          <EditorContent editor={editor} className="nfm-prose" />
        </div>
      </Field>

      <Field label="Context">
        <textarea
          value={formData.context}
          onChange={(e) => setFormData({ ...formData, context: e.target.value })}
          rows={2}
          className="form-textarea"
          placeholder="What prompted this note?"
        />
      </Field>

      <div className="nfm-grid-2">
        <Field label="Date noted">
          <input
            type="date"
            value={formData.noted_on}
            onChange={(e) => setFormData({ ...formData, noted_on: e.target.value })}
            className="form-input"
          />
        </Field>
        <label className="nfm-pin">
          <input
            type="checkbox"
            checked={formData.pinned}
            onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
          />
          <span>Pin this note</span>
        </label>
      </div>
    </section>
  );
}

// =====================================================================
// Tab — Connections
// =====================================================================
function ConnectionsTab({ formData, setFormData, sourceId, conceptId }) {
  return (
    <section className="nfm-section">
      <div className="nfm-grid-2">
        <Field label="Link to sources">
          <SourceSelector
            selectedSourceIds={formData.source_ids || []}
            onChange={(ids) => setFormData({ ...formData, source_ids: ids })}
            multiple={true}
            themeColor={NOTE_ACCENT}
          />
        </Field>
        {!conceptId && (
          <Field label="Link to concepts">
            <ConceptSelector
              selectedConceptIds={formData.concept_ids}
              onChange={(ids) => setFormData({ ...formData, concept_ids: ids })}
              themeColor={NOTE_ACCENT}
            />
          </Field>
        )}
        <Field label="Link to people">
          <PeopleSelector
            selectedPersonIds={formData.person_ids}
            onChange={(ids) => setFormData({ ...formData, person_ids: ids })}
            themeColor={NOTE_ACCENT}
          />
        </Field>
        <Field label="Add to collections">
          <CollectionSelector
            selectedCollectionIds={formData.collection_ids}
            onChange={(ids) => setFormData({ ...formData, collection_ids: ids })}
            themeColor={NOTE_ACCENT}
          />
        </Field>
        <Field label="Tags">
          <TagSelector
            selectedTags={formData.tags}
            onChange={(tags) => setFormData({ ...formData, tags })}
            themeColor={NOTE_ACCENT}
          />
        </Field>
      </div>
    </section>
  );
}

// =====================================================================
// Reusable Field wrapper
// =====================================================================
function Field({ label, required, trailing, children }) {
  return (
    <div className="nfm-field">
      <div className="nfm-field-head">
        <label className="nfm-label">
          {label}{required && <span className="nfm-req">*</span>}
        </label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

// =====================================================================
// Editor toolbar — single source of truth (used in both inline + fullscreen)
// =====================================================================
function EditorToolbar({ editor, onFullscreenToggle, fullscreenIcon }) {
  if (!editor) return null;

  const Btn = ({ icon, isActive, onClick, title, disabled }) => (
    <button
      type="button"
      className={`nfm-tb-btn${isActive ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      <FontAwesomeIcon icon={icon} />
    </button>
  );
  const Divider = () => <span className="nfm-tb-divider" />;

  const headingValue =
    editor.isActive('heading', { level: 1 }) ? '1' :
    editor.isActive('heading', { level: 2 }) ? '2' :
    editor.isActive('heading', { level: 3 }) ? '3' :
    editor.isActive('heading', { level: 4 }) ? '4' :
    editor.isActive('heading', { level: 5 }) ? '5' :
    editor.isActive('heading', { level: 6 }) ? '6' : '';

  return (
    <div className="nfm-tb">
      <Btn icon={faBold}          isActive={editor.isActive('bold')}      onClick={() => editor.chain().focus().toggleBold().run()}      title="Bold" />
      <Btn icon={faItalic}        isActive={editor.isActive('italic')}    onClick={() => editor.chain().focus().toggleItalic().run()}    title="Italic" />
      <Btn icon={faUnderline}     isActive={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline" />
      <Btn icon={faStrikethrough} isActive={editor.isActive('strike')}    onClick={() => editor.chain().focus().toggleStrike().run()}    title="Strikethrough" />
      <Divider />
      <select
        className="nfm-tb-select"
        value={headingValue}
        onChange={(e) => {
          const level = parseInt(e.target.value, 10);
          if (level) editor.chain().focus().toggleHeading({ level }).run();
          else       editor.chain().focus().setParagraph().run();
        }}
      >
        <option value="">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
        <option value="4">Heading 4</option>
        <option value="5">Heading 5</option>
        <option value="6">Heading 6</option>
      </select>
      <Divider />
      <input
        type="color"
        className="nfm-tb-color"
        onInput={(e) => editor.chain().focus().setColor(e.target.value).run()}
        value={editor.getAttributes('textStyle').color || '#000000'}
        title="Text color"
      />
      <input
        type="color"
        className="nfm-tb-color"
        onInput={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
        title="Highlight color"
      />
      <Divider />
      <Btn icon={faAlignLeft}   isActive={editor.isActive({ textAlign: 'left' })}   onClick={() => editor.chain().focus().setTextAlign('left').run()}   title="Align left" />
      <Btn icon={faAlignCenter} isActive={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center" />
      <Btn icon={faAlignRight}  isActive={editor.isActive({ textAlign: 'right' })}  onClick={() => editor.chain().focus().setTextAlign('right').run()}  title="Align right" />
      <Divider />
      <Btn icon={faListUl}  isActive={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()}  title="Bullet list" />
      <Btn icon={faListOl}  isActive={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list" />
      <Btn icon={faIndent}                                            onClick={() => editor.chain().focus().sinkListItem('listItem').run()} title="Indent" />
      <Btn icon={faOutdent}                                           onClick={() => editor.chain().focus().liftListItem('listItem').run()} title="Outdent" />
      <Divider />
      <Btn
        icon={faLink}
        isActive={editor.isActive('link')}
        onClick={() => {
          const url = window.prompt('Enter URL:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        title="Add link"
      />
      <Btn
        icon={faUnlink}
        onClick={() => editor.chain().focus().unsetLink().run()}
        title="Remove link"
        disabled={!editor.isActive('link')}
      />
      <Btn icon={faQuoteLeft} isActive={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote" />
      <Btn icon={faCode}      isActive={editor.isActive('codeBlock')}  onClick={() => editor.chain().focus().toggleCodeBlock().run()}  title="Code block" />
      <Btn icon={faMinus}                                              onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule" />
      <Divider />
      <Btn icon={faTable} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table" />
      <Btn
        icon={faImage}
        onClick={() => {
          const url = window.prompt('Enter image URL:');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
        title="Insert image"
      />
      {onFullscreenToggle && (
        <button
          type="button"
          className="nfm-tb-btn nfm-tb-btn-trail"
          onClick={onFullscreenToggle}
          title={fullscreenIcon === faCompress ? 'Exit focus mode' : 'Focus mode'}
        >
          <FontAwesomeIcon icon={fullscreenIcon} />
        </button>
      )}
    </div>
  );
}

function csrfToken() {
  return document.querySelector('[name="csrf-token"]')?.content;
}

// =====================================================================
// Styles
// =====================================================================
function NfmStyles() {
  return (
    <style>{`
      :root {
        --nfm-accent:      ${NOTE_ACCENT};
        --nfm-accent-dark: ${NOTE_ACCENT_DARK};
        --nfm-accent-tint: ${NOTE_ACCENT_TINT};
      }

      .nfm {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--paper);
      }

      /* ---------- Header ---------- */
      .nfm-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 10px 16px;
        background: var(--nfm-accent);
        flex-shrink: 0;
        z-index: 5;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
      }
      .nfm-head.is-draggable { cursor: move; }
      .nfm-head-left {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        flex: 1;
      }
      .nfm-head-right {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .nfm-grip {
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
        flex-shrink: 0;
      }
      .nfm-title {
        margin: 0;
        font-family: var(--font-display);
        font-size: 17px;
        font-weight: 600;
        color: var(--paper);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .nfm-title i { font-size: 14px; opacity: 0.85; }
      .nfm-head-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: var(--r-sm);
        color: var(--paper);
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
        flex-shrink: 0;
      }
      .nfm-head-pill:hover {
        background: rgba(255, 255, 255, 0.25);
        border-color: rgba(255, 255, 255, 0.5);
      }
      .nfm-head-icon {
        width: 30px;
        height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.15);
        border: none;
        border-radius: 50%;
        color: var(--paper);
        cursor: pointer;
        font-size: 13px;
        transition: background 0.15s, color 0.15s;
      }
      .nfm-head-icon:hover { background: rgba(255, 255, 255, 0.3); }
      .nfm-head-icon-danger:hover { background: rgba(255, 255, 255, 0.2); color: #ffd0d0; }

      /* Save status pill */
      .nfm-save {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: var(--paper);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 11.5px;
        font-weight: 500;
      }
      .nfm-save.is-pending { color: var(--ink-3); }
      .nfm-save.is-saving  { color: var(--nfm-accent-dark); }
      .nfm-save.is-saved   { color: var(--success); }
      .nfm-save.is-error   { color: var(--error); }
      .nfm-save.is-idle    { color: var(--ink-3); }

      /* ---------- Error banner ---------- */
      .nfm-error {
        margin: 12px 24px 0;
        padding: 10px 14px;
        background: color-mix(in srgb, var(--error) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
        border-radius: var(--r-md);
        color: var(--error);
        font-family: var(--font-body);
        font-size: 13px;
      }
      .nfm-error i { margin-right: 6px; }

      /* ---------- Body (sidebar nav + content) ---------- */
      .nfm-body {
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
      }
      .nfm-nav {
        width: 200px;
        flex-shrink: 0;
        background: var(--paper-soft);
        border-right: 1px solid var(--ink-line);
        padding: 16px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .nfm-nav-label {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 6px;
        padding: 0 6px;
      }
      .nfm-tab {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        background: transparent;
        border: none;
        border-radius: var(--r-sm);
        cursor: pointer;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        text-align: left;
        transition: background 0.12s, color 0.12s;
      }
      .nfm-tab:hover { background: var(--hover); }
      .nfm-tab.is-active {
        background: var(--nfm-accent-tint);
        color: var(--nfm-accent-dark);
        font-weight: 500;
      }
      .nfm-tab i { width: 14px; font-size: 12px; }

      .nfm-content {
        flex: 1;
        overflow-y: auto;
        background: var(--paper);
        padding: 24px 32px 80px;
        min-width: 0;
      }
      .nfm-section { display: flex; flex-direction: column; gap: 18px; }

      /* ---------- Field component ---------- */
      .nfm-field { display: flex; flex-direction: column; gap: 6px; }
      .nfm-field-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }
      .nfm-label {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--nfm-accent-dark);
      }
      .nfm-req { color: var(--error); margin-left: 4px; }
      .nfm-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
      }

      .nfm-pin {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding-top: 22px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        cursor: pointer;
      }
      .nfm-pin input { accent-color: var(--nfm-accent); }

      /* ---------- Quoted passage ---------- */
      .nfm-quote {
        margin: 0;
        padding: 10px 14px;
        background: var(--paper-soft);
        border-left: 3px solid var(--nfm-accent);
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 13.5px;
        line-height: 1.55;
        color: var(--ink-2);
        font-style: italic;
        white-space: pre-wrap;
      }
      .nfm-quote-detach {
        background: transparent;
        border: none;
        color: var(--ink-3);
        cursor: pointer;
        font-family: var(--font-body);
        font-size: 11.5px;
        padding: 0;
      }
      .nfm-quote-detach:hover { color: var(--error); }
      .nfm-quote-detach i { margin-right: 4px; }

      /* ---------- Editor + toolbar ---------- */
      .nfm-editor {
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        background: var(--paper);
        overflow: hidden;
      }
      .nfm-tb {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        padding: 8px;
        border-bottom: 1px solid var(--ink-line-soft);
        background: var(--paper);
      }
      .nfm-tb-btn {
        width: 30px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        background: transparent;
        border: none;
        border-radius: var(--r-sm);
        color: var(--nfm-accent-dark);
        cursor: pointer;
        font-size: 12.5px;
        transition: background 0.12s, color 0.12s;
      }
      .nfm-tb-btn:hover:not(:disabled) {
        background: color-mix(in srgb, var(--nfm-accent) 12%, transparent);
      }
      .nfm-tb-btn.is-active {
        background: color-mix(in srgb, var(--nfm-accent) 22%, transparent);
        color: var(--nfm-accent-dark);
      }
      .nfm-tb-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .nfm-tb-btn-trail { margin-left: auto; }
      .nfm-tb-divider {
        width: 1px;
        height: 22px;
        background: color-mix(in srgb, var(--nfm-accent) 25%, transparent);
        margin: 0 4px;
      }
      .nfm-tb-select {
        padding: 4px 8px;
        background: var(--paper);
        border: 1px solid color-mix(in srgb, var(--nfm-accent) 25%, var(--ink-line));
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12.5px;
        color: var(--nfm-accent-dark);
        cursor: pointer;
      }
      .nfm-tb-color {
        width: 30px;
        height: 26px;
        padding: 0;
        background: transparent;
        border: 1px solid color-mix(in srgb, var(--nfm-accent) 25%, var(--ink-line));
        border-radius: var(--r-sm);
        cursor: pointer;
      }

      .nfm-prose {
        padding: 12px 16px;
        min-height: 180px;
        font-family: var(--font-body);
        font-size: 14.5px;
        line-height: 1.7;
        color: var(--ink);
      }
      .nfm-prose .ProseMirror { outline: none; min-height: 160px; }
      .nfm-prose .ProseMirror p { margin: 0 0 12px; }
      .nfm-prose .ProseMirror p:last-child { margin: 0; }
      .nfm-prose .ProseMirror ul,
      .nfm-prose .ProseMirror ol { margin: 0 0 12px; padding-left: 22px; }
      .nfm-prose .ProseMirror ul ul,
      .nfm-prose .ProseMirror ol ol,
      .nfm-prose .ProseMirror ul ol,
      .nfm-prose .ProseMirror ol ul { margin-bottom: 0; }
      .nfm-prose .ProseMirror li { margin-bottom: 4px; }
      .nfm-prose .ProseMirror blockquote {
        border-left: 3px solid var(--ink-line);
        padding-left: 14px;
        color: var(--ink-2);
        font-style: italic;
        margin: 0 0 12px;
      }
      .nfm-prose .ProseMirror pre {
        background: var(--paper-soft);
        padding: 10px 12px;
        border-radius: var(--r-sm);
        overflow-x: auto;
      }
      .nfm-prose .ProseMirror code {
        background: var(--paper-soft);
        padding: 1px 5px;
        border-radius: 2px;
        font-family: var(--font-mono);
        font-size: 12.5px;
      }
      .nfm-prose .ProseMirror table {
        border-collapse: collapse;
        width: 100%;
        margin: 0 0 12px;
      }
      .nfm-prose .ProseMirror table td,
      .nfm-prose .ProseMirror table th {
        border: 1px solid var(--ink-line);
        padding: 6px 8px;
      }
      .nfm-prose .ProseMirror table th {
        background: var(--paper-soft);
        text-align: left;
      }
      .nfm-prose .ProseMirror img { max-width: 100%; height: auto; }

      /* ---------- Footer (new-note submit row) ---------- */
      .nfm-foot {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 10px;
        padding: 14px 24px;
        border-top: 1px solid var(--ink-line);
        background: var(--paper-soft);
        flex-shrink: 0;
      }
      .nfm-foot-create {
        background: var(--nfm-accent);
        border-color: var(--nfm-accent);
        color: var(--paper);
      }
      .nfm-foot-create:hover {
        background: var(--nfm-accent-dark);
        border-color: var(--nfm-accent-dark);
      }

      /* ---------- Floating window mode ---------- */
      .nfm-floating {
        position: fixed;
        width: min(540px, calc(100vw - 16px));
        height: min(680px, calc(100vh - 16px));
        background: var(--paper);
        border-radius: var(--r-lg);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* ---------- Fullscreen mode ---------- */
      .nfm-fullscreen {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: var(--paper);
        display: flex;
        flex-direction: column;
      }
      .nfm-fs-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 14px;
        background: var(--paper-soft);
        border-bottom: 1px solid var(--ink-line);
        flex-shrink: 0;
      }
      .nfm-fs-head-left {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .nfm-fs-exit {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: var(--nfm-accent);
        color: var(--paper);
        border: none;
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
      }
      .nfm-fs-exit:hover { background: var(--nfm-accent-dark); }
      .nfm-fs-title {
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink-2);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .nfm-fs-body {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        max-width: 920px;
        width: 100%;
        margin: 0 auto;
      }
      .nfm-prose-fs { padding: 0; min-height: calc(100vh - 200px); font-size: 16px; }

      /* ---------- Responsive ---------- */
      @media (max-width: 768px) {
        .nfm-nav {
          width: 56px;
          padding: 12px 8px;
        }
        .nfm-nav-label { display: none; }
        .nfm-tab {
          justify-content: center;
          padding: 8px;
        }
        .nfm-tab span { display: none; }
        .nfm-content { padding: 16px 16px 60px; }
        .nfm-grid-2 { grid-template-columns: 1fr; }
        .nfm-pin { padding-top: 0; }
        .nfm-head-pill span { display: none; }
      }
    `}</style>
  );
}
