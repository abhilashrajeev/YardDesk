import { ReactNode, useEffect } from 'react';

/** Centered popup overlay for view/edit panels — click the backdrop, press Escape,
 *  or use the Close button to dismiss. Replaces the old pattern of rendering these
 *  panels inline at the bottom of the page, which needed scrolling to reach. */
export default function Modal({
  title,
  onClose,
  children,
  maxWidth = 640,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '5vh 16px',
        overflowY: 'auto',
        zIndex: 1000,
      }}
    >
      <div
        className="panel"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth, margin: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
          <button type="button" className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
        <div className="body" style={{ overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
