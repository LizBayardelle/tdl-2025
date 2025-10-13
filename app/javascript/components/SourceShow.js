import React, { useState, useEffect } from 'react';

export default function SourceShow({ sourceId }) {
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <a href="/sources" className="text-sm text-primary hover:text-accent-dark">
          ← Back to Sources
        </a>
      </div>

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
    </div>
  );
}

function SourceDisplay({ source }) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-8">
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            {source.kind && (
              <span className="text-xs uppercase tracking-wider text-primary bg-sand px-3 py-1 rounded">
                {source.kind.replace('_', ' ')}
              </span>
            )}
            {source.year && (
              <span className="text-sm text-gray-600">{source.year}</span>
            )}
          </div>
          <h1 className="text-4xl mb-3">{source.title}</h1>
          {source.authors && (
            <p className="text-lg text-gray-700 mb-2">{source.authors}</p>
          )}
          <p className="text-sm text-gray-600">
            Last updated: {new Date(source.updated_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {source.summary && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Summary</h3>
          <p className="leading-relaxed whitespace-pre-wrap">{source.summary}</p>
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

      {source.tags && source.tags.length > 0 && (
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-lg mb-2">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {source.tags.map((tag, idx) => (
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
