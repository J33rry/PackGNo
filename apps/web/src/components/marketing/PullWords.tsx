import type { ReactNode } from 'react';

/**
 * Splits text into words that slide up on mount with a staggered delay
 * (see `.pull-word` in globals.css). Server-safe. Segments let a phrase mix
 * styles (e.g. one italic serif clause) while keeping one continuous stagger.
 */
type Segment = { text: string; className?: string };

export function PullWords({
  text,
  segments,
  className = '',
  baseDelay = 0,
}: {
  text?: string;
  segments?: Segment[];
  className?: string;
  baseDelay?: number;
}) {
  const parts: Segment[] = segments ?? [{ text: text ?? '' }];
  let index = 0;
  const nodes: ReactNode[] = [];

  parts.forEach((seg, si) => {
    const words = seg.text.split(' ').filter(Boolean);
    words.forEach((word, wi) => {
      const i = index++;
      nodes.push(
        <span
          key={`${si}-${wi}`}
          className={`pull-word ${seg.className ?? ''}`}
          style={{ ['--i' as string]: i, animationDelay: `${baseDelay + i * 0.07}s` }}
        >
          {word}
        </span>,
      );
      nodes.push(<span key={`sp-${si}-${wi}`}>{' '}</span>);
    });
  });

  return <span className={className}>{nodes}</span>;
}
