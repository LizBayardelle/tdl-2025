import React, { useState, useRef, useEffect } from 'react';

// Relationship types organized by category
export const RELATIONSHIP_CATEGORIES = [
  {
    label: 'Hierarchical',
    types: [
      { value: 'parent_of', text: 'is a parent of' },
      { value: 'child_of', text: 'is a child of' },
      { value: 'is_a', text: 'is a (categorization)' },
    ]
  },
  {
    label: 'Sequential',
    types: [
      { value: 'prerequisite_for', text: 'is a prerequisite for' },
      { value: 'builds_on', text: 'builds on' },
      { value: 'derived_from', text: 'is derived from' },
    ]
  },
  {
    label: 'Semantic',
    types: [
      { value: 'related_to', text: 'is related to' },
      { value: 'contrasts_with', text: 'contrasts with' },
      { value: 'integrates_with', text: 'integrates with' },
      { value: 'associated_with', text: 'is associated with' },
    ]
  },
  {
    label: 'Influence',
    types: [
      { value: 'influenced', text: 'influenced' },
      { value: 'supports', text: 'supports' },
      { value: 'critiques', text: 'critiques' },
    ]
  },
  {
    label: 'Positional',
    types: [
      { value: 'is_above', text: 'is above' },
      { value: 'is_below', text: 'is below' },
      { value: 'contains', text: 'contains' },
      { value: 'is_inside', text: 'is inside' },
      { value: 'faces', text: 'faces' },
      { value: 'faces_away_from', text: 'faces away from' },
      { value: 'is_near', text: 'is near' },
    ]
  },
  {
    label: 'Positional - Anatomical',
    types: [
      { value: 'superior_to', text: 'is superior to' },
      { value: 'inferior_to', text: 'is inferior to' },
      { value: 'anterior_to', text: 'is anterior to' },
      { value: 'posterior_to', text: 'is posterior to' },
      { value: 'medial_to', text: 'is medial to' },
      { value: 'lateral_to', text: 'is lateral to' },
      { value: 'dorsal_to', text: 'is dorsal to' },
      { value: 'ventral_to', text: 'is ventral to' },
      { value: 'rostral_to', text: 'is rostral to' },
      { value: 'caudal_to', text: 'is caudal to' },
      { value: 'proximal_to', text: 'is proximal to' },
      { value: 'distal_to', text: 'is distal to' },
      { value: 'ipsilateral_to', text: 'is ipsilateral to' },
      { value: 'contralateral_to', text: 'is contralateral to' },
    ]
  },
  {
    label: 'Other',
    types: [
      { value: 'authored', text: 'authored' },
      { value: 'applies_to', text: 'applies to' },
      { value: 'treats', text: 'treats' },
    ]
  },
];

// Helper to get display text for a relationship type
export const getRelTypeText = (value) => {
  for (const cat of RELATIONSHIP_CATEGORIES) {
    const found = cat.types.find(t => t.value === value);
    if (found) return found.text;
  }
  return value?.replace(/_/g, ' ') || value;
};

// Helper to get category for a relationship type
export const getRelTypeCategory = (value) => {
  for (const cat of RELATIONSHIP_CATEGORIES) {
    if (cat.types.find(t => t.value === value)) {
      return cat.label;
    }
  }
  return 'Other';
};

/**
 * InlineRelTypeSelect - A clickable inline dropdown for selecting relationship types
 *
 * Props:
 * - value: current relationship type value (e.g., 'related_to')
 * - onChange: callback when value changes, receives new value
 * - disabled: whether the dropdown is disabled
 * - size: 'sm' | 'md' - controls text size (default: 'sm')
 */
export default function InlineRelTypeSelect({ value, onChange, disabled = false, size = 'sm' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  const openDropdown = () => {
    if (disabled) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownHeight = 350;
      const dropdownWidth = 280;
      let top = rect.bottom + 4;
      if (top + dropdownHeight > window.innerHeight) {
        top = Math.max(8, rect.top - dropdownHeight - 4);
      }
      let left = rect.left;
      if (left + dropdownWidth > window.innerWidth) {
        left = window.innerWidth - dropdownWidth - 8;
      }
      setDropdownPos({ top, left });
    }
    setIsOpen(true);
  };

  const handleSelect = (newValue) => {
    if (newValue !== value) {
      onChange(newValue);
    }
    setIsOpen(false);
  };

  const displayText = getRelTypeText(value);
  const fontSize = size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)';

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={openDropdown}
        disabled={disabled}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '2px 6px',
          margin: '-2px 0',
          borderRadius: 'var(--radius)',
          cursor: disabled ? 'default' : 'pointer',
          color: 'var(--neutral-500)',
          fontSize,
          fontFamily: 'var(--font-body)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.15s',
          textDecoration: disabled ? 'none' : 'underline',
          textDecorationStyle: 'dotted',
          textUnderlineOffset: '2px',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = 'var(--neutral-100)';
            e.currentTarget.style.color = 'var(--primary)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--neutral-500)';
        }}
        title={disabled ? undefined : 'Click to change relationship type'}
      >
        {displayText}
        {!disabled && (
          <i className="fas fa-pencil-alt" style={{ fontSize: '9px', opacity: 0.6 }}></i>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10001,
            }}
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: '280px',
            maxHeight: '350px',
            overflowY: 'auto',
            background: 'white',
            border: '1px solid var(--neutral-300)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 10002,
          }}>
            {RELATIONSHIP_CATEGORIES.map(cat => (
              <div key={cat.label}>
                <div style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--neutral-100)',
                  borderBottom: '1px solid var(--neutral-200)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  color: 'var(--neutral-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}>
                  {cat.label}
                </div>
                {cat.types.map(type => (
                  <div
                    key={type.value}
                    onClick={() => handleSelect(type.value)}
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--neutral-100)',
                      background: value === type.value ? 'var(--accent-green-light)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onMouseEnter={(e) => {
                      if (value !== type.value) {
                        e.currentTarget.style.background = 'var(--neutral-50)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = value === type.value ? 'var(--accent-green-light)' : 'transparent';
                    }}
                  >
                    <span style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--neutral-700)',
                    }}>
                      {type.text}
                    </span>
                    {value === type.value && (
                      <i className="fas fa-check" style={{ fontSize: '11px', color: 'var(--primary)' }}></i>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
