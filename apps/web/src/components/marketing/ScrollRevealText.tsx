'use client';

import { Fragment, useEffect, useRef } from 'react';

/**
 * Progressive character reveal linked to scroll position: characters brighten
 * from faint to full as the paragraph travels through the viewport, giving a
 * calm "reading along" cadence. One scroll handler drives all characters via a
 * rAF-throttled pass; respects prefers-reduced-motion (renders fully lit).
 *
 * Words are wrapped in inline-block spans with a normal breakable space between
 * them, so the paragraph wraps to its container instead of overflowing.
 */
export function ScrollRevealText({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chars = Array.from(el.querySelectorAll<HTMLElement>('[data-char]'));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      chars.forEach((c) => (c.style.opacity = '1'));
      return;
    }

    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.min(
        1,
        Math.max(0, (vh * 0.85 - rect.top) / (vh * 0.55 + rect.height)),
      );
      const total = chars.length;
      chars.forEach((c, i) => {
        const cp = i / total;
        const local = (progress - cp + 0.12) / 0.12;
        c.style.opacity = String(Math.min(1, Math.max(0.16, local)));
      });
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [text]);

  const words = text.split(' ');

  return (
    <p ref={ref} className={className} aria-label={text}>
      {words.map((word, wi) => (
        <Fragment key={wi}>
          <span className="inline-block">
            {Array.from(word).map((ch, ci) => (
              <span key={ci} data-char aria-hidden="true" style={{ opacity: 0.16 }}>
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </p>
  );
}
