import React, { createContext, useContext, useReducer, useMemo, useCallback } from 'react';

const BulkUploadContext = createContext();

const initialState = {
  // Current batch data (from server)
  batch: null,
  phase: 'upload', // 'upload' | 'processing' | 'review' | 'complete'

  // Session state (client-side until approved)
  pendingPeople: [],
  authorResolutions: {},  // { "itemId:authorIdx": { action, tempPersonId?, personId? } }
  pendingConcepts: [],
  conceptResolutions: {},

  // Extras (not tied to any detected index — added by the user from the "new author/concept" form)
  extraAuthors: {},   // { [itemId]: [{ tempId, firstName, lastName, orcid }] }
  extraConcepts: {},  // { [itemId]: [{ tempId, label, conceptType }] }

  // UI state
  expandedItemId: null,
  filter: 'all',  // 'all' | 'ready' | 'needs_review' | 'failed'

  // Loading/error state
  loading: false,
  error: null,

  // Completion stats
  completionStats: null
};

function generateTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function findSessionMatches(author, pendingPeople) {
  if (!author || !pendingPeople.length) return [];

  return pendingPeople.filter(pending => {
    // Match by ORCID (if both have it)
    if (author.orcid && pending.orcid && author.orcid === pending.orcid) {
      return true;
    }
    // Match by family name + initial
    const authorFamily = (author.family || '').toLowerCase().trim();
    const pendingLast = (pending.lastName || '').toLowerCase().trim();

    if (pendingLast && authorFamily && pendingLast === authorFamily) {
      // Family name matches, check given name
      const authorGiven = (author.given || '').toLowerCase().trim();
      const pendingFirst = (pending.firstName || '').toLowerCase().trim();

      if (!authorGiven || !pendingFirst) return true;
      // Check if first initial matches
      return pendingFirst[0] === authorGiven[0];
    }
    return false;
  });
}

function findConceptMatches(concept, pendingConcepts) {
  if (!concept || !pendingConcepts.length) return [];

  const keyword = (concept.keyword || concept.label || '').toLowerCase().trim();
  if (!keyword) return [];

  return pendingConcepts.filter(pending => {
    const pendingLabel = (pending.label || '').toLowerCase().trim();
    // Exact match or very close
    return pendingLabel === keyword ||
           pendingLabel.replace(/[-_\s]/g, '') === keyword.replace(/[-_\s]/g, '');
  });
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_BATCH':
      return {
        ...state,
        batch: action.payload,
        error: null
      };

    case 'SET_PHASE':
      return {
        ...state,
        phase: action.payload
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };

    case 'CREATE_PENDING_PERSON': {
      const tempId = generateTempId();
      const { itemId, authorIdx, firstName, lastName, orcid, createdFromAuthor } = action.payload;
      const key = `${itemId}:${authorIdx}`;

      return {
        ...state,
        pendingPeople: [
          ...state.pendingPeople,
          {
            tempId,
            firstName,
            lastName,
            orcid: orcid || null,
            createdFromAuthor,
            createdInItemId: itemId
          }
        ],
        authorResolutions: {
          ...state.authorResolutions,
          [key]: { action: 'create', tempPersonId: tempId, firstName, lastName, orcid }
        }
      };
    }

    case 'RESOLVE_AUTHOR': {
      const { itemId, authorIdx, resolution } = action.payload;
      const key = `${itemId}:${authorIdx}`;

      // If resolution is null, remove the key (clear the resolution)
      if (resolution === null) {
        const newResolutions = { ...state.authorResolutions };
        delete newResolutions[key];
        return {
          ...state,
          authorResolutions: newResolutions
        };
      }

      return {
        ...state,
        authorResolutions: {
          ...state.authorResolutions,
          [key]: resolution
        }
      };
    }

    case 'CLEAR_AUTHOR_RESOLUTION': {
      const { itemId, authorIdx } = action.payload;
      const key = `${itemId}:${authorIdx}`;
      const newResolutions = { ...state.authorResolutions };
      delete newResolutions[key];

      return {
        ...state,
        authorResolutions: newResolutions
      };
    }

    case 'CREATE_PENDING_CONCEPT': {
      const tempId = generateTempId();
      const { itemId, conceptIdx, label, conceptType, createdFromKeyword } = action.payload;
      const key = `${itemId}:${conceptIdx}`;

      return {
        ...state,
        pendingConcepts: [
          ...state.pendingConcepts,
          {
            tempId,
            label,
            conceptType: conceptType || 'non_physical_concept',
            createdFromKeyword,
            createdInItemId: itemId
          }
        ],
        conceptResolutions: {
          ...state.conceptResolutions,
          [key]: { action: 'create', tempConceptId: tempId, label, conceptType }
        }
      };
    }

    case 'RESOLVE_CONCEPT': {
      const { itemId, conceptIdx, resolution } = action.payload;
      const key = `${itemId}:${conceptIdx}`;

      // If resolution is null, remove the key (clear the resolution)
      if (resolution === null) {
        const newResolutions = { ...state.conceptResolutions };
        delete newResolutions[key];
        return {
          ...state,
          conceptResolutions: newResolutions
        };
      }

      return {
        ...state,
        conceptResolutions: {
          ...state.conceptResolutions,
          [key]: resolution
        }
      };
    }

    case 'CLEAR_CONCEPT_RESOLUTION': {
      const { itemId, conceptIdx } = action.payload;
      const key = `${itemId}:${conceptIdx}`;
      const newResolutions = { ...state.conceptResolutions };
      delete newResolutions[key];

      return {
        ...state,
        conceptResolutions: newResolutions
      };
    }

    case 'ADD_EXTRA_AUTHOR': {
      const { itemId, firstName, lastName, orcid } = action.payload;
      if (!(firstName || lastName)) return state;
      const tempId = generateTempId();
      const existing = state.extraAuthors[itemId] || [];
      return {
        ...state,
        extraAuthors: {
          ...state.extraAuthors,
          [itemId]: [...existing, { tempId, firstName: firstName || '', lastName: lastName || '', orcid: orcid || null }]
        }
      };
    }

    case 'REMOVE_EXTRA_AUTHOR': {
      const { itemId, tempId } = action.payload;
      const existing = state.extraAuthors[itemId] || [];
      return {
        ...state,
        extraAuthors: {
          ...state.extraAuthors,
          [itemId]: existing.filter(a => a.tempId !== tempId)
        }
      };
    }

    case 'ADD_EXTRA_CONCEPT': {
      const { itemId, label, conceptType } = action.payload;
      if (!label) return state;
      const tempId = generateTempId();
      const existing = state.extraConcepts[itemId] || [];
      return {
        ...state,
        extraConcepts: {
          ...state.extraConcepts,
          [itemId]: [...existing, { tempId, label, conceptType: conceptType || 'non_physical_concept' }]
        }
      };
    }

    case 'REMOVE_EXTRA_CONCEPT': {
      const { itemId, tempId } = action.payload;
      const existing = state.extraConcepts[itemId] || [];
      return {
        ...state,
        extraConcepts: {
          ...state.extraConcepts,
          [itemId]: existing.filter(c => c.tempId !== tempId)
        }
      };
    }

    case 'REPLACE_TEMP_IDS': {
      // When items are approved, replace temp IDs with real DB IDs
      const { personMappings, conceptMappings } = action.payload;

      // Update pending people with real IDs
      const updatedPeople = state.pendingPeople.map(person => {
        const realId = personMappings[person.tempId];
        return realId ? { ...person, realId } : person;
      });

      // Update author resolutions to use real IDs
      const updatedAuthorResolutions = { ...state.authorResolutions };
      Object.keys(updatedAuthorResolutions).forEach(key => {
        const resolution = updatedAuthorResolutions[key];
        if (resolution.tempPersonId && personMappings[resolution.tempPersonId]) {
          updatedAuthorResolutions[key] = {
            ...resolution,
            personId: personMappings[resolution.tempPersonId]
          };
        }
      });

      // Same for concepts
      const updatedConcepts = state.pendingConcepts.map(concept => {
        const realId = conceptMappings?.[concept.tempId];
        return realId ? { ...concept, realId } : concept;
      });

      const updatedConceptResolutions = { ...state.conceptResolutions };
      Object.keys(updatedConceptResolutions).forEach(key => {
        const resolution = updatedConceptResolutions[key];
        if (resolution.tempConceptId && conceptMappings?.[resolution.tempConceptId]) {
          updatedConceptResolutions[key] = {
            ...resolution,
            conceptId: conceptMappings[resolution.tempConceptId]
          };
        }
      });

      return {
        ...state,
        pendingPeople: updatedPeople,
        authorResolutions: updatedAuthorResolutions,
        pendingConcepts: updatedConcepts,
        conceptResolutions: updatedConceptResolutions
      };
    }

    case 'EXPAND_ITEM':
      return {
        ...state,
        expandedItemId: action.payload
      };

    case 'SET_FILTER':
      return {
        ...state,
        filter: action.payload
      };

    case 'SET_COMPLETION_STATS':
      return {
        ...state,
        completionStats: action.payload
      };

    case 'RESET':
      return {
        ...initialState
      };

    default:
      return state;
  }
}

export function BulkUploadProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Compute enriched items with session matches
  const enrichedItems = useMemo(() => {
    if (!state.batch?.items) return [];

    return state.batch.items.map(item => {
      const detectedAuthors = item.detected_authors || [];
      const detectedConcepts = item.detected_concepts || [];

      return {
        ...item,
        detected_authors: detectedAuthors.map((author, idx) => ({
          ...author,
          sessionMatches: findSessionMatches(author, state.pendingPeople),
          resolution: state.authorResolutions[`${item.id}:${idx}`]
        })),
        detected_concepts: detectedConcepts.map((concept, idx) => ({
          ...concept,
          sessionMatches: findConceptMatches(concept, state.pendingConcepts),
          resolution: state.conceptResolutions[`${item.id}:${idx}`]
        }))
      };
    });
  }, [
    state.batch,
    state.pendingPeople,
    state.pendingConcepts,
    state.authorResolutions,
    state.conceptResolutions
  ]);

  // Compute stats for bulk action bar
  const stats = useMemo(() => {
    const items = enrichedItems;
    if (!items.length) return { ready: 0, needsReview: 0, failed: 0, approved: 0, created: 0, skipped: 0 };

    let ready = 0;
    let needsReview = 0;
    let failed = 0;
    let approved = 0;
    let created = 0;
    let skipped = 0;

    items.forEach(item => {
      if (item.status === 'approved') {
        approved++;
      } else if (item.status === 'created') {
        created++;
      } else if (item.status === 'skipped') {
        skipped++;
      } else if (item.status === 'failed') {
        failed++;
      } else if (item.status === 'extracted') {
        // Check if all authors are resolved
        const allAuthorsResolved = item.detected_authors.every(
          author => author.resolution || author.auto_linked
        );
        if (allAuthorsResolved) {
          ready++;
        } else {
          needsReview++;
        }
      } else if (item.status === 'review_needed') {
        needsReview++;
      } else {
        needsReview++;
      }
    });

    return { ready, needsReview, failed, approved, created, skipped };
  }, [enrichedItems]);

  // Filter items based on current filter
  const filteredItems = useMemo(() => {
    if (state.filter === 'all') return enrichedItems;

    return enrichedItems.filter(item => {
      const isDone = ['approved', 'created', 'skipped'].includes(item.status);

      if (state.filter === 'ready') {
        if (isDone) return false;
        if (item.status === 'failed') return false;
        // Check if ready (all authors resolved)
        const allAuthorsResolved = item.detected_authors.every(
          author => author.resolution || author.auto_linked
        );
        return item.status === 'extracted' && allAuthorsResolved;
      }
      if (state.filter === 'needs_review') {
        if (isDone) return false;
        if (item.status === 'failed') return false;
        if (item.status === 'review_needed') return true;
        // Check if any authors need resolution
        const allAuthorsResolved = item.detected_authors.every(
          author => author.resolution || author.auto_linked
        );
        return !allAuthorsResolved;
      }
      if (state.filter === 'failed') {
        return item.status === 'failed';
      }
      return true;
    });
  }, [enrichedItems, state.filter]);

  const value = useMemo(() => ({
    state,
    dispatch,
    enrichedItems,
    filteredItems,
    stats
  }), [state, enrichedItems, filteredItems, stats]);

  return (
    <BulkUploadContext.Provider value={value}>
      {children}
    </BulkUploadContext.Provider>
  );
}

export function useBulkUpload() {
  const context = useContext(BulkUploadContext);
  if (!context) {
    throw new Error('useBulkUpload must be used within a BulkUploadProvider');
  }
  return context;
}

export default BulkUploadContext;
