'use client';

import {
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  forwardRef,
  useCallback,
  useLayoutEffect,
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

      const computedStyle = window.getComputedStyle(textarea);
      const minHeight =
        Number.parseFloat(computedStyle.minHeight) || textarea.clientHeight || 0;

      textarea.style.height = '0px';
      const nextHeight = Math.min(
        Math.max(textarea.scrollHeight, minHeight),
        maxHeight,
      );
      textarea.style.height = `${nextHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [maxHeight]);

    useLayoutEffect(() => {
      resizeTextarea();
    }, [props.defaultValue, props.value, resizeTextarea]);

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
