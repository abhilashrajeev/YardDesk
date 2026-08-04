import { ReactNode } from 'react';
import Modal from './Modal';

/** Thin wrapper kept so SaleDetail/PurchaseDetail don't need to change their imports —
 *  view/edit renders as a centered popup instead of inline at the bottom of the page. */
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
    <Modal title={title} onClose={onClose}>
      {children}
    </Modal>
  );
}
