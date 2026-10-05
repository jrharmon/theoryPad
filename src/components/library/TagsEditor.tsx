import { useState } from 'react';
import { normalizeTag } from '@/domain/library';
import { Button } from '@/components/ui/button';

/**
 * An exercise's tags: every tag on offer as a pill, on or off, and a field to
 * add a new one. Typed tags are stored lowercase-kebab.
 */
export function TagsEditor({
  tags,
  offered,
  onChange,
}: {
  tags: readonly string[];
  /** The known tags and any in use elsewhere; the exercise's own are always shown. */
  offered: readonly string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const all = [...tags, ...offered.filter((t) => !tags.includes(t))];

  const add = () => {
    const tag = normalizeTag(draft);
    setDraft('');
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Tags">
      {all.map((tag) => {
        const on = tags.includes(tag);
        return (
          <Button
            key={tag}
            size="xs"
            variant={on ? 'secondary' : 'ghost'}
            className={on ? 'rounded-full' : 'rounded-full text-ink-disabled'}
            aria-pressed={on}
            onClick={() => onChange(on ? tags.filter((t) => t !== tag) : [...tags, tag])}
          >
            {tag}
          </Button>
        );
      })}
      <input
        aria-label="Add a tag"
        placeholder="Add tag"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
          if (e.key === 'Escape') setDraft('');
        }}
        className="h-6 w-24 rounded-full border border-dashed border-rule bg-transparent px-2.5 text-meta outline-none placeholder:text-ink-faint focus:border-ink"
      />
    </div>
  );
}
