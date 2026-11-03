// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CaseContents } from './case-contents';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});
const entries = [
  {
    readingKey: '00000000-0000-4000-8000-000000000002',
    label: 'Second topic',
    anchor: 'section-00000000-0000-4000-8000-000000000002',
  },
  {
    readingKey: '00000000-0000-4000-8000-000000000001',
    label: 'First topic',
    anchor: 'section-00000000-0000-4000-8000-000000000001',
  },
];

// Hardcoded topics or position-derived anchors would break reordered editorial navigation.
it('renders received anchors in editorial order and honors direct hash entry', () => {
  window.history.replaceState(null, '', `/#${entries[1].anchor}`);
  render(<CaseContents entries={entries} label="In this study" />);
  expect(screen.queryByRole('navigation', { name: 'In this study' })).toBeInTheDocument();
  expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
    '#section-00000000-0000-4000-8000-000000000002',
    '#section-00000000-0000-4000-8000-000000000001',
  ]);
  expect(screen.getByRole('link', { name: 'First topic' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  fireEvent.click(screen.getByRole('link', { name: 'Second topic' }));
  expect(screen.getByRole('link', { name: 'Second topic' })).toHaveAttribute(
    'aria-current',
    'location',
  );
});

// The observer is the browser-only boundary; assertions inspect real accessible link state.
it('updates current location from visible sections and removes a stale current entry', () => {
  let notify: IntersectionObserverCallback = () => {};
  const observers: IntersectionObserver[] = [];
  class Observer implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '-10% 0px -65% 0px';
    readonly scrollMargin = '0px';
    readonly thresholds = [0];
    constructor(callback: IntersectionObserverCallback) {
      notify = callback;
      observers.push(this);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', Observer);
  const { rerender } = render(
    <>
      <CaseContents entries={entries} label="Contents" />
      <section id={entries[0].anchor} />
      <section id={entries[1].anchor} />
    </>,
  );
  act(() =>
    notify(
      [
        {
          target: document.getElementById(entries[1].anchor)!,
          isIntersecting: true,
          boundingClientRect: new DOMRect(0, 60, 342, 240),
          intersectionRect: new DOMRect(0, 60, 342, 240),
          rootBounds: new DOMRect(0, 0, 390, 844),
          intersectionRatio: 1,
          time: 0,
        },
      ],
      observers.at(-1)!,
    ),
  );
  expect(screen.queryByRole('link', { name: 'First topic' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  rerender(<CaseContents entries={[entries[0]]} label="Contents" />);
  expect(screen.getByRole('link', { name: 'Second topic' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  expect(screen.getAllByRole('link')).toHaveLength(1);
});

it('follows history hash changes and omits empty navigation', () => {
  const { rerender } = render(<CaseContents entries={entries} label="Contents" />);
  window.history.replaceState(null, '', `/#${entries[1].anchor}`);
  fireEvent(window, new HashChangeEvent('hashchange'));
  expect(screen.queryByRole('link', { name: 'First topic' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  rerender(<CaseContents entries={[]} label="Contents" />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

// A direct return above the article must not keep announcing the last section as current.
it('returns to the first section on scroll without another intersection notification', () => {
  let notify: IntersectionObserverCallback = () => {};
  class Observer {
    constructor(callback: IntersectionObserverCallback) {
      notify = callback;
    }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', Observer);
  render(
    <>
      <CaseContents entries={entries} label="Contents" />
      <section id={entries[0].anchor} />
      <section id={entries[1].anchor} />
    </>,
  );
  const first = document.getElementById(entries[0].anchor)!;
  const last = document.getElementById(entries[1].anchor)!;
  let firstTop = -2000;
  vi.spyOn(first, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, firstTop, 342, 240),
  );
  const change = (intersects: boolean) => ({
    target: last,
    isIntersecting: intersects,
    boundingClientRect: new DOMRect(0, intersects ? 60 : 5000, 342, 240),
    intersectionRect: new DOMRect(0, 0, 0, 0),
    rootBounds: new DOMRect(0, 0, 390, 844),
    intersectionRatio: intersects ? 1 : 0,
    time: 0,
  });
  act(() => notify([change(true)], {} as IntersectionObserver));
  expect(screen.getByRole('link', { name: 'First topic' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  // Below the article, no new section intersects; the final entry remains meaningful.
  act(() => notify([change(false)], {} as IntersectionObserver));
  expect(screen.getByRole('link', { name: 'First topic' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  firstTop = 1200;
  act(() => fireEvent.scroll(window));
  expect(screen.getByRole('link', { name: 'Second topic' })).toHaveAttribute(
    'aria-current',
    'location',
  );
});
