import React, { useRef, useEffect } from 'react';

export default function RichTextEditor({ value, onChange, placeholder, rows = 4, themeColor = 'var(--accent-blue)' }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const applyFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const minHeight = `${rows * 1.5}rem`;

  return (
    <div style={{
      border: '1px solid var(--neutral-300)',
      borderRadius: 'var(--radius)',
      background: 'white',
      fontFamily: 'var(--font-body)'
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-1)',
        padding: 'var(--space-2)',
        borderBottom: '1px solid var(--neutral-200)',
        background: 'var(--neutral-50)',
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => applyFormat('bold')}
          style={{
            padding: 'var(--space-1) var(--space-2)',
            fontSize: 'var(--text-sm)',
            border: `1px solid ${themeColor}`,
            borderRadius: 'var(--radius)',
            background: 'white',
            color: themeColor,
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'var(--font-body)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = themeColor;
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = themeColor;
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = `2px solid ${themeColor}`;
            e.currentTarget.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${themeColor} 10%, transparent)`;
            e.currentTarget.style.padding = 'calc(var(--space-1) - 1px) calc(var(--space-2) - 1px)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = `1px solid ${themeColor}`;
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.padding = 'var(--space-1) var(--space-2)';
          }}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => applyFormat('italic')}
          style={{
            padding: 'var(--space-1) var(--space-2)',
            fontSize: 'var(--text-sm)',
            border: `1px solid ${themeColor}`,
            borderRadius: 'var(--radius)',
            background: 'white',
            color: themeColor,
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'var(--font-body)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = themeColor;
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = themeColor;
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = `2px solid ${themeColor}`;
            e.currentTarget.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${themeColor} 10%, transparent)`;
            e.currentTarget.style.padding = 'calc(var(--space-1) - 1px) calc(var(--space-2) - 1px)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = `1px solid ${themeColor}`;
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.padding = 'var(--space-1) var(--space-2)';
          }}
          title="Italic"
        >
          <em>I</em>
        </button>
        <div style={{ width: '1px', background: 'var(--neutral-300)', margin: '0 var(--space-1)' }}></div>
        <button
          type="button"
          onClick={() => applyFormat('formatBlock', '<h3>')}
          style={{
            padding: 'var(--space-1) var(--space-2)',
            fontSize: 'var(--text-xs)',
            border: `1px solid ${themeColor}`,
            borderRadius: 'var(--radius)',
            background: 'white',
            color: themeColor,
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'var(--font-body)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = themeColor;
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = themeColor;
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = `2px solid ${themeColor}`;
            e.currentTarget.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${themeColor} 10%, transparent)`;
            e.currentTarget.style.padding = 'calc(var(--space-1) - 1px) calc(var(--space-2) - 1px)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = `1px solid ${themeColor}`;
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.padding = 'var(--space-1) var(--space-2)';
          }}
          title="Heading"
        >
          H
        </button>
        <button
          type="button"
          onClick={() => applyFormat('formatBlock', '<p>')}
          style={{
            padding: 'var(--space-1) var(--space-2)',
            fontSize: 'var(--text-xs)',
            border: `1px solid ${themeColor}`,
            borderRadius: 'var(--radius)',
            background: 'white',
            color: themeColor,
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'var(--font-body)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = themeColor;
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = themeColor;
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = `2px solid ${themeColor}`;
            e.currentTarget.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${themeColor} 10%, transparent)`;
            e.currentTarget.style.padding = 'calc(var(--space-1) - 1px) calc(var(--space-2) - 1px)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = `1px solid ${themeColor}`;
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.padding = 'var(--space-1) var(--space-2)';
          }}
          title="Paragraph"
        >
          P
        </button>
        <div style={{ width: '1px', background: 'var(--neutral-300)', margin: '0 var(--space-1)' }}></div>
        <button
          type="button"
          onClick={() => applyFormat('removeFormat')}
          style={{
            padding: 'var(--space-1) var(--space-2)',
            fontSize: 'var(--text-xs)',
            border: `1px solid ${themeColor}`,
            borderRadius: 'var(--radius)',
            background: 'white',
            color: themeColor,
            cursor: 'pointer',
            transition: 'all 0.15s',
            fontFamily: 'var(--font-body)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = themeColor;
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = themeColor;
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = `2px solid ${themeColor}`;
            e.currentTarget.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${themeColor} 10%, transparent)`;
            e.currentTarget.style.padding = 'calc(var(--space-1) - 1px) calc(var(--space-2) - 1px)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = `1px solid ${themeColor}`;
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.padding = 'var(--space-1) var(--space-2)';
          }}
          title="Clear formatting"
        >
          Clear
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="rich-text-editor"
        style={{
          width: '100%',
          padding: 'var(--space-4)',
          minHeight,
          outline: 'none',
          lineHeight: 1.6,
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)'
        }}
        onFocus={(e) => {
          e.currentTarget.parentElement.style.border = `2px solid ${themeColor}`;
          e.currentTarget.parentElement.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${themeColor} 10%, transparent)`;
        }}
        onBlur={(e) => {
          e.currentTarget.parentElement.style.border = '1px solid var(--neutral-300)';
          e.currentTarget.parentElement.style.boxShadow = 'none';
        }}
        data-placeholder={placeholder}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
          .rich-text-editor:empty:before {
            content: attr(data-placeholder);
            color: var(--neutral-400);
          }
          .rich-text-editor h3 {
            font-weight: 600;
            font-size: 0.95em;
            margin-top: 0.75em;
            margin-bottom: 0.5em;
            font-family: var(--font-body);
          }
          .rich-text-editor p {
            margin-bottom: 0.5em;
          }
        `
      }} />
    </div>
  );
}
