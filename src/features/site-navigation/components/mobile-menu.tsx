'use client';

import type { NavigationPresentation } from '../contracts/navigation-presentation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import styles from '../stylesheets/navigation.module.css';

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
    <div className={styles.mobileMenu}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button className={styles.menuTrigger}>{controls.openMenuLabel}</Button>
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
          <div className={styles.menuHeading}>
            <SheetTitle className={styles.menuTitle}>{navigationLabel}</SheetTitle>
            <SheetClose asChild>
              <Button>{controls.closeMenuLabel}</Button>
            </SheetClose>
          </div>
          <nav aria-label={navigationLabel}>
            <ul className={styles.mobileNavigationList}>
              {items.map((item) => (
                <li key={item.purpose}>
                  <SheetClose asChild>
                    <a
                      className={styles.navigationLink}
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
                        <span className={styles.visuallyHidden}> ({controls.newTabLabel})</span>
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
