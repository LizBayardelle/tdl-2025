import React, { useState, useEffect } from 'react';
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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBold, faItalic, faUnderline, faStrikethrough,
  faAlignLeft, faAlignCenter, faAlignRight,
  faListUl, faListOl, faLink, faUnlink,
  faQuoteLeft, faMinus, faTable, faImage,
  faIndent, faOutdent, faCode
} from '@fortawesome/free-solid-svg-icons';

export default function NoteFormModal({ isOpen, onClose, onSuccess, item, conceptId, sourceId }) {
  const [activeTab, setActiveTab] = useState('content');
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    note_type: 'note',
    context: '',
    pinned: false,
    noted_on: new Date().toISOString().split('T')[0],
    concept_ids: [],
    source_id: null,
    tags: []
  });
  const [error, setError] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto',
        },
      }),
    ],
    content: formData.body,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, body: editor.getHTML() }));
    },
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab('content');
      if (item) {
        const newFormData = {
          title: item.title || '',
          body: item.body || '',
          note_type: item.note_type || 'note',
          context: item.context || '',
          pinned: item.pinned || false,
          noted_on: item.noted_on || new Date().toISOString().split('T')[0],
          concept_ids: item.concepts?.map(c => c.id) || (conceptId ? [conceptId] : []),
          source_id: item.source_id || sourceId || null,
          tags: item.tags?.map(t => t.name) || []
        };
        setFormData(newFormData);
        if (editor) {
          editor.commands.setContent(newFormData.body);
        }
      } else {
        const newFormData = {
          title: '',
          body: '',
          note_type: 'note',
          context: '',
          pinned: false,
          noted_on: new Date().toISOString().split('T')[0],
          concept_ids: conceptId ? [conceptId] : [],
          source_id: sourceId || null,
          tags: []
        };
        setFormData(newFormData);
        if (editor) {
          editor.commands.setContent('');
        }
      }
      setError('');
    }
  }, [isOpen, item, conceptId, sourceId, editor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      ...formData,
      concept_ids: formData.concept_ids || [],
      source_id: formData.source_id || null,
      tags: formData.tags || []
    };

    try {
      console.log('Submitting note. item:', item, 'item.id:', item?.id);
      const url = item ? `/notes/${item.id}` : '/notes';
      const method = item ? 'PATCH' : 'POST';
      console.log('URL:', url, 'Method:', method);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ note: payload }),
      });

      if (response.ok) {
        const data = await response.json();
        onSuccess(data);
        onClose();
      } else {
        const data = await response.json();
        setError(data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error saving note:', error);
      setError('An error occurred while saving the note');
    }
  };

  const toolbarButtonStyle = (isActive) => ({
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: '4px',
    fontSize: 'var(--text-sm)',
    color: '#639CA1',
    background: isActive ? 'rgba(99, 156, 161, 0.2)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '28px',
  });

  const toolbarHover = (isActive) => ({
    onMouseEnter: (e) => !isActive && (e.currentTarget.style.background = 'rgba(99, 156, 161, 0.1)'),
    onMouseLeave: (e) => !isActive && (e.currentTarget.style.background = 'transparent'),
  });

  const divider = (
    <div style={{ width: '1px', height: '24px', background: 'rgba(99, 156, 161, 0.2)', margin: '0 var(--space-1)' }}></div>
  );

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {error && (
          <div className="alert alert-error" style={{ margin: 'var(--space-4)', marginBottom: 0 }}>
            <span className="alert-title"><i className="fas fa-times-circle"></i> Error:</span>
            {error}
          </div>
        )}

        {/* Sidebar + Content Layout */}
        <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden', position: 'relative' }}>
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 'var(--space-4)',
              right: 'var(--space-4)',
              zIndex: 10,
              background: 'white',
              border: 'none',
              color: 'var(--neutral-500)',
              fontSize: 'var(--text-2xl)',
              cursor: 'pointer',
              padding: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              boxShadow: 'var(--shadow-md)',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--neutral-100)';
              e.currentTarget.style.color = 'var(--neutral-900)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.color = 'var(--neutral-500)';
            }}
          >
            ×
          </button>
          {/* Left Sidebar Navigation */}
          <div className="w-12 md:w-[200px]" style={{
            background: 'var(--sidebar-bg)',
            padding: 'var(--space-2)',
            paddingTop: 'var(--space-6)',
            flexShrink: 0,
          }}>
            <div className="hidden md:block" style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--neutral-500)',
              marginBottom: 'var(--space-3)',
              fontFamily: 'var(--font-body)',
            }}>
              Sections
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className="justify-center md:justify-start"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-700)',
                background: activeTab === 'content' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'content') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'content') e.currentTarget.style.background = 'transparent';
              }}
              title="Content"
            >
              <i className="fas fa-file-alt" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Content</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('connections')}
              className="justify-center md:justify-start"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--neutral-700)',
                background: activeTab === 'connections' ? 'var(--neutral-200)' : 'transparent',
                border: 'none',
                transition: 'background 0.15s',
                marginBottom: '0.25rem',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'connections') e.currentTarget.style.background = 'var(--neutral-100)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'connections') e.currentTarget.style.background = 'transparent';
              }}
              title="Connections"
            >
              <i className="fas fa-project-diagram" style={{ width: '16px' }}></i>
              <span className="hidden md:inline">Connections</span>
            </button>
          </div>

          {/* Content Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--background)',
            padding: 'var(--space-6)',
          }}>
            {activeTab === 'content' && (
              <div className="space-y-4">
            <div>
              <label className="form-label required teal">Type</label>
              <select
                value={formData.note_type}
                onChange={(e) => setFormData({ ...formData, note_type: e.target.value })}
                className="form-select"
              >
                <option value="note">Note</option>
                <option value="question">Question</option>
                <option value="synthesis">Synthesis</option>
                <option value="connection">Connection</option>
                <option value="todo">To Do Item</option>
              </select>
            </div>

            <div>
              <label className="form-label teal">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="form-input"
                placeholder="Optional title for this note"
              />
            </div>

            <div>
              <label className="form-label required teal">Body</label>
              <div style={{
                border: '1px solid var(--neutral-300)',
                borderRadius: 'var(--radius)',
                background: 'white',
                overflow: 'hidden'
              }}>
            {editor && (
              <div style={{
                borderBottom: '1px solid var(--neutral-200)',
                padding: 'var(--space-2)',
                display: 'flex',
                gap: 'var(--space-1)',
                flexWrap: 'wrap',
                background: 'white'
              }}>
                {/* Text formatting */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  style={toolbarButtonStyle(editor.isActive('bold'))}
                  {...toolbarHover(editor.isActive('bold'))}
                  title="Bold"
                >
                  <FontAwesomeIcon icon={faBold} />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  style={toolbarButtonStyle(editor.isActive('italic'))}
                  {...toolbarHover(editor.isActive('italic'))}
                  title="Italic"
                >
                  <FontAwesomeIcon icon={faItalic} />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  style={toolbarButtonStyle(editor.isActive('underline'))}
                  {...toolbarHover(editor.isActive('underline'))}
                  title="Underline"
                >
                  <FontAwesomeIcon icon={faUnderline} />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  style={toolbarButtonStyle(editor.isActive('strike'))}
                  {...toolbarHover(editor.isActive('strike'))}
                  title="Strikethrough"
                >
                  <FontAwesomeIcon icon={faStrikethrough} />
                </button>

                {divider}

                {/* Headings dropdown */}
                <select
                  onChange={(e) => {
                    const level = parseInt(e.target.value);
                    if (level) {
                      editor.chain().focus().toggleHeading({ level }).run();
                    } else {
                      editor.chain().focus().setParagraph().run();
                    }
                  }}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: '4px',
                    fontSize: 'var(--text-sm)',
                    color: '#639CA1',
                    border: '1px solid rgba(99, 156, 161, 0.2)',
                    background: 'var(--neutral-50)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)'
                  }}
                  value={
                    editor.isActive('heading', { level: 1 }) ? '1' :
                    editor.isActive('heading', { level: 2 }) ? '2' :
                    editor.isActive('heading', { level: 3 }) ? '3' :
                    editor.isActive('heading', { level: 4 }) ? '4' :
                    editor.isActive('heading', { level: 5 }) ? '5' :
                    editor.isActive('heading', { level: 6 }) ? '6' : ''
                  }
                >
                  <option value="">Paragraph</option>
                  <option value="1">Heading 1</option>
                  <option value="2">Heading 2</option>
                  <option value="3">Heading 3</option>
                  <option value="4">Heading 4</option>
                  <option value="5">Heading 5</option>
                  <option value="6">Heading 6</option>
                </select>

                {divider}

                {/* Text color */}
                <input
                  type="color"
                  onInput={(e) => editor.chain().focus().setColor(e.target.value).run()}
                  value={editor.getAttributes('textStyle').color || '#000000'}
                  style={{
                    width: '32px',
                    height: '24px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: '1px solid rgba(99, 156, 161, 0.2)'
                  }}
                  title="Text Color"
                />

                {/* Highlight */}
                <input
                  type="color"
                  onInput={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                  style={{
                    width: '32px',
                    height: '24px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: '1px solid rgba(99, 156, 161, 0.2)'
                  }}
                  title="Highlight Color"
                />

                {divider}

                {/* Text alignment */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  style={toolbarButtonStyle(editor.isActive({ textAlign: 'left' }))}
                  {...toolbarHover(editor.isActive({ textAlign: 'left' }))}
                  title="Align Left"
                >
                  <FontAwesomeIcon icon={faAlignLeft} />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  style={toolbarButtonStyle(editor.isActive({ textAlign: 'center' }))}
                  {...toolbarHover(editor.isActive({ textAlign: 'center' }))}
                  title="Align Center"
                >
                  <FontAwesomeIcon icon={faAlignCenter} />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  style={toolbarButtonStyle(editor.isActive({ textAlign: 'right' }))}
                  {...toolbarHover(editor.isActive({ textAlign: 'right' }))}
                  title="Align Right"
                >
                  <FontAwesomeIcon icon={faAlignRight} />
                </button>

                {divider}

                {/* Lists */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  style={toolbarButtonStyle(editor.isActive('bulletList'))}
                  {...toolbarHover(editor.isActive('bulletList'))}
                  title="Bullet List"
                >
                  <FontAwesomeIcon icon={faListUl} />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  style={toolbarButtonStyle(editor.isActive('orderedList'))}
                  {...toolbarHover(editor.isActive('orderedList'))}
                  title="Numbered List"
                >
                  <FontAwesomeIcon icon={faListOl} />
                </button>

                {/* Indent / Outdent */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
                  style={toolbarButtonStyle(false)}
                  {...toolbarHover(false)}
                  title="Indent"
                >
                  <FontAwesomeIcon icon={faIndent} />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().liftListItem('listItem').run()}
                  style={toolbarButtonStyle(false)}
                  {...toolbarHover(false)}
                  title="Outdent"
                >
                  <FontAwesomeIcon icon={faOutdent} />
                </button>

                {divider}

                {/* Link */}
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt('Enter URL:');
                    if (url) {
                      editor.chain().focus().setLink({ href: url }).run();
                    }
                  }}
                  style={toolbarButtonStyle(editor.isActive('link'))}
                  {...toolbarHover(editor.isActive('link'))}
                  title="Add Link"
                >
                  <FontAwesomeIcon icon={faLink} />
                </button>

                {/* Unlink */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().unsetLink().run()}
                  style={{
                    ...toolbarButtonStyle(false),
                    opacity: editor.isActive('link') ? 1 : 0.4,
                    cursor: editor.isActive('link') ? 'pointer' : 'default',
                  }}
                  {...toolbarHover(false)}
                  title="Remove Link"
                  disabled={!editor.isActive('link')}
                >
                  <FontAwesomeIcon icon={faUnlink} />
                </button>

                {/* Blockquote */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  style={toolbarButtonStyle(editor.isActive('blockquote'))}
                  {...toolbarHover(editor.isActive('blockquote'))}
                  title="Blockquote"
                >
                  <FontAwesomeIcon icon={faQuoteLeft} />
                </button>

                {/* Code Block */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                  style={toolbarButtonStyle(editor.isActive('codeBlock'))}
                  {...toolbarHover(editor.isActive('codeBlock'))}
                  title="Code Block"
                >
                  <FontAwesomeIcon icon={faCode} />
                </button>

                {/* Horizontal Rule */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setHorizontalRule().run()}
                  style={toolbarButtonStyle(false)}
                  {...toolbarHover(false)}
                  title="Horizontal Rule"
                >
                  <FontAwesomeIcon icon={faMinus} />
                </button>

                {divider}

                {/* Table */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                  style={toolbarButtonStyle(false)}
                  {...toolbarHover(false)}
                  title="Insert Table"
                >
                  <FontAwesomeIcon icon={faTable} />
                </button>

                {/* Image */}
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt('Enter image URL:');
                    if (url) {
                      editor.chain().focus().setImage({ src: url }).run();
                    }
                  }}
                  style={toolbarButtonStyle(false)}
                  {...toolbarHover(false)}
                  title="Insert Image"
                >
                  <FontAwesomeIcon icon={faImage} />
                </button>
              </div>
            )}
                <EditorContent
                  editor={editor}
                  className="px-4 py-2 min-h-[150px] prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[150px] [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:mt-3 [&_h4]:mb-1 [&_h5]:text-base [&_h5]:font-bold [&_h5]:mt-2 [&_h5]:mb-1 [&_h6]:text-sm [&_h6]:font-bold [&_h6]:mt-2 [&_h6]:mb-1 [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_ul_ul]:ml-6 [&_ol_ol]:ml-6 [&_ul_ol]:ml-6 [&_ol_ul]:ml-6 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded"
                />
              </div>
            </div>

                <div>
                  <label className="form-label">Context</label>
                  <textarea
                    value={formData.context}
                    onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                    rows="2"
                    className="form-textarea"
                    placeholder="What prompted this note?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Date Noted</label>
                    <input
                      type="date"
                      value={formData.noted_on}
                      onChange={(e) => setFormData({ ...formData, noted_on: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>
                    <input
                      type="checkbox"
                      id="pinned"
                      checked={formData.pinned}
                      onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                      style={{
                        borderRadius: '4px',
                        border: '1px solid var(--neutral-300)',
                        accentColor: '#639CA1'
                      }}
                    />
                    <label htmlFor="pinned" className="text-sm">
                      Pin this note
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'connections' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ height: '300px' }}>
                  {!sourceId && (
                    <div style={{ height: '100%' }}>
                      <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Link to Source</label>
                      <SourceSelector
                        selectedSourceId={formData.source_id}
                        onChange={(sourceId) => setFormData({ ...formData, source_id: sourceId })}
                        multiple={false}
                        themeColor="#639CA1"
                      />
                    </div>
                  )}

                  {!conceptId && (
                    <div style={{ height: '100%' }}>
                      <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Link to Constructs</label>
                      <ConceptSelector
                        selectedConceptIds={formData.concept_ids}
                        onChange={(conceptIds) => setFormData({ ...formData, concept_ids: conceptIds })}
                        themeColor="#639CA1"
                      />
                    </div>
                  )}

                  <div style={{ height: '100%' }}>
                    <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Tags</label>
                    <TagSelector
                      selectedTags={formData.tags}
                      onChange={(tags) => setFormData({ ...formData, tags: tags })}
                      themeColor="#639CA1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--neutral-200)',
          background: 'var(--background)',
          padding: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-3)',
        }}>
          <button
            type="submit"
            className="btn-primary"
            style={{
              background: '#639CA1',
              color: 'white'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#527d81'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#639CA1'}
          >
            {item ? 'Save Changes' : 'Create Note'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </SlidePanel>
  );
}
