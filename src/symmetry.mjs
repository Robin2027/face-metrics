/**
 * Mirror symmetry of a landmark configuration.
 *
 * Only paired landmarks are used. For every anatomical pair — left canthus and
 * right canthus, left mouth corner and right mouth corner, and so on — we look
 * for the one straight line that best maps one side onto the other by
 * reflection. That line is the facial midline implied by the landmarks
 * themselves, so the caller never has to nominate a midline point.
 *
 * The optimal reflection is available in closed form. A reflection through the
 * origin about an axis at angle t is
 *
 *     Q(t) = [[cos 2t,  sin 2t],
 *             [sin 2t, -cos 2t]]          det(Q) = -1,  Q'Q = I
 *
 * and minimising sum |r_i - Q l_i|^2 is the same as maximising
 *
 *     cos(2t) * A + sin(2t) * B
 *     A = sum (rx lx - ry ly),  B = sum (rx ly + ry lx)
 *
 * over the unit circle, so 2t = atan2(B, A). No iteration, no SVD.
 *
 * The result is invariant to where the face sits in the image, how large it is
 * and how it is rotated: the axis is refitted and the residual is divided by
 * centroid size.
 */

import { toPoint } from './points.mjs';

const EPS = 1e-12;

/**
 * @typedef {object} Pair
 * @property {[number, number] | {x: number, y: number}} left
 * @property {[number, number] | {x: number, y: number}} right
 * @property {string} [label]
 */

function normalizePairs(pairs) {
  if (!Array.isArray(pairs)) {
    throw new TypeError(`pairs must be an array, got ${typeof pairs}`);
  }

  return pairs.map((entry, i) => {
    if (Array.isArray(entry)) {
      if (entry.length < 2) {
        throw new TypeError(`pairs[${i}] must be [left, right], got an array of length ${entry.length}`);
      }
      return {
        left: toPoint(entry[0], `pairs[${i}].left`),
        right: toPoint(entry[1], `pairs[${i}].right`),
        label: typeof entry[2] === 'string' ? entry[2] : `pair ${i + 1}`,
      };
    }

    if (entry && typeof entry === 'object') {
      const left = entry.left ?? entry.a;
      const right = entry.right ?? entry.b;
      if (left === undefined || right === undefined) {
        throw new TypeError(`pairs[${i}] must have left and right points`);
      }
      return {
        left: toPoint(left, `pairs[${i}].left`),
        right: toPoint(right, `pairs[${i}].right`),
        label: typeof entry.label === 'string' ? entry.label : `pair ${i + 1}`,
      };
    }

    throw new TypeError(`pairs[${i}] must be [left, right] or {left, right}`);
  });
}

/**
 * Fit the mirror axis and measure how far the two sides are from being
 * reflections of each other.
 *
 * @param {Array<Pair | [Pair['left'], Pair['right'], string?]>} pairs
 *   At least three anatomical pairs. Order does not matter, but the two points
 *   in a pair must be the same anatomical point on opposite sides.
 * @returns {{
 *   index: number,
 *   rms: number,
 *   centroidSize: number,
 *   axis: {x: number, y: number, angle: number, angleDegrees: number},
 *   pairs: Array<{label: string, residual: number, share: number}>,
 *   formula: string,
 *   notes: string
 * }}
 *   `index` is the RMS reflection residual as a percentage of centroid size.
 *   `axis` is the fitted midline: a point on it and its angle in radians
 *   (measured from the +x axis; with image coordinates, y grows downwards).
 *   `pairs[].share` is that pair's residual in the same percentage unit, so a
 *   single dragging corner can be identified.
 */
export function asymmetry(pairs) {
  const list = normalizePairs(pairs);

  if (list.length < 3) {
    throw new RangeError(
      `asymmetry() needs at least 3 landmark pairs to fit an axis, got ${list.length}`,
    );
  }

  let cx = 0;
  let cy = 0;
  for (const pair of list) {
    cx += pair.left.x + pair.right.x;
    cy += pair.left.y + pair.right.y;
  }
  const pointCount = list.length * 2;
  cx /= pointCount;
  cy /= pointCount;

  let a = 0;
  let b = 0;
  let spread = 0;

  for (const pair of list) {
    const lx = pair.left.x - cx;
    const ly = pair.left.y - cy;
    const rx = pair.right.x - cx;
    const ry = pair.right.y - cy;

    a += rx * lx - ry * ly;
    b += rx * ly + ry * lx;
    spread += lx * lx + ly * ly + rx * rx + ry * ry;
  }

  const angle = Math.abs(a) < EPS && Math.abs(b) < EPS ? 0 : 0.5 * Math.atan2(b, a);
  const cos2t = Math.cos(2 * angle);
  const sin2t = Math.sin(2 * angle);

  let residualSquares = 0;
  const perPair = [];

  for (const pair of list) {
    const lx = pair.left.x - cx;
    const ly = pair.left.y - cy;

    // Reflect the left point across the fitted midline...
    const mirroredX = cos2t * lx + sin2t * ly;
    const mirroredY = sin2t * lx - cos2t * ly;

    // ...and measure how far it lands from its right-hand counterpart.
    const dx = pair.right.x - cx - mirroredX;
    const dy = pair.right.y - cy - mirroredY;
    const squared = dx * dx + dy * dy;

    residualSquares += squared;
    perPair.push({ label: pair.label, residual: Math.sqrt(squared) });
  }

  const size = Math.sqrt(spread / pointCount);
  const rms = Math.sqrt(residualSquares / list.length);
  const index = size > EPS ? (100 * rms) / size : Number.NaN;

  perPair.sort((x, y) => y.residual - x.residual);

  return {
    index,
    rms,
    centroidSize: size,
    axis: {
      x: cx,
      y: cy,
      angle,
      angleDegrees: (angle * 180) / Math.PI,
    },
    pairs: perPair.map((pair) => ({
      label: pair.label,
      residual: pair.residual,
      share: size > EPS ? (100 * pair.residual) / size : Number.NaN,
    })),
    formula: '100 * sqrt(sum(d^2) / N) / centroidSize',
    notes:
      'd is the distance from each right landmark to the reflection of its left counterpart across the best-fit midline; ' +
      'N is the number of pairs; centroidSize is the RMS distance of all 2N landmarks from their centroid.',
  };
}

/**
 * Two endpoints of the fitted midline, for drawing it over an image.
 *
 * @param {ReturnType<typeof asymmetry>} result
 * @param {number} halfLength  Half the length of the segment, in the same units
 *   as the input landmarks.
 * @returns {[[number, number], [number, number]]}
 */
export function axisSegment(result, halfLength) {
  if (!Number.isFinite(halfLength) || halfLength <= 0) {
    throw new RangeError(`halfLength must be a positive number, got ${halfLength}`);
  }
  const { x, y, angle } = result.axis;
  const dx = Math.cos(angle) * halfLength;
  const dy = Math.sin(angle) * halfLength;
  return [
    [x - dx, y - dy],
    [x + dx, y + dy],
  ];
}
