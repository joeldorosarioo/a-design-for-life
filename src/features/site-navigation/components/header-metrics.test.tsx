// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { HeaderMetrics } from './header-metrics';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty('--portfolio-header-height');
  window.history.replaceState(null, '', '/');
});
it('corrects an initially occluded native hash once using the measured Header height', () => {
  window.history.replaceState(null, '', '/#contact');
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const top = this.id === 'contact' ? 96 : 0;
    const height = this.tagName === 'HEADER' ? 156 : 300;
    return {
      top,
      bottom: top + height,
      left: 0,
      right: 390,
      width: 390,
      height,
      x: 0,
      y: top,
      toJSON() {},
    };
  });
  const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  render(
    <>
      <header data-portfolio-header>
        <HeaderMetrics />
      </header>
      <section id="contact">Contact</section>
    </>,
  );
  expect(scroll).toHaveBeenCalledWith({ top: -84, behavior: 'instant' });
  window.dispatchEvent(new Event('resize'));
  expect(scroll).toHaveBeenCalledTimes(1);
});
it('publishes the real Header height for native anchor offsets and cleans its owned value', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 156,
    left: 0,
    right: 390,
    width: 390,
    height: 156,
    x: 0,
    y: 0,
    toJSON() {},
  });
  const view = render(
    <header data-portfolio-header>
      <HeaderMetrics />
    </header>,
  );
  expect(document.documentElement.style.getPropertyValue('--portfolio-header-height')).toBe(
    '156px',
  );
  view.unmount();
  expect(document.documentElement.style.getPropertyValue('--portfolio-header-height')).toBe('');
});
