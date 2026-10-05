import { sameName } from '@/domain/library';

/**
 * "from Modes up the neck": the blueprint an exercise was made from, named
 * once and quietly — only where the exercise's own name differs from it.
 */
export function FromBlueprint({
  name,
  blueprint,
  className = '',
}: {
  name: string;
  blueprint: string;
  className?: string;
}) {
  if (sameName(name, blueprint)) return null;
  return <span className={`text-meta text-ink-muted ${className}`}>from {blueprint}</span>;
}
