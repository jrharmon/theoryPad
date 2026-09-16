import { CircleOfFifths } from '@/components/music';
import type { KeyMode } from '@/domain/music';
import { useSettings } from '@/store/settings';
import { SidePanel } from './SidePanel';

/** The key on the circle of fifths, in the right column: the room it had spare under the neck. */
export function CircleSheet({ keyMode }: { keyMode: KeyMode }) {
  const ui = useSettings((s) => s.settings.ui);
  const save = useSettings((s) => s.save);
  return (
    <SidePanel
      title="Circle of fifths"
      open={ui.showCircle !== false}
      onToggle={(open) => void save({ ui: { ...ui, showCircle: open } })}
    >
      <CircleOfFifths keyMode={keyMode} />
    </SidePanel>
  );
}
