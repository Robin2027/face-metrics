import test from 'node:test';
import assert from 'node:assert/strict';

import { similarity } from '../src/procrustes.mjs';
import { transform } from './fixtures.mjs';

function near(actual, expected, tolerance = 1e-9, message = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} expected ${expected}, got ${actual}`,
  );
}

const SHAPE = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
  [0.5, 0.2],
  [0.3, 0.9],
];

test('recovers a known similarity transform', () => {
  const options = { angle: 0.4, scale: 2.5, tx: 7, ty: -3 };
  const target = SHAPE.map((p) => transform(p, options));

  const fit = similarity(SHAPE, target);

  near(fit.scale, options.scale, 1e-12, 'scale:');
  near(fit.rotation, options.angle, 1e-12, 'rotation:');
  near(fit.rms, 0, 1e-12, 'residual on an exact match:');
  near(fit.rmsRelative, 0, 1e-12);

  const [x, y] = fit.apply(SHAPE[1]);
  near(x, target[1][0], 1e-12);
  near(y, target[1][1], 1e-12);
});

test('moving the target does not change the measured shape difference', () => {
  const target = SHAPE.map((p) => transform(p, { angle: 1.2, scale: 4, tx: -30, ty: 9 }));
  const elsewhere = target.map(([x, y]) => [x + 500, y - 200]);

  const a = similarity(SHAPE, target);
  const b = similarity(SHAPE, elsewhere);

  near(b.rms, a.rms, 1e-9);
  near(b.scale, a.scale, 1e-9);
  near(b.rotation, a.rotation, 1e-9);
});

test('residual grows with the size of the perturbation', () => {
  const noise = [0.01, 0.02, 0.04];
  const residuals = noise.map((amount) =>
    similarity(
      SHAPE,
      SHAPE.map((p, i) => [p[0] + (i % 2 ? amount : 0), p[1]]),
    ).rms,
  );

  for (let i = 1; i < residuals.length; i += 1) {
    assert.ok(
      residuals[i] > residuals[i - 1],
      `residual did not grow at step ${i}: ${residuals}`,
    );
  }
});

test('mismatched inputs are rejected', () => {
  assert.throws(() => similarity(SHAPE, SHAPE.slice(0, 3)), RangeError);
  assert.throws(() => similarity([[0, 0]], [[1, 1]]), RangeError);
  assert.throws(() => similarity('nope', SHAPE), TypeError);
  assert.throws(() => similarity(SHAPE, [[0, 0], [1, 'x']]), TypeError);
});
