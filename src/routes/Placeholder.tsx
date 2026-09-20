import { PageHeader } from '@/components/ui/page-header';
/**
 * Stand-in for a screen that has not been built yet.
 * Every route gets one at M0 so navigation is real and the milestone is verifiable.
 */
export function Placeholder({
  title,
  milestone,
  summary,
}: {
  title: string;
  milestone: string;
  summary: string;
}) {
  return (
    <section>
      <PageHeader kicker={milestone} title={title} intro={summary} />
    </section>
  );
}
