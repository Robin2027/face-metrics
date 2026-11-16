/**
 * Landmark tables.
 *
 * Indices follow the canonical numbering of each detector. They are listed once,
 * here, so the formulas and the code that evaluates them cannot drift apart;
 * `test/ratios.test.mjs` checks that every formula string names the indices the
 * code actually reads.
 *
 * MediaPipe Face Mesh (468 points, 478 with iris refinement)
 *   https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
 *   Iris points 468-472 and 473-477 come from the iris refinement model; 468
 *   and 473 are the two pupil centres.
 *
 * dlib / iBUG 68 (the 68-point markup used by dlib, OpenCV Facemark and most
 * 300-W derived models). It has no zygomatic or gonion points, so the ratios
 * that need them are reported as unavailable rather than approximated.
 */

import { distance, midpoint } from './points.mjs';

const dist = (a, b) => distance(a, b);

function metric(key, label, formula, anchors, compute) {
  return { key, label, formula, anchors, compute };
}

const MEDIAPIPE_PAIRS = [
  ['outer canthus', 33, 263],
  ['inner canthus', 133, 362],
  ['upper eyelid', 159, 386],
  ['lower eyelid', 145, 374],
  ['lateral eyebrow', 70, 300],
  ['medial eyebrow', 107, 336],
  ['alar base', 129, 358],
  ['mouth corner', 61, 291],
  ['zygomatic', 234, 454],
  ['gonion', 172, 397],
  ['jaw, mouth level', 58, 288],
  ['temple', 127, 356],
];

const MEDIAPIPE_RATIOS = [
  metric(
    'interocular-outer',
    'Outer canthal distance / bizygomatic width',
    '|p33 - p263| / |p234 - p454|',
    [33, 263, 234, 454],
    (p) => dist(p[33], p[263]) / dist(p[234], p[454]),
  ),
  metric(
    'interocular-inner',
    'Inner canthal distance / bizygomatic width',
    '|p133 - p362| / |p234 - p454|',
    [133, 362, 234, 454],
    (p) => dist(p[133], p[362]) / dist(p[234], p[454]),
  ),
  metric(
    'eye-spacing',
    'Inner canthal distance / outer canthal distance',
    '|p133 - p362| / |p33 - p263|',
    [133, 362, 33, 263],
    (p) => dist(p[133], p[362]) / dist(p[33], p[263]),
  ),
  metric(
    'nose-mouth',
    'Nose width (alar base) / mouth width',
    '|p129 - p358| / |p61 - p291|',
    [129, 358, 61, 291],
    (p) => dist(p[129], p[358]) / dist(p[61], p[291]),
  ),
  metric(
    'mouth-face',
    'Mouth width / bizygomatic width',
    '|p61 - p291| / |p234 - p454|',
    [61, 291, 234, 454],
    (p) => dist(p[61], p[291]) / dist(p[234], p[454]),
  ),
  metric(
    'jaw-cheek',
    'Bigonial width / bizygomatic width',
    '|p172 - p397| / |p234 - p454|',
    [172, 397, 234, 454],
    (p) => dist(p[172], p[397]) / dist(p[234], p[454]),
  ),
  metric(
    'face-index',
    'Morphological facial index: nasion to menton over bizygomatic width, x 100',
    '100 * |p168 - p152| / |p234 - p454|',
    [168, 152, 234, 454],
    (p) => (100 * dist(p[168], p[152])) / dist(p[234], p[454]),
  ),
];

const MEDIAPIPE_IRIS_RATIO = metric(
  'midface',
  'Interpupillary distance / pupil midpoint to upper lip centre',
  '|p468 - p473| / |mid(p468, p473) - p0|',
  [468, 473, 0],
  (p) => dist(p[468], p[473]) / dist(midpoint(p[468], p[473]), p[0]),
);

const DLIB68_PAIRS = [
  ['outer canthus', 36, 45],
  ['inner canthus', 39, 42],
  ['upper eyelid', 37, 44],
  ['lower eyelid', 41, 46],
  ['lateral eyebrow', 17, 26],
  ['medial eyebrow', 21, 22],
  ['alar base', 31, 35],
  ['mouth corner', 48, 54],
  ['upper jaw', 1, 15],
  ['jaw, mouth level', 3, 13],
  ['jaw, lower', 6, 10],
];

const DLIB68_RATIOS = [
  metric(
    'eye-spacing',
    'Inner canthal distance / outer canthal distance',
    '|p39 - p42| / |p36 - p45|',
    [39, 42, 36, 45],
    (p) => dist(p[39], p[42]) / dist(p[36], p[45]),
  ),
  metric(
    'nose-mouth',
    'Nose width (alar base) / mouth width',
    '|p31 - p35| / |p48 - p54|',
    [31, 35, 48, 54],
    (p) => dist(p[31], p[35]) / dist(p[48], p[54]),
  ),
  metric(
    'mouth-jaw',
    'Mouth width / jaw width at ear level',
    '|p48 - p54| / |p0 - p16|',
    [48, 54, 0, 16],
    (p) => dist(p[48], p[54]) / dist(p[0], p[16]),
  ),
  metric(
    'face-index',
    'Nose bridge to chin over jaw width at ear level, x 100',
    '100 * |p27 - p8| / |p0 - p16|',
    [27, 8, 0, 16],
    (p) => (100 * dist(p[27], p[8])) / dist(p[0], p[16]),
  ),
];

const DLIB68_UNAVAILABLE = [
  {
    key: 'interocular-outer',
    reason: 'the 68-point markup has no zygomatic points, so there is no bizygomatic width to divide by',
  },
  {
    key: 'jaw-cheek',
    reason: 'the 68-point markup has no gonion points, so bigonial width cannot be measured',
  },
  {
    key: 'midface',
    reason: 'the 68-point markup has no iris points, so the pupil centres are unknown',
  },
];

export const SCHEMAS = {
  'mediapipe-478': {
    id: 'mediapipe-478',
    detector: 'MediaPipe Face Mesh with iris refinement',
    pointCount: 478,
    pairs: [...MEDIAPIPE_PAIRS, ['iris centre', 468, 473]],
    ratios: [...MEDIAPIPE_RATIOS, MEDIAPIPE_IRIS_RATIO],
    unavailable: [],
  },
  'mediapipe-468': {
    id: 'mediapipe-468',
    detector: 'MediaPipe Face Mesh',
    pointCount: 468,
    pairs: MEDIAPIPE_PAIRS,
    ratios: MEDIAPIPE_RATIOS,
    unavailable: [
      {
        key: 'midface',
        reason: 'the 468-point mesh has no iris points; use the 478-point output with iris refinement',
      },
    ],
  },
  dlib68: {
    id: 'dlib68',
    detector: 'dlib / iBUG 68-point markup',
    pointCount: 68,
    pairs: DLIB68_PAIRS,
    ratios: DLIB68_RATIOS,
    unavailable: DLIB68_UNAVAILABLE,
  },
};

/**
 * Guess the landmark schema from the number of points.
 *
 * @param {unknown[]} points
 * @returns {typeof SCHEMAS[keyof typeof SCHEMAS]}
 * @throws {TypeError} when the length matches no known detector.
 */
export function detectSchema(points) {
  if (!Array.isArray(points)) {
    throw new TypeError(`points must be an array, got ${typeof points}`);
  }

  switch (points.length) {
    case 478:
      return SCHEMAS['mediapipe-478'];
    case 468:
      return SCHEMAS['mediapipe-468'];
    case 68:
      return SCHEMAS.dlib68;
    default:
      throw new TypeError(
        `unsupported landmark count: ${points.length}. Supported: 68 (dlib/iBUG), 468 (MediaPipe Face Mesh), 478 (MediaPipe with iris). ` +
          'Pass a schema explicitly only if you know the indices differ.',
      );
  }
}
