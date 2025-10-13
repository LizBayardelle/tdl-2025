import React from 'react';

export default function Modal({ isOpen, onClose, title, children, size = 'medium' }) {
  if (!isOpen) return null;

  const sizeClasses = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
    xlarge: 'max-w-6xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ zIndex: 9999 }}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity"
          onClick={onClose}
          style={{ zIndex: 9998, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        ></div>

        {/* Modal panel */}
        <div
          className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full mx-auto"
          style={{ zIndex: 9999, maxWidth: '95vw' }}
        >
          <div className={`${sizeClasses[size]} mx-auto`}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
              <h3 className="text-xl font-medium">{title}</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 max-h-[70vh] overflow-y-auto bg-white">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
