/**
 * Anthropometric ratios for a landmark set.
 *
 * Every number carries the formula that produced it and the landmark indices it
 * read. Ratios that cannot be measured with a given markup are listed as
 * unavailable with a reason, instead of being silently skipped or approximated
 * from the wrong point.
 */

import { toPoints } from './points.mjs';

/**
 * @param {Array<[number, number] | {x: number, y: number}>} points
 * @param {object} schema  One of the entries in `SCHEMAS`.
 */
export function analyzeRatios(points, schema) {
  const list = toPoints(points);

  const highestIndex = schema.ratios.reduce(
    (max, item) => item.anchors.reduce((m, index) => Math.max(m, index), max),
    0,
  );

  if (list.length <= highestIndex) {
    throw new RangeError(
      `schema ${schema.id} needs at least ${highestIndex + 1} points, got ${list.length}`,
    );
  }

  const measured = schema.ratios.map((item) => {
    const raw = item.compute(list);
    const finite = Number.isFinite(raw);

    return {
      key: item.key,
      label: item.label,
      value: finite ? raw : null,
      formula: item.formula,
      landmarks: item.anchors.map((index) => `p${index}`),
      note: finite
        ? undefined
        : 'not computable from these landmarks: a reference distance in the formula is zero, ' +
          'which usually means the points are degenerate (all identical, or a flat line)',
    };
  });

  return {
    measured,
    unavailable: schema.unavailable.map((item) => ({ ...item })),
  };
}
