import { useState } from 'react';
import type { MetronomeVoiceId } from '@/domain/drums';
import { patternById } from '@/domain/drums';
import type { TimeSignature } from '@/domain/phrase';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePractice } from '@/store/practice';
import { MenuOption } from './MenuOption';
import { metronomeChoices, metronomeHeard, metronomeTitle } from './metronomeChoices';

/**
 * Off, the click, or a drum beat that fits the phrase's signature — this
 * exercise's own, or in a routine this item's, and saved to it. Usable while
 * playing: the metronome runs one grid, so a new choice is heard from its next
 * step. `M` still turns it off and back on.
 */
export function MetronomeMenu() {
  const chosen = usePractice((s) => s.metronome);
  const timeSignature = usePractice((s) =>
    s.instance?.kind === 'played' ? s.instance.phrase.timeSignature : null,
  );
  const inRoutine = usePractice((s) => s.routineId !== null);
  // A track is the click: the metronome waits it out, and says why.
  const underTrack = usePractice((s) => s.backing.resolved.kind === 'video');
  const setVoice = usePractice((s) => s.setMetronomeVoice);
  const [open, setOpen] = useState(false);

  if (!timeSignature) return null;
  const heard = metronomeHeard(chosen, timeSignature);

  const pick = (id: MetronomeVoiceId) => {
    setOpen(false);
    void setVoice(id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          disabled={underTrack}
          title={
            underTrack ? 'Muted under a backing track' : 'Metronome  ( M turns it off and on )'
          }
          data-testid="metronome-menu"
        >
          <span className="text-ink-muted">Metronome</span>
          <span>{metronomeTitle(heard)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[340px] p-2">
        <ul className="space-y-0.5" role="listbox" aria-label="Metronome">
          {metronomeChoices(timeSignature).map((choice) => (
            <MenuOption
              key={choice.id}
              selected={choice.id === heard}
              title={choice.title}
              detail={choice.detail}
              onPick={() => pick(choice.id)}
            />
          ))}
        </ul>
        <p className="px-2 pt-2 pb-1 text-meta text-ink-muted">
          {heard !== chosen && `${unfitNote(chosen, timeSignature)} `}
          {inRoutine ? 'This item’s own, and kept.' : 'This exercise’s own, and kept.'} M turns
          it off and back on.
        </p>
      </PopoverContent>
    </Popover>
  );
}

const signature = (ts: TimeSignature) => `${ts.beats}/${ts.unit}`;

/** Why the beat you chose isn't the one playing. */
function unfitNote(chosen: MetronomeVoiceId, timeSignature: TimeSignature): string {
  const pattern = patternById(chosen.replace('drums-', ''));
  const written = pattern?.timeSignature ? ` for ${signature(pattern.timeSignature)}` : '';
  return `${pattern?.name ?? chosen} is written${written}, so Simple plays in ${signature(timeSignature)}.`;
}
