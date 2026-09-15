import { useEffect, useState } from 'react';
import type { BackingCriteria, Exercise } from '@/data';
import { exerciseVideos } from '@/data';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Kicker } from '@/components/ui/kicker';
import { VideoEmbed } from '@/components/media/VideoEmbed';
import { useExercises } from '@/store/exercises';
import { useVideos } from '@/store/videos';
import { TrackForm, type TrackFormTarget } from '../settings/TrackForm';

/**
 * This exercise's own videos. Only it sees them. A reference video is watched,
 * never played along to; one with play-along on is a custom backing track,
 * offered first in the practice screen's backing menu.
 */
export function ExerciseVideos({ exercise, played }: { exercise: Exercise; played: boolean }) {
  const { videos, load } = useVideos();
  const [editing, setEditing] = useState<TrackFormTarget | null>(null);
  const scope = { kind: 'exercise', exerciseId: exercise.id } as const;

  useEffect(() => {
    void load();
  }, [load]);

  const own = exerciseVideos(videos, exercise.id);

  return (
    <div className="sheet px-5 py-4" data-testid="exercise-videos">
      <div className="flex items-baseline justify-between">
        <Kicker>Videos</Kicker>
        <Button variant="secondary" size="xs" onClick={() => setEditing({ scope })}>
          Add a video
        </Button>
      </div>
      <p className="mt-1 text-[12px] text-ink/64">
        {played
          ? 'Lessons and demos to watch, or tracks made for this exercise.'
          : 'Lessons and demos to watch.'}
      </p>
      <div className="mt-3 space-y-4">
        {own.map((video) => (
          <div key={video.id}>
            <VideoEmbed
              videoId={video.videoId}
              title={video.title}
              startSec={video.playAlong ? 0 : video.startSec}
              endSec={video.playAlong ? undefined : video.endSec}
            >
              <Button variant="secondary" size="xs" onClick={() => setEditing({ video, scope })}>
                Edit
              </Button>
            </VideoEmbed>
            {video.playAlong && (
              <p className="text-[12px] text-ink/64">
                Backing track{video.bpm !== undefined ? ` · ${video.bpm} bpm` : ''}
                {video.keyMode ? '' : ' · any key'}
              </p>
            )}
          </div>
        ))}
      </div>
      <TrackForm target={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/**
 * Narrow the shared tracks the backing menu offers this exercise: tags a track
 * must have, and a bpm range. New tracks that fit appear on their own.
 */
export function BackingCriteriaEditor({
  exercise,
  requiredTags = [],
}: {
  exercise: Exercise;
  /** Tags the exercise itself asks for, on top of these. Not editable here. */
  requiredTags?: readonly string[] | undefined;
}) {
  const update = useExercises((s) => s.update);
  const criteria: BackingCriteria = exercise.backingCriteria ?? { tags: [] };
  const [tags, setTags] = useState(criteria.tags.join(', '));

  const save = (next: BackingCriteria) => void update(exercise.id, { backingCriteria: next });
  // An open end is stored as 0 or 999, so the range stays plain JSON.
  const low = criteria.bpm?.min || null;
  const high = criteria.bpm && criteria.bpm.max < 999 ? criteria.bpm.max : null;
  const setBpm = (which: 'min' | 'max', value: string) => {
    const n = value.trim() === '' || !(Number(value) > 0) ? null : Number(value);
    const min = which === 'min' ? n : low;
    const max = which === 'max' ? n : high;
    const { bpm: _drop, ...rest } = criteria;
    save(min === null && max === null ? rest : { ...rest, bpm: { min: min ?? 0, max: max ?? 999 } });
  };

  return (
    <div className="sheet px-5 py-4" data-testid="backing-criteria">
      <Kicker>Backing tracks offered</Kicker>
      <p className="mt-1 text-[12px] text-ink/64">
        Shared tracks in the session’s key and mode. Narrow them here; this exercise’s own tracks
        are always offered.
      </p>
      <div className="mt-3 space-y-3">
        {requiredTags.length > 0 && (
          <p className="text-[13px]" data-testid="required-tags">
            <span className="text-ink/64">This exercise always asks for </span>
            {requiredTags.map((tag, i) => (
              <span key={tag}>
                {i > 0 && ', '}
                <span className="font-semibold">{tag}</span>
              </span>
            ))}
            <span className="text-ink/64">.</span>
          </p>
        )}
        <Field label="With these tags" htmlFor="criteria-tags" hint="Separated by commas. Empty offers every track.">
          <Input
            id="criteria-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            onBlur={() =>
              save({ ...criteria, tags: [...new Set(tags.split(',').map((t) => t.trim()).filter(Boolean))] })
            }
          />
        </Field>
        <div className="flex gap-2">
          <Field label="From bpm" htmlFor="criteria-min">
            <Input
              id="criteria-min"
              inputMode="numeric"
              className="w-[90px] tabular-nums"
              defaultValue={low ?? ''}
              onBlur={(e) => setBpm('min', e.target.value)}
            />
          </Field>
          <Field label="To bpm" htmlFor="criteria-max">
            <Input
              id="criteria-max"
              inputMode="numeric"
              className="w-[90px] tabular-nums"
              defaultValue={high ?? ''}
              onBlur={(e) => setBpm('max', e.target.value)}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
