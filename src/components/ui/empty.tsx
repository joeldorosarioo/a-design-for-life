import type { ComponentProps } from 'react';
import { cn } from 'cn';

function Empty({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="empty" className={cn('grid gap-4', className)} {...props} />;
}

export { Empty };
