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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [conceptsRes, sourcesRes, peopleRes, connectionsRes, notesRes, tagsRes] = await Promise.all([
        fetch('/concepts.json'),
        fetch('/sources.json'),
        fetch('/people.json'),
        fetch('/connections.json'),
        fetch('/notes.json'),
        fetch('/tags.json')
      ]);

      const [concepts, sources, people, connections, notes, tags] = await Promise.all([
        conceptsRes.json(),
        sourcesRes.json(),
        peopleRes.json(),
        connectionsRes.json(),
        notesRes.json(),
        tagsRes.json()
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

  if (loading) {
    return (
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: 'var(--space-8)',
        fontFamily: 'var(--font-body)',
        color: 'var(--neutral-600)'
      }}>
        Loading dashboard...
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1280px',
      margin: '0 auto',
      padding: 'var(--space-6)',
      paddingTop: 'var(--space-8)',
      paddingBottom: 'var(--space-8)'
    }}>
      {/* Header */}
      <h1 style={{
        fontSize: 'var(--text-4xl)',
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color: 'var(--neutral-900)',
        marginBottom: 'var(--space-8)'
      }}>
        Dashboard
      </h1>

      {/* Quick Add Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-8)'
      }}>
        <StatActionCard
          label="Concepts"
          subtitle="Knowledge constructs"
          value={stats.totalConcepts}
          link="/concepts"
          onAdd={() => setShowConceptModal(true)}
          color="var(--accent-green)"
          icon="fa-lightbulb"
        />
        <StatActionCard
          label="Sources"
          subtitle="References & resources"
          value={stats.totalSources}
          link="/sources"
          onAdd={() => setShowSourceModal(true)}
          color="var(--accent-blue)"
          icon="fa-book"
        />
        <StatActionCard
          label="People"
          subtitle="Authors & researchers"
          value={stats.totalPeople}
          link="/people"
          onAdd={() => setShowPersonModal(true)}
          color="var(--accent-gold)"
          icon="fa-user"
        />
        <StatActionCard
          label="Notes"
          subtitle="Insights & reflections"
          value={stats.totalNotes}
          link="/notes"
          onAdd={() => setShowNoteModal(true)}
          color="var(--accent-teal)"
          icon="fa-sticky-note"
        />
        <StatActionCard
          label="Tags"
          subtitle="Organizing labels"
          value={stats.totalTags}
          link="/tags"
          onAdd={() => setShowTagModal(true)}
          color="var(--accent-purple)"
          icon="fa-tag"
        />
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
      <ConceptRelationshipMap />
    </div>
  );
}

function StatActionCard({ label, subtitle, value, link, onAdd, color, icon }) {
  return (
    <div className="card" style={{
      padding: 'var(--space-4)',
      position: 'relative',
      transition: 'all 0.15s',
      borderLeft: `5px solid ${color}`,
      cursor: 'pointer'
    }}>
      <a href={link} style={{ textDecoration: 'none', display: 'block' }}>
        {/* Number at top left */}
        <div style={{
          fontSize: 'var(--text-4xl)',
          fontWeight: 300,
          fontFamily: 'var(--font-display)',
          color: 'var(--neutral-900)',
          marginBottom: 'var(--space-3)',
          lineHeight: 1
        }}>
          {value}
        </div>

        {/* Icon + Label */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-1)'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 'var(--text-xs)',
            flexShrink: 0
          }}>
            <i className={`fas ${icon}`}></i>
          </div>
          <div style={{
            fontSize: 'var(--text-base)',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            color: 'var(--neutral-900)'
          }}>
            {label}
          </div>
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--neutral-500)',
          fontFamily: 'var(--font-body)',
          paddingLeft: 'calc(24px + var(--space-2))',
          lineHeight: 1.2
        }}>
          {subtitle}
        </div>
      </a>
      {onAdd && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd();
          }}
          style={{
            position: 'absolute',
            top: 'var(--space-3)',
            right: 'var(--space-3)',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: color,
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontSize: 'var(--text-sm)',
            boxShadow: 'var(--shadow-sm)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
          title={`Add ${label.slice(0, -1)}`}
        >
          <i className="fas fa-plus"></i>
        </button>
      )}
    </div>
  );
}
