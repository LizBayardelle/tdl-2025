import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfPreview({ pdfUrl }) {
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(Math.max(200, containerRef.current.clientWidth - 24));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  if (!pdfUrl) return null;

  // Backstop: intercept link clicks from the annotation layer and force a new tab.
  // react-pdf's externalLinkTarget sometimes doesn't get applied to the rendered <a> tags.
  const handleClick = (e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#')) return; // let in-document jumps keep working
    e.preventDefault();
    e.stopPropagation();
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        background: 'var(--neutral-100)',
        padding: 'var(--space-2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<div style={{ padding: 'var(--space-4)', color: 'var(--neutral-600)' }}>Loading PDF…</div>}
        error={<div style={{ padding: 'var(--space-4)', color: 'var(--accent-red)' }}>Failed to load PDF.</div>}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i} style={{ marginBottom: 'var(--space-2)', boxShadow: 'var(--shadow-sm)' }}>
            <Page
              pageNumber={i + 1}
              width={containerWidth}
              externalLinkTarget="_blank"
              externalLinkRel="noopener noreferrer"
              renderTextLayer={false}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
