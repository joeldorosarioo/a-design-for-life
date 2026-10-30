import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

/** Closed Figma actions: Primary for content CTAs, Secondary for the shared shell. */
export const buttonVariants = cva('ui-button', {
  variants: { variant: { primary: 'ui-button-primary', secondary: 'ui-button-secondary' } },
  defaultVariants: { variant: 'secondary' },
});

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonVariants({ variant, className })} {...props} />;
}
