import React, { useState, useEffect, useRef } from 'react';

export default function UserDropdown({ userEmail }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/users/sign_out';

    const methodInput = document.createElement('input');
    methodInput.type = 'hidden';
    methodInput.name = '_method';
    methodInput.value = 'delete';

    const csrfToken = document.querySelector('[name="csrf-token"]').content;
    const csrfInput = document.createElement('input');
    csrfInput.type = 'hidden';
    csrfInput.name = 'authenticity_token';
    csrfInput.value = csrfToken;

    form.appendChild(methodInput);
    form.appendChild(csrfInput);
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <UserDropdownStyles />
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="ud-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Account menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          width="22"
          height="22"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="ud-menu" role="menu">
          <div className="ud-header">
            <div className="ud-header-eyebrow">Signed in as</div>
            <div className="ud-header-email" title={userEmail}>{userEmail}</div>
          </div>

          <div className="ud-group">
            <a href="/users/edit" className="ud-item" role="menuitem">
              <i className="fas fa-gear ud-item-icon" aria-hidden="true"></i>
              Settings
            </a>
            <a href="/subscription" className="ud-item" role="menuitem">
              <i className="fas fa-credit-card ud-item-icon" aria-hidden="true"></i>
              Subscription
            </a>
          </div>

          <div className="ud-group ud-group-divider">
            <button
              type="button"
              onClick={handleSignOut}
              className="ud-item ud-item-button"
              role="menuitem"
            >
              <i className="fas fa-arrow-right-from-bracket ud-item-icon" aria-hidden="true"></i>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserDropdownStyles() {
  return (
    <style>{`
      .ud-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 6px 8px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--r-sm);
        color: var(--primary);
        cursor: pointer;
        transition: background 0.12s, border-color 0.12s;
      }
      .ud-trigger:hover {
        background: var(--hover);
        border-color: var(--ink-line);
      }
      .ud-trigger:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 1px;
      }

      .ud-menu {
        position: absolute;
        right: 0;
        margin-top: 8px;
        width: 240px;
        background: var(--paper);
        border: 1px solid var(--ink-line);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-lg);
        z-index: 50;
        overflow: hidden;
        font-family: var(--font-body);
      }

      .ud-header {
        padding: 12px 14px;
        border-bottom: 1px solid var(--ink-line-soft);
        background: var(--paper-soft);
      }
      .ud-header-eyebrow {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-3);
        margin-bottom: 2px;
      }
      .ud-header-email {
        font-size: 13px;
        color: var(--ink);
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ud-group { padding: 4px; }
      .ud-group-divider {
        border-top: 1px solid var(--ink-line-soft);
      }

      .ud-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 8px 10px;
        border-radius: var(--r-sm);
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--ink);
        text-decoration: none;
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        transition: background 0.12s, color 0.12s;
      }
      .ud-item-button { font: inherit; }
      .ud-item:hover {
        background: var(--hover);
        color: var(--primary);
      }
      .ud-item-icon {
        width: 14px;
        text-align: center;
        font-size: 12px;
        color: var(--primary);
      }
    `}</style>
  );
}
