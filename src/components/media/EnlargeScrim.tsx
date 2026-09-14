/** The same scrim as a dialog's, dark in both themes. */
export function EnlargeScrim({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-30 bg-black/50" aria-hidden onClick={onClose} />;
}
