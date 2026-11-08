import { describe, expect, it } from 'vitest';
import { resolveInteractionMotion } from './presets';

const kinds = ['button', 'menu', 'toast'] as const;

describe('interaction motion policy', () => {
  // A missing reduced-motion branch would leave the toast displaced.
  it('removes toast displacement when reduced motion is active', () => {
    const animation = resolveInteractionMotion({ kind: 'toast', reducedMotion: true });
    expect(animation.initial.y).toBe(0);
    expect(animation.animate.y).toBe(0);
  });

  // No server-rendered content may become hidden or displaced before hydration.
  it.each(kinds)('keeps %s content readable at the server boundary', (kind) => {
    const animation = resolveInteractionMotion({ kind, reducedMotion: false });
    expect(animation.initial).toEqual({ y: 0, opacity: 1 });
    expect(animation.animate).toEqual({ y: 0, opacity: 1 });
  });

  // All interaction states must respect reduction, including gestures and exits.
  it.each(kinds)('removes every %s transform and limits reduced fades', (kind) => {
    const animation = resolveInteractionMotion({ kind, reducedMotion: true });
    for (const target of [
      animation.initial,
      animation.animate,
      animation.exit,
      animation.whileHover,
      animation.whileTap,
    ]) {
      expect(target.y).toBe(0);
      expect(Object.keys(target).sort()).toEqual(['opacity', 'y']);
    }
    expect(animation.transition.duration).toBeGreaterThan(0);
    expect(animation.transition.duration).toBeLessThanOrEqual(0.2);
  });

  // Accidentally returning the reduced branch for every user removes state feedback.
  it('provides button feedback without hiding its label', () => {
    const animation = resolveInteractionMotion({ kind: 'button', reducedMotion: false });
    expect(animation.whileHover.y).toBeLessThan(0);
    expect(animation.whileTap.y).toBe(0);
    expect(animation.whileHover.opacity).toBe(1);
    expect(animation.exit.opacity).toBe(1);
  });

  it.each(['menu', 'toast'] as const)('lets a dismissed %s leave without moving layout', (kind) => {
    const animation = resolveInteractionMotion({ kind, reducedMotion: false });
    expect(animation.exit.y).toBeGreaterThan(0);
    expect(animation.exit.opacity).toBe(0);
    expect(Object.keys(animation.exit).sort()).toEqual(['opacity', 'y']);
  });
});
