/**
 * Synthetic landmark configurations used by the tests.
 *
 * These are not photographs of anyone. They are hand-placed points with round
 * coordinates, so the expected value of every ratio can be worked out on paper
 * and written into the test as a literal number.
 */

/** Reflect a point across a line through the origin at angle `t`. */
export function reflect(point, t) {
  const c = Math.cos(2 * t);
  const s = Math.sin(2 * t);
  return [c * point[0] + s * point[1], s * point[0] - c * point[1]];
}

/** Rotate, scale and translate a point. */
export function transform(point, { angle = 0, scale = 1, tx = 0, ty = 0 } = {}) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [scale * (c * point[0] - s * point[1]) + tx, scale * (s * point[0] + c * point[1]) + ty];
}

/** A ladder of pairs, symmetric about the vertical line x = 0. */
export function symmetricPairs(count = 6) {
  const pairs = [];
  for (let i = 0; i < count; i += 1) {
    const x = 0.3 + i * 0.1;
    const y = 0.2 + i * 0.12;
    pairs.push({ label: `pair ${i + 1}`, left: [-x, y], right: [x, y] });
  }
  return pairs;
}

export function transformPairs(pairs, options) {
  return pairs.map((pair) => ({
    label: pair.label,
    left: transform(pair.left, options),
    right: transform(pair.right, options),
  }));
}

/**
 * Anchors for a 478-point face, laid out in a unit square.
 * Left-side coordinates are mirrored for the right side, so the configuration
 * is exactly symmetric about x = 0.5.
 */
const FACE478_ANCHORS = {
  33: [0.3, 0.4],
  133: [0.4, 0.42],
  159: [0.35, 0.38],
  145: [0.35, 0.44],
  70: [0.27, 0.34],
  107: [0.41, 0.35],
  129: [0.44, 0.55],
  61: [0.42, 0.65],
  234: [0.12, 0.45],
  172: [0.2, 0.58],
  58: [0.24, 0.68],
  127: [0.16, 0.3],
  468: [0.35, 0.41],
  168: [0.5, 0.4],
  152: [0.5, 0.88],
  0: [0.5, 0.635],
};

/** Right-hand counterpart of each left-hand index in the 478 anchor table. */
const MIRROR = {
  33: 263,
  133: 362,
  159: 386,
  145: 374,
  70: 300,
  107: 336,
  129: 358,
  61: 291,
  234: 454,
  172: 397,
  58: 288,
  127: 356,
  468: 473,
};

/**
 * @param {{size?: 468 | 478, displace?: {index: number, dx?: number, dy?: number}}} [options]
 *   `displace` moves a single landmark, which is how an asymmetric face is
 *   simulated.
 */
export function makeFace(options = {}) {
  const { size = 478, displace } = options;
  const points = new Array(size).fill(null).map(() => [0.5, 0.5]);

  for (const [index, xy] of Object.entries(FACE478_ANCHORS)) {
    const i = Number(index);
    if (i >= size) continue;
    points[i] = [xy[0], xy[1]];
  }

  for (const [left, right] of Object.entries(MIRROR)) {
    const l = Number(left);
    const r = Number(right);
    if (l >= size || r >= size) continue;
    points[r] = [1 - points[l][0], points[l][1]];
  }

  if (displace) {
    const { index, dx = 0, dy = 0 } = displace;
    points[index] = [points[index][0] + dx, points[index][1] + dy];
  }

  return points;
}

/**
 * A 68-point configuration with coordinates chosen so the ratios come out as
 * round numbers:
 *
 *   outer canthal    |p36 - p45| = 4
 *   inner canthal    |p39 - p42| = 2   -> eye-spacing 0.5
 *   nose width       |p31 - p35| = 1
 *   mouth width      |p48 - p54| = 2   -> nose-mouth 0.5
 *   jaw width        |p0  - p16| = 10  -> mouth-jaw 0.2
 *   nose bridge-chin |p27 - p8 | = 3   -> face-index 30
 */
export function makeFace68() {
  const points = new Array(68).fill(null).map(() => [1, 1]);
  const place = (index, x, y) => {
    points[index] = [x, y];
  };

  place(36, 0, 0);
  place(45, 4, 0);
  place(39, 1, 0);
  place(42, 3, 0);

  place(31, 0, 5);
  place(35, 1, 5);
  place(48, 0, 6);
  place(54, 2, 6);

  place(0, 0, 10);
  place(16, 10, 10);
  place(27, 5, 4);
  place(8, 5, 7);

  return points;
}
