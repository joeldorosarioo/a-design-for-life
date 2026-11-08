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
