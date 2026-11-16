/**
 * Run with: node examples/node-quickstart.mjs
 *
 * A toy configuration, not a face: five landmark pairs mirrored about a line,
 * then one of them nudged. It shows the shape of the output without pretending
 * a handful of points is a measurement of anyone.
 */

import { asymmetry, axisSegment } from '../src/index.mjs';

const pairs = [
  { label: 'outer canthus', left: [-60, -10], right: [60, -10] },
  { label: 'inner canthus', left: [-22, -8], right: [22, -8] },
  { label: 'alar base', left: [-16, 30], right: [16, 30] },
  { label: 'mouth corner', left: [-28, 58], right: [28, 58] },
  { label: 'gonion', left: [-78, 44], right: [78, 44] },
];

const clean = asymmetry(pairs);
console.log('symmetric:', clean.index.toFixed(3), '%');

pairs[3].right = [pairs[3].right[0] + 8, pairs[3].right[1]];
const nudged = asymmetry(pairs);

console.log('after moving one corner:', nudged.index.toFixed(3), '%');
console.log('worst pair:', nudged.pairs[0].label, nudged.pairs[0].share.toFixed(2), '%');
console.log('midline:', axisSegment(nudged, 40));
