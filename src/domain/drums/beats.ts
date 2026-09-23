import { drumTab } from './tab';

/**
 * The drum beats the metronome offers besides Simple, written as drum tab.
 * Edit a line and it is heard on the next load; add a `drumTab({ … })` to
 * BEATS and it appears in the transport's Metronome menu and in Settings.
 *
 *   -  rest     g  ghost (soft)     x  hit     X  accent
 *
 *   CR crash   RD ride   HH closed hat   OH open hat
 *   SN snare   BD kick   ST stick
 *
 * A line per drum, `|` between bars. Every line has the same bars, and within
 * a bar the same number of cells. The beat loops over all the bars written.
 * In 4/4, 16 cells to a bar are sixteenths, 12 are eighth triplets (swing),
 * 8 are eighths; a bar may use a different count from the next. A closed hat
 * chokes an open one, as the pedal does.
 *
 * Keep `id` once it has shipped: an exercise saves `drums-<id>`. A beat whose
 * id disappears plays Simple instead.
 */

const SWING = drumTab({
  id: 'swing',
  name: 'Swing',
  detail: 'A jazz ride, the hat on 2 and 4, ghost notes, a fill every fourth bar.',
  signature: '4/4',
  //    1  2  3  4  |1  2  3  4  |1  2  3  4  |1  2  3  4
  tab: `
    CR |X-----------|------------|------------|------------|
    RD |---X-xx--X-x|x--X-xx--X-x|x--X-xx--X-x|x--X-xx--X-x|
    HH |---g-----g--|---g-----g--|---g-----g--|---g-----g--|
    SN |--------g--g|-----g-----X|--g-----g---|--g--gX-gX-X|
    BD |X--g--g--g--|g--g--g--g-x|g--g--g--g--|g--g--g-----|
  `,
});

const UPBEAT = drumTab({
  id: 'upbeat',
  name: 'Upbeat',
  detail: 'Straight sixteenths: hats, ghost notes, a kick that skips around.',
  signature: '4/4',
  //    1   2   3   4   |1   2   3   4   |1   2   3   4   |1   2   3   4
  tab: `
    CR |X---------------|----------------|----------------|----------------|
    HH |--x-x-x-x-x-x-x-|x-x-x-x-x-x-x-x-|x-x-x-x-x-x-x-x-|x-x-x-x-x-x-x---|
    OH |----------------|----------------|----------------|--------------x-|
    SN |----X--g-g--X--g|-g--X--g-g--X-g-|----X--g-g--X--g|-g--X--g-g-gXgXX|
    BD |X-----x---x-----|x-----x--x----x-|x-----x---x--x--|x-----x---x-----|
  `,
});

const HEAVY = drumTab({
  id: 'heavy',
  name: 'Heavy',
  detail: 'Metal: galloping double kick, a bar of straight sixteenths, a fill.',
  signature: '4/4',
  //    1   2   3   4   |1   2   3   4   |1   2   3   4   |1   2   3   4
  tab: `
    CR |X---------------|----------------|X---------------|----------------|
    HH |----x---x---x---|x---x---x---x---|----x---x---x---|x---x-----------|
    SN |----X-------X---|----X-------X---|----X-------X---|----X---XgXgXXXX|
    BD |x-xxx-xxx-xxx-xx|x-xxx-xxx-xxxxxx|xxxxxxxxxxxxxxxx|x-xxx-xxx-x-x-x-|
  `,
});

export const BEATS = [UPBEAT, SWING, HEAVY];
