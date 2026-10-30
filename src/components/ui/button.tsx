import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/** Only Secondary is needed by this foundation. */
export const buttonVariants = cva('ui-button', {
  variants: { variant: { secondary: 'ui-button-secondary' } },
  defaultVariants: { variant: 'secondary' },
});

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonVariants({ variant, className })} {...props} />;
}
