import type { ComponentProps } from 'react';
import { cn } from 'cn';

function Skeleton({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('block rounded-md bg-[var(--bg-subtle)]', className)}
      {...props}
    />
  );
}

export { Skeleton };
