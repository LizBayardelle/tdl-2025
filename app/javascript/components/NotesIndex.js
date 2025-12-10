import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbtack, faPen, faTrash, faEye } from '@fortawesome/free-solid-svg-icons';

export default function NotesIndex() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [filterType, showPinnedOnly]);

  const fetchNotes = async () => {
    try {
      let url = '/notes.json?';
      if (filterType !== 'all') url += `note_type=${filterType}&`;
      if (showPinnedOnly) url += 'pinned=true';

      const response = await fetch(url);
      const data = await response.json();
      setNotes(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setLoading(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return;

    try {
      const response = await fetch(`/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setNotes(notes.filter(n => n.id !== noteId));
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleTogglePin = async (note) => {
    try {
      const response = await fetch(`/notes/${note.id}.json`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ note: { pinned: !note.pinned } }),
      });

      if (response.ok) {
        const updatedNote = await response.json();
        setNotes(notes.map(n => n.id === note.id ? updatedNote : n));
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const noteTypeLabels = {
    note: 'Note',
    question: 'Question',
    synthesis: 'Synthesis',
    connection: 'Connection',
    todo: 'To Do Item'
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl mb-4">Notes</h1>
        <p className="text-lg mb-6">
          Capture notes, questions, connections, and to-do items as you learn
        </p>

        <div className="flex items-center gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Filter by Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="all">All Types</option>
              <option value="note">Note</option>
              <option value="question">Question</option>
              <option value="synthesis">Synthesis</option>
              <option value="connection">Connection</option>
              <option value="todo">To Do Item</option>
            </select>
          </div>

          <div className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              id="pinned-filter"
              checked={showPinnedOnly}
              onChange={(e) => setShowPinnedOnly(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="pinned-filter" className="text-sm">
              Pinned only
            </label>
          </div>

          <a
            href="/notes/new"
            className="ml-auto mt-6 px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark inline-block"
          >
            + New Note
          </a>
        </div>
      </div>

      {loading ? (
        <p>Loading notes...</p>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-300 rounded-lg">
          <p className="text-lg text-gray-600">No notes yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {notes.map(note => (
            <div
              key={note.id}
              className="bg-white border border-gray-300 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => handleTogglePin(note)}
                    className={`!bg-transparent border-0 transition-colors ${note.pinned ? '!text-primary' : '!text-sand hover:!text-primary'}`}
                    title={note.pinned ? 'Unpin' : 'Pin'}
                  >
                    <FontAwesomeIcon icon={faThumbtack} />
                  </button>
                  <span className="text-xs uppercase tracking-wider px-3 py-1 rounded bg-sand text-gray-800 font-medium">
                    {noteTypeLabels[note.note_type] || note.note_type}
                  </span>
                  {note.concept && (
                    <a
                      href={`/concepts/${note.concept.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      → {note.concept.label}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={`/notes/${note.id}/edit`}
                    className="text-primary hover:text-accent-dark transition-colors"
                    title="Edit"
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </a>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="!text-primary hover:!text-accent-dark transition-colors !bg-transparent border-0"
                    title="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>

              {note.title ? (
                <a href={`/notes/${note.id}`} className="block mb-3">
                  <h3 className="text-xl font-bold text-primary hover:text-accent-dark transition-colors">
                    {note.title}
                  </h3>
                </a>
              ) : (
                <a
                  href={`/notes/${note.id}`}
                  className="inline-block mb-3 text-primary hover:text-accent-dark transition-colors"
                  title="View note"
                >
                  <FontAwesomeIcon icon={faEye} className="text-lg" />
                </a>
              )}

              <div className="mb-3 leading-relaxed prose prose-sm max-w-none line-clamp-4 [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:ml-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:mt-2 [&_h4]:mb-1 [&_h5]:text-base [&_h5]:font-bold [&_h5]:mt-2 [&_h5]:mb-1 [&_h6]:text-sm [&_h6]:font-bold [&_h6]:mt-2 [&_h6]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-700 [&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100" dangerouslySetInnerHTML={{ __html: note.body }} />

              {note.context && (
                <div className="bg-sand rounded p-3 mb-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Context:</span> {note.context}
                  </p>
                </div>
              )}

              {(note.source || note.people?.length > 0 || note.tags?.length > 0) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {note.source && (
                    <a
                      href={`/sources/${note.source.id}`}
                      className="text-xs bg-accent-dark text-sand px-3 py-1 rounded hover:bg-primary-light transition-colors"
                    >
                      {note.source.title}
                    </a>
                  )}
                  {note.people?.map((person) => (
                    <a
                      key={person.id}
                      href={`/people/${person.id}`}
                      className="text-xs bg-sand text-primary border border-primary px-3 py-1 rounded hover:bg-primary-light transition-colors"
                    >
                      {person.full_name}
                    </a>
                  ))}
                  {note.tags?.map((tag, idx) => (
                    <a
                      key={idx}
                      href={`/tags/${tag.name}`}
                      className="text-xs bg-primary text-sand px-3 py-1 rounded hover:bg-primary-light transition-colors"
                    >
                      {typeof tag === 'string' ? tag : tag.name}
                    </a>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500">
                {new Date(note.created_at).toLocaleDateString()}
                {note.noted_on && note.noted_on !== new Date(note.created_at).toISOString().split('T')[0] && (
                  <span className="ml-3">Noted: {new Date(note.noted_on).toLocaleDateString()}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
