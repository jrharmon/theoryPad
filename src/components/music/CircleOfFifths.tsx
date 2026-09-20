import type { KeyMode } from '@/domain/music';
import { modeTitle } from '@/domain/music';
import type { CircleCell, CircleRing } from '@/domain/theory';
import { CIRCLE_POSITIONS, keyOnCircle, majorAt, minorAt } from '@/domain/theory';

const SIZE = 280;
const C = SIZE / 2;
/** Outer and inner radius of each ring. The diminished ring only ever holds the key's vii°. */
const RINGS: Record<CircleRing, [outer: number, inner: number]> = {
  major: [136, 98],
  minor: [98, 66],
  diminished: [66, 44],
};

/** A point on the circle: position 0 (C) at the top, each fifth 30° clockwise. */
function point(position: number, radius: number, turn = 0): [number, number] {
  const angle = ((position * 30 + turn - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(angle), C + radius * Math.sin(angle)];
}

/** One 30° slice of a ring, as an SVG path. */
function segment(position: number, ring: CircleRing): string {
  const [outer, inner] = RINGS[ring];
  const [x1, y1] = point(position, outer, -15);
  const [x2, y2] = point(position, outer, 15);
  const [x3, y3] = point(position, inner, 15);
  const [x4, y4] = point(position, inner, -15);
  return `M${x1} ${y1} A${outer} ${outer} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${inner} ${inner} 0 0 0 ${x4} ${y4} Z`;
}

const suffix: Record<CircleRing, string> = { major: '', minor: 'm', diminished: '°' };

/**
 * The circle of fifths with the key marked: the parent major's seven chords
 * tinted as a wedge, spelled from the key, and the mode's home chord in
 * ballpoint blue — so D Dorian shows C major's chords with D minor picked out.
 */
export function CircleOfFifths({ keyMode }: { keyMode: KeyMode }) {
  const circle = keyOnCircle(keyMode);
  const inKey = (ring: CircleRing, position: number): CircleCell | undefined =>
    circle.cells.find((c) => c.ring === ring && c.position === position);
  const { sharps, flats, relativeMajor } = circle.signature;
  const count = sharps > 0 ? `${sharps}♯` : flats > 0 ? `${flats}♭` : '0';

  const cells: {
    ring: CircleRing;
    position: number;
    label: string;
    cell?: CircleCell | undefined;
  }[] = [];
  for (const position of CIRCLE_POSITIONS) {
    const major = inKey('major', position);
    const minor = inKey('minor', position);
    cells.push({
      ring: 'major',
      position,
      label: major?.root ?? majorAt(position),
      cell: major,
    });
    cells.push({
      ring: 'minor',
      position,
      label: minor?.root ?? minorAt(position),
      cell: minor,
    });
  }
  const dim = circle.cells.find((c) => c.ring === 'diminished')!;
  cells.push({ ring: 'diminished', position: dim.position, label: dim.root, cell: dim });

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto block w-full max-w-[280px]"
      role="img"
      aria-label={`Circle of fifths: ${keyMode.tonic} ${modeTitle(keyMode.mode)}, from ${relativeMajor} major, ${count === '0' ? 'no sharps or flats' : count}`}
      data-testid="circle-of-fifths"
    >
      {cells.map(({ ring, position, label, cell }) => {
        const tonic = cell !== undefined && cell === circle.tonic;
        const [outer, inner] = RINGS[ring];
        const [x, y] = point(position, (outer + inner) / 2);
        return (
          <g
            key={`${ring}-${position}`}
            data-testid={tonic ? 'circle-tonic' : cell ? 'circle-in-key' : undefined}
          >
            <path
              d={segment(position, ring)}
              className={`stroke-rule ${tonic ? 'fill-accent' : cell ? 'fill-accent-tint' : 'fill-paper'}`}
              strokeWidth={1}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className={
                tonic
                  ? 'fill-on-accent font-extrabold'
                  : cell
                    ? 'fill-accent-text font-bold'
                    : 'fill-ink/64'
              }
              fontSize={ring === 'major' ? 15 : 12}
            >
              {label}
              {ring !== 'major' && <tspan fontSize={10}>{suffix[ring]}</tspan>}
            </text>
          </g>
        );
      })}
      <text
        x={C}
        y={C - 6}
        textAnchor="middle"
        dominantBaseline="central"
        className="num fill-ink font-extrabold"
        fontSize={18}
      >
        {count}
      </text>
      <text
        x={C}
        y={C + 14}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-ink/64"
        fontSize={10}
      >
        {relativeMajor} major
      </text>
    </svg>
  );
}
