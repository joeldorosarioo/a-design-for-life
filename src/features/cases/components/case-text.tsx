import { PortfolioLink } from '@/components/portfolio-link';
import { Fragment, type ReactNode } from 'react';
import { cn } from 'cn';
import type { RichText } from '../contracts/rich-text.schema';
import type { ContextualLink } from '../contracts/contextual-link.schema';
export const caseEyebrowClass = 'm-0 text-xs font-semibold whitespace-pre-line text-primary';
export const caseTextLinkClass =
  'inline-flex min-h-11 items-center justify-self-start gap-2 text-sm font-semibold text-primary no-underline [&:hover]:text-[color:var(--action-hover)] [&:hover]:underline [&:hover]:underline-offset-[0.2em]';
const proseClass =
  'text-base text-muted-foreground [&_p]:whitespace-pre-line [&>:not(:first-child)]:mt-6';

export type ResolvedCaseLink = { href: string; newTab?: boolean };
export type CaseLinkResolver = (link: ContextualLink) => ResolvedCaseLink | null;
type RichNode =
  RichText['root']['children'][number] | RichText['root']['children'][number]['children'][number];
export function CaseText({
  content,
  resolveLink,
  newTabLabel,
  className,
}: {
  content: RichText | null;
  resolveLink: CaseLinkResolver;
  newTabLabel: string;
  className?: string;
}) {
  function renderNode(node: RichNode): ReactNode {
    if (node.type === 'text') {
      let text: ReactNode = node.text;
      if (node.format & 1) text = <strong>{text}</strong>;
      if (node.format & 2) text = <em>{text}</em>;
      return text;
    }
    if (node.type === 'linebreak') return <br />;
    const children = node.children.map((child, index) => (
      <Fragment key={index}>{renderNode(child)}</Fragment>
    ));
    switch (node.type) {
      case 'paragraph':
        return <p>{children}</p>;
      case 'listitem':
        return <li value={node.value}>{children}</li>;
      case 'list':
        return node.listType === 'number' ? (
          <ol start={node.start} className="mb-0 ps-6 [&>li+li]:mt-2">
            {children}
          </ol>
        ) : (
          <ul className="mb-0 ps-6 [&>li+li]:mt-2">{children}</ul>
        );
      case 'link': {
        const target = resolveLink(node.fields);
        if (!target) return children;
        return (
          <PortfolioLink
            href={target.href}
            className="text-primary underline underline-offset-[0.2em] [&:hover]:text-[color:var(--action-hover)]"
            target={target.newTab ? '_blank' : undefined}
            rel={target.newTab ? 'noopener noreferrer' : undefined}
          >
            {children}
            {target.newTab ? (
              <>
                {' '}
                <span className="sr-only">{newTabLabel}</span>
              </>
            ) : null}
          </PortfolioLink>
        );
      }
    }
  }
  if (!content) return null;
  return (
    <div className={cn(proseClass, className)}>
      {content.root.children.map((node, index) => (
        <Fragment key={index}>{renderNode(node)}</Fragment>
      ))}
    </div>
  );
}

/** Plain editorial fields preserve authored lines and never interpret HTML. */
export function CaseProse({ text, className }: { text: string | null; className?: string }) {
  if (!text) return null;
  return (
    <div className={cn(proseClass, className)}>
      {text
        .split(/\r?\n[\t ]*\r?\n+/)
        .filter((paragraph) => paragraph.trim())
        .map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
    </div>
  );
}
