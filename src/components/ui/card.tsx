import type { ComponentProps, ComponentPropsWithoutRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const cardVariants = cva('grid min-w-0 gap-6', {
  variants: {
    variant: {
      default: 'content-start rounded-lg border border-[color:var(--border-default)] p-6',
      flush: 'wrap-anywhere',
    },
  },
  defaultVariants: { variant: 'default' },
});

function Card({
  as: Tag = 'article',
  className,
  variant,
  ...props
}: ComponentPropsWithoutRef<'article'> &
  VariantProps<typeof cardVariants> & { as?: 'article' | 'li' }) {
  return <Tag data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />;
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('grid gap-2', className)} {...props} />;
}

export { Card, CardContent };
