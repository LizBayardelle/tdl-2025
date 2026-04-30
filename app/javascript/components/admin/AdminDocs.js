import React, { useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import AdminPageHeader from './AdminPageHeader';
import AdminStyleGuide from './AdminStyleGuide';
import useIsMobile from './useIsMobile';

const DOCS = [
  {
    slug: 'page-audit',
    title: 'Page Audit',
    icon: 'fa-list-check',
    description: 'Mobile & iPad responsiveness sweep across every route',
  },
  {
    slug: 'brand-voice',
    title: 'Brand Voice',
    icon: 'fa-feather',
    description: 'How Map My Research sounds, in product and in marketing',
  },
  {
    slug: 'style-guide',
    title: 'Style Guide',
    icon: 'fa-palette',
    description: 'Design system reference: tokens, components, and migration plan',
  },
  {
    slug: 'to-do',
    title: 'To-Do & Future Ideas',
    icon: 'fa-list-ul',
    description: 'Pending work and captured ideas waiting for a moment',
  },
];

export default function AdminDocs({ initialSlug }) {
  const isMobile = useIsMobile();
  const slug = initialSlug || 'page-audit';
  const activeDoc = DOCS.find((d) => d.slug === slug) || DOCS[0];

  const renderDoc = () => {
    switch (activeDoc.slug) {
      case 'page-audit':
        return <PageAudit />;
      case 'brand-voice':
        return <BrandVoice />;
      case 'style-guide':
        return <AdminStyleGuide />;
      case 'to-do':
        return <ToDoDoc />;
      default:
        return <DocStub doc={activeDoc} />;
    }
  };

  return (
    <AdminLayout currentPage="docs" activeChildKey={activeDoc.slug}>
      <AdminPageHeader
        title={activeDoc.title}
        subtitle={activeDoc.description}
      />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          padding: isMobile ? 'var(--space-5)' : 'var(--space-8)',
          background: 'white',
        }}
      >
        {renderDoc()}
      </div>
    </AdminLayout>
  );
}

// ---------------- Page Audit ----------------

const STATUS_CYCLE = ['todo', 'in_progress', 'done'];
const STATUS_LABEL = {
  todo: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
};
const STATUS_COLOR = {
  todo: { bg: 'var(--neutral-100, #efeae1)', fg: 'var(--neutral-700, #4a4337)' },
  in_progress: { bg: '#fff4d6', fg: '#8a6d2c' },
  done: { bg: '#dcecd6', fg: '#3f6b34' },
};

const FLOWS = [
  {
    name: 'Auth & Account',
    routes: [
      { path: '/users/sign_in', view: 'Devise sessions#new', notes: 'Sign in', rebrandedAt: '2026-04-26' },
      { path: '/users/sign_up', view: 'Devise registrations#new', notes: 'Create an account', rebrandedAt: '2026-04-26' },
      { path: '/users/password/new', view: 'Devise passwords#new', notes: 'Forgot password', rebrandedAt: '2026-04-26' },
      { path: '/users/password/edit', view: 'Devise passwords#edit', notes: 'Reset password (token link)', rebrandedAt: '2026-04-26' },
      { path: '/users/edit', view: 'Devise registrations#edit', notes: 'Settings + profile image', rebrandedAt: '2026-04-26' },
    ],
  },
  {
    name: 'Home & Search',
    routes: [
      { path: '/', view: 'home#index', notes: 'Landing / marketing', rebrandedAt: '2026-04-26' },
      { path: '/dashboard', view: 'home#dashboard → Dashboard.js', notes: 'Main authenticated landing', rebrandedAt: '2026-04-26' },
      { path: '/search', view: 'search#index → SearchPage.js', notes: 'Full search results.  Nav typeahead in GlobalSearch.', rebrandedAt: '2026-04-26' },
    ],
  },
  {
    name: 'Concepts',
    routes: [
      { path: '/concepts', view: 'ConceptsIndex.js', notes: 'Library: filters by type, hierarchy', rebrandedAt: '2026-04-26' },
      { path: '/concepts/:id', view: 'ConceptShow.js', notes: 'Hierarchy breadcrumb, inline relationship adding, on-demand definitions', rebrandedAt: '2026-04-26' },
      { path: '— modal', view: 'ConceptFormModal / ConceptDisambiguationModal', notes: 'Slimmed: relationships moved to show page; new taxonomy + ? reference; sidebar tabs and header in concept navy', rebrandedAt: '2026-04-26' },
    ],
  },
  {
    name: 'Sources',
    routes: [
      { path: '/sources', view: 'SourcesIndex.js', notes: 'List + filters' },
      { path: '/sources/:id', view: 'SourceShow.js', notes: 'Metadata, related concepts' },
      { path: '/sources/:id/study', view: 'PdfStudyMode.js (study layout)', notes: 'PDF reader — likely desktop-first' },
      { path: '/sources/:id/notes', view: 'sources#notes', notes: 'Notes for a source' },
    ],
  },
  {
    name: 'People',
    routes: [
      { path: '/people', view: 'PeopleIndex.js', notes: 'Authors / researchers' },
      { path: '/people/:id', view: 'PersonShow.js', notes: 'ORCID enrichment, works' },
    ],
  },
  {
    name: 'Connections & Notes',
    routes: [
      { path: '/connections', view: 'ConnectionVisualization.js', notes: 'Graph view — pinch/zoom on touch' },
      { path: '/notes', view: 'NotesIndex.js', notes: 'Cross-source notes hub: facets, search, sort, group-by, density toggle, URL-state filters', rebrandedAt: '2026-04-27' },
      { path: '/notes/new', view: 'NotesForm.js', notes: 'Note editor' },
      { path: '/tabletops', view: 'TabletopsIndex.js', notes: 'Spatial canvas index — list of saved tabletops; CRUD; opens canvas', rebrandedAt: '2026-04-28' },
      { path: '/tabletops/:id', view: 'TabletopShow.js', notes: 'Spatial canvas — pan/zoom, drag notes, decoration tools (headers/text/arrows) coming next', rebrandedAt: '2026-04-28' },
      { path: '/tags', view: 'TagsIndex.js', notes: 'Tag management' },
    ],
  },
  {
    name: 'Collections',
    routes: [
      { path: '/collections', view: 'CollectionsIndex.js', notes: 'List' },
      { path: '/collections/:id', view: 'CollectionManager.js', notes: 'Item management' },
      { path: '— modal', view: 'CollectionSelector / Modal', notes: 'Add-to-collection picker' },
    ],
  },
  {
    name: 'Uploads',
    routes: [
      { path: '/uploads', view: 'home#uploads', notes: 'Upload landing' },
      { path: '/upload_batches', view: 'BulkUploadPage.js', notes: 'Batch list / active' },
      { path: '/upload_batches/new', view: 'bulk-upload-v2/BulkUploadWizard', notes: 'Multi-step wizard' },
      { path: '/upload_batches/:id', view: 'BulkUploadItemList.js', notes: 'Per-item review' },
    ],
  },
  {
    name: 'Sharing',
    routes: [
      { path: '/sharing', view: 'SharingHub.js', notes: 'Hub' },
      { path: '/shares', view: 'shares#index', notes: 'Sent shares' },
      { path: '/shares/received', view: 'shares#received', notes: 'Received shares' },
      { path: '/shares/accept/:token', view: 'shares#accept', notes: 'Public accept page' },
      { path: '— modal', view: 'ShareModal', notes: 'Reused share dialog' },
    ],
  },
  {
    name: 'Admin',
    routes: [
      { path: '/admin', view: 'AdminDashboard.js', notes: 'Stats grid' },
      { path: '/admin/users', view: 'AdminUsers.js', notes: 'User table' },
      { path: '/admin/concept_generations', view: 'AdminConceptGenerations.js', notes: 'Generation queue' },
      { path: '/admin/concept_generations/new', view: 'AdminConceptGenerationNew.js', notes: 'New generation form' },
      { path: '/admin/concept_generations/:id', view: 'AdminConceptGenerationShow.js', notes: 'Multi-stage review' },
      { path: '/admin/docs', view: 'AdminDocs.js', notes: 'This page' },
    ],
  },
  {
    name: 'Shared chrome',
    routes: [
      { path: '— component', view: 'shared/_navigation', notes: 'Top nav across all pages' },
      { path: '— component', view: 'Modal.js', notes: 'Base modal — check sheet behavior on mobile' },
      { path: '— component', view: 'AdminLayout.js sidebar', notes: 'Drawer + draggable toggle' },
      { path: '— component', view: 'GlobalSearch / UserDropdown', notes: 'Header dropdowns' },
    ],
  },
  {
    name: 'Legal',
    routes: [
      { path: '/legal', view: 'legal#index → LegalPage', notes: 'Public index of all legal documents' },
      { path: '/legal/terms', view: 'LegalPage[terms]', notes: 'Terms of Service' },
      { path: '/legal/privacy', view: 'LegalPage[privacy]', notes: 'Privacy Policy' },
      { path: '/legal/cookies', view: 'LegalPage[cookies]', notes: 'Cookie Notice' },
      { path: '/legal/acceptable-use', view: 'LegalPage[acceptable-use]', notes: 'Acceptable Use Policy' },
      { path: '/legal/dmca', view: 'LegalPage[dmca]', notes: 'Copyright and DMCA Policy. Designated agent name + phone still placeholders; registration with U.S. Copyright Office still required for safe harbor.' },
      { path: '/legal/refunds', view: 'LegalPage[refunds]', notes: 'Refund Policy' },
      { path: '/legal/ai', view: 'LegalPage[ai]', notes: 'AI Use and Content Policy' },
      { path: '/legal/subprocessors', view: 'LegalPage[subprocessors]', notes: 'Subprocessors list' },
      { path: '/legal/accessibility', view: 'LegalPage[accessibility]', notes: 'Accessibility Statement' },
      { path: '/legal/security', view: 'LegalPage[security]', notes: 'Security Overview' },
    ],
  },
];

const STORAGE_KEY = 'admin_page_audit_status_v1';

function loadStatuses() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveStatuses(statuses) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  } catch (_) {}
}

// A route's default rebrand status is 'done' if FLOWS data marks it as
// converted; otherwise 'todo'.  User toggles in localStorage override.
function defaultStatusFor(track, route) {
  if (track === 'rebrand' && route && route.rebrandedAt) return 'done';
  return 'todo';
}
function readStatus(statuses, flowName, route, track) {
  const key = `${flowName}::${route.path}::${track}`;
  return statuses[key] || defaultStatusFor(track, route);
}

function PageAudit() {
  const isMobile = useIsMobile();
  const [statuses, setStatuses] = useState(loadStatuses);

  const setStatus = (key, value) => {
    setStatuses((prev) => {
      const next = { ...prev, [key]: value };
      saveStatuses(next);
      return next;
    });
  };

  const cycle = (key, currentStatus) => {
    const cur = currentStatus || statuses[key] || 'todo';
    const idx = STATUS_CYCLE.indexOf(cur);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setStatus(key, next);
  };

  const counts = useMemo(() => {
    let total = 0;
    let done = 0;
    let inProgress = 0;
    FLOWS.forEach((flow) => {
      flow.routes.forEach((r) => {
        ['rebrand', 'mobile', 'ipad'].forEach((track) => {
          total += 1;
          const s = readStatus(statuses, flow.name, r, track);
          if (s === 'done') done += 1;
          else if (s === 'in_progress') inProgress += 1;
        });
      });
    });
    return { total, done, inProgress };
  }, [statuses]);

  const resetAll = () => {
    if (!window.confirm('Clear all audit progress?')) return;
    setStatuses({});
    saveStatuses({});
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--neutral-600)',
          marginTop: 0,
          marginBottom: 'var(--space-6)',
          lineHeight: 1.6,
        }}
      >
        Three tracks per page: <strong>Rebrand</strong> (convert to the new design system), <strong>Mobile</strong>, and <strong>iPad</strong>.  Click any status pill to cycle <em>Not started → In progress → Done</em>.  Progress is saved to your browser.
      </p>

      {/* Approach card */}
      <div
        style={{
          background: 'white',
          border: '1px solid var(--neutral-200)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-5)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--neutral-700)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Approach
        </div>
        <ol
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-800)',
            lineHeight: 1.7,
            paddingLeft: '1.25rem',
            margin: 0,
          }}
        >
          <li><strong>One page at a time.</strong> Read the component, look for the usual suspects: fixed widths, unwrapped flex rows, overflowing tables, modals that don't fit small viewports, touch targets under ~44px.</li>
          <li><strong>Fix what's clearly broken</strong> — no mass refactor. Targeted changes per page.</li>
          <li><strong>Lift to shared components</strong> only when the same issue (nav, modal, form layout) keeps showing up.</li>
          <li><strong>Spot-check on a real device</strong> when a change touches real layout. Flag anything that genuinely needs hands-on testing.</li>
        </ol>
        <div
          style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--neutral-200)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--neutral-600)',
          }}
        >
          <span><strong>Mobile breakpoints:</strong> 320, 375, 414</span>
          <span style={{ color: 'var(--neutral-300)' }}>•</span>
          <span><strong>iPad breakpoints:</strong> 768 (portrait), 1024 (landscape / iPad Pro)</span>
        </div>
      </div>

      {/* Progress summary */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-5)',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Pill bg={STATUS_COLOR.done.bg} fg={STATUS_COLOR.done.fg}>
            Done {counts.done}/{counts.total}
          </Pill>
          <Pill bg={STATUS_COLOR.in_progress.bg} fg={STATUS_COLOR.in_progress.fg}>
            In progress {counts.inProgress}
          </Pill>
          <Pill bg={STATUS_COLOR.todo.bg} fg={STATUS_COLOR.todo.fg}>
            Remaining {counts.total - counts.done - counts.inProgress}
          </Pill>
        </div>
        <button
          onClick={resetAll}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--neutral-500)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Reset progress
        </button>
      </div>

      {/* Flows */}
      {FLOWS.map((flow) => (
        <FlowSection
          key={flow.name}
          flow={flow}
          statuses={statuses}
          onCycle={cycle}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}

function FlowSection({ flow, statuses, onCycle, isMobile }) {
  return (
    <section style={{ marginBottom: 'var(--space-8)' }}>
      <h2
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--neutral-700)',
          paddingBottom: 'var(--space-2)',
          borderBottom: '1px solid var(--neutral-200)',
          marginBottom: 'var(--space-3)',
        }}
      >
        {flow.name}
      </h2>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {flow.routes.map((r) => (
            <RouteCard
              key={`${flow.name}::${r.path}`}
              flowName={flow.name}
              route={r}
              statuses={statuses}
              onCycle={onCycle}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            background: 'white',
            border: '1px solid var(--neutral-200)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <thead>
              <tr style={{ background: 'var(--neutral-50, #f7f4ee)' }}>
                <Th>Route</Th>
                <Th>View / Component</Th>
                <Th>Notes</Th>
                <Th width="120px">Rebrand</Th>
                <Th width="120px">Mobile</Th>
                <Th width="120px">iPad</Th>
              </tr>
            </thead>
            <tbody>
              {flow.routes.map((r) => {
                const rebrandKey = `${flow.name}::${r.path}::rebrand`;
                const mobileKey = `${flow.name}::${r.path}::mobile`;
                const ipadKey = `${flow.name}::${r.path}::ipad`;
                const rebrandStatus = readStatus(statuses, flow.name, r, 'rebrand');
                const mobileStatus = readStatus(statuses, flow.name, r, 'mobile');
                const ipadStatus = readStatus(statuses, flow.name, r, 'ipad');
                return (
                  <tr key={r.path + r.view} style={{ borderTop: '1px solid var(--neutral-200)' }}>
                    <Td>
                      <code
                        style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          fontSize: '12px',
                          color: 'var(--neutral-900)',
                        }}
                      >
                        {r.path}
                      </code>
                    </Td>
                    <Td>{r.view}</Td>
                    <Td color="var(--neutral-600)">{r.notes}</Td>
                    <Td>
                      <StatusPill status={rebrandStatus} onClick={() => onCycle(rebrandKey, rebrandStatus)} />
                    </Td>
                    <Td>
                      <StatusPill status={mobileStatus} onClick={() => onCycle(mobileKey, mobileStatus)} />
                    </Td>
                    <Td>
                      <StatusPill status={ipadStatus} onClick={() => onCycle(ipadKey, ipadStatus)} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RouteCard({ flowName, route, statuses, onCycle }) {
  const rebrandKey = `${flowName}::${route.path}::rebrand`;
  const mobileKey = `${flowName}::${route.path}::mobile`;
  const ipadKey = `${flowName}::${route.path}::ipad`;
  const rebrandStatus = readStatus(statuses, flowName, route, 'rebrand');
  const mobileStatus = readStatus(statuses, flowName, route, 'mobile');
  const ipadStatus = readStatus(statuses, flowName, route, 'ipad');
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-3)',
      }}
    >
      <code
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '12px',
          color: 'var(--neutral-900)',
          display: 'block',
          marginBottom: '4px',
        }}
      >
        {route.path}
      </code>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--neutral-800)',
          marginBottom: '2px',
        }}
      >
        {route.view}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          color: 'var(--neutral-600)',
          marginBottom: 'var(--space-3)',
        }}
      >
        {route.notes}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <LabeledStatus
          label="Rebrand"
          status={rebrandStatus}
          onClick={() => onCycle(rebrandKey, rebrandStatus)}
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <LabeledStatus
            label="Mobile"
            status={mobileStatus}
            onClick={() => onCycle(mobileKey, mobileStatus)}
          />
          <LabeledStatus
            label="iPad"
            status={ipadStatus}
            onClick={() => onCycle(ipadKey, ipadStatus)}
          />
        </div>
      </div>
    </div>
  );
}

function Th({ children, width }) {
  return (
    <th
      style={{
        textAlign: 'left',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--neutral-600)',
        padding: 'var(--space-2) var(--space-3)',
        width,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, color }) {
  return (
    <td
      style={{
        padding: 'var(--space-3)',
        verticalAlign: 'top',
        color: color || 'var(--neutral-900)',
      }}
    >
      {children}
    </td>
  );
}

function StatusPill({ status, onClick }) {
  const colors = STATUS_COLOR[status];
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '11px',
        fontWeight: 600,
        background: colors.bg,
        color: colors.fg,
        border: 'none',
        borderRadius: '999px',
        padding: '4px 10px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
      title="Click to advance status"
    >
      {STATUS_LABEL[status]}
    </button>
  );
}

function LabeledStatus({ label, status, onClick }) {
  const colors = STATUS_COLOR[status];
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        fontFamily: 'var(--font-body)',
        fontSize: '11px',
        fontWeight: 600,
        background: colors.bg,
        color: colors.fg,
        border: 'none',
        borderRadius: 'var(--radius)',
        padding: '6px 10px',
        cursor: 'pointer',
        textAlign: 'center',
      }}
    >
      {label}: {STATUS_LABEL[status]}
    </button>
  );
}

function Pill({ children, bg, fg }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '12px',
        fontWeight: 600,
        background: bg,
        color: fg,
        borderRadius: '999px',
        padding: '4px 12px',
      }}
    >
      {children}
    </span>
  );
}

function DocStub({ doc }) {
  return (
    <div style={{ fontFamily: 'var(--font-body)', color: 'var(--neutral-600)' }}>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-3xl)',
          color: 'var(--neutral-900)',
          margin: 0,
          marginBottom: 'var(--space-3)',
        }}
      >
        {doc.title}
      </h1>
      <p>Coming soon.</p>
    </div>
  );
}

// ---------------- Brand Voice ----------------

function BrandVoice() {
  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      <BVIntro />

      <BVSection title="The brand in one sentence">
        <BVPara>
          Map My Research is the workspace serious researchers use to make sense of
          everything they have read. We sound like the colleague who has been doing
          this longer than the user. Knowledgeable, direct, and on their side
          without making a show of it.
        </BVPara>
      </BVSection>

      <BVSection title="What Map My Research is">
        <BVList
          items={[
            'A system of record for the literature in your field.',
            'A way to cross-reference notes, sources, concepts, and people across thousands of items at once.',
            'Infrastructure for collaborative research, built around sharing curated bodies of work rather than single files.',
            'An automation layer that pulls in metadata, citations, and related work so the user spends more time reading and less time entering data.',
          ]}
        />
      </BVSection>

      <BVSection title="What it isn't">
        <BVList
          items={[
            'A note-taking app dressed up as a research tool.',
            'A "second brain." We do not traffic in that vocabulary.',
            'A consumer product. The interface assumes the user knows their work.',
            'A general-purpose knowledge graph.',
          ]}
        />
      </BVSection>

      <BVSection title="Who we're for">
        <BVPara>
          PhDs, MDs, and the people becoming them. The user is competent in their
          field, comfortable with rigor, and uninterested in being congratulated
          for completing tasks. We do not write for the lowest common denominator.
          We write for our user.
        </BVPara>
        <BVPara>
          Domain language is permitted but not required. A psychologist may not
          read pharmacology and a clinician may not read social theory; do not
          assume cross-domain fluency. Assume general scholarly fluency instead.
          The user knows what a citation, a methodology, and a literature review
          are. Write to that level.
        </BVPara>
      </BVSection>

      <BVSection title="Ten Things You're Doing Right Now">
        <BVPara>
          The brand earns credibility by demonstrating that we understand the
          work, not by claiming to.  When we describe user pain, we describe it
          precisely.  Like a clinician naming symptoms.  Not &ldquo;research is
          hard,&rdquo; but specific moments any researcher with fifty sources
          will recognize on sight.
        </BVPara>
        <BVPara muted>
          The list below is a reference for that voice.  It is also lift-able,
          in part or whole, for marketing copy.
        </BVPara>
        <BVPainList
          items={[
            "You are looking for a passage you highlighted last semester.  You don't remember the paper.  You remember it was a Tuesday.",
            "You have three subtly different copies of the same PDF.  Two have your annotations.  One has the better OCR.",
            "Your reading list, your Zotero library, and your notes folder disagree on what you have read.  None of them is right.",
            "You are re-reading an abstract and recognizing it twenty seconds in.  You read the paper.  You wrote notes.  The notes are somewhere.",
            "You are pasting the same DOI into the same citation generator for the fourth time this month.",
            "You are about to discover that two of your concept tags refer to the same thing.  You will discover this halfway through writing the literature review.",
            "You are sitting on sixteen browser tabs from a PubMed search.  You will close most of them without reading.",
            "You are trying to find every note you have ever written that touches on construct validity.  You wrote them across four sources, two semesters, and three apps.",
            "You are trying to remember which Smith.",
            "You are starting a new chapter and rebuilding, by hand, the mental map you already had two months ago.",
          ]}
        />
      </BVSection>

      <BVSection title="Three Pillars of the Voice">
        <BVPillar
          n="1"
          title="Direct"
          body="Say the thing.  Name the action.  Do not soften with hedges, do not pad with adverbs, do not bury the verb.  If a sync failed, the message is &ldquo;Sync failed.&rdquo;  Not &ldquo;We&rsquo;re so sorry, something didn&rsquo;t quite work as expected.&rdquo;"
        />
        <BVPillar
          n="2"
          title="Knowledgeable"
          body="We have thought about this longer than the user has.  That earns us the right to make recommendations.  When a workflow exists that would save time, surface it colleague-to-colleague, not as a promotion.  &ldquo;Most researchers tag at the source level and filter notes by tag&rdquo; reads correctly.  &ldquo;Pro tip: tagging is awesome!&rdquo; does not."
        />
        <BVPillar
          n="3"
          title="Genuinely on the User's Side"
          body="We do not perform care.  We earn it.  The brand should feel cooler than it actually is.  Like a senior colleague who does not fuss on good days but, when something goes wrong, becomes plain-spoken, calm, and useful.  The warmth comes from competence, not from emotional language."
        />
      </BVSection>

      <BVSection title="The Persona">
        <BVPara>
          Picture a senior resident running a teaching service. Smart. Tired in a
          way that makes them efficient. Will not waste your time. Will tell you
          when you are doing something wrong, and will not make a thing of it.
          Will also stay late to help you fix it. Does not ask how your weekend
          was. Notices when you are struggling and meets you where you are
          without naming it.
        </BVPara>
        <BVPara>
          That is the brand. Write like that resident is dictating.
        </BVPara>
      </BVSection>

      <BVSection title="Tone Calibration">
        <BVPara>
          The voice does not change. The tone shifts by context.
        </BVPara>
        <BVToneTable
          rows={[
            ['Marketing pages', 'Confident, declarative.', '"Cross-reference everything you’ve read."'],
            ['Empty states', 'Brief, orienting.', '"No sources yet.  Paste a DOI to add the first."'],
            ['Loading', 'Silent if possible.  Otherwise minimal.', '"Loading."'],
            ['Success', 'Quiet.  The changed UI is usually the message.', '"Source added." (or no message at all)'],
            ['User errors', 'Plain, specific, no judgment.', '"DOI not found.  Check the identifier and try again."'],
            ['Our errors', 'Plain, accountable, no over-apology.', '"Sync failed.  We’ve logged it.  Try again in a moment."'],
            ['Destructive confirms', 'Formal.  Names the consequence in full.', '"Deleting this note is permanent and cannot be undone."'],
            ['Onboarding', 'Brisk, instructive.', '"Start with one concept.  Connections come later."'],
          ]}
        />
      </BVSection>

      <BVSection title="Writing Rules">
        <BVList
          items={[
            'Sentence case for full-sentence headings, buttons, and labels.  Title Case is fine for headings that are not full sentences.  Title case in body copy is shouty.',
            'No em dashes.  Use a period or a comma.  The pause an em dash creates is almost always better as a full stop.  If you are reaching for an em dash, you are reaching for two sentences.',
            'Oxford commas.  Always.',
            'Contractions are allowed but not required.  Use them where they read more naturally; drop them where formality serves clarity.  Destructive and consequential copy leans formal: "Deleting this note is permanent and cannot be undone," not "Can\'t be undone."',
            'Two spaces after a period.',
            'Numerals for counts of research artifacts (4 sources, not "four sources").  Spelled out only at the start of a sentence.',
            'Active voice.  The subject does the verb.',
            'Cut every word that does not change meaning.  If the sentence still works without it, it should not be there.',
          ]}
        />
      </BVSection>

      <BVSection title="Banned Vocabulary">
        <BVPara>
          If one of these slips into copy, treat it as a bug.
        </BVPara>
        <BVBannedGrid
          items={[
            'em dashes ( — )',
            'supercharge',
            'unlock',
            'magical',
            'effortless',
            'seamless',
            'revolutionary',
            'game-changer',
            'AI-powered',
            'second brain',
            'knowledge graph (as marketing)',
            'empower',
            'journey',
            'reimagine',
            'Oops / Whoops / Uh-oh',
            'Let’s get started',
            'You’re all set!',
            'Exclamation points in product UI',
            'Emoji in product surfaces',
            'Awesome / amazing / incredible',
          ]}
        />
        <BVPara muted>
          AI may power features. We do not market it that way. Describe what the
          feature does, not what runs underneath.
        </BVPara>
      </BVSection>

      <BVSection title="Voice in Practice">
        <BVPara>
          Concrete pairs. Read the left, then the right. The right is the brand.
        </BVPara>
        <BVDoDontTable
          rows={[
            ['Oops! Something went wrong.', 'Sync failed. Try again in a moment.'],
            ['Great work! 🎉 You added your first concept!', 'Concept added.'],
            ['Let’s get started by adding your first source.', 'Add your first source.'],
            ['We couldn’t find anything matching your search.', 'No matches for "attachment theory."'],
            ['Awesome! Your notes are syncing in the background.', 'Notes are syncing.'],
            ['Pro tip: try filtering by tag!', 'Most researchers filter notes by tag once they pass 50 sources.'],
            ['Are you sure you want to delete this?', 'Deleting this note is permanent and cannot be undone.'],
            ['Loading your research…', 'Loading.'],
            ['Welcome back, friend!', 'Welcome back.'],
            ['Empower your research with the power of AI.', 'Auto-fill metadata from a DOI.'],
          ]}
        />
      </BVSection>

      <BVSection title="Tagline Candidates">
        <BVPara>
          A tagline answers <em>what does this do for me</em>, not <em>who we
          think we are</em>. Three options for the homepage hero, ordered by how
          on-brand they read.
        </BVPara>
        <BVTagline
          rank="1"
          line="Cross-reference everything you’ve read."
          note="Direct, names the value, no metaphor. Strongest fit for the voice."
          recommended
        />
        <BVTagline
          rank="2"
          line="A workspace for cumulative research."
          note="Dignified, names the use case, no hype."
        />
        <BVTagline
          rank="3"
          line="For the literature you live in."
          note="Slightly more evocative. Defensible. Small risk of feeling literary."
        />
        <BVCallout>
          <strong>Recommendation: option 1.</strong>  The current homepage line
          (&ldquo;Organize your research.  See the connections.  Build real
          expertise.&rdquo;) uses three clauses where one would do, and
          &ldquo;build real expertise&rdquo; is a promise the product cannot
          keep.  Expertise is built by the user, not by us.
        </BVCallout>
      </BVSection>

      <BVSection title="Linchpin Industries">
        <BVPara>
          Linchpin Industries is the parent company. Map My Research is one of
          its tools. The voice for Linchpin is the same shape, with one shift:
          Linchpin talks to people choosing tools (often technical buyers,
          sometimes team leads), not to researchers. Same directness, same lack
          of theater, slightly more product-craft language (&ldquo;we make tools
          that hold up under load&rdquo;) and less domain language.
        </BVPara>
        <BVPara>
          Inside Map My Research, Linchpin should be invisible. The product
          should feel like the tool that built itself. Linchpin signs the work;
          Map My Research does it.
        </BVPara>
      </BVSection>

      <BVSection title="Logo Direction">
        <BVPara muted>
          Note: actual logo design is a separate workstream.  These are
          principles only.
        </BVPara>
        <BVList
          items={[
            'Wordmark over icon.  The product name is the logo until proven otherwise.',
            'A single quiet mark, not a cluster of nodes-and-edges.  What the product does (connect) should not be what its logo shows.  Too literal.',
            'One typeface.  Either a humanist serif to signal scholarship, or a precise grotesque to signal infrastructure.  Pick one direction; do not blend.',
            'Single ink.  The mark must read without color.',
            'No gradients, no glow, no animation in the static mark.',
            'It should look like it belongs on the spine of a hardcover, not on a sticker.',
          ]}
        />
      </BVSection>

      <BVSection title="Quick Reference">
        <BVCallout strong>
          Write like the senior resident who is not going to fuss over the user,
          but who is, in fact, on their side.
        </BVCallout>
        <BVPara>If only three rules: </BVPara>
        <BVList
          items={[
            'Say the thing.',
            'Trust the reader.',
            'Cut every word you don’t need.',
          ]}
        />
      </BVSection>
    </div>
  );
}

// ---- Brand Voice subcomponents ----

function BVIntro() {
  return (
    <div
      style={{
        marginBottom: 'var(--space-8)',
        paddingBottom: 'var(--space-6)',
        borderBottom: '1px solid var(--neutral-200)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--neutral-500)',
          marginBottom: 'var(--space-3)',
        }}
      >
        Linchpin Industries · Map My Research
      </div>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          lineHeight: 1.7,
          color: 'var(--neutral-700)',
          margin: 0,
        }}
      >
        This document is the source of truth for how Map My Research sounds.
        In the product, on the marketing site, in emails, in error messages,
        in every word a user encounters.  Use it when writing copy.  Use it
        when editing copy.  If a piece of copy violates this document, the
        document wins.
      </p>
    </div>
  );
}

function BVSection({ title, children }) {
  return (
    <section style={{ marginBottom: 'var(--space-8)' }}>
      <h2
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--neutral-700)',
          paddingBottom: 'var(--space-2)',
          borderBottom: '1px solid var(--neutral-200)',
          margin: 0,
          marginBottom: 'var(--space-4)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function BVPara({ children, muted }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-base)',
        lineHeight: 1.75,
        color: muted ? 'var(--neutral-500)' : 'var(--neutral-800)',
        margin: 0,
        marginBottom: 'var(--space-4)',
      }}
    >
      {children}
    </p>
  );
}

function BVList({ items }) {
  return (
    <ul
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-base)',
        lineHeight: 1.75,
        color: 'var(--neutral-800)',
        paddingLeft: '1.25rem',
        margin: 0,
        marginBottom: 'var(--space-4)',
      }}
    >
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 'var(--space-2)' }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function BVPainList({ items }) {
  return (
    <ol
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        marginBottom: 'var(--space-4)',
        borderTop: '1px solid var(--neutral-200)',
      }}
    >
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
            padding: 'var(--space-4) 0',
            borderBottom: '1px solid var(--neutral-200)',
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: '36px',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: 'var(--neutral-400)',
              letterSpacing: '0.05em',
              lineHeight: 1.7,
            }}
          >
            {String(i + 1).padStart(2, '0')}
          </div>
          <div
            style={{
              flex: 1,
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-base)',
              lineHeight: 1.7,
              color: 'var(--neutral-800)',
            }}
          >
            {item}
          </div>
        </li>
      ))}
    </ol>
  );
}

function BVPillar({ n, title, body }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-4)',
        padding: 'var(--space-4) 0',
        borderTop: '1px solid var(--neutral-200)',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: '32px',
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          color: 'var(--neutral-300)',
          lineHeight: 1,
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--neutral-900)',
            marginBottom: 'var(--space-2)',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            lineHeight: 1.7,
            color: 'var(--neutral-700)',
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

function BVToneTable({ rows }) {
  return (
    <div
      style={{
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <thead>
          <tr style={{ background: 'var(--neutral-50, #f7f4ee)' }}>
            <BVTh width="22%">Context</BVTh>
            <BVTh width="32%">Tone</BVTh>
            <BVTh>Example</BVTh>
          </tr>
        </thead>
        <tbody>
          {rows.map(([ctx, tone, ex], i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--neutral-200)' }}>
              <BVTd>
                <strong style={{ color: 'var(--neutral-900)' }}>{ctx}</strong>
              </BVTd>
              <BVTd color="var(--neutral-700)">{tone}</BVTd>
              <BVTd color="var(--neutral-800)">
                <em>{ex}</em>
              </BVTd>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BVDoDontTable({ rows }) {
  return (
    <div
      style={{
        border: '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <thead>
          <tr style={{ background: 'var(--neutral-50, #f7f4ee)' }}>
            <BVTh width="50%">
              <span style={{ color: '#8b2d2d' }}>Off-brand</span>
            </BVTh>
            <BVTh width="50%">
              <span style={{ color: 'var(--primary)' }}>On-brand</span>
            </BVTh>
          </tr>
        </thead>
        <tbody>
          {rows.map(([off, on], i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--neutral-200)' }}>
              <BVTd color="var(--neutral-500)">
                <span style={{ textDecoration: 'line-through' }}>{off}</span>
              </BVTd>
              <BVTd color="var(--neutral-900)">{on}</BVTd>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BVBannedGrid({ items }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
      }}
    >
      {items.map((word, i) => (
        <div
          key={i}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-600)',
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--neutral-100)',
            border: '1px solid var(--neutral-200)',
            borderRadius: 'var(--radius)',
            textDecoration: 'line-through',
            textDecorationColor: '#8b2d2d',
          }}
        >
          {word}
        </div>
      ))}
    </div>
  );
}

function BVTagline({ rank, line, note, recommended }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-3)',
        background: recommended ? 'var(--accent-green-light, #e8ebe0)' : 'var(--neutral-100)',
        border: recommended ? '1px solid var(--primary)' : '1px solid var(--neutral-200)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-xl)',
          fontWeight: 700,
          color: recommended ? 'var(--primary)' : 'var(--neutral-400)',
          width: '24px',
          lineHeight: 1.2,
        }}
      >
        {rank}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--neutral-900)',
            marginBottom: 'var(--space-1)',
          }}
        >
          {line}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--neutral-600)',
            lineHeight: 1.6,
          }}
        >
          {note}
        </div>
      </div>
    </div>
  );
}

function BVCallout({ children, strong }) {
  return (
    <div
      style={{
        padding: 'var(--space-5)',
        background: strong ? 'var(--neutral-900)' : 'var(--neutral-100)',
        color: strong ? 'white' : 'var(--neutral-800)',
        borderLeft: strong ? 'none' : '3px solid var(--primary)',
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-body)',
        fontSize: strong ? 'var(--text-base)' : 'var(--text-sm)',
        lineHeight: 1.7,
        marginBottom: 'var(--space-4)',
      }}
    >
      {children}
    </div>
  );
}

function BVTh({ children, width }) {
  return (
    <th
      style={{
        textAlign: 'left',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--neutral-600)',
        padding: 'var(--space-3)',
        width,
      }}
    >
      {children}
    </th>
  );
}

function BVTd({ children, color }) {
  return (
    <td
      style={{
        padding: 'var(--space-3)',
        verticalAlign: 'top',
        color: color || 'var(--neutral-900)',
        lineHeight: 1.6,
      }}
    >
      {children}
    </td>
  );
}

// ---------------- To-Do & Future Ideas ----------------

function ToDoDoc() {
  return (
    <div className="td-host">
      <ToDoStyles />

      <header className="td-hero">
        <div className="td-eyebrow">Map My Research</div>
        <h1 className="td-title">To-Do &amp; Future Ideas</h1>
        <p className="td-lead">
          Pending work and captured ideas.  Things land here so they don&apos;t sit in a chat thread or get lost.
        </p>
      </header>

      <ToDoSection
        eyebrow="Pending"
        title="To Do"
        items={[
          {
            title: 'Landing page: FAQ section',
            body: 'Add an FAQ accordion or simple Q&A list to the marketing homepage. Cover the high-friction questions that block conversion: imports from Zotero / Mendeley / EndNote (planned), exporting your library (planned), mobile app (planned), what happens to your data if you cancel, pricing tiers and the 300-article free limit, and how concept-definition generation works. Sit between the Founder note and the final CTA.',
            tags: ['homepage', 'marketing'],
            captured: '2026-04-26',
          },
          {
            title: 'Inline-editable long-form fields on concept show page',
            body: 'Make each long-form field (description, examples, history, location, etymology, school of thought, clinical relevance, controversy, misconceptions, developmental notes, measurement notes) editable inline.  Plain-text fields: click to swap into a textarea, blur to PATCH /concepts/:id.  Rich-text fields: open a small inline TipTap editor.  Once shipped, the modal can shrink to label + type + summary only.',
            tags: ['concepts', 'show page'],
            captured: '2026-04-26',
          },
          {
            title: 'Shared RichTextField helper for the 6 TipTap instances in ConceptFormModal',
            body: 'Currently the form modal has 6 TipTap editor instances (summary, description, examples, history, plus two more) each with their own toolbar, hover state, and FontAwesome icon imports.  Extract a single RichTextField component that takes a value + onChange, owns its toolbar, and uses SVG icons to match the rest of the new design system.  Saves ~300 lines of duplication and removes a FontAwesome dependency from this surface.',
            tags: ['concepts', 'modal', 'cleanup'],
            captured: '2026-04-26',
          },
          {
            title: 'Mobile/iPad responsive sweep across all rebranded pages',
            body: 'Test every Rebrand-done route at 375px, 414px, 768px (iPad portrait), and 1024px (iPad landscape).  Mark each in the Mobile and iPad columns of the page audit.  Especially attention: ConceptFormModal tab rail at narrow widths, ConceptShow tile grids, dashboard secondary stats wrap, search filters bar.',
            tags: ['responsive', 'audit'],
            captured: '2026-04-26',
          },
          {
            title: 'Bulk upload page (/uploads) rebrand to source-blue system',
            body: 'BulkUploadWizard and its phases (UploadPhase, ProcessingPhase, ReviewPhase, CompletePhase) plus the Author and Concept resolution sections still use the old visual system: Font Awesome icons, accent-blue/green/purple/maroon colored section headers, old button classes.  Bring it in line with the new sources-page system: source-blue accents, MagicSparkles for any Haiku-driven actions (auto-tag methods runs server-side already in CreateSourceFromUploadJob, but the review phase could still expose a re-tag button), title-case labels, grey themeColor for Tags/Collections selectors, the new label/grid spacing.  Keep the Phase wizard logic untouched — this is purely cosmetic.',
            tags: ['bulk upload', 'rebrand'],
            captured: '2026-04-26',
          },
          {
            title: 'Admin API cost tracking + per-user rollups',
            body: 'New admin page (/admin/api_usage or similar) that logs every Anthropic call: timestamp, user_id, task (research_type_tag, concept_suggestion, author_suggestion, concept_definition_generation, etc.), prompt_tokens, completion_tokens, model, computed_cost_cents.  Backed by a new ApiCall model with indexes on user_id and created_at.  Rollups: cost-per-user (last 30d), cost-per-task-type, cost-per-tier (free/storage/unlimited) so we can verify margins.  Power users approaching their cap surface in a watch-list.  Wrap calls through a thin instrumenting helper so every service logs through one place.',
            tags: ['admin', 'observability', 'monetization'],
            captured: '2026-04-27',
          },
          {
            title: 'Enable Stripe Tax for subscription invoices',
            body: 'Subscriptions currently invoice without sales-tax / VAT calculation.  Once revenue clears the relevant threshold (most US states have economic-nexus triggers around $100K or 200 transactions; EU VAT applies from the first euro to a customer in those countries; UK VAT from £85K of UK sales), enable Stripe Tax in the Stripe dashboard and turn on tax behavior on the Storage and Unlimited products.  Verify the tax line shows on the next invoice and receipt.  No code change is required if Stripe Tax is enabled on the products themselves.  If we want per-customer tax overrides for institutional customers (B2B with valid VAT IDs or resale certs), add tax_id_collection: { enabled: true } to the Checkout session creation in SubscriptionsController#create and enable tax-ID collection in the Stripe Customer Portal config.  Until then, prices on the marketing page are net of tax — note that on the subscribe page if regulators get strict (UK and EU expect tax-inclusive consumer pricing).',
            tags: ['monetization', 'compliance', 'stripe'],
            captured: '2026-04-27',
          },
          {
            title: 'Source citation-count enrichment from Crossref / Scholar',
            body: 'Background job that pings Crossref (free, DOI-keyed) for each source with a DOI and stores the returned citation count on the Source record.  Display on the source show page as a credibility/popularity signal — "Cited 1,247 times" pill near the kind chip, or in the right sidebar stats.  Re-run on a slow cadence (monthly?) so counts stay roughly fresh.  Crossref has rate limits but free; Semantic Scholar is an alternative when DOI is missing.  Skip for non-academic kinds (book chapter, working paper, etc.) where the count is meaningless.',
            tags: ['enrichment', 'sources'],
            captured: '2026-04-27',
          },
        ]}
        emptyText="Nothing pending right now."
      />

      <ToDoSection
        eyebrow="Captured for later"
        title="Future Ideas"
        items={[
          {
            title: 'Automatic relationship creation/detection for concepts',
            body: 'Trigger Haiku to sweep the whole library and propose relationships, either from the /concepts index page or as a follow-up to PDF ingestion.  Keep as "suggest, then review."  Never auto-create.  Async job into a review queue at /concepts/suggestions.  Cap each run at ~200 concepts with a cost preview.  Remember dismissals so re-running the sweep does not surface the same rejected pairs.',
            tags: ['index', 'on input'],
            captured: '2026-04-26',
          },
          {
            title: 'Institutional / B2B sales of curated concept bundles',
            body: 'Future B2B revenue line: build a "curated bundle" framework on top of ConceptDefinition (pre-generated definitions grouped by domain, e.g., "DSM-5 in 200 concepts" or "Neuroanatomy 101") and license to medical schools, board-prep services, dissertation programs.  Different price point ($500-$5K per institution), different sales channel.  Originally the consumer "Pack" feature was this framework, removed when we moved to subscription + on-demand generation; if we revisit this, build a fresh bundle/license model — do NOT resurrect the old Pack tables (they were tightly coupled to checkout, user_packs, and the consumer marketplace flow we cut).',
            tags: ['monetization', 'b2b'],
            captured: '2026-04-27',
          },
        ]}
      />
    </div>
  );
}

function ToDoSection({ eyebrow, title, items, emptyText }) {
  return (
    <section className="td-section">
      <div className="td-section-head">
        <div className="td-section-eyebrow">{eyebrow}</div>
        <h2 className="td-section-title">{title}</h2>
      </div>
      {items.length === 0 ? (
        <div className="td-empty">{emptyText || 'Nothing here yet.'}</div>
      ) : (
        <ol className="td-list">
          {items.map((item, i) => (
            <li key={i} className="td-item">
              <div className="td-item-head">
                <span className="td-item-n">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="td-item-title">{item.title}</h3>
                {item.tags && item.tags.length > 0 && (
                  <div className="td-item-tags">
                    {item.tags.map((t) => (
                      <span key={t} className="td-item-tag">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {item.body && <p className="td-item-body">{item.body}</p>}
              {item.captured && (
                <div className="td-item-meta">Captured {item.captured}</div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ToDoStyles() {
  return (
    <style>{`
      .td-host {
        max-width: 820px;
        margin: 0 auto;
        font-family: var(--font-body);
      }

      .td-hero {
        margin-bottom: 32px;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--ink-line);
      }
      .td-eyebrow {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 10px;
      }
      .td-title {
        font-family: var(--font-display);
        font-size: 36px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: -0.02em;
        line-height: 1.05;
        margin: 0 0 12px;
      }
      .td-lead {
        font-family: var(--font-body);
        font-size: 15px;
        color: var(--ink-2);
        line-height: 1.65;
        margin: 0;
        max-width: 620px;
      }

      .td-section { margin-bottom: 36px; }
      .td-section-head { margin-bottom: 14px; }
      .td-section-eyebrow {
        font-family: var(--font-body);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 4px;
      }
      .td-section-title {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 600;
        color: var(--ink);
        letter-spacing: -0.01em;
        line-height: 1.2;
        margin: 0;
      }

      .td-empty {
        padding: 22px 24px;
        background: var(--paper-soft);
        border: 1px dashed var(--ink-line);
        border-radius: var(--r-md);
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink-3);
        text-align: center;
      }

      .td-list { list-style: none; margin: 0; padding: 0; }
      .td-item {
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        padding: 18px 20px;
        margin-bottom: 12px;
      }
      .td-item-head {
        display: flex;
        align-items: baseline;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .td-item-n {
        font-family: var(--font-display);
        font-size: 13px;
        font-weight: 600;
        color: var(--ink-4);
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
        flex-shrink: 0;
      }
      .td-item-title {
        font-family: var(--font-display);
        font-size: 16px;
        font-weight: 600;
        color: var(--ink);
        margin: 0;
        flex: 1;
        line-height: 1.3;
      }
      .td-item-tags { display: flex; gap: 4px; flex-shrink: 0; }
      .td-item-tag {
        font-family: var(--font-body);
        font-size: 10.5px;
        color: var(--ink-3);
        background: var(--paper-warm);
        padding: 2px 8px;
        border-radius: var(--r-sm);
      }
      .td-item-body {
        font-family: var(--font-body);
        font-size: 13.5px;
        color: var(--ink-2);
        line-height: 1.65;
        margin: 0 0 8px;
      }
      .td-item-meta {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--ink-3);
      }
    `}</style>
  );
}
