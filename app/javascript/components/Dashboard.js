import React, { useState, useEffect } from 'react';
import ConceptRelationshipMap from './ConceptRelationshipMap';
import ConceptFormModal from './ConceptFormModal';
import SourceFormModal from './SourceFormModal';
import PersonFormModal from './PersonFormModal';
import NoteFormModal from './NoteFormModal';
import TagFormModal from './TagFormModal';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
    // Update time every minute
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [conceptsRes, sourcesRes, peopleRes, connectionsRes, notesRes, tagsRes, collectionsRes] = await Promise.all([
        fetch('/concepts.json'),
        fetch('/sources.json'),
        fetch('/people.json'),
        fetch('/connections.json'),
        fetch('/notes.json'),
        fetch('/tags.json'),
        fetch('/collections.json')
      ]);

      const [concepts, sources, people, connections, notes, tags, collections] = await Promise.all([
        conceptsRes.json(),
        sourcesRes.json(),
        peopleRes.json(),
        connectionsRes.json(),
        notesRes.json(),
        tagsRes.json(),
        collectionsRes.json()
      ]);

      // Calculate stats
      const conceptsByType = concepts.reduce((acc, concept) => {
        acc[concept.node_type] = (acc[concept.node_type] || 0) + 1;
        return acc;
      }, {});

      const conceptsByStatus = concepts.reduce((acc, concept) => {
        const status = concept.level_status || 'mapped';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const needsReview = concepts.filter(c => {
        if (!c.last_reviewed_on) return true;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return new Date(c.last_reviewed_on) < thirtyDaysAgo;
      }).length;

      setStats({
        totalConcepts: concepts.length,
        totalSources: sources.length,
        totalPeople: people.length,
        totalConnections: connections.length,
        totalNotes: notes.length,
        totalTags: tags.length,
        totalCollections: collections.length,
        totalPdfs: sources.filter(s => s.pdf_url).length,
        conceptsByType,
        conceptsByStatus,
        needsReview,
        pinnedNotes: notes.filter(n => n.pinned).length
      });

      // Combine recent activity
      const activity = [
        ...concepts.slice(0, 5).map(c => ({ type: 'concept', item: c, date: c.updated_at })),
        ...notes.slice(0, 5).map(n => ({ type: 'note', item: n, date: n.created_at })),
        ...connections.slice(0, 5).map(c => ({ type: 'connection', item: c, date: c.created_at }))
      ]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);

      setRecentActivity(activity);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).toUpperCase();
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (loading) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 64px)',
        background: '#e2e2e2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        color: 'var(--neutral-600)',
        fontSize: 'var(--text-lg)',
        letterSpacing: '0.1em'
      }}>
        LOADING ARCHIVES...
      </div>
    );
  }

  const totalItems = stats.totalConcepts + stats.totalSources + stats.totalPeople + stats.totalNotes + stats.totalTags;

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      background: '#e2e2e2',
    }}>
      <DashboardStyles />
      {/* Status Bar */}
      <div className="dashboard-status-bar">
        <span>RECORDS: {totalItems.toLocaleString()}</span>
        <span>PDFS: {stats.totalPdfs.toLocaleString()}</span>
      </div>

      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="dashboard-header-date">
            {formatDate(currentTime)} {formatTime(currentTime)}
          </div>
          <h1 className="dashboard-header-title">
            Dashboard
          </h1>
        </div>

        {/* Dossier Cards Grid */}
        <div className="dashboard-cards-grid">
          <DossierCard
            label="Concepts"
            code="Concepts"
            value={stats.totalConcepts}
            link="/concepts"
            onAdd={() => setShowConceptModal(true)}
            color="var(--accent-green)"
            icon="fa-lightbulb"
          />
          <DossierCard
            label="Sources"
            code="Sources"
            value={stats.totalSources}
            link="/sources"
            onAdd={() => setShowSourceModal(true)}
            color="var(--accent-blue)"
            icon="fa-book"
          />
          <DossierCard
            label="People"
            code="People"
            value={stats.totalPeople}
            link="/people"
            onAdd={() => setShowPersonModal(true)}
            color="var(--accent-gold)"
            icon="fa-user"
          />
          <DossierCard
            label="Notes"
            code="Notes"
            value={stats.totalNotes}
            link="/notes"
            onAdd={() => setShowNoteModal(true)}
            color="var(--accent-teal)"
            icon="fa-sticky-note"
          />
          <DossierCard
            label="Tags"
            code="Tags"
            value={stats.totalTags}
            link="/tags"
            onAdd={() => setShowTagModal(true)}
            color="var(--accent-purple)"
            icon="fa-tag"
          />
        </div>

        {/* Quick Stats Row */}
        <div className="dashboard-quick-stats">
          <div className="dashboard-quick-stats-left">
            <QuickStat label="Pinned Notes" value={stats.pinnedNotes} />
            <QuickStat label="Total Connections" value={stats.totalConnections} />
            <QuickStat label="Collections" value={stats.totalCollections} />
          </div>
          <div className="dashboard-quick-stats-right">
            USER SINCE: {currentTime.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
          </div>
        </div>

        {/* Modals */}
        <ConceptFormModal
          isOpen={showConceptModal}
          onClose={() => setShowConceptModal(false)}
          onSuccess={() => {
            fetchDashboardData();
            setShowConceptModal(false);
          }}
        />
        <SourceFormModal
          isOpen={showSourceModal}
          onClose={() => setShowSourceModal(false)}
          onSuccess={() => {
            fetchDashboardData();
            setShowSourceModal(false);
          }}
        />
        <PersonFormModal
          isOpen={showPersonModal}
          onClose={() => setShowPersonModal(false)}
          onSuccess={() => {
            fetchDashboardData();
            setShowPersonModal(false);
          }}
        />
        <NoteFormModal
          isOpen={showNoteModal}
          onClose={() => setShowNoteModal(false)}
          onSuccess={() => {
            fetchDashboardData();
            setShowNoteModal(false);
          }}
        />
        <TagFormModal
          isOpen={showTagModal}
          onClose={() => setShowTagModal(false)}
          onSuccess={() => {
            fetchDashboardData();
            setShowTagModal(false);
          }}
        />

        {/* Concept Relationship Map */}
        <div style={{
          background: 'white',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--neutral-800)',
            color: 'var(--neutral-300)',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.15em',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>RELATIONSHIP MATRIX</span>
            <span style={{ color: 'var(--neutral-500)' }}>INTERACTIVE</span>
          </div>
          <ConceptRelationshipMap />
        </div>
      </div>
    </div>
  );
}

function DossierCard({ label, code, value, link, onAdd, color, icon }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        transition: 'transform 0.2s',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Folder Tab */}
      <div
        className="dossier-tab"
        style={{
          background: color,
        }}
      >
        {code}
      </div>

      {/* Card Body */}
      <a
        href={link}
        style={{
          textDecoration: 'none',
          display: 'block',
        }}
      >
        <div style={{
          background: `color-mix(in srgb, ${color} 15%, white)`,
          border: '1px solid var(--neutral-300)',
          borderTop: `5px solid ${color}`,
          borderRadius: '0 4px 4px 4px',
          padding: 'var(--space-5)',
          paddingTop: 'var(--space-6)',
          boxShadow: isHovered
            ? '0 8px 24px rgba(0,0,0,0.18), 2px 2px 0 rgba(0,0,0,0.05)'
            : '0 2px 8px rgba(0,0,0,0.1), 2px 2px 0 rgba(0,0,0,0.03)',
          transition: 'box-shadow 0.2s',
          position: 'relative',
          zIndex: 1,
          minHeight: '120px',
        }}>
          {/* Subtle paper lines */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'repeating-linear-gradient(transparent, transparent 23px, rgba(0,0,0,0.03) 24px)',
            pointerEvents: 'none',
            borderRadius: '0 4px 4px 4px',
          }} />

          {/* Number */}
          <div className="dossier-number">
            {value}
          </div>

          {/* Label with icon */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            paddingLeft: 'var(--space-2)',
          }}>
            <i
              className={`fas ${icon}`}
              style={{
                color: color,
                fontSize: 'var(--text-sm)',
              }}
            />
            <span style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              color: 'var(--neutral-700)',
            }}>
              {label}
            </span>
          </div>
        </div>
      </a>

      {/* Add Button */}
      {onAdd && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd();
          }}
          style={{
            position: 'absolute',
            bottom: 'var(--space-3)',
            right: 'var(--space-3)',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'white',
            color: color,
            border: `2px solid ${color}`,
            borderRadius: '50%',
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontSize: 'var(--text-sm)',
            boxShadow: 'var(--shadow-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = color;
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = color;
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={`Add ${label.slice(0, -1)}`}
        >
          <i className="fas fa-plus"></i>
        </button>
      )}
    </div>
  );
}

function QuickStat({ label, value, warning }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 'var(--space-2)',
    }}>
      <span style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 600,
        fontFamily: 'var(--font-display)',
        color: warning ? 'var(--accent-gold)' : 'var(--neutral-800)',
      }}>
        {value}
      </span>
      <span style={{
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-display)',
        color: 'var(--neutral-500)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  );
}

// Dashboard responsive styles
const DashboardStyles = () => (
  <style>{`
    .dashboard-status-bar {
      background: var(--neutral-800);
      color: var(--neutral-400);
      padding: 8px 24px;
      font-family: var(--font-display);
      font-size: var(--text-xs);
      letter-spacing: 0.15em;
      display: flex;
      gap: 24px;
      align-items: center;
      border-bottom: 2px solid var(--neutral-700);
    }

    .dashboard-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 32px;
    }

    .dashboard-header {
      margin-bottom: 24px;
    }

    .dashboard-header-date {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      letter-spacing: 0.2em;
      color: var(--neutral-500);
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .dashboard-header-title {
      font-size: var(--text-5xl);
      font-weight: 700;
      font-family: var(--font-display);
      color: var(--neutral-800);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .dashboard-cards-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 32px;
      padding-top: 24px;
    }

    .dashboard-quick-stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 32px;
      margin-bottom: 32px;
      padding: 10px 24px;
      background: white;
      border-radius: 4px;
      border: 1px solid var(--neutral-300);
    }

    .dashboard-quick-stats-left {
      display: flex;
      gap: 32px;
      align-items: center;
    }

    .dashboard-quick-stats-right {
      font-family: var(--font-display);
      font-size: var(--text-xs);
      color: var(--neutral-500);
      letter-spacing: 0.1em;
      white-space: nowrap;
    }

    /* Tablet breakpoint */
    @media (max-width: 1024px) {
      .dashboard-cards-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    /* Mobile breakpoint */
    @media (max-width: 768px) {
      .dashboard-container {
        padding: 16px;
      }

      .dashboard-header-title {
        font-size: var(--text-3xl);
      }

      .dashboard-header-date {
        font-size: 10px;
      }

      .dashboard-status-bar {
        padding: 8px 16px;
        font-size: 10px;
        gap: 16px;
      }

      .dashboard-cards-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        padding-top: 20px;
      }

      .dashboard-quick-stats {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 16px;
      }

      .dashboard-quick-stats-left {
        flex-wrap: wrap;
        gap: 16px;
      }

      .dashboard-quick-stats-right {
        width: 100%;
        text-align: left;
        padding-top: 8px;
        border-top: 1px solid var(--neutral-200);
      }
    }

    /* Small mobile breakpoint */
    @media (max-width: 480px) {
      .dashboard-cards-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .dashboard-quick-stats-right {
        display: none;
      }
    }

    /* Dossier Card styles */
    .dossier-tab {
      position: absolute;
      top: -18px;
      left: 12px;
      color: white;
      padding: 4px 12px 6px;
      font-family: var(--font-display);
      font-size: var(--text-xs);
      letter-spacing: 0.1em;
      border-radius: 3px 3px 0 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      z-index: 2;
    }

    .dossier-number {
      font-size: 48px;
      font-weight: 300;
      font-family: var(--font-display);
      color: var(--neutral-800);
      line-height: 1;
      margin-bottom: 8px;
      text-align: center;
    }

    @media (max-width: 768px) {
      .dossier-tab {
        top: -18px;
        padding: 3px 8px 4px;
        font-size: 10px;
      }

      .dossier-number {
        font-size: 36px;
      }
    }

    @media (max-width: 480px) {
      .dossier-number {
        font-size: 42px;
      }
    }
  `}</style>
);
