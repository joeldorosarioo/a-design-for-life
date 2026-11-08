import type { ComponentProps } from 'react';
import { cn } from 'cn';

function Alert({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        'rounded-lg border border-[color:var(--border-control)] bg-[var(--bg-surface)] px-6 py-4 text-sm text-[color:var(--text-primary)] wrap-anywhere',
        className,
      )}
      {...props}
    />
  );
}

export { Alert };
