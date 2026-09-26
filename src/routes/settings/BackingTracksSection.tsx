import { useEffect, useState } from 'react';
import type { KeyMode, ModeName } from '@/domain/music';
import { modeTitle } from '@/domain/music';
import { formatVideoTime } from '@/domain/backing';
import { coverage, sameKeyMode, sharedTracks } from '@/data';
import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { KeyModeGrid } from '@/components/music/KeyModeGrid';
import { useVideos } from '@/store/videos';
import { TrackForm, type TrackFormTarget } from './TrackForm';

const SHARED = { kind: 'shared' } as const;

/**
 * The shared tracks: which keys and modes they cover, and the tracks
 * themselves. An exercise's own videos are managed on that exercise.
 */
export function BackingTracksSection() {
  const { videos, load } = useVideos();
  const [filter, setFilter] = useState<KeyMode | null>(null);
  const [editing, setEditing] = useState<TrackFormTarget | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const tracks = sharedTracks(videos);
  const shown = filter
    ? tracks.filter((t) => t.keyMode && sameKeyMode(t.keyMode, filter))
    : tracks;

  const pick = (keyMode: KeyMode) => {
    const matching = tracks.filter((t) => t.keyMode && sameKeyMode(t.keyMode, keyMode));
    if (matching.length === 0) {
      setEditing({
        scope: SHARED,
        fill: { tonic: keyMode.tonic, mode: keyMode.mode as ModeName },
      });
      return;
    }
    setFilter(filter && sameKeyMode(filter, keyMode) ? null : keyMode);
  };

  return (
    <div className="sheet mx-8 mb-4 px-6 py-5" data-testid="backing-tracks">
      <div className="flex items-baseline justify-between gap-4">
        <Kicker>Backing tracks</Kicker>
        <Button size="sm" onClick={() => setEditing({ scope: SHARED })}>
          Add a track
        </Button>
      </div>
      <p className="mt-2 max-w-[760px] text-body-sm text-ink-muted">
        Offered to any exercise or routine in the same key and mode. The grid shows which are
        covered — pick a filled cell to list its tracks, an empty one to add one there.
      </p>

      <div className="mt-4">
        <KeyModeGrid
          grid={coverage(videos)}
          selected={filter}
          onSelect={pick}
          unit={['track', 'tracks']}
          showCounts
          testId="coverage-grid"
        />
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <p className="text-body-sm font-semibold">
          {filter ? `${filter.tonic} ${modeTitle(filter.mode)}` : 'Every shared track'}
          <span className="font-normal text-ink-muted"> · {shown.length}</span>
        </p>
        {filter && (
          <Button variant="ghost" size="xs" onClick={() => setFilter(null)}>
            Show all
          </Button>
        )}
      </div>

      <ul className="mt-2 divide-y divide-ink/10" data-testid="track-list">
        {shown.map((track) => (
          <li key={track.id} className="flex items-center gap-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-semibold">{track.title}</p>
              <p className="text-meta text-ink-muted">
                {[
                  track.keyMode && `${track.keyMode.tonic} ${modeTitle(track.keyMode.mode)}`,
                  track.bpm !== undefined && `${track.bpm} bpm`,
                  track.progression,
                  `bar 1 at ${formatVideoTime(track.startSec)}`,
                  ...track.tags,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing({ video: track, scope: track.scope })}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>

      <TrackForm target={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
