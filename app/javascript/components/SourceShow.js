import React, { useState, useEffect } from 'react';
import SourceFormModal from './SourceFormModal';

export default function SourceShow({ sourceId }) {
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchSource();
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="text-center py-12">
        <p className="text-lg">Source not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
      <div className="mb-4 md:mb-6 flex justify-between items-center">
        <a href="/sources" className="text-sm text-primary hover:text-accent-dark">
          ← Back to Sources
        </a>
        <button
          onClick={() => setEditing(true)}
          className="text-sm hover:opacity-70"
          style={{ background: 'transparent', color: '#6f9e7f', border: 'none', padding: 0 }}
        >
          Edit
        </button>
      </div>

      <SourceFormModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        item={source}
        onSuccess={(updatedSource) => {
          setSource(updatedSource);
          setEditing(false);
        }}
      />

      <SourceDisplay source={source} />

      {source.concepts && source.concepts.length > 0 && (
        <div className="mt-8">
          <SourceConcepts concepts={source.concepts} />
        </div>
      )}

      {source.people && source.people.length > 0 && (
        <div className="mt-8">
          <SourcePeople people={source.people} />
        </div>
      )}

      <div className="mt-8">
        <SourceNotes sourceId={source.id} />
      </div>
    </div>
  );
}

function SourceDisplay({ source }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 md:gap-3 mb-3 flex-wrap">
          {source.kind && (
            <span className="text-xs uppercase tracking-wider text-primary bg-sand px-2 py-1 rounded">
              {source.kind.replace('_', ' ')}
            </span>
          )}
          {source.methodologies && source.methodologies.length > 0 && source.methodologies.map((methodology, idx) => (
            <span key={idx} className="text-xs uppercase tracking-wider text-accent-dark bg-accent-light px-2 py-1 rounded">
              {methodology}
            </span>
          ))}
          {source.year && (
            <span className="text-xs md:text-sm text-gray-600">{source.year}</span>
          )}
          {source.pdf_url && (
            <>
              <a
                href={source.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto px-3 py-1.5 md:px-4 md:py-2 bg-sand text-primary rounded hover:bg-khaki inline-flex items-center gap-1.5 md:gap-2 border border-gray-300 text-xs md:text-sm"
              >
                <i className="fas fa-file-pdf"></i>
                <span className="hidden sm:inline">View PDF</span>
                <span className="sm:hidden">PDF</span>
              </a>
              <a
                href={`/sources/${source.id}/study`}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-accent-dark text-sand rounded hover:bg-plum inline-flex items-center gap-1.5 md:gap-2 text-xs md:text-sm"
              >
                <i className="fas fa-book-open"></i>
                <span className="hidden sm:inline">Take Notes</span>
                <span className="sm:hidden">Notes</span>
              </a>
            </>
          )}
        </div>
        <h1 className="text-2xl md:text-4xl mb-2 md:mb-3 leading-tight">{source.title}</h1>
        {source.authors && (
          <p className="text-sm md:text-lg text-gray-700 mb-1 md:mb-2">{source.authors}</p>
        )}
        <p className="text-xs md:text-sm text-gray-600">
          Last updated: {new Date(source.updated_at).toLocaleDateString()}
        </p>
      </div>

      {source.summary && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Summary</h3>
          <p className="leading-relaxed whitespace-pre-wrap">{source.summary}</p>
        </div>
      )}

      {source.abstract && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Abstract</h3>
          <p className="leading-relaxed whitespace-pre-wrap">{source.abstract}</p>
        </div>
      )}

      {source.doi_or_url && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Link</h3>
          <a
            href={source.doi_or_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-accent-dark underline break-all"
          >
            {source.doi_or_url}
          </a>
        </div>
      )}

      {((source.concepts && source.concepts.length > 0) || (source.tags && source.tags.length > 0) || (source.people && source.people.length > 0)) && (
        <div className="pt-6 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {source.concepts?.map((concept) => (
              <a
                key={concept.id}
                href={`/concepts/${concept.id}`}
                className="text-xs bg-accent-dark text-sand px-3 py-1 rounded hover:opacity-80 transition-opacity"
              >
                {concept.label}
              </a>
            ))}
            {source.tags?.map((tag, idx) => (
              <a
                key={idx}
                href={`/tags/${tag.slug || tag.name}`}
                className="text-xs bg-primary text-sand px-3 py-1 rounded hover:opacity-80 transition-opacity"
              >
                {tag.name}
              </a>
            ))}
            {source.people?.map((person) => (
              <a
                key={person.id}
                href={`/people/${person.id}`}
                className="text-xs bg-sand text-primary px-3 py-1 rounded hover:bg-primary hover:text-sand transition-colors"
              >
                {person.full_name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceConcepts({ concepts }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <h2 className="text-2xl mb-6">Related Constructs ({concepts.length})</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {concepts.map(concept => (
          <a
            key={concept.id}
            href={`/concepts/${concept.id}`}
            className="border border-gray-200 rounded p-4 hover:bg-sand transition-colors block"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{concept.label}</span>
              {concept.node_type && (
                <span className="text-xs text-gray-500">{concept.node_type}</span>
              )}
            </div>
            {concept.summary_top && (
              <p className="text-sm text-gray-600 line-clamp-2">{concept.summary_top}</p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

function SourcePeople({ people }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <h2 className="text-2xl mb-6">Related People ({people.length})</h2>
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

function SourceNotes({ sourceId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-8">
        <h2 className="text-2xl mb-6">Notes</h2>
        <p className="text-sm text-gray-600">Loading notes...</p>
      </div>
    );
  }

  if (notes.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 md:p-8">
      <h2 className="text-xl md:text-2xl mb-4 md:mb-6">Notes ({notes.length})</h2>
      <div className="space-y-4">
        {notes.map(note => (
          <div key={note.id} className="border border-gray-200 rounded overflow-hidden shadow-md hover:shadow-lg transition-shadow">
            {note.title && (
              <div className="px-4 py-2 bg-primary">
                <h3 className="font-semibold text-sm md:text-base" style={{ color: '#f6f0e9' }}>{note.title}</h3>
              </div>
            )}
            <div className="p-4">
              <div
                className="text-sm text-gray-700 prose prose-sm max-w-none line-clamp-3 mb-2"
                dangerouslySetInnerHTML={{ __html: note.body }}
              />
              {(note.concepts?.length > 0 || note.tags?.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {note.concepts?.map((concept) => (
                    <span key={concept.id} className="text-xs bg-accent-dark text-sand px-2 py-1 rounded">
                      {concept.label}
                    </span>
                  ))}
                  {note.tags?.map((tag, idx) => (
                    <span key={idx} className="text-xs bg-primary text-sand px-2 py-1 rounded">
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-1 bg-sage flex items-center justify-between">
              <div className="text-xs text-primary">
                {note.page_number && (
                  <span className="font-medium">Page {note.page_number}</span>
                )}
              </div>
              <div className="text-xs text-primary">
                {new Date(note.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
