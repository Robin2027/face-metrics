/**
 * Small point helpers shared by the rest of the library.
 *
 * A landmark may be written as `[x, y]` or `{ x, y }`. Nothing else is
 * accepted: silently coercing `{x: "12"}` or a `[x, y, z]` triple leads to
 * numbers that look plausible and are wrong, which is the worst failure mode
 * for a measurement library.
 */

export function toPoint(value, label = 'landmark') {
  if (Array.isArray(value)) {
    if (value.length < 2) {
      throw new TypeError(`${label} must be [x, y] or {x, y}, got an array of length ${value.length}`);
    }
    const [x, y] = value;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError(`${label} must be finite numbers, got [${x}, ${y}]`);
    }
    return { x, y };
  }

  if (value && typeof value === 'object') {
    const x = value.x ?? value[0];
    const y = value.y ?? value[1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError(`${label} must be {x, y} with finite numbers, got ${JSON.stringify(value)}`);
    }
    return { x, y };
  }

  throw new TypeError(`${label} must be [x, y] or {x, y}, got ${typeof value}`);
}

export function toPoints(points, label = 'points') {
  if (!Array.isArray(points)) {
    throw new TypeError(`${label} must be an array of landmarks, got ${typeof points}`);
  }
  return points.map((p, i) => toPoint(p, `${label}[${i}]`));
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function centroid(points) {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** Centroid size: the root mean square distance of the points from their centroid. */
export function centroidSize(points) {
  const c = centroid(points);
  let sum = 0;
  for (const p of points) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    sum += dx * dx + dy * dy;
  }
  return Math.sqrt(sum / points.length);
}
