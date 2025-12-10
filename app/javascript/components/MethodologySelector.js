import React, { useState } from 'react';

const METHODOLOGIES = [
  'Meta-analysis',
  'Systematic review',
  'Literature review',
  'RCT',
  'Experimental',
  'Quasi-experimental',
  'Natural experiment',
  'Observational',
  'Cross-sectional',
  'Longitudinal',
  'Cohort study',
  'Case study',
  'Quantitative',
  'Qualitative',
  'Mixed methods',
  'Secondary data analysis',
  'Pilot study',
  'Theoretical paper',
  'Psychometrics',
  'Replication study',
  'Computational modeling',
  'Predictive modeling'
];

export default function MethodologySelector({ selectedMethodologies = [], onChange }) {
  const [filter, setFilter] = useState('');

  const filteredMethodologies = METHODOLOGIES.filter(methodology =>
    methodology.toLowerCase().includes(filter.toLowerCase())
  );

  const handleToggleMethodology = (methodology) => {
    if (selectedMethodologies.includes(methodology)) {
      onChange(selectedMethodologies.filter(m => m !== methodology));
    } else {
      onChange([...selectedMethodologies, methodology]);
    }
  };

  return (
    <div className="border border-gray-300 rounded bg-white">
      {/* Search/Filter Input */}
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Type to filter methodologies..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
        />
      </div>

      {/* Selected Methodologies */}
      {selectedMethodologies.length > 0 && (
        <div className="p-3 border-b border-gray-200 bg-sand">
          <div className="text-xs font-medium mb-2 text-gray-600">Selected:</div>
          <div className="flex flex-wrap gap-2">
            {selectedMethodologies.map(methodology => (
              <span
                key={methodology}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-sand text-xs rounded"
              >
                {methodology}
                <button
                  type="button"
                  onClick={() => handleToggleMethodology(methodology)}
                  className="hover:text-accent-light"
                  style={{ background: 'none', padding: 0, fontSize: '14px' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable Methodology List */}
      <div className="max-h-48 overflow-y-auto p-3">
        {filteredMethodologies.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            No matching methodologies
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMethodologies.map(methodology => (
              <label
                key={methodology}
                className="flex items-center gap-2 cursor-pointer hover:bg-sand px-2 py-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedMethodologies.includes(methodology)}
                  onChange={() => handleToggleMethodology(methodology)}
                  className="rounded border-gray-300"
                  style={{ accentColor: '#414431' }}
                />
                <span className="text-sm">{methodology}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
