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
import CollectionsIndex from './components/CollectionsIndex';
import Dashboard from './components/Dashboard';
import GlobalSearch from './components/GlobalSearch';
import UserDropdown from './components/UserDropdown';
import PdfStudyMode from './components/PdfStudyMode';
import SharingHub from './components/SharingHub';
import CollectionManager from './components/CollectionManager';
import ShareModal from './components/ShareModal';
import BulkUploadPage from './components/BulkUploadPage';
import BulkUploadWizard from './components/bulk-upload-v2/BulkUploadWizard';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminUsers from './components/admin/AdminUsers';
import AdminConceptGenerations from './components/admin/AdminConceptGenerations';
import AdminConceptGenerationNew from './components/admin/AdminConceptGenerationNew';
import AdminConceptGenerationShow from './components/admin/AdminConceptGenerationShow';
import AdminDocs from './components/admin/AdminDocs';
import SamplePage from './components/SamplePage';
import LegalPage from './components/LegalPage';
import SearchPage from './components/SearchPage';

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
    const personId = personShowRoot.dataset.personId;
    createRoot(personShowRoot).render(<PersonShow personId={personId} />);
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

  const collectionsIndexRoot = document.getElementById('collections-index-root');
  if (collectionsIndexRoot) {
    createRoot(collectionsIndexRoot).render(<CollectionsIndex />);
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

  const pdfStudyRoot = document.getElementById('pdf-study-root');
  if (pdfStudyRoot) {
    const sourceId = pdfStudyRoot.dataset.sourceId;
    const sourceTitle = pdfStudyRoot.dataset.sourceTitle;
    const pdfUrl = pdfStudyRoot.dataset.pdfUrl;
    const userUnlimited = pdfStudyRoot.dataset.userUnlimited === 'true';
    const userAdmin = pdfStudyRoot.dataset.userAdmin === 'true';
    createRoot(pdfStudyRoot).render(
      <PdfStudyMode
        sourceId={sourceId}
        sourceTitle={sourceTitle}
        pdfUrl={pdfUrl}
        userUnlimited={userUnlimited}
        userAdmin={userAdmin}
      />
    );
  }

  const sharingHubRoot = document.getElementById('sharing-hub-root');
  if (sharingHubRoot) {
    createRoot(sharingHubRoot).render(<SharingHub />);
  }

  // New bulk upload wizard (v2)
  const bulkUploadWizardRoot = document.getElementById('bulk-upload-wizard-root');
  if (bulkUploadWizardRoot) {
    createRoot(bulkUploadWizardRoot).render(<BulkUploadWizard />);
  }

  // Legacy bulk upload page
  const bulkUploadRoot = document.getElementById('bulk-upload-root');
  if (bulkUploadRoot) {
    createRoot(bulkUploadRoot).render(<BulkUploadPage />);
  }

  // Admin
  const adminDashboardRoot = document.getElementById('admin-dashboard-root');
  if (adminDashboardRoot) {
    createRoot(adminDashboardRoot).render(<AdminDashboard />);
  }

  const adminUsersRoot = document.getElementById('admin-users-root');
  if (adminUsersRoot) {
    createRoot(adminUsersRoot).render(<AdminUsers />);
  }

  const adminConceptGenerationsRoot = document.getElementById('admin-concept-generations-root');
  if (adminConceptGenerationsRoot) {
    createRoot(adminConceptGenerationsRoot).render(<AdminConceptGenerations />);
  }

  const adminConceptGenerationNewRoot = document.getElementById('admin-concept-generation-new-root');
  if (adminConceptGenerationNewRoot) {
    createRoot(adminConceptGenerationNewRoot).render(<AdminConceptGenerationNew />);
  }

  const adminConceptGenerationShowRoot = document.getElementById('admin-concept-generation-show-root');
  if (adminConceptGenerationShowRoot) {
    const generationId = adminConceptGenerationShowRoot.dataset.generationId;
    createRoot(adminConceptGenerationShowRoot).render(<AdminConceptGenerationShow generationId={generationId} />);
  }

  const adminDocsRoot = document.getElementById('admin-docs-root');
  if (adminDocsRoot) {
    const initialSlug = adminDocsRoot.dataset.slug;
    createRoot(adminDocsRoot).render(<AdminDocs initialSlug={initialSlug} />);
  }

  const samplePageRoot = document.getElementById('samplepage-root');
  if (samplePageRoot) {
    createRoot(samplePageRoot).render(<SamplePage />);
  }

  const legalPageRoot = document.getElementById('legal-page-root');
  if (legalPageRoot) {
    const slug = legalPageRoot.dataset.slug || null;
    createRoot(legalPageRoot).render(<LegalPage slug={slug} />);
  }

  const searchPageRoot = document.getElementById('search-page-root');
  if (searchPageRoot) {
    const initialQuery = searchPageRoot.dataset.query || '';
    createRoot(searchPageRoot).render(<SearchPage initialQuery={initialQuery} />);
  }
});

// Export components for use in other React components
export { CollectionManager, ShareModal };
