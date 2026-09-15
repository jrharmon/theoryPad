import { CircleOfFifths } from '@/components/music';
import { Kicker } from '@/components/ui/kicker';
import type { KeyMode } from '@/domain/music';

/** The key on the circle of fifths, in the right column: the room it had spare under the neck. */
export function CircleSheet({ keyMode }: { keyMode: KeyMode }) {
  return (
    <div className="sheet px-5 pt-4 pb-[18px]">
      <Kicker>Circle of fifths</Kicker>
      <div className="mt-2">
        <CircleOfFifths keyMode={keyMode} />
      </div>
    </div>
  );
}
