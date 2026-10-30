import { Fragment, type ReactNode } from 'react';
import type { RichText } from '../contracts/rich-text.schema';
import type { ContextualLink } from '../contracts/contextual-link.schema';
import styles from '../stylesheets/cases.module.css';
export type ResolvedCaseLink = { href: string; newTab?: boolean };
export type CaseLinkResolver = (link: ContextualLink) => ResolvedCaseLink | null;
type RichNode =
  RichText['root']['children'][number] | RichText['root']['children'][number]['children'][number];
export function CaseText({
  content,
  resolveLink,
  newTabLabel,
}: {
  content: RichText | null;
  resolveLink: CaseLinkResolver;
  newTabLabel: string;
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
          <ol start={node.start}>{children}</ol>
        ) : (
          <ul>{children}</ul>
        );
      case 'link': {
        const target = resolveLink(node.fields);
        if (!target) return children;
        return (
          <a
            href={target.href}
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
          </a>
        );
      }
    }
  }
  if (!content) return null;
  return (
    <div className={styles.prose}>
      {content.root.children.map((node, index) => (
        <Fragment key={index}>{renderNode(node)}</Fragment>
      ))}
    </div>
  );
}

/** Plain editorial fields preserve authored lines and never interpret HTML. */
export function CaseProse({ text, className = '' }: { text: string | null; className?: string }) {
  if (!text) return null;
  return (
    <div className={`${styles.prose} ${className}`}>
      {text
        .split(/\r?\n[\t ]*\r?\n+/)
        .filter((paragraph) => paragraph.trim())
        .map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
    </div>
  );
}
