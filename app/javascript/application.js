// Entry point for the build script in your package.json
import React from 'react';
import { createRoot } from 'react-dom/client';

// Import components
import ConceptsIndex from './components/ConceptsIndex';
import ConceptShow from './components/ConceptShow';
import SourcesIndex from './components/SourcesIndex';
import SourceShow from './components/SourceShow';
import PeopleIndex from './components/PeopleIndex';
import PersonShow from './components/PersonShow';
import ConnectionVisualization from './components/ConnectionVisualization';
import NotesIndex from './components/NotesIndex';
import NotesForm from './components/NotesForm';
import TagsIndex from './components/TagsIndex';
import Dashboard from './components/Dashboard';
import GlobalSearch from './components/GlobalSearch';
import UserDropdown from './components/UserDropdown';

// Initialize React components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const conceptsIndexRoot = document.getElementById('concepts-index-root');
  if (conceptsIndexRoot) {
    createRoot(conceptsIndexRoot).render(<ConceptsIndex />);
  }

  const conceptShowRoot = document.getElementById('concept-show-root');
  if (conceptShowRoot) {
    const conceptId = conceptShowRoot.dataset.conceptId;
    createRoot(conceptShowRoot).render(<ConceptShow conceptId={conceptId} />);
  }

  const sourcesIndexRoot = document.getElementById('sources-index-root');
  if (sourcesIndexRoot) {
    createRoot(sourcesIndexRoot).render(<SourcesIndex />);
  }

  const sourceShowRoot = document.getElementById('source-show-root');
  if (sourceShowRoot) {
    const sourceId = sourceShowRoot.dataset.sourceId;
    createRoot(sourceShowRoot).render(<SourceShow sourceId={sourceId} />);
  }

  const peopleIndexRoot = document.getElementById('people-index-root');
  if (peopleIndexRoot) {
    createRoot(peopleIndexRoot).render(<PeopleIndex />);
  }

  const personShowRoot = document.getElementById('person-show-root');
  if (personShowRoot) {
    createRoot(personShowRoot).render(<PersonShow />);
  }

  const connectionVisualizationRoot = document.getElementById('connection-visualization-root');
  if (connectionVisualizationRoot) {
    createRoot(connectionVisualizationRoot).render(<ConnectionVisualization />);
  }

  const notesIndexRoot = document.getElementById('notes-index-root');
  if (notesIndexRoot) {
    createRoot(notesIndexRoot).render(<NotesIndex />);
  }

  const noteFormRoot = document.getElementById('note-form-root');
  if (noteFormRoot) {
    createRoot(noteFormRoot).render(<NotesForm />);
  }

  const tagsIndexRoot = document.getElementById('tags-index-root');
  if (tagsIndexRoot) {
    createRoot(tagsIndexRoot).render(<TagsIndex />);
  }

  const dashboardRoot = document.getElementById('dashboard-root');
  if (dashboardRoot) {
    createRoot(dashboardRoot).render(<Dashboard />);
  }

  const globalSearchRoot = document.getElementById('global-search-root');
  if (globalSearchRoot) {
    createRoot(globalSearchRoot).render(<GlobalSearch />);
  }

  const userDropdownRoot = document.getElementById('user-dropdown-root');
  if (userDropdownRoot) {
    const userEmail = userDropdownRoot.dataset.userEmail;
    createRoot(userDropdownRoot).render(<UserDropdown userEmail={userEmail} />);
  }
});
