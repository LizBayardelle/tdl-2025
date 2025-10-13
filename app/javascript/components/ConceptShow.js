import React, { useState, useEffect } from 'react';
import { NoteForm } from './NotesIndex';

export default function ConceptShow({ conceptId }) {
  const [concept, setConcept] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showConnections, setShowConnections] = useState(true);

  useEffect(() => {
    fetchConcept();
  }, []);

  const fetchConcept = async () => {
    try {
      const response = await fetch(`/concepts/${conceptId}.json`);
      const data = await response.json();
      setConcept(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching concept:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!concept) {
    return (
      <div className="text-center py-12">
        <p className="text-lg">Concept not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <a href="/concepts" className="text-sm text-primary hover:text-accent-dark">
          ← Back to Constructs
        </a>
      </div>

      {editing ? (
        <ConceptEditForm
          concept={concept}
          onSuccess={(updatedConcept) => {
            setConcept(updatedConcept);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <ConceptDisplay concept={concept} onEdit={() => setEditing(true)} />

          <div className="mt-8">
            <ConnectionManager conceptId={conceptId} />
          </div>

          <div className="mt-8">
            <ConceptNotes conceptId={conceptId} />
          </div>
        </>
      )}
    </div>
  );
}

function ConceptDisplay({ concept, onEdit }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs uppercase tracking-wider text-primary bg-sand px-3 py-1 rounded">
              {concept.node_type}
            </span>
            {concept.level_status && (
              <span className="text-xs uppercase tracking-wider text-accent-dark bg-accent-light px-3 py-1 rounded">
                {concept.level_status}
              </span>
            )}
          </div>
          <h1 className="text-4xl mb-2">{concept.label}</h1>
          <p className="text-sm text-gray-600">
            Last updated: {new Date(concept.updated_at).toLocaleDateString()}
            {concept.last_reviewed_on && (
              <span className="ml-4">
                Last reviewed: {new Date(concept.last_reviewed_on).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="px-4 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          Edit
        </button>
      </div>

      {/* Three-level mastery summaries */}
      <div className="space-y-6 mb-8">
        {concept.summary_top && (
          <Section title="Summary (Top-level)" content={concept.summary_top} />
        )}
        {concept.summary_mid && (
          <Section title="Summary (Mid-level)" content={concept.summary_mid} />
        )}
        {concept.summary_deep && (
          <Section title="Summary (Deep)" content={concept.summary_deep} />
        )}
      </div>

      {/* Array fields */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <ArraySection title="Mechanisms" items={concept.mechanisms} />
        <ArraySection title="Signature Techniques" items={concept.signature_techniques} />
        <ArraySection title="Strengths" items={concept.strengths} />
        <ArraySection title="Weaknesses" items={concept.weaknesses} />
        <ArraySection title="Adjacent Models" items={concept.adjacent_models} />
        <ArraySection title="Contrasts With" items={concept.contrasts_with} />
        <ArraySection title="Integrates With" items={concept.integrates_with} />
        <ArraySection title="Intake Questions" items={concept.intake_questions} />
        <ArraySection title="Micro Skills" items={concept.micro_skills} />
        <ArraySection title="Practice Prompts" items={concept.practice_prompts} />
        <ArraySection title="Assessment Links" items={concept.assessment_links} />
      </div>

      {/* Evidence and reflection */}
      {concept.evidence_brief && (
        <Section title="Evidence Brief" content={concept.evidence_brief} className="mb-6" />
      )}
      {concept.confidence_note && (
        <Section title="Confidence Note" content={concept.confidence_note} className="mb-6" />
      )}

      {/* Tags */}
      {concept.tags && concept.tags.length > 0 && (
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-lg mb-2">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {concept.tags.map((tag, idx) => (
              <span key={idx} className="text-xs bg-sand px-3 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, content, className = '' }) {
  return (
    <div className={className}>
      <h3 className="text-lg mb-2">{title}</h3>
      <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}

function ArraySection({ title, items }) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg mb-2">{title}</h3>
      <ul className="list-disc list-inside space-y-1">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ConceptEditForm({ concept, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    label: concept.label || '',
    node_type: concept.node_type || 'model',
    level_status: concept.level_status || 'mapped',
    summary_top: concept.summary_top || '',
    summary_mid: concept.summary_mid || '',
    summary_deep: concept.summary_deep || '',
    evidence_brief: concept.evidence_brief || '',
    confidence_note: concept.confidence_note || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`/concepts/${concept.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ concept: formData }),
      });

      if (response.ok) {
        const updatedConcept = await response.json();
        onSuccess(updatedConcept);
      } else {
        const data = await response.json();
        alert('Error: ' + data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error updating concept:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-300 rounded-lg p-8">
      <h2 className="text-2xl mb-6">Edit Construct</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Label *</label>
          <input
            type="text"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select
              value={formData.node_type}
              onChange={(e) => setFormData({ ...formData, node_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="model">Model</option>
              <option value="technique">Technique</option>
              <option value="mechanism">Mechanism</option>
              <option value="construct">Construct</option>
              <option value="measure">Measure</option>
              <option value="population">Population</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={formData.level_status}
              onChange={(e) => setFormData({ ...formData, level_status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="mapped">Mapped</option>
              <option value="basic">Basic</option>
              <option value="deep">Deep</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Summary Top (2-3 sentences)
          </label>
          <textarea
            value={formData.summary_top}
            onChange={(e) => setFormData({ ...formData, summary_top: e.target.value })}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Summary Mid (~200 words)
          </label>
          <textarea
            value={formData.summary_mid}
            onChange={(e) => setFormData({ ...formData, summary_mid: e.target.value })}
            rows="6"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Summary Deep (~600 words)
          </label>
          <textarea
            value={formData.summary_deep}
            onChange={(e) => setFormData({ ...formData, summary_deep: e.target.value })}
            rows="12"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Evidence Brief</label>
          <textarea
            value={formData.evidence_brief}
            onChange={(e) => setFormData({ ...formData, evidence_brief: e.target.value })}
            rows="4"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Confidence Note</label>
          <textarea
            value={formData.confidence_note}
            onChange={(e) => setFormData({ ...formData, confidence_note: e.target.value })}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          Save Changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded hover:bg-sand"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ConnectionManager({ conceptId }) {
  const [connections, setConnections] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingConnection, setCreatingConnection] = useState(false);

  useEffect(() => {
    fetchConnections();
    fetchConcepts();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await fetch(`/connections.json?concept_id=${conceptId}`);
      const data = await response.json();
      setConnections(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching connections:', error);
      setLoading(false);
    }
  };

  const fetchConcepts = async () => {
    try {
      const response = await fetch('/concepts.json');
      const data = await response.json();
      setConcepts(data.filter(n => n.id !== parseInt(conceptId)));
    } catch (error) {
      console.error('Error fetching concepts:', error);
    }
  };

  const handleDeleteConnection = async (connectionId) => {
    if (!confirm('Delete this relationship?')) return;

    try {
      const response = await fetch(`/connections/${connectionId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
      });

      if (response.ok) {
        setConnections(connections.filter(e => e.id !== connectionId));
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
    }
  };

  const relTypeLabels = {
    authored: 'Authored',
    influenced: 'Influenced',
    contrasts_with: 'Contrasts with',
    integrates_with: 'Integrates with',
    derived_from: 'Derived from',
    applies_to: 'Applies to',
    treats: 'Treats',
    associated_with: 'Associated with',
    critiques: 'Critiques',
    supports: 'Supports',
    related_to: 'Related to'
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl">Relationships</h2>
        <button
          onClick={() => setCreatingConnection(!creatingConnection)}
          className="px-4 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          {creatingConnection ? 'Cancel' : '+ Add Relationship'}
        </button>
      </div>

      {creatingConnection && (
        <ConnectionForm
          conceptId={conceptId}
          concepts={concepts}
          onSuccess={(newConnection) => {
            setConnections([newConnection, ...connections]);
            setCreatingConnection(false);
          }}
          onCancel={() => setCreatingConnection(false)}
        />
      )}

      {loading ? (
        <p className="text-sm">Loading relationships...</p>
      ) : connections.length === 0 ? (
        <p className="text-sm text-gray-600">No relationships yet</p>
      ) : (
        <div className="space-y-4">
          {connections.map(connection => {
            const isSource = connection.src_concept.id === parseInt(conceptId);
            const otherConcept = isSource ? connection.dst_concept : connection.src_concept;
            const direction = isSource ? '→' : '←';

            return (
              <div key={connection.id} className="flex items-start justify-between border-b border-gray-200 pb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
                      {relTypeLabels[connection.rel_type]}
                    </span>
                    {connection.strength && (
                      <span className="text-xs text-gray-600">
                        Strength: {connection.strength}/5
                      </span>
                    )}
                    <span className="text-gray-400">{direction}</span>
                  </div>
                  <a
                    href={`/concepts/${otherConcept.id}`}
                    className="text-lg hover:text-primary"
                  >
                    {otherConcept.label}
                  </a>
                  <p className="text-xs text-gray-500 mt-1">{otherConcept.node_type}</p>
                  {connection.description && (
                    <p className="text-sm mt-2">{connection.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteConnection(connection.id)}
                  className="text-sm text-accent-dark hover:text-primary ml-4"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConnectionForm({ conceptId, concepts, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    src_concept_id: conceptId,
    dst_concept_id: '',
    rel_type: 'authored',
    strength: 3,
    description: '',
    tags: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      tags: formData.tags.split('\n').filter(t => t.trim())
    };

    try {
      const response = await fetch('/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content,
        },
        body: JSON.stringify({ connection: payload }),
      });

      if (response.ok) {
        const newConnection = await response.json();
        onSuccess(newConnection);
      } else {
        const data = await response.json();
        alert('Error: ' + data.errors.join(', '));
      }
    } catch (error) {
      console.error('Error creating connection:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-sand rounded-lg p-6 mb-6">
      <h3 className="text-lg mb-4">New Relationship</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">To Construct *</label>
          <select
            value={formData.dst_concept_id}
            onChange={(e) => setFormData({ ...formData, dst_concept_id: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            required
          >
            <option value="">Select a construct...</option>
            {concepts.map(concept => (
              <option key={concept.id} value={concept.id}>
                {concept.label} ({concept.node_type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Relationship Type *</label>
          <select
            value={formData.rel_type}
            onChange={(e) => setFormData({ ...formData, rel_type: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          >
            <option value="authored">Authored</option>
            <option value="influenced">Influenced</option>
            <option value="contrasts_with">Contrasts with</option>
            <option value="integrates_with">Integrates with</option>
            <option value="derived_from">Derived from</option>
            <option value="applies_to">Applies to</option>
            <option value="treats">Treats</option>
            <option value="associated_with">Associated with</option>
            <option value="critiques">Critiques</option>
            <option value="supports">Supports</option>
            <option value="related_to">Related to</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Strength (1-5)</label>
          <input
            type="number"
            min="1"
            max="5"
            value={formData.strength}
            onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
            placeholder="Why are these constructs related?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tags (one per line)</label>
          <textarea
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            rows="2"
            className="w-full px-4 py-2 border border-gray-300 rounded bg-white"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          Create Relationship
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded hover:bg-sand"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ConceptNotes({ conceptId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingNote, setCreatingNote] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/notes.json?concept_id=${conceptId}`);
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

  const noteTypeLabels = {
    reflection: 'Reflection',
    question: 'Question',
    insight: 'Insight',
    critique: 'Critique',
    application: 'Application',
    synthesis: 'Synthesis'
  };

  const noteTypeColors = {
    reflection: 'bg-blue-100 text-blue-800',
    question: 'bg-purple-100 text-purple-800',
    insight: 'bg-yellow-100 text-yellow-800',
    critique: 'bg-red-100 text-red-800',
    application: 'bg-green-100 text-green-800',
    synthesis: 'bg-indigo-100 text-indigo-800'
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl">Notes</h2>
        <button
          onClick={() => setCreatingNote(!creatingNote)}
          className="px-4 py-2 bg-primary text-sand rounded hover:bg-accent-dark"
        >
          {creatingNote ? 'Cancel' : '+ Add Note'}
        </button>
      </div>

      {creatingNote && (
        <NoteForm
          conceptId={conceptId}
          onSuccess={(newNote) => {
            setNotes([newNote, ...notes]);
            setCreatingNote(false);
          }}
          onCancel={() => setCreatingNote(false)}
        />
      )}

      {loading ? (
        <p className="text-sm">Loading notes...</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-600">No notes yet</p>
      ) : (
        <div className="space-y-4">
          {notes.map(note => (
            <div key={note.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <span className={`text-xs uppercase tracking-wider px-3 py-1 rounded ${noteTypeColors[note.note_type] || 'bg-gray-100'}`}>
                  {noteTypeLabels[note.note_type] || note.note_type}
                </span>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-sm text-accent-dark hover:text-primary"
                >
                  Delete
                </button>
              </div>

              <p className="mb-3 whitespace-pre-wrap">{note.body}</p>

              {note.context && (
                <div className="bg-sand rounded p-3 mb-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Context:</span> {note.context}
                  </p>
                </div>
              )}

              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {note.tags.map((tag, idx) => (
                    <span key={idx} className="text-xs bg-sand px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500">
                {new Date(note.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
