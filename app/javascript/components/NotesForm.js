import React, { useState, useEffect } from 'react';
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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBold, faItalic, faUnderline, faStrikethrough, faAlignLeft, faAlignCenter, faAlignRight, faListUl, faListOl, faLink, faUnlink, faQuoteLeft, faCode, faTable, faImage } from '@fortawesome/free-solid-svg-icons';
import ConceptSelector from './ConceptSelector';
import TagSelector from './TagSelector';
import SourceSelector from './SourceSelector';
import PeopleSelector from './PeopleSelector';

export default function NotesForm() {
  const rootElement = document.getElementById('note-form-root');
  const noteData = rootElement ? JSON.parse(rootElement.dataset.note) : {};
  const sourceIdFromUrl = rootElement?.dataset.sourceId;
  const conceptIdFromUrl = rootElement?.dataset.conceptId;

  const isEdit = !!noteData.id;

  const [formData, setFormData] = useState({
    title: noteData.title || '',
    body: noteData.body || '',
    note_type: noteData.note_type || 'note',
    context: noteData.context || '',
    pinned: noteData.pinned || false,
    noted_on: noteData.noted_on || new Date().toISOString().split('T')[0],
    concept_id: noteData.concept?.id || conceptIdFromUrl || '',
    source_id: noteData.source?.id || sourceIdFromUrl || '',
    tags: noteData.tags ? noteData.tags.map(t => t.name) : [],
    person_ids: noteData.people ? noteData.people.map(p => p.id) : []
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
    if (editor && formData.body) {
      editor.commands.setContent(formData.body);
    }
  }, [editor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const url = isEdit ? `/notes/${noteData.id}.json` : '/notes.json';
      const method = isEdit ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ note: formData }),
      });

      if (response.ok) {
        window.location.href = '/notes';
      } else {
        const data = await response.json();
        setError(data.errors?.join(', ') || 'An error occurred');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      setError('An error occurred while saving the note');
    }
  };

  if (!editor) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <a href="/notes" className="text-primary hover:text-accent-dark">← Back to Notes</a>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg p-8">
        <h1 className="text-4xl mb-6">{isEdit ? 'Edit Note' : 'New Note'}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Note Type</label>
            <select
              value={formData.note_type}
              onChange={(e) => setFormData({ ...formData, note_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="note">Note</option>
              <option value="question">Question</option>
              <option value="synthesis">Synthesis</option>
              <option value="connection">Connection</option>
              <option value="todo">To Do Item</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
              placeholder="Brief title for this note (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Note Content *</label>
            <div className="border border-gray-300 rounded bg-white">
              {/* Toolbar */}
              {editor && (
                <div className="border-b border-gray-200 p-2 flex gap-0 flex-wrap bg-sand">
                  {/* Text formatting */}
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive('bold') ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive('bold') ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Bold"
                  >
                    <FontAwesomeIcon icon={faBold} />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive('italic') ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive('italic') ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Italic"
                  >
                    <FontAwesomeIcon icon={faItalic} />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive('underline') ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive('underline') ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Underline"
                  >
                    <FontAwesomeIcon icon={faUnderline} />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive('strike') ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive('strike') ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Strikethrough"
                  >
                    <FontAwesomeIcon icon={faStrikethrough} />
                  </button>

                  <div className="w-px h-6 bg-primary/20 mx-1"></div>

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
                    className="px-2 py-1 rounded text-sm border border-primary/20 bg-sand hover:bg-primary/10"
                    style={{ color: '#414431' }}
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

                  <div className="w-px h-6 bg-primary/20 mx-1"></div>

                  {/* Text color */}
                  <input
                    type="color"
                    onInput={(e) => editor.chain().focus().setColor(e.target.value).run()}
                    value={editor.getAttributes('textStyle').color || '#000000'}
                    className="w-8 h-6 rounded cursor-pointer border border-primary/20"
                    title="Text Color"
                  />

                  {/* Highlight */}
                  <input
                    type="color"
                    onInput={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                    className="w-8 h-6 rounded cursor-pointer border border-primary/20"
                    title="Highlight Color"
                  />

                  <div className="w-px h-6 bg-primary/20 mx-1"></div>

                  {/* Text alignment */}
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive({ textAlign: 'left' }) ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive({ textAlign: 'left' }) ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Align Left"
                  >
                    <FontAwesomeIcon icon={faAlignLeft} />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive({ textAlign: 'center' }) ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive({ textAlign: 'center' }) ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Align Center"
                  >
                    <FontAwesomeIcon icon={faAlignCenter} />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive({ textAlign: 'right' }) ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive({ textAlign: 'right' }) ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Align Right"
                  >
                    <FontAwesomeIcon icon={faAlignRight} />
                  </button>

                  <div className="w-px h-6 bg-primary/20 mx-1"></div>

                  {/* Lists */}
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive('bulletList') ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive('bulletList') ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Bullet List"
                  >
                    <FontAwesomeIcon icon={faListUl} />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive('orderedList') ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive('orderedList') ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Numbered List"
                  >
                    <FontAwesomeIcon icon={faListOl} />
                  </button>

                  <div className="w-px h-6 bg-primary/20 mx-1"></div>

                  {/* Link */}
                  <button
                    type="button"
                    onClick={() => {
                      const url = window.prompt('Enter URL:');
                      if (url) {
                        editor.chain().focus().setLink({ href: url }).run();
                      }
                    }}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive('link') ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive('link') ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Insert Link"
                  >
                    <FontAwesomeIcon icon={faLink} />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().unsetLink().run()}
                    disabled={!editor.isActive('link')}
                    className="px-3 py-1 rounded text-sm hover:bg-primary/10 disabled:opacity-50"
                    style={{ background: 'transparent', color: '#414431' }}
                    title="Remove Link"
                  >
                    <FontAwesomeIcon icon={faUnlink} />
                  </button>

                  <div className="w-px h-6 bg-primary/20 mx-1"></div>

                  {/* Blockquote & Code */}
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive('blockquote') ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive('blockquote') ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Blockquote"
                  >
                    <FontAwesomeIcon icon={faQuoteLeft} />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={`px-3 py-1 rounded text-sm ${editor.isActive('codeBlock') ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                    style={{ background: editor.isActive('codeBlock') ? 'rgba(65, 68, 49, 0.2)' : 'transparent', color: '#414431' }}
                    title="Code Block"
                  >
                    <FontAwesomeIcon icon={faCode} />
                  </button>

                  <div className="w-px h-6 bg-primary/20 mx-1"></div>

                  {/* Table */}
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                    className="px-3 py-1 rounded text-sm hover:bg-primary/10"
                    style={{ background: 'transparent', color: '#414431' }}
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
                    className="px-3 py-1 rounded text-sm hover:bg-primary/10"
                    style={{ background: 'transparent', color: '#414431' }}
                    title="Insert Image"
                  >
                    <FontAwesomeIcon icon={faImage} />
                  </button>
                </div>
              )}

              {/* Editor */}
              <EditorContent
                editor={editor}
                className="px-4 py-2 min-h-[300px] prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[300px] [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:mt-2 [&_h4]:mb-1 [&_h5]:text-base [&_h5]:font-bold [&_h5]:mt-2 [&_h5]:mb-1 [&_h6]:text-sm [&_h6]:font-bold [&_h6]:mt-2 [&_h6]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-700 [&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Context</label>
            <textarea
              value={formData.context}
              onChange={(e) => setFormData({ ...formData, context: e.target.value })}
              rows="2"
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
              placeholder="What prompted this note?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Link to Construct</label>
            <ConceptSelector
              selectedConceptIds={formData.concept_id ? [parseInt(formData.concept_id)] : []}
              onChange={(concept_ids) => setFormData({ ...formData, concept_id: concept_ids[0] || '' })}
            />
            <p className="text-xs text-gray-600 mt-1">Select one construct (optional)</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Link to Source</label>
            <SourceSelector
              selectedSourceIds={formData.source_id ? [parseInt(formData.source_id)] : []}
              onChange={(source_ids) => setFormData({ ...formData, source_id: source_ids[0] || '' })}
            />
            <p className="text-xs text-gray-600 mt-1">Select one source (optional)</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <TagSelector
              selectedTags={formData.tags}
              onChange={(tags) => setFormData({ ...formData, tags })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Link People</label>
            <PeopleSelector
              selectedPersonIds={formData.person_ids}
              onChange={(person_ids) => setFormData({ ...formData, person_ids })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date Noted</label>
              <input
                type="date"
                value={formData.noted_on}
                onChange={(e) => setFormData({ ...formData, noted_on: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
              />
            </div>

            <div className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                id="pinned"
                checked={formData.pinned}
                onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="pinned" className="text-sm">
                Pin this note
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
            >
              {isEdit ? 'Save Changes' : 'Create Note'}
            </button>
            <a
              href="/notes"
              className="px-6 py-2 border border-gray-300 rounded hover:bg-sand inline-block"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
