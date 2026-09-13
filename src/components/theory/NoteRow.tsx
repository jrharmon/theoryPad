import type { KeyMode } from '@/domain/music';
import { scaleDegrees, scaleNotes } from '@/domain/music';

/** A key's seven notes with their degrees, the ones in question filled. */
export function NoteRow({ keyMode, highlight }: { keyMode: KeyMode; highlight: readonly number[] }) {
  const notes = scaleNotes(keyMode);
  const degrees = scaleDegrees(keyMode);
  const all = highlight.length === notes.length;
  return (
    <div className="flex border border-rule" data-testid="note-row" role="img" aria-label="Notes of the key">
      {notes.map((note, i) => {
        // Every degree highlighted is the whole scale — show it plainly instead.
        const on = !all && highlight.includes(i + 1);
        return (
          <div
            key={note}
            className={[
              'flex flex-1 flex-col items-center gap-0.5 py-2',
              i > 0 ? 'border-l border-rule' : '',
              on ? 'bg-accent text-white' : '',
            ].join(' ')}
          >
            <span className="text-[15px] font-extrabold">{note}</span>
            <span className={`text-[11px] ${on ? 'text-white/85' : 'text-ink/55'}`}>{degrees[i]!.label}</span>
          </div>
        );
      })}
    </div>
  );
}
