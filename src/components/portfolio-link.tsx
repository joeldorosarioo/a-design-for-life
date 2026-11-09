import Link from 'next/link';
import type { ComponentPropsWithRef } from 'react';

type PortfolioLinkProps = ComponentPropsWithRef<'a'> & {
  href: string;
  transitionTypes?: string[];
  onNavigate?: ComponentPropsWithRef<typeof Link>['onNavigate'];
};

export function PortfolioLink({ href, transitionTypes, onNavigate, ...props }: PortfolioLinkProps) {
  const publicPage = /^\/(?:pt|en)(?=\/|[?#]|$)/.test(href);
  if (publicPage && (!props.target || props.target === '_self') && props.download == null) {
    // Select the current published snapshot on navigation.
    return (
      <Link
        {...props}
        href={href}
        prefetch={false}
        transitionTypes={transitionTypes}
        onNavigate={onNavigate}
      />
    );
  }
  return <a {...props} href={href} />;
}
