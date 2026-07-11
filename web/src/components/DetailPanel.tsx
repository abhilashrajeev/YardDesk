import { ReactNode } from 'react';

/**
 * Inline view/edit panel — renders in the page flow below the list, instead of a modal
 * popup. Used by SaleDetail/PurchaseDetail so viewing or editing a record doesn't cover
 * the rest of the page.
 */
export default function DetailPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="panel">
      <div className="between" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
        <button className="btn sm ghost" onClick={onClose}>Close</button>
      </div>
      <div className="body">{children}</div>
    </div>
  );
}
