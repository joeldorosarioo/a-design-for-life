import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
  'inline-flex max-w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-6 py-3 text-center font-sans text-base font-semibold no-underline wrap-anywhere disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'border-0 bg-[var(--action-background)] text-[color:var(--action-on-background)] not-disabled:hover:bg-[var(--action-hover)]',
        secondary:
          'border border-[color:var(--border-default)] bg-[var(--bg-surface)] text-[color:var(--action-default)] not-disabled:hover:bg-[var(--action-soft)] not-disabled:active:border-[color:var(--border-control)] not-disabled:active:text-[color:var(--action-hover)]',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

function Button({
  className,
  variant = 'secondary',
  asChild = false,
  type = 'button',
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Button };
