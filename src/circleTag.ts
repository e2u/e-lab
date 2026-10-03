/** `.sym-tag` size. Longer tags inside a coil circle shrink from this. */
export const CIRCLE_TAG_BASE = 12;

/**
 * Red Hat Mono at weight 500. Measured advance is 0.638em, and the ink box
 * of a tag such as M_FWD is 1.26em tall once `dominantBaseline="central"`
 * centers it. Rounded up so the corners stay off the stroke.
 */
const MONO = 0.64;
const HALF_EM = 0.66;

/**
 * Font size that keeps `label` inside a circle of `radius`.
 * The stroke is centered on the radius. One pixel of fill stays clear of
 * the stroke's inner edge. Tags that already fit stay at `base`.
 */
export function circleTagFontSize(
  label: string,
  radius: number,
  strokeWidth = 2,
  base = CIRCLE_TAG_BASE,
): number {
  const text = label.trim();
  if (!text || radius <= 0) return base;
  const inner = radius - strokeWidth / 2 - 1;
  if (inner <= 1) return 1;
  const halfW = (text.length * MONO) / 2;
  const fitted = inner / Math.sqrt(halfW * halfW + HALF_EM * HALF_EM);
  return Math.round(Math.min(base, fitted) * 10) / 10;
}
