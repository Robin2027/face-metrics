/**
 * face-metrics — facial geometry from landmark sets, with the formula attached
 * to every number.
 *
 * The library does not detect faces. It takes landmarks that some other model
 * produced (MediaPipe Face Mesh, dlib/iBUG 68, anything you can index) and
 * returns:
 *
 *   - a mirror-symmetry index with the best-fit facial midline, invariant to
 *     position, scale and in-plane rotation;
 *   - anthropometric ratios, each with its formula and the indices it used;
 *   - a Procrustes alignment for comparing two configurations after removing
 *     pose.
 *
 * It deliberately does not return a "beauty score". A score without a published
 * formula is not a measurement, and the evidence for any particular set of
 * "ideal" proportions is much weaker than the internet suggests.
 *
 * @example
 * import { metrics } from 'face-metrics';
 *
 * const result = metrics(landmarks); // 468, 478 or 68 points
 * result.symmetry.index;            // 1.83, percent of centroid size
 * result.symmetry.axis.angleDegrees; // tilt of the fitted midline
 * result.ratios.measured;            // [{ key, value, formula, landmarks }]
 *
 * @module face-metrics
 */

import { toPoints } from './points.mjs';
import { asymmetry, axisSegment } from './symmetry.mjs';
import { similarity } from './procrustes.mjs';
import { SCHEMAS, detectSchema } from './schemas.mjs';
import { analyzeRatios } from './ratios.mjs';

export { asymmetry, axisSegment, similarity, SCHEMAS, detectSchema, analyzeRatios, toPoints };

function resolveSchema(schema) {
  if (typeof schema === 'string') {
    const found = SCHEMAS[schema];
    if (!found) {
      throw new TypeError(
        `unknown schema "${schema}"; known schemas: ${Object.keys(SCHEMAS).join(', ')}`,
      );
    }
    return found;
  }
  if (schema && typeof schema === 'object' && Array.isArray(schema.pairs)) {
    return schema;
  }
  throw new TypeError('schema must be a schema name or a schema object');
}

/**
 * Everything the library can say about one landmark configuration.
 *
 * @param {Array<[number, number] | {x: number, y: number}>} points
 *   68, 468 or 478 points; either pixel coordinates or normalised 0-1
 *   coordinates. Both work, because every measure is a ratio.
 * @param {{schema?: string | object}} [options]
 * @returns {{
 *   schema: string,
 *   detector: string,
 *   pointCount: number,
 *   symmetry: ReturnType<typeof asymmetry>,
 *   ratios: ReturnType<typeof analyzeRatios>
 * }}
 */
export function metrics(points, options = {}) {
  const list = toPoints(points);
  const schema = options.schema ? resolveSchema(options.schema) : detectSchema(list);

  if (list.length < schema.pointCount) {
    throw new RangeError(
      `schema ${schema.id} expects ${schema.pointCount} points, got ${list.length}`,
    );
  }

  const symmetry = asymmetry(
    schema.pairs.map(([label, left, right]) => ({
      label,
      left: list[left],
      right: list[right],
    })),
  );

  const ratios = analyzeRatios(list, schema);

  return {
    schema: schema.id,
    detector: schema.detector,
    pointCount: list.length,
    symmetry,
    ratios,
  };
}
