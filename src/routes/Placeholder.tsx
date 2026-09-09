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
    <section className="px-8 py-8">
      <p className="kicker kicker-accent">{milestone}</p>
      <h1 className="text-[42px]">{title}</h1>
      <p className="max-w-[640px] text-[15px] text-ink/70">{summary}</p>
    </section>
  );
}
