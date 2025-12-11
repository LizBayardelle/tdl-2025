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
          {/* Close button in absolute top right corner */}
          <button
            onClick={onClose}
            className="absolute top-2 right-4 !text-olive text-3xl leading-none !bg-transparent hover:opacity-80 z-10"
            type="button"
          >
            ×
          </button>

          {/* Header */}
          <div className="bg-sand border-b border-gray-300">
            <div className={`${sizeClasses[size]} mx-auto px-6 py-6`}>
              <h3 className="text-3xl font-medium text-center">{title}</h3>
            </div>
          </div>

          {/* Body */}
          <div className="bg-white">
            <div className={`${sizeClasses[size]} mx-auto px-6 pt-6 pb-4 max-h-[70vh] overflow-y-auto`}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
