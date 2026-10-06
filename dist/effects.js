// Rendering-only curves. Never resize a Matter body to match these poses.
export const MERGE_ABSORB_MS = 170;
export const BIRTH_MS = 280;
const ease = t => t * t * (3 - 2 * t);
export function birthScale(age, reduced = false) {
  if (age < 0) return 0;
  if (reduced) return .96 + .04 * Math.min(1, age / 100);
  const keys = [[0, .55], [95, 1.18], [165, .94], [225, 1.04], [280, 1]];
  for (let i = 1; i < keys.length; i++) {
    if (age <= keys[i][0]) {
      const [start, a] = keys[i - 1], [end, b] = keys[i];
      return a + (b - a) * ease(Math.max(0, (age - start) / (end - start)));
    }
  }
  return 1;
}
export function mergeEchoPose(age, reduced = false) {
  const compression = Math.min(1, Math.max(0, age / 80));
  const absorb = ease(Math.min(1, Math.max(0, (age - 80) / 90)));
  return { progress: reduced ? 0 : absorb, scale: reduced ? 1 : 1 - .08 * compression - .32 * absorb,
    alpha: reduced ? Math.max(0, 1-age/60) : 1 - absorb };
}
