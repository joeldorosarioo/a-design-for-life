'use client';

import type { ComponentProps } from 'react';
import { cn } from 'cn';
import { Dialog as SheetPrimitive } from 'radix-ui';

const Sheet = SheetPrimitive.Root;

function SheetTrigger(props: ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetContent({ className, ...props }: ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-cherry-cola-950/50"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed inset-y-0 end-0 z-[51] flex max-h-dvh w-full max-w-[24rem] flex-col gap-8 overflow-y-auto border-s border-[color:var(--border-default)] bg-[var(--bg-surface)] p-6 text-[color:var(--text-primary)]',
          className,
        )}
        {...props}
      />
    </SheetPrimitive.Portal>
  );
}

function SheetHeader(props: ComponentProps<'div'>) {
  return <div data-slot="sheet-header" {...props} />;
}

function SheetTitle(props: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle };
