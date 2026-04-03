'use client';

import {
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
} from 'react';

type AutoGrowTextareaProps = ComponentPropsWithoutRef<'textarea'> & {
  maxHeight?: number;
};

function assignTextareaRef(
  target: ForwardedRef<HTMLTextAreaElement>,
  value: HTMLTextAreaElement | null,
) {
  if (!target) {
    return;
  }

  if (typeof target === 'function') {
    target(value);
    return;
  }

  target.current = value;
}

export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(
  function AutoGrowTextarea(
    {
      maxHeight = 160,
      onInput,
      ...props
    }: AutoGrowTextareaProps,
    forwardedRef,
  ) {
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
        ref={(node) => {
          textareaRef.current = node;
          assignTextareaRef(forwardedRef, node);
        }}
        onInput={(event) => {
          resizeTextarea();
          onInput?.(event);
        }}
      />
    );
  },
);
