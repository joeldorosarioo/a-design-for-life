'use client';

import type { ComponentProps } from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import styles from './stylesheets/sheet.module.css';

// Adapted from shadcn/ui Sheet: Dialog composition, project tokens, consumer-owned close control.
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;

export function SheetContent({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className={styles.overlay} />
      <SheetPrimitive.Content
        className={[styles.content, className].filter(Boolean).join(' ')}
        {...props}
      />
    </SheetPrimitive.Portal>
  );
}
