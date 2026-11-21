import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const { message, type = 'success' } = toast;
  const isError = type === 'error';
  const isInfo = type === 'info';

  const bgColor = isError ? '#fee2e2' : isInfo ? '#e0f2fe' : '#dcfce7';
  const textColor = isError ? '#991b1b' : isInfo ? '#075985' : '#166534';
  const borderColor = isError ? '#fecaca' : isInfo ? '#bae6fd' : '#bbf7d0';

  return (
    <div
      role="status"
      aria-live="polite"
      className="toast-container"
      style={{
        position: 'fixed',
        top: '4.5rem',
        right: '1.25rem',
        zIndex: 150,
        backgroundColor: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        padding: '0.75rem 1.1rem',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        fontWeight: 600,
        fontSize: '0.88rem',
        maxWidth: 'calc(100vw - 2.5rem)',
        animation: 'fadeIn 0.2s ease'
      }}
    >
      {isError ? (
        <AlertCircle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
      ) : isInfo ? (
        <Info size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
      ) : (
        <CheckCircle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
      )}
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss message"
          style={{
            color: 'inherit',
            padding: '0.2rem',
            marginLeft: '0.35rem',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

