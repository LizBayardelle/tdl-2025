import React, { useState, useEffect } from 'react';

export default function ConnectionVisualization() {
  const [concepts, setConcepts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedRelType, setSelectedRelType] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [conceptsRes, connectionsRes] = await Promise.all([
        fetch('/concepts.json'),
        fetch('/connections.json')
      ]);
      const conceptsData = await conceptsRes.json();
      const connectionsData = await connectionsRes.json();
      setConcepts(conceptsData);
      setConnections(connectionsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const filteredConcepts = selectedType === 'all'
    ? concepts
    : concepts.filter(n => n.concept_type === selectedType);

  const filteredConnections = connections.filter(connection => {
    const hasConcept = filteredConcepts.some(n => n.id === connection.src_concept.id || n.id === connection.dst_concept.id);
    const matchesRelType = selectedRelType === 'all' || connection.rel_type === selectedRelType;
    return hasConcept && matchesRelType;
  });

  // Group concepts by type
  const conceptsByType = filteredConcepts.reduce((acc, concept) => {
    if (!acc[concept.concept_type]) acc[concept.concept_type] = [];
    acc[concept.concept_type].push(concept);
    return acc;
  }, {});

  const relTypeLabels = {
    authored: 'Authored',
    influenced: 'Influenced',
    contrasts_with: 'Contrasts',
    integrates_with: 'Integrates',
    derived_from: 'Derived from',
    applies_to: 'Applies to',
    treats: 'Treats',
    associated_with: 'Associated with',
    critiques: 'Critiques',
    supports: 'Supports',
    related_to: 'Related to',
    is_a: 'Is a',
    // Positional (general)
    is_above: 'Is above',
    is_below: 'Is below',
    contains: 'Contains',
    is_inside: 'Is inside',
    faces: 'Faces',
    faces_away_from: 'Faces away from',
    is_near: 'Is near',
    // Positional (anatomical)
    superior_to: 'Superior to',
    inferior_to: 'Inferior to',
    anterior_to: 'Anterior to',
    posterior_to: 'Posterior to',
    medial_to: 'Medial to',
    lateral_to: 'Lateral to',
    dorsal_to: 'Dorsal to',
    ventral_to: 'Ventral to',
    rostral_to: 'Rostral to',
    caudal_to: 'Caudal to',
    proximal_to: 'Proximal to',
    distal_to: 'Distal to',
    ipsilateral_to: 'Ipsilateral to',
    contralateral_to: 'Contralateral to'
  };

  const relTypeColors = {
    authored: 'bg-purple-100 border-purple-300',
    influenced: 'bg-blue-100 border-blue-300',
    contrasts_with: 'bg-red-100 border-red-300',
    integrates_with: 'bg-green-100 border-green-300',
    derived_from: 'bg-indigo-100 border-indigo-300',
    applies_to: 'bg-cyan-100 border-cyan-300',
    treats: 'bg-pink-100 border-pink-300',
    associated_with: 'bg-gray-100 border-gray-300',
    critiques: 'bg-orange-100 border-orange-300',
    supports: 'bg-emerald-100 border-emerald-300',
    related_to: 'bg-slate-100 border-slate-300',
    is_a: 'bg-teal-100 border-teal-300',
    // Positional (general)
    is_above: 'bg-amber-100 border-amber-300',
    is_below: 'bg-amber-100 border-amber-300',
    contains: 'bg-amber-100 border-amber-300',
    is_inside: 'bg-amber-100 border-amber-300',
    faces: 'bg-amber-100 border-amber-300',
    faces_away_from: 'bg-amber-100 border-amber-300',
    is_near: 'bg-amber-100 border-amber-300',
    // Positional (anatomical)
    superior_to: 'bg-yellow-100 border-yellow-300',
    inferior_to: 'bg-yellow-100 border-yellow-300',
    anterior_to: 'bg-yellow-100 border-yellow-300',
    posterior_to: 'bg-yellow-100 border-yellow-300',
    medial_to: 'bg-yellow-100 border-yellow-300',
    lateral_to: 'bg-yellow-100 border-yellow-300',
    dorsal_to: 'bg-yellow-100 border-yellow-300',
    ventral_to: 'bg-yellow-100 border-yellow-300',
    rostral_to: 'bg-yellow-100 border-yellow-300',
    caudal_to: 'bg-yellow-100 border-yellow-300',
    proximal_to: 'bg-yellow-100 border-yellow-300',
    distal_to: 'bg-yellow-100 border-yellow-300',
    ipsilateral_to: 'bg-yellow-100 border-yellow-300',
    contralateral_to: 'bg-yellow-100 border-yellow-300'
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p>Loading visualization...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl mb-4">Knowledge Graph</h1>
        <p className="text-lg mb-6">
          Explore relationships between concepts
        </p>

        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Filter by Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="all">All Types</option>
              <option value="research_method">Research Method</option>
              <option value="measurement">Measurement</option>
              <option value="intervention">Intervention</option>
              <option value="pathology">Pathology</option>
              <option value="emotion">Emotion</option>
              <option value="symptom">Symptom</option>
              <option value="school_of_thought">School of Thought</option>
              <option value="physical_entity">Physical Entity</option>
              <option value="physical_process">Physical Process</option>
              <option value="non_physical_process">Non-Physical Process</option>
              <option value="non_physical_concept">Non-Physical Concept</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Filter by Relationship</label>
            <select
              value={selectedRelType}
              onChange={(e) => setSelectedRelType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="all">All Relationships</option>
              <option value="adjacent">Adjacent</option>
              <option value="contrasts_with">Contrasts With</option>
              <option value="integrates_with">Integrates With</option>
              <option value="builds_on">Builds On</option>
              <option value="subsumes">Subsumes</option>
            </select>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium mb-2">Legend:</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(relTypeLabels).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border ${relTypeColors[key]}`} />
                <span className="text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(conceptsByType).map(([type, typeConcepts]) => (
          <div key={type} className="bg-white border border-gray-300 rounded-lg p-6">
            <h2 className="text-xl mb-4 capitalize">
              {type.replace('_', ' ')}s ({typeConcepts.length})
            </h2>
            <div className="space-y-4">
              {typeConcepts.map(concept => {
                const conceptConnections = filteredConnections.filter(
                  e => e.src_concept.id === concept.id || e.dst_concept.id === concept.id
                );

                return (
                  <div key={concept.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <a
                          href={`/concepts/${concept.id}`}
                          className="text-lg font-medium hover:text-primary"
                        >
                          {concept.label}
                        </a>
                        {concept.summary && (
                          <p className="text-sm text-gray-600 mt-1">{concept.summary}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 ml-4">
                        {conceptConnections.length} {conceptConnections.length === 1 ? 'connection' : 'connections'}
                      </span>
                    </div>

                    {conceptConnections.length > 0 && (
                      <div className="grid md:grid-cols-2 gap-2 mt-3">
                        {conceptConnections.map(connection => {
                          const isSource = connection.src_concept.id === concept.id;
                          const otherConcept = isSource ? connection.dst_concept : connection.src_concept;
                          const direction = isSource ? '→' : '←';

                          return (
                            <div
                              key={connection.id}
                              className={`${relTypeColors[connection.rel_type]} border rounded px-3 py-2`}
                            >
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium">
                                  {relTypeLabels[connection.rel_type]}
                                </span>
                                <span className="text-gray-600">{direction}</span>
                                <a
                                  href={`/concepts/${otherConcept.id}`}
                                  className="hover:underline flex-1 truncate"
                                >
                                  {otherConcept.label}
                                </a>
                              </div>
                              {connection.strength && (
                                <div className="text-xs text-gray-600 mt-1">
                                  Strength: {connection.strength}/5
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filteredConcepts.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-300 rounded-lg">
          <p className="text-lg text-gray-600">No concepts match your filters</p>
        </div>
      )}
    </div>
  );
}
