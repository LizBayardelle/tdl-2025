import React, { useState, useEffect } from 'react';
import ConceptFormModal from './ConceptFormModal';
import ConnectionFormModal from './ConnectionFormModal';
import NoteFormModal from './NoteFormModal';

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

      <ConceptFormModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        item={concept}
        onSuccess={(updatedConcept) => {
          setConcept(updatedConcept);
          setEditing(false);
        }}
      />

      {!editing && (
        <>
          <ConceptDisplay concept={concept} onEdit={() => setEditing(true)} />

          <div className="mt-8">
            <ConnectionManager conceptId={conceptId} />
          </div>

          <div className="mt-8">
            <ConceptPeople conceptId={conceptId} />
          </div>

          <div className="mt-8">
            <ConceptSources conceptId={conceptId} />
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

function ConnectionManager({ conceptId }) {
  const [connections, setConnections] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [allConcepts, setAllConcepts] = useState([]);
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
      setAllConcepts(data); // Store all concepts for lookup
      setConcepts(data.filter(n => n.id !== parseInt(conceptId))); // Filter for dropdown
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
    // Hierarchical
    parent_of: 'Parent of',
    child_of: 'Child of',
    // Sequential
    prerequisite_for: 'Prerequisite for',
    builds_on: 'Builds on',
    derived_from: 'Derived from',
    // Semantic
    related_to: 'Related to',
    contrasts_with: 'Contrasts with',
    integrates_with: 'Integrates with',
    associated_with: 'Associated with',
    // Influence
    influenced: 'Influenced',
    supports: 'Supports',
    critiques: 'Critiques',
    // Other
    authored: 'Authored',
    applies_to: 'Applies to',
    treats: 'Treats'
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

      <ConnectionFormModal
        isOpen={creatingConnection}
        onClose={() => setCreatingConnection(false)}
        conceptId={conceptId}
        concepts={concepts}
        allConcepts={allConcepts}
        onSuccess={(newConnection) => {
          setConnections([newConnection, ...connections]);
          setCreatingConnection(false);
        }}
      />

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
              <div key={connection.id} className="flex items-center justify-between border-b border-gray-200 pb-4">
                <div className="flex items-center gap-3 flex-1 flex-wrap">
                  <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded whitespace-nowrap">
                    {connection.relationship_label || relTypeLabels[connection.rel_type]}
                  </span>
                  <span className="text-gray-400">{direction}</span>
                  <a
                    href={`/concepts/${otherConcept.id}`}
                    className="text-lg hover:text-primary font-medium"
                  >
                    {otherConcept.label}
                  </a>
                  <span className="text-xs text-gray-500">({otherConcept.node_type})</span>
                  {connection.description && (
                    <p className="text-sm text-gray-600 w-full mt-2">{connection.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteConnection(connection.id)}
                  className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50 ml-4 whitespace-nowrap"
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

function ConceptPeople({ conceptId }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    try {
      const response = await fetch(`/concepts/${conceptId}.json`);
      const data = await response.json();
      setPeople(data.people || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching people:', error);
      setLoading(false);
    }
  };

  if (loading) return null;
  if (people.length === 0) return null;

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <h2 className="text-2xl mb-6">Related People</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {people.map(person => (
          <a
            key={person.id}
            href={`/people/${person.id}`}
            className="border border-gray-200 rounded p-4 hover:bg-sand transition-colors block"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{person.full_name}</span>
              {person.role && (
                <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
                  {person.role}
                </span>
              )}
            </div>
            {person.summary && (
              <p className="text-sm text-gray-600 line-clamp-2">{person.summary}</p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

function ConceptSources({ conceptId }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const response = await fetch(`/concepts/${conceptId}.json`);
      const data = await response.json();
      setSources(data.sources || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching sources:', error);
      setLoading(false);
    }
  };

  if (loading) return null;
  if (sources.length === 0) return null;

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <h2 className="text-2xl mb-6">Related Sources</h2>
      <div className="space-y-3">
        {sources.map(source => (
          <a
            key={source.id}
            href={`/sources/${source.id}`}
            className="border border-gray-200 rounded p-4 hover:bg-sand transition-colors block"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">{source.title}</span>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {source.kind && (
                  <span className="uppercase">{source.kind.replace('_', ' ')}</span>
                )}
                {source.year && <span>{source.year}</span>}
              </div>
            </div>
            {source.authors && (
              <p className="text-sm text-gray-600">{source.authors}</p>
            )}
          </a>
        ))}
      </div>
    </div>
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

      <NoteFormModal
        isOpen={creatingNote}
        onClose={() => setCreatingNote(false)}
        conceptId={conceptId}
        onSuccess={(newNote) => {
          setNotes([newNote, ...notes]);
          setCreatingNote(false);
        }}
      />

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
