import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { KeyMode } from '@/domain/music';
import { KeyModeTrigger } from '@/components/music';
import { useKeyModeView } from '@/store/keyModeView';

/**
 * The practice screens' key/mode reference, wired to the shared open state so
 * `K` toggles it and the transport's keys stand aside while it is up.
 */
export function ReferenceTrigger({
  keyMode,
  children,
  className,
}: {
  keyMode: KeyMode;
  children: ReactNode;
  className?: string;
}) {
  const { popover, sheet, setPopover, setSheet, setAvailable } = useKeyModeView();
  useEffect(() => {
    setAvailable(true);
    return () => setAvailable(false);
  }, [setAvailable]);

  return (
    <KeyModeTrigger
      keyMode={keyMode}
      popover={{ open: popover, onOpenChange: setPopover }}
      sheet={{ open: sheet, onOpenChange: setSheet }}
      {...(className ? { className } : {})}
    >
      {children}
    </KeyModeTrigger>
  );
}
