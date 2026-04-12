'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { createPortal } from 'react-dom';
import { saveHomeAppZoomPreferenceAction } from './actions';
import {
  applyAppZoomModeToDocument,
  type AppZoomMode,
} from '@/modules/ui-preferences/app-zoom';
import {
  getZoomSwitcherClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client';

type HomeAppZoomControlProps = {
  compact?: boolean;
  initialZoomMode: AppZoomMode;
  language: AppLanguage;
};

type HomeZoomOverlayLayout = {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
};

const HOME_ZOOM_OVERLAY_MARGIN_PX = 16;
const HOME_ZOOM_OVERLAY_OFFSET_PX = 10;
const HOME_ZOOM_PANEL_COMPACT_WIDTH_PX = 320;
const HOME_ZOOM_PANEL_WIDTH_PX = 352;

function resolveZoomModeLabel(input: {
  mode: AppZoomMode;
  t: ReturnType<typeof getZoomSwitcherClientTranslations>;
}) {
  switch (input.mode) {
    case 'larger':
      return input.t.zoomSwitcher.larger;
    case 'largest':
      return input.t.zoomSwitcher.largest;
    case 'standard':
    default:
      return input.t.zoomSwitcher.standard;
  }
}

function resolveZoomModeHint(input: {
  mode: AppZoomMode;
  t: ReturnType<typeof getZoomSwitcherClientTranslations>;
}) {
  switch (input.mode) {
    case 'larger':
      return input.t.zoomSwitcher.largerHint;
    case 'largest':
      return input.t.zoomSwitcher.largestHint;
    case 'standard':
    default:
      return input.t.zoomSwitcher.standardHint;
  }
}

function resolveCompactZoomModeToken(mode: AppZoomMode) {
  switch (mode) {
    case 'larger':
      return 'A+';
    case 'largest':
      return 'A++';
    case 'standard':
    default:
      return 'A';
  }
}

export function HomeAppZoomControl({
  compact = false,
  initialZoomMode,
  language,
}: HomeAppZoomControlProps) {
  const router = useRouter();
  const t = getZoomSwitcherClientTranslations(language);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const savedZoomModeRef = useRef<AppZoomMode>(initialZoomMode);
  const [savedZoomMode, setSavedZoomMode] =
    useState<AppZoomMode>(initialZoomMode);
  const [previewZoomMode, setPreviewZoomMode] =
    useState<AppZoomMode>(initialZoomMode);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [overlayLayout, setOverlayLayout] =
    useState<HomeZoomOverlayLayout | null>(null);
  const [isSaving, startTransition] = useTransition();

  useEffect(() => {
    savedZoomModeRef.current = savedZoomMode;
  }, [savedZoomMode]);

  useEffect(() => {
    applyAppZoomModeToDocument(previewZoomMode);
  }, [previewZoomMode]);

  useEffect(() => {
    return () => {
      applyAppZoomModeToDocument(savedZoomModeRef.current);
    };
  }, []);

  const hasUnsavedPreview = previewZoomMode !== savedZoomMode;
  const currentZoomModeLabel = useMemo(
    () =>
      resolveZoomModeLabel({
        mode: hasUnsavedPreview ? previewZoomMode : savedZoomMode,
        t,
      }),
    [hasUnsavedPreview, previewZoomMode, savedZoomMode, t],
  );
  const currentCompactZoomToken = useMemo(
    () =>
      resolveCompactZoomModeToken(
        hasUnsavedPreview ? previewZoomMode : savedZoomMode,
      ),
    [hasUnsavedPreview, previewZoomMode, savedZoomMode],
  );

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setPreviewZoomMode(savedZoomModeRef.current);
    setErrorMessage(null);
    setOverlayLayout(null);
  }, []);

  const updateOverlayLayout = useCallback(() => {
    if (
      typeof window === 'undefined' ||
      !containerRef.current
    ) {
      return;
    }

    const triggerRect = containerRef.current.getBoundingClientRect();
    const preferredWidth = compact
      ? HOME_ZOOM_PANEL_COMPACT_WIDTH_PX
      : HOME_ZOOM_PANEL_WIDTH_PX;
    const availableWidth = Math.max(
      0,
      window.innerWidth - HOME_ZOOM_OVERLAY_MARGIN_PX * 2,
    );
    const width = Math.min(preferredWidth, availableWidth);
    const top = triggerRect.bottom + HOME_ZOOM_OVERLAY_OFFSET_PX;
    const minLeft = HOME_ZOOM_OVERLAY_MARGIN_PX;
    const maxLeft = Math.max(
      HOME_ZOOM_OVERLAY_MARGIN_PX,
      window.innerWidth - HOME_ZOOM_OVERLAY_MARGIN_PX - width,
    );
    const left = Math.min(
      Math.max(triggerRect.right - width, minLeft),
      maxLeft,
    );
    const maxHeight = Math.max(
      220,
      window.innerHeight - top - HOME_ZOOM_OVERLAY_MARGIN_PX,
    );

    setOverlayLayout({
      left,
      maxHeight,
      top,
      width,
    });
  }, [compact]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        closePanel();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closePanel();
      }
    }

    updateOverlayLayout();
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateOverlayLayout);
    window.addEventListener('scroll', updateOverlayLayout, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateOverlayLayout);
      window.removeEventListener('scroll', updateOverlayLayout, true);
    };
  }, [closePanel, isOpen, updateOverlayLayout]);

  const handlePreviewZoomMode = useCallback((mode: AppZoomMode) => {
    setPreviewZoomMode(mode);
    setErrorMessage(null);
  }, []);

  const handleConfirmZoomMode = useCallback(() => {
    const nextZoomMode = previewZoomMode;

    startTransition(async () => {
      const result = await saveHomeAppZoomPreferenceAction({
        language,
        zoomMode: nextZoomMode,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        setPreviewZoomMode(savedZoomModeRef.current);
        return;
      }

      setSavedZoomMode(nextZoomMode);
      savedZoomModeRef.current = nextZoomMode;
      setErrorMessage(null);
      setIsOpen(false);
      setOverlayLayout(null);
      router.refresh();
    });
  }, [language, previewZoomMode, router]);

  return (
    <>
      <div
        className={
          compact ? 'home-zoom-control home-zoom-control-compact' : 'home-zoom-control'
        }
        ref={containerRef}
      >
        <button
          aria-label={`${t.zoomSwitcher.trigger}: ${currentZoomModeLabel}`}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className={
            isOpen
              ? compact
                ? 'home-zoom-trigger home-zoom-trigger-compact home-zoom-trigger-active'
                : 'home-zoom-trigger home-zoom-trigger-active'
              : compact
                ? 'home-zoom-trigger home-zoom-trigger-compact'
                : 'home-zoom-trigger'
          }
          onClick={() => {
            if (isOpen) {
              closePanel();
              return;
            }

            setIsOpen(true);
            setErrorMessage(null);
          }}
          type="button"
        >
          <span aria-hidden="true" className="home-zoom-trigger-glyph">
            Aa
          </span>
          <span className="home-zoom-trigger-copy">
            <span className="home-zoom-trigger-label">
              {t.zoomSwitcher.trigger}
            </span>
            <span className="home-zoom-trigger-value">
              {compact ? currentCompactZoomToken : currentZoomModeLabel}
            </span>
          </span>
        </button>
      </div>

      {isOpen && overlayLayout && typeof document !== 'undefined'
        ? createPortal(
            <div className="home-zoom-overlay">
              <button
                aria-label={t.zoomSwitcher.cancel}
                className="home-zoom-overlay-backdrop"
                onClick={closePanel}
                tabIndex={-1}
                type="button"
              />

              <div
                aria-label={t.zoomSwitcher.title}
                className={
                  compact
                    ? 'card home-zoom-panel home-zoom-panel-compact home-zoom-panel-overlay'
                    : 'card home-zoom-panel home-zoom-panel-overlay'
                }
                ref={panelRef}
                role="dialog"
                style={{
                  left: `${overlayLayout.left}px`,
                  maxHeight: `${overlayLayout.maxHeight}px`,
                  top: `${overlayLayout.top}px`,
                  width: `${overlayLayout.width}px`,
                }}
              >
                <div className="stack home-zoom-panel-copy">
                  <div className="stack settings-card-copy settings-section-copy">
                    <h2 className="section-title home-zoom-panel-title">
                      {t.zoomSwitcher.title}
                    </h2>
                    <p className="muted home-zoom-panel-body">
                      {t.zoomSwitcher.body}
                    </p>
                  </div>

                  <div className="home-zoom-option-list">
                    {(['standard', 'larger', 'largest'] as const).map((mode) => {
                      const isSelectedPreview = previewZoomMode === mode;
                      const isSavedMode = savedZoomMode === mode;

                      return (
                        <button
                          key={mode}
                          className={
                            isSelectedPreview
                              ? 'home-zoom-option home-zoom-option-active'
                              : 'home-zoom-option'
                          }
                          onClick={() => handlePreviewZoomMode(mode)}
                          type="button"
                        >
                          <span className="home-zoom-option-copy">
                            <span className="home-zoom-option-title">
                              {resolveZoomModeLabel({ mode, t })}
                            </span>
                            <span className="home-zoom-option-hint">
                              {resolveZoomModeHint({ mode, t })}
                            </span>
                          </span>
                          <span
                            aria-hidden="true"
                            className="home-zoom-option-preview"
                            data-zoom-mode={mode}
                          >
                            <span className="home-zoom-option-preview-line home-zoom-option-preview-line-wide" />
                            <span className="home-zoom-option-preview-line" />
                            <span className="home-zoom-option-preview-pill" />
                          </span>
                          {isSelectedPreview && !isSavedMode ? (
                            <span className="summary-pill summary-pill-muted home-zoom-option-state">
                              {t.zoomSwitcher.previewBadge}
                            </span>
                          ) : isSavedMode ? (
                            <span className="summary-pill summary-pill-muted home-zoom-option-state">
                              {t.zoomSwitcher.currentBadge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  <p className="home-zoom-preview-note">
                    {t.zoomSwitcher.previewNotice}
                  </p>

                  {errorMessage ? (
                    <p className="notice notice-error home-zoom-error">
                      {errorMessage}
                    </p>
                  ) : null}

                  {hasUnsavedPreview ? (
                    <div className="home-zoom-actions">
                      <button
                        className="button"
                        disabled={isSaving}
                        onClick={handleConfirmZoomMode}
                        type="button"
                      >
                        {t.zoomSwitcher.confirm}
                      </button>
                      <button
                        className="pill"
                        disabled={isSaving}
                        onClick={closePanel}
                        type="button"
                      >
                        {t.zoomSwitcher.cancel}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
