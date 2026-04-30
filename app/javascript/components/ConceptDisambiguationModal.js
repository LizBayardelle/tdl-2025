import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';

const CONCEPT_TYPE_OPTIONS = [
  { value: 'research_method', label: 'Research Method' },
  { value: 'measurement', label: 'Measurement' },
  { value: 'intervention', label: 'Intervention' },
  { value: 'pathology', label: 'Pathology' },
  { value: 'emotion', label: 'Emotion' },
  { value: 'symptom', label: 'Symptom' },
  { value: 'school_of_thought', label: 'School of Thought' },
  { value: 'physical_entity', label: 'Physical Entity' },
  { value: 'physical_process', label: 'Physical Process' },
  { value: 'non_physical_process', label: 'Non-Physical Process' },
  { value: 'non_physical_concept', label: 'Non-Physical Concept' },
];

const CONFIDENCE_COLORS = {
  high: { bg: 'var(--accent-green-light)', border: 'var(--accent-green)', text: 'var(--accent-green)' },
  medium: { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
  low: { bg: 'var(--neutral-100)', border: 'var(--neutral-400)', text: 'var(--neutral-600)' },
};

const emptyCustomRow = () => ({
  originalSuggestion: null,
  action: 'create',
  linkedConceptId: null,
  linkedConceptLabel: null,
  linkedConceptType: null,
  editedLabel: '',
  editedConceptType: 'non_physical_concept',
  isCustom: true,
});

function ConceptLabelTypeahead({ value, onChange, onLink, placeholder, autoFocus }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/concepts/search?q=${encodeURIComponent(value.trim())}`);
        if (r.ok) {
          const data = await r.json();
          setResults(data || []);
          setActive(-1);
        }
      } catch (e) { console.error(e); }
    }, 180);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleKey = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      onLink(results[active]);
      setOpen(false);
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="form-input"
        style={{
          width: '100%',
          padding: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          border: '1px solid var(--neutral-300)',
          borderRadius: '4px',
          fontFamily: 'var(--font-body)',
          background: 'white',
          height: '36px',
          boxSizing: 'border-box',
        }}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 10,
          background: 'white',
          border: '1px solid var(--neutral-300)',
          borderRadius: '4px',
          marginTop: '2px',
          maxHeight: '220px',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--neutral-500)',
            padding: 'var(--space-1) var(--space-2)',
            borderBottom: '1px solid var(--neutral-200)',
            fontFamily: 'var(--font-body)',
          }}>
            <i className="fas fa-database" style={{ marginRight: 'var(--space-1)' }}></i>
            Click to link to an existing concept
          </div>
          {results.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onLink(c); setOpen(false); }}
              onMouseEnter={() => setActive(i)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                background: i === active ? 'var(--accent-green-light)' : 'white',
                border: 'none',
                borderBottom: '1px solid var(--neutral-100)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
              }}
            >
              <span style={{ fontWeight: 500 }}>{c.label}</span>
              <span style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--neutral-500)',
                textTransform: 'capitalize',
              }}>{(c.concept_type || '').replace(/_/g, ' ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function iconBtnStyle(color) {
  return {
    width: '32px',
    height: '32px',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: color,
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function ConceptRow({ concept, onChange, onLink, onUnlink, onSkip, onInclude, onRemove, isLast }) {
  const isSkipped = concept.action === 'skip';
  const isLinked = concept.action === 'link' && concept.linkedConceptId;
  const isCustom = concept.isCustom;
  const conf = concept.originalSuggestion?.confidence;
  const confStyle = CONFIDENCE_COLORS[conf] || CONFIDENCE_COLORS.medium;

  return (
    <div style={{
      borderBottom: isLast ? 'none' : '1px solid var(--neutral-200)',
      background: isSkipped ? 'var(--neutral-50)' : 'white',
      opacity: isSkipped ? 0.6 : 1,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 200px 100px 40px',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-3)',
        alignItems: 'center',
      }}>
        <div>
          {isLinked ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2)',
              background: 'var(--accent-green-light)',
              border: '1px solid var(--accent-green)',
              borderRadius: '4px',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              height: '36px',
              boxSizing: 'border-box',
            }}>
              <i className="fas fa-link" style={{ color: 'var(--accent-green)', fontSize: 'var(--text-xs)' }}></i>
              <span style={{ fontWeight: 500 }}>{concept.linkedConceptLabel}</span>
            </div>
          ) : (
            <ConceptLabelTypeahead
              value={concept.editedLabel}
              onChange={(v) => onChange({ editedLabel: v })}
              onLink={onLink}
              placeholder={isCustom ? 'Type a concept name...' : ''}
            />
          )}
        </div>

        <div>
          {isLinked ? (
            <div style={{
              padding: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              color: 'var(--neutral-600)',
              fontFamily: 'var(--font-body)',
              textTransform: 'capitalize',
              height: '36px',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
            }}>
              {(concept.linkedConceptType || '').replace(/_/g, ' ')}
            </div>
          ) : (
            <select
              value={concept.editedConceptType}
              onChange={(e) => onChange({ editedConceptType: e.target.value })}
              className="form-select"
              style={{
                width: '100%',
                padding: 'var(--space-1) var(--space-2)',
                fontSize: 'var(--text-sm)',
                border: '1px solid var(--neutral-300)',
                borderRadius: '4px',
                fontFamily: 'var(--font-body)',
                height: '36px',
                background: 'white',
                boxSizing: 'border-box',
              }}
            >
              {CONCEPT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {isSkipped ? (
            <span style={{
              fontSize: 'var(--text-xs)',
              padding: '2px 8px',
              background: 'var(--neutral-100)',
              color: 'var(--neutral-500)',
              borderRadius: '4px',
              fontWeight: 500,
            }}>
              Skipped
            </span>
          ) : isLinked ? (
            <span style={{
              fontSize: 'var(--text-xs)',
              padding: '2px 8px',
              background: 'var(--accent-green-light)',
              color: 'var(--accent-green)',
              borderRadius: '4px',
              fontWeight: 500,
            }}>
              <i className="fas fa-check" style={{ marginRight: '4px' }}></i>Linked
            </span>
          ) : isCustom ? (
            <span style={{
              fontSize: 'var(--text-xs)',
              padding: '2px 8px',
              background: 'var(--accent-blue)',
              color: 'white',
              borderRadius: '4px',
              fontWeight: 500,
            }}>
              Custom
            </span>
          ) : (
            <span style={{
              fontSize: 'var(--text-xs)',
              padding: '2px 8px',
              background: confStyle.bg,
              color: confStyle.text,
              border: `1px solid ${confStyle.border}`,
              borderRadius: '4px',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}>
              {conf || 'new'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {isLinked ? (
            <button type="button" onClick={onUnlink} title="Unlink"
              style={iconBtnStyle('var(--neutral-500)')}>
              <i className="fas fa-unlink"></i>
            </button>
          ) : isSkipped ? (
            <button type="button" onClick={onInclude} title="Include"
              style={iconBtnStyle('var(--accent-green)')}>
              <i className="fas fa-plus"></i>
            </button>
          ) : isCustom ? (
            <button type="button" onClick={onRemove} title="Remove"
              style={iconBtnStyle('var(--error)')}>
              <i className="fas fa-trash"></i>
            </button>
          ) : (
            <button type="button" onClick={onSkip} title="Skip"
              style={iconBtnStyle('var(--neutral-500)')}>
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      </div>

      {!isSkipped && !isLinked && concept.originalSuggestion?.rationale && (
        <div style={{
          padding: '0 var(--space-3) var(--space-2) var(--space-3)',
          fontSize: 'var(--text-xs)',
          color: 'var(--neutral-500)',
          fontStyle: 'italic',
          fontFamily: 'var(--font-body)',
        }}>
          {concept.originalSuggestion.rationale}
        </div>
      )}
    </div>
  );
}

export default function ConceptDisambiguationModal({ isOpen, onClose, suggestions, onConfirm }) {
  const [conceptData, setConceptData] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    if (suggestions && suggestions.length > 0) {
      const initial = suggestions.map((s) => {
        const exact = (s.potential_matches || []).find(m => m.match_type === 'exact');
        return {
          originalSuggestion: {
            label: s.label,
            concept_type: s.concept_type,
            confidence: s.confidence,
            rationale: s.rationale,
          },
          action: exact ? 'link' : 'create',
          linkedConceptId: exact ? exact.id : null,
          linkedConceptLabel: exact ? exact.label : null,
          linkedConceptType: exact ? exact.concept_type : null,
          editedLabel: exact ? exact.label : s.label,
          editedConceptType: s.concept_type || 'non_physical_concept',
          isCustom: false,
        };
      });
      setConceptData(initial);
    } else {
      setConceptData([emptyCustomRow()]);
    }
  }, [isOpen, suggestions]);

  const updateRow = (i, patch) => {
    setConceptData(prev => prev.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  };

  const removeRow = (i) => {
    setConceptData(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleLink = (i, concept) => {
    updateRow(i, {
      action: 'link',
      linkedConceptId: concept.id,
      linkedConceptLabel: concept.label,
      linkedConceptType: concept.concept_type,
      editedLabel: concept.label,
    });
  };

  const handleUnlink = (i) => {
    updateRow(i, {
      action: 'create',
      linkedConceptId: null,
      linkedConceptLabel: null,
      linkedConceptType: null,
    });
  };

  const handleSkip = (i) => updateRow(i, { action: 'skip' });
  const handleInclude = (i) => updateRow(i, { action: 'create' });

  const addCustomRow = () => {
    setConceptData(prev => [...prev, emptyCustomRow()]);
  };

  const handleConfirm = () => {
    const processed = conceptData
      .filter(c => c.action !== 'skip')
      .filter(c => (c.action === 'link' && c.linkedConceptId) || (c.editedLabel && c.editedLabel.trim()))
      .map(c => ({
        action: c.action,
        linkedConceptId: c.linkedConceptId,
        editedLabel: (c.editedLabel || '').trim(),
        editedConceptType: c.editedConceptType,
        originalSuggestion: c.originalSuggestion,
        isCustom: c.isCustom,
      }));
    onConfirm(processed);
  };

  const activeCount = conceptData.filter(c =>
    c.action !== 'skip' &&
    ((c.action === 'link' && c.linkedConceptId) || (c.editedLabel && c.editedLabel.trim()))
  ).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review Suggested Concepts" size="large">
      <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-600)',
            marginBottom: 'var(--space-3)',
            fontFamily: 'var(--font-body)',
          }}>
            {suggestions?.length > 0
              ? `${suggestions.length} concept${suggestions.length !== 1 ? 's' : ''} suggested. Type in any label to search your library and link to an existing one — or leave as-is to create new.`
              : 'No suggestions were generated. Add concepts manually below.'
            }
          </p>

          <div style={{
            border: '1px solid var(--neutral-200)',
            borderRadius: '4px',
            overflow: 'visible',
            background: 'white',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 200px 100px 40px',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--neutral-100)',
              borderBottom: '1px solid var(--neutral-200)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--neutral-700)',
              fontFamily: 'var(--font-body)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <div>Label</div>
              <div>Type</div>
              <div style={{ textAlign: 'center' }}>Status</div>
              <div></div>
            </div>

            {conceptData.map((concept, i) => (
              <ConceptRow
                key={i}
                concept={concept}
                isLast={i === conceptData.length - 1}
                onChange={(patch) => updateRow(i, patch)}
                onLink={(c) => handleLink(i, c)}
                onUnlink={() => handleUnlink(i)}
                onSkip={() => handleSkip(i)}
                onInclude={() => handleInclude(i)}
                onRemove={() => removeRow(i)}
              />
            ))}

            <button
              type="button"
              onClick={addCustomRow}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
                width: '100%',
                padding: 'var(--space-3)',
                background: 'var(--neutral-50)',
                border: 'none',
                borderTop: '1px dashed var(--neutral-300)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--accent-blue)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
              }}
            >
              <i className="fas fa-plus-circle"></i>
              Add another concept
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--neutral-200)',
          background: 'white',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={handleConfirm}
            className="sp-action sp-action-primary"
            disabled={activeCount === 0}
          >
            Confirm {activeCount > 0 ? `(${activeCount})` : ''}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="sp-action sp-action-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
