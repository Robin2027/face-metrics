import test from 'node:test';
import assert from 'node:assert/strict';

import { asymmetry, axisSegment } from '../src/symmetry.mjs';
import { reflect, symmetricPairs, transformPairs } from './fixtures.mjs';

function near(actual, expected, tolerance = 1e-9, message = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} expected ${expected}, got ${actual}`,
  );
}

/** Axes are lines, so an angle and that angle plus half a turn are the same axis. */
function sameAxis(actual, expected, tolerance = 1e-9, message = '') {
  const difference = actual - expected;
  const wrapped = Math.atan2(Math.sin(2 * difference), Math.cos(2 * difference)) / 2;
  near(wrapped, 0, tolerance, `${message} (${actual} vs ${expected})`);
}

test('a mirrored configuration has zero asymmetry', () => {
  const result = asymmetry(symmetricPairs(8));
  assert.equal(result.pairs.length, 8);
  near(result.index, 0);
  near(result.rms, 0);
  near(result.axis.x, 0);
  // These pairs are mirrored about the vertical line x = 0, so the fitted
  // midline is vertical: 90 degrees from the +x axis.
  near(result.axis.angleDegrees, 90);
});

test('index is invariant to position, scale and rotation', () => {
  const base = asymmetry(symmetricPairs(6));

  const moved = transformPairs(symmetricPairs(6), {
    angle: 0.7,
    scale: 3,
    tx: 120,
    ty: -40,
  });
  const shifted = asymmetry(moved);

  near(shifted.index, base.index, 1e-9, 'index changed after a similarity transform:');
  near(shifted.centroidSize, base.centroidSize * 3, 1e-9);
  // The fitted midline rotates with the configuration.
  sameAxis(shifted.axis.angle, base.axis.angle + 0.7, 1e-9, 'fitted axis did not follow the rotation');
});

test('the fitted axis is the axis the pairs were mirrored about', () => {
  const t = 0.31;
  const pairs = symmetricPairs(7).map((pair) => ({
    label: pair.label,
    left: pair.left,
    right: reflect(pair.left, t),
  }));

  const result = asymmetry(pairs);
  near(result.index, 0, 1e-12, 'a reflection about a known axis should leave no residual:');
  sameAxis(result.axis.angle, t, 1e-12, 'recovered axis angle');
});

test('a displaced landmark raises the index monotonically', () => {
  const indexes = [0, 0.005, 0.01, 0.02].map((shift) => {
    const pairs = symmetricPairs(6);
    pairs[2].right = [pairs[2].right[0] + shift, pairs[2].right[1]];
    return asymmetry(pairs).index;
  });

  assert.ok(Math.abs(indexes[0]) < 1e-12, `an undisplaced configuration should measure zero, got ${indexes[0]}`);
  for (let i = 1; i < indexes.length; i += 1) {
    assert.ok(indexes[i] > indexes[i - 1], `index did not increase at step ${i}: ${indexes}`);
  }
});

test('per-pair shares point at the pair that moved', () => {
  const pairs = symmetricPairs(6);
  pairs[4].right = [pairs[4].right[0] + 0.02, pairs[4].right[1]];
  pairs[4].label = 'mouth corner';

  const result = asymmetry(pairs);
  assert.equal(result.pairs[0].label, 'mouth corner');
  assert.ok(
    result.pairs[0].share > 0,
    'share should be a positive percentage of centroid size',
  );

  // The axis is refitted around the displacement, so the untouched pairs pick up
  // a small residual of their own. It must stay far below the pair that moved.
  const [, next] = result.pairs;
  assert.ok(
    next.residual < result.pairs[0].residual / 3,
    `untouched pairs should be much closer than the moved one: ${next.residual} vs ${result.pairs[0].residual}`,
  );
});

test('both point forms give the same answer', () => {
  const arrays = symmetricPairs(5).map((pair) => [pair.left, pair.right, pair.label]);
  const objects = symmetricPairs(5).map((pair) => ({
    left: { x: pair.left[0], y: pair.left[1] },
    right: { x: pair.right[0], y: pair.right[1] },
  }));

  near(asymmetry(arrays).index, asymmetry(objects).index);
  assert.deepEqual(
    asymmetry(arrays).pairs.map((p) => p.label),
    asymmetry(objects).pairs.map((p) => p.label),
  );
});

test('bad input fails loudly', () => {
  assert.throws(() => asymmetry('nope'), TypeError);
  assert.throws(() => asymmetry([]), RangeError);
  assert.throws(() => asymmetry(symmetricPairs(2)), RangeError);
  assert.throws(() => asymmetry([[[0, 0], [1, 1]], [[0, 0], [1, 1]]]), RangeError);
  assert.throws(() => asymmetry([{ left: [0, 0] }, { left: [1, 1] }]), TypeError);
  assert.throws(
    () => asymmetry([[[0, 0], [Number.NaN, 1]], [[0, 0], [1, 1]], [[0, 0], [1, 1]]]),
    TypeError,
  );
});

test('axisSegment draws the fitted midline', () => {
  const result = asymmetry(transformPairs(symmetricPairs(5), { angle: 0.2, tx: 10, ty: 4 }));
  const [p, q] = axisSegment(result, 5);

  near(Math.hypot(q[0] - p[0], q[1] - p[1]), 10);
  near((p[0] + q[0]) / 2, result.axis.x);
  near((p[1] + q[1]) / 2, result.axis.y);
  assert.throws(() => axisSegment(result, 0), RangeError);
});
