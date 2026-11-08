'use client';

import type { NavigationPresentation } from '../contracts/navigation-presentation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export type MobileMenuProps = {
  items: NavigationPresentation['items'];
  controls: Pick<
    NavigationPresentation['controls'],
    'openMenuLabel' | 'closeMenuLabel' | 'newTabLabel'
  >;
  navigationLabel: string;
};

export function MobileMenu({ items, controls, navigationLabel }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const focusContact = useRef(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia('(min-width: 64rem)');
    const dismissOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener('change', dismissOnDesktop);
    return () => desktop.removeEventListener('change', dismissOnDesktop);
  }, []);
  return (
    <div className="col-span-full lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button className="min-h-11 px-4 py-[calc(var(--space-3)-1px)] text-sm">
            {controls.openMenuLabel}
          </Button>
        </SheetTrigger>
        <SheetContent
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (!focusContact.current) return;
            focusContact.current = false;
            const target = document.getElementById('contact');
            if (target) {
              event.preventDefault();
              target.focus();
              target.scrollIntoView?.({ block: 'start', behavior: 'instant' });
            }
          }}
        >
          <SheetHeader className="flex flex-wrap items-center justify-between gap-4">
            <SheetTitle className="m-0 text-lg font-semibold">{navigationLabel}</SheetTitle>
            <SheetClose asChild>
              <Button>{controls.closeMenuLabel}</Button>
            </SheetClose>
          </SheetHeader>
          <nav aria-label={navigationLabel}>
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {items.map((item) => (
                <li key={item.purpose}>
                  <SheetClose asChild>
                    <a
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-foreground no-underline wrap-anywhere hover:underline hover:underline-offset-[0.25em]"
                      href={item.destination.href}
                      data-analytics-purpose={item.purpose === 'resume' ? 'resume' : undefined}
                      aria-label={
                        item.destination.kind === 'resume'
                          ? `${item.label} (${controls.newTabLabel})`
                          : undefined
                      }
                      onClick={() => {
                        focusContact.current = item.purpose === 'contact';
                      }}
                      {...(item.destination.kind === 'resume'
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {item.label}
                      {item.destination.kind === 'resume' && (
                        <span className="sr-only"> ({controls.newTabLabel})</span>
                      )}
                    </a>
                  </SheetClose>
                </li>
              ))}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
