// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

afterEach(cleanup);

// Omitting the safe default would submit the surrounding form on activation.
it('does not submit its surrounding form unless explicitly requested', async () => {
  let submissions = 0;
  const user = userEvent.setup();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submissions += 1;
      }}
    >
      <Button>Open projects</Button>
      <Button type="submit">Send</Button>
    </form>,
  );
  await user.click(screen.getByRole('button', { name: 'Open projects' }));
  expect(submissions).toBe(0);
  await user.click(screen.getByRole('button', { name: 'Send' }));
  expect(submissions).toBe(1);
});
