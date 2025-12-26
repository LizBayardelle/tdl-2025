import React, { useRef, useEffect } from 'react';

export default function RichTextEditor({ value, onChange, placeholder, rows = 4 }) {
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
    <div className="border border-gray-300 rounded bg-white">
      {/* Toolbar */}
      <div className="flex gap-1 p-2 border-b border-gray-200 bg-sand">
        <button
          type="button"
          onClick={() => applyFormat('bold')}
          className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-white transition-colors"
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => applyFormat('italic')}
          className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-white transition-colors"
          title="Italic"
        >
          <em>I</em>
        </button>
        <div className="w-px bg-gray-300 mx-1"></div>
        <button
          type="button"
          onClick={() => applyFormat('formatBlock', '<h3>')}
          className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white transition-colors"
          title="Heading"
        >
          H
        </button>
        <button
          type="button"
          onClick={() => applyFormat('formatBlock', '<p>')}
          className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white transition-colors"
          title="Paragraph"
        >
          P
        </button>
        <div className="w-px bg-gray-300 mx-1"></div>
        <button
          type="button"
          onClick={() => applyFormat('removeFormat')}
          className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white transition-colors"
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
        className="w-full px-4 py-2 focus:outline-none leading-snug rich-text-editor"
        style={{ minHeight }}
        data-placeholder={placeholder}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
          .rich-text-editor:empty:before {
            content: attr(data-placeholder);
            color: #9ca3af;
          }
          .rich-text-editor h3 {
            font-weight: 600;
            font-size: 0.95em;
            margin-top: 0.75em;
            margin-bottom: 0.5em;
          }
          .rich-text-editor p {
            margin-bottom: 0.5em;
          }
        `
      }} />
    </div>
  );
}
