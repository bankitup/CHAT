'use client';

export const THREAD_NEAR_BOTTOM_THRESHOLD_PX = 160;

export function resolveThreadScrollTarget(targetId: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const element = document.getElementById(targetId);
  return element instanceof HTMLElement ? element : null;
}

export function getThreadDistanceFromBottom(target: HTMLElement) {
  return Math.max(target.scrollHeight - target.scrollTop - target.clientHeight, 0);
}

export function isThreadNearBottom(
  target: HTMLElement,
  thresholdPx = THREAD_NEAR_BOTTOM_THRESHOLD_PX,
) {
  return getThreadDistanceFromBottom(target) <= thresholdPx;
}

export function scrollThreadToBottom(
  target: HTMLElement,
  behavior: ScrollBehavior = 'auto',
) {
  target.scrollTo({
    top: target.scrollHeight,
    behavior,
  });
}
