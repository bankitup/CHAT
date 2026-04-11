'use client';

import { useEffect, useState } from 'react';
import {
  isThreadNearBottom,
  resolveThreadScrollTarget,
  scrollThreadToBottom,
} from './thread-scroll';

type JumpToLatestButtonProps = {
  label: string;
  latestVisibleMessageSeq: number | null;
  targetId: string;
};

export function JumpToLatestButton({
  label,
  latestVisibleMessageSeq,
  targetId,
}: JumpToLatestButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const target = resolveThreadScrollTarget(targetId);

    if (!target || latestVisibleMessageSeq === null) {
      return;
    }

    const updateVisibility = () => {
      setIsVisible(!isThreadNearBottom(target));
    };

    updateVisibility();

    target.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);

    return () => {
      target.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
    };
  }, [latestVisibleMessageSeq, targetId]);

  if (!isVisible || latestVisibleMessageSeq === null) {
    return null;
  }

  return (
    <button
      aria-label={label}
      className="chat-jump-to-latest"
      onClick={() => {
        const target = resolveThreadScrollTarget(targetId);

        if (!target) {
          return;
        }

        scrollThreadToBottom(target, 'smooth');
      }}
      type="button"
    >
      <span aria-hidden="true" className="chat-jump-to-latest-glyph">
        ↓
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
