import { useEffect, useMemo, useRef, useState } from 'react';
import type { Video, VideoScope } from '@/data';
import { tagsInUse } from '@/data';
import { MODE_NAMES, modeTitle, tonicsForMode } from '@/domain/music';
import type { ModeName } from '@/domain/music';
import { MIN_TAPS, formatVideoTime, parseVideoTime, parseYouTubeLink, tapTempo } from '@/domain/backing';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlayerSlot } from '@/components/media/PlayerSlot';
import { useYouTubePlayer } from '@/components/media/useYouTubePlayer';
import { useVideos } from '@/store/videos';
import { draftFromVideo, draftToVideo, emptyDraft, respell, type TrackDraft } from './trackDraft';

/** After this long without a tap, the next one starts a fresh run. */
const TAP_RESET_SEC = 3;
const ANY = '__any';

export interface TrackFormTarget {
  /** Editing this one; absent to add. */
  video?: Video;
  scope: VideoScope;
  fill?: Partial<TrackDraft>;
}

/**
 * Add or edit a video. The player sits in the form so bar 1 and the bpm can be
 * found by ear: tap along on the beat, from the first beat where the backing
 * kicks in.
 */
export function TrackForm({ target, onClose }: { target: TrackFormTarget | null; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target && (
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[760px]">
          <FormBody target={target} onClose={onClose} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function FormBody({ target, onClose }: { target: TrackFormTarget; onClose: () => void }) {
  const { videos, add, update, remove } = useVideos();
  const [draft, setDraft] = useState<TrackDraft>(() =>
    target.video ? draftFromVideo(target.video) : emptyDraft(target.scope, target.fill),
  );
  const change = (changes: Partial<TrackDraft>) => setDraft((d) => ({ ...d, ...changes }));

  const link = parseYouTubeLink(draft.link);
  const { player, error: playerError } = useYouTubePlayer(
    link?.videoId ?? null,
    parseVideoTime(draft.start) ?? 0,
  );
  const { video, problems } = draftToVideo(draft);
  const shared = draft.scope.kind === 'shared';
  const suggestions = useMemo(() => tagsInUse(videos), [videos]);

  const save = async () => {
    if (!video || problems.length > 0) return;
    if (target.video) await update(target.video.id, video);
    else await add(video);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{target.video ? 'Edit' : 'Add'} {shared ? 'a backing track' : 'a video'}</DialogTitle>
        <DialogDescription>
          {shared
            ? 'Shared tracks are offered to any exercise or routine in the same key and mode.'
            : 'Only this exercise sees it.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Field label="YouTube link" htmlFor="track-link">
          <Input
            id="track-link"
            value={draft.link}
            placeholder="https://www.youtube.com/watch?v=…"
            onChange={(e) => {
              const parsed = parseYouTubeLink(e.target.value);
              const start =
                parsed?.startSec !== undefined && (parseVideoTime(draft.start) ?? 0) === 0
                  ? formatVideoTime(parsed.startSec)
                  : draft.start;
              change({ link: e.target.value, start });
            }}
          />
        </Field>

        {link && (
          <div className="space-y-1">
            <PlayerSlot player={player} className="max-w-[560px]" />
            {playerError && <p className="text-[13px] text-destructive">{playerError}</p>}
          </div>
        )}

        {(shared || draft.playAlong) && (
          <Timing draft={draft} change={change} player={player} />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="track-title">
            <Input id="track-title" value={draft.title} onChange={(e) => change({ title: e.target.value })} />
          </Field>
          <KeyAndMode draft={draft} change={change} allowAny={!shared} />
        </div>

        {!shared && (
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="checkbox"
              checked={draft.playAlong}
              onChange={(e) => change({ playAlong: e.target.checked })}
              className="accent-[var(--color-accent)]"
            />
            Play along — run the exercise with it. Off, it is a video to watch.
          </label>
        )}

        {(shared || draft.playAlong) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Progression" htmlFor="track-progression" hint="For display: modal vamp, ii-V-i, 12-bar blues.">
              <Input
                id="track-progression"
                value={draft.progression}
                onChange={(e) => change({ progression: e.target.value })}
              />
            </Field>
            <Field label="Tags" htmlFor="track-tags" hint="Separated by commas: rock, funk, drums only.">
              <Input id="track-tags" value={draft.tags} onChange={(e) => change({ tags: e.target.value })} />
              <TagSuggestions suggestions={suggestions} draft={draft} change={change} />
            </Field>
          </div>
        )}

        {problems.length > 0 && draft.link.trim() !== '' && (
          <ul className="list-disc pl-5 text-[13px] text-ink/64" data-testid="track-problems">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>

      <DialogFooter className="sm:justify-between">
        <div>
          {target.video && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                void remove(target.video!.id).then(onClose);
              }}
            >
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!video || problems.length > 0} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

type Change = (changes: Partial<TrackDraft>) => void;

/** Bar 1, the tempo and the loop point — found by tapping along to the player. */
function Timing({
  draft,
  change,
  player,
}: {
  draft: TrackDraft;
  change: Change;
  player: { currentTime: number; playFrom(seconds: number): Promise<void> } | null;
}) {
  const [taps, setTaps] = useState<number[]>([]);
  const lastTapAt = useRef(0);
  const result = tapTempo(taps);

  const tap = () => {
    if (!player) return;
    const now = performance.now() / 1000;
    const time = player.currentTime;
    const fresh = now - lastTapAt.current > TAP_RESET_SEC;
    lastTapAt.current = now;
    setTaps((current) => (fresh ? [time] : [...current, time]));
  };

  // T taps, so eyes can stay on the video. Not while typing in a field.
  const tapRef = useRef(tap);
  useEffect(() => {
    tapRef.current = tap;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 't' || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [role="combobox"]')) return;
      e.preventDefault();
      tapRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const start = parseVideoTime(draft.start);
  const nudge = (by: number) => {
    if (start !== null) change({ start: formatVideoTime(Math.max(0, start + by)) });
  };

  return (
    <div className="space-y-3 rounded-[8px] bg-ink/[0.03] p-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Bar 1" htmlFor="track-start" hint="Where the backing kicks in, after any intro.">
          <Input
            id="track-start"
            value={draft.start}
            className="w-[110px] tabular-nums"
            onChange={(e) => change({ start: e.target.value })}
          />
        </Field>
        <Button variant="secondary" size="sm" aria-label="Bar 1 earlier" onClick={() => nudge(-0.05)}>
          −0.05 s
        </Button>
        <Button variant="secondary" size="sm" aria-label="Bar 1 later" onClick={() => nudge(0.05)}>
          +0.05 s
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!player}
          onClick={() => player && change({ start: formatVideoTime(player.currentTime) })}
        >
          Set to now
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!player || start === null}
          onClick={() => player && start !== null && void player.playFrom(start)}
        >
          Play from bar 1
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!player} onClick={tap} className="min-w-[88px]">
          Tap (T)
        </Button>
        <p className="text-[13px] text-ink/64" data-testid="tap-readout">
          {taps.length === 0
            ? 'Play the video and tap every beat, starting on the first beat of bar 1.'
            : result
              ? `${taps.length} taps · ${result.bpm} bpm · bar 1 at ${formatVideoTime(result.bar1Sec)}`
              : taps.length < MIN_TAPS
                ? `${taps.length} ${taps.length === 1 ? 'tap' : 'taps'} — keep going`
                : 'Uneven — a tap was missed or doubled. Pause for a moment and start again.'}
        </p>
        {result && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              change({ bpm: String(result.bpm), start: formatVideoTime(result.bar1Sec) });
              setTaps([]);
            }}
          >
            Use these
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Field label="Tempo" htmlFor="track-bpm">
          <Input
            id="track-bpm"
            value={draft.bpm}
            inputMode="decimal"
            className="w-[90px] tabular-nums"
            onChange={(e) => change({ bpm: e.target.value })}
          />
        </Field>
        <Field label="Beats per bar" htmlFor="track-beats">
          <Input
            id="track-beats"
            value={draft.beats}
            inputMode="numeric"
            className="w-[70px] tabular-nums"
            onChange={(e) => change({ beats: e.target.value })}
          />
        </Field>
        <Field label="Loop back at" htmlFor="track-end" hint="Optional. The end of the video otherwise.">
          <div className="flex gap-2">
            <Input
              id="track-end"
              value={draft.end}
              placeholder="the end"
              className="w-[110px] tabular-nums"
              onChange={(e) => change({ end: e.target.value })}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!player}
              onClick={() => player && change({ end: formatVideoTime(player.currentTime) })}
            >
              Set to now
            </Button>
          </div>
        </Field>
      </div>
    </div>
  );
}

function KeyAndMode({ draft, change, allowAny }: { draft: TrackDraft; change: Change; allowAny: boolean }) {
  const mode = draft.mode || 'ionian';
  return (
    <div className="flex gap-2">
      <Field label="Key" htmlFor="track-tonic">
        <Select
          value={draft.tonic || ANY}
          onValueChange={(tonic) =>
            change(tonic === ANY ? { tonic: '', mode: '' } : { tonic, mode: draft.mode || 'ionian' })
          }
        >
          <SelectTrigger id="track-tonic" aria-label="Key" className="w-[110px]">
            <SelectValue placeholder="Key" />
          </SelectTrigger>
          <SelectContent>
            {allowAny && <SelectItem value={ANY}>Any key</SelectItem>}
            {!allowAny && !draft.tonic && <SelectItem value={ANY} disabled>Key</SelectItem>}
            {tonicsForMode(mode).map((tonic) => (
              <SelectItem key={tonic} value={tonic}>
                {tonic}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Mode" htmlFor="track-mode">
        <Select
          value={draft.mode || ANY}
          onValueChange={(value) => {
            if (value === ANY) return change({ tonic: '', mode: '' });
            const next = value as ModeName;
            change({ mode: next, tonic: respell(draft.tonic, next) || (allowAny ? '' : draft.tonic) });
          }}
        >
          <SelectTrigger id="track-mode" aria-label="Mode" className="w-[150px]">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            {allowAny && <SelectItem value={ANY}>Any mode</SelectItem>}
            {!allowAny && !draft.mode && <SelectItem value={ANY} disabled>Mode</SelectItem>}
            {MODE_NAMES.map((m) => (
              <SelectItem key={m} value={m}>
                {modeTitle(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

/** Tags already in use that this track doesn't have yet — one click adds one. */
function TagSuggestions({ suggestions, draft, change }: { suggestions: string[]; draft: TrackDraft; change: Change }) {
  const have = new Set(draft.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean));
  const offered = suggestions.filter((t) => !have.has(t.toLowerCase()));
  if (offered.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {offered.map((tag) => (
        <button
          key={tag}
          type="button"
          className="rounded-toggle bg-ink/5 px-2 py-0.5 text-[12px] text-ink/70 hover:bg-ink/10"
          onClick={() => change({ tags: [...have.size ? [draft.tags.trim().replace(/,$/, '')] : [], tag].join(', ') })}
        >
          + {tag}
        </button>
      ))}
    </div>
  );
}
