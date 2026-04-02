'use client';

import {
  type ComponentPropsWithoutRef,
  useCallback,
  useEffect,
  useRef,
} from 'react';

type AutoGrowTextareaProps = ComponentPropsWithoutRef<'textarea'> & {
  maxHeight?: number;
};

export function AutoGrowTextarea({
  maxHeight = 160,
  onInput,
  ...props
}: AutoGrowTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxHeight]);

  useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      onInput={(event) => {
        resizeTextarea();
        onInput?.(event);
      }}
    />
  );
}
