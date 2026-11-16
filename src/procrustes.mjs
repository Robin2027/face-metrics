/**
 * Least-squares similarity alignment of two 2D landmark configurations
 * (the Umeyama / Procrustes step), without reflection.
 *
 * This is the standard way to compare two faces after removing position,
 * scale and in-plane rotation. It answers "how different are these two shapes,
 * ignoring pose" and, with `apply`, puts one configuration into the other's
 * frame so the two can be overlaid.
 *
 * The optimal rotation for a similarity transform has a closed form in 2D:
 *
 *     U = sum (ax bx + ay by),  V = sum (ax by - ay bx)
 *     angle = atan2(V, U),      scale = hypot(U, V) / sum |a|^2
 *
 * which is the same answer the SVD-based Umeyama solution gives, minus the SVD.
 */

import { toPoints, centroid } from './points.mjs';

const EPS = 1e-12;

/**
 * @param {Array<[number, number] | {x: number, y: number}>} source
 * @param {Array<[number, number] | {x: number, y: number}>} target
 *   Must have the same length as `source`, with corresponding indices.
 * @returns {{
 *   scale: number,
 *   rotation: number,
 *   rotationDegrees: number,
 *   translation: {x: number, y: number},
 *   rms: number,
 *   rmsRelative: number,
 *   apply: (point: [number, number] | {x: number, y: number}) => [number, number]
 * }}
 *   `rms` is in target units; `rmsRelative` divides it by the target's centroid
 *   size, which is the comparable number when the two faces are different sizes.
 */
export function similarity(source, target) {
  const a = toPoints(source, 'source');
  const b = toPoints(target, 'target');

  if (a.length !== b.length) {
    throw new RangeError(
      `source and target must have the same number of landmarks, got ${a.length} and ${b.length}`,
    );
  }
  if (a.length < 2) {
    throw new RangeError(`at least 2 landmark pairs are needed, got ${a.length}`);
  }

  const centreA = centroid(a);
  const centreB = centroid(b);

  let varianceA = 0;
  let u = 0;
  let v = 0;
  let varianceB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const ax = a[i].x - centreA.x;
    const ay = a[i].y - centreA.y;
    const bx = b[i].x - centreB.x;
    const by = b[i].y - centreB.y;

    varianceA += ax * ax + ay * ay;
    varianceB += bx * bx + by * by;
    u += ax * bx + ay * by;
    v += ax * by - ay * bx;
  }

  const rotation = Math.atan2(v, u);
  const scale = varianceA > EPS ? Math.hypot(u, v) / varianceA : 1;

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const translation = {
    x: centreB.x - scale * (cos * centreA.x - sin * centreA.y),
    y: centreB.y - scale * (sin * centreA.x + cos * centreA.y),
  };

  const apply = (point) => {
    const p = Array.isArray(point) ? { x: point[0], y: point[1] } : point;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new TypeError('apply() expects [x, y] or {x, y} with finite numbers');
    }
    return [
      scale * (cos * p.x - sin * p.y) + translation.x,
      scale * (sin * p.x + cos * p.y) + translation.y,
    ];
  };

  let residualSquares = 0;
  for (let i = 0; i < a.length; i += 1) {
    const [x, y] = apply(a[i]);
    const dx = x - b[i].x;
    const dy = y - b[i].y;
    residualSquares += dx * dx + dy * dy;
  }

  const rms = Math.sqrt(residualSquares / a.length);
  const targetSize = Math.sqrt(varianceB / b.length);

  return {
    scale,
    rotation,
    rotationDegrees: (rotation * 180) / Math.PI,
    translation,
    rms,
    rmsRelative: targetSize > EPS ? rms / targetSize : Number.NaN,
    apply,
  };
}
