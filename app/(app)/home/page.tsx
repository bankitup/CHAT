import { logoutAction } from '../actions';
import { ProfileSettingsForm } from '../settings/profile-settings-form';
import { ProfileStatusForm } from '../settings/profile-status-form';
import {
  type HomeSpacePlanCode,
  type HomeSpaceUsageState,
} from './space-plan-config';
import { HomeAppZoomControl } from './home-app-zoom-control';
import { HomeLanguageSwitch } from './home-language-switch';
import { PrivateSpaceCtaCard } from './private-space-cta-card';
import { SpaceThemeCard } from './space-theme-card';
import {
  getHomeSpaceUsageSnapshot,
  type HomeSpaceUsageSnapshot,
} from './space-usage-data';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  promoteSpaceParticipantsToAdminAction,
  requestAdditionalSpaceAccountsAction,
  removeSpaceParticipantsAction,
} from './actions';
import { SpaceParticipantsModule } from './space-participants-module';
import { SpaceUsageCard, type SpaceUsageMetricViewModel } from './space-usage-card';
import { getRequestViewer } from '@/lib/request-context/server';
import { formatMemberCount, getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import { getCurrentUserProfile } from '@/modules/messaging/data/server';
import type { ReactNode } from 'react';
import {
  getUserFacingErrorFallback,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import {
  getManageableSpaceParticipantsForUser,
  isSpaceMembersSchemaCacheErrorMessage,
  resolveActiveSpaceForUser,
  resolveSpaceAccessContract,
  resolveSpaceGovernanceRoleForRuntimeSpaceRole,
  resolveV1TestSpaceFallback,
} from '@/modules/spaces/server';
import { resolveSpaceProductPosture } from '@/modules/spaces/shell';
import {
  getKeepCozyPrimaryTestFlowHints,
  getKeepCozyHomeDashboardData,
  isKeepCozyPrimaryTestHomeName,
} from '@/modules/keepcozy/server';
import { withSpaceParam } from '@/modules/spaces/url';
import { getRequestAppZoomMode } from '@/modules/ui-preferences/app-zoom-server';

type HomeDashboardPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    participants?: string;
    space?: string;
  }>;
};

function resolveUsageProgressPercent(input: { limit: number; used: number }) {
  if (input.limit <= 0) {
    return 0;
  }

  return Math.max(0, Math.min((input.used / input.limit) * 100, 100));
}

function formatStorageUsageBytes(input: {
  unitLabel: string;
  valueBytes: number;
}) {
  const valueInGigabytes = input.valueBytes / (1024 * 1024 * 1024);
  const roundedValue =
    valueInGigabytes >= 10
      ? Math.round(valueInGigabytes)
      : Math.round(valueInGigabytes * 10) / 10;

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: roundedValue >= 10 ? 0 : 1,
    minimumFractionDigits:
      roundedValue > 0 && roundedValue < 10 ? 1 : 0,
  }).format(roundedValue)} ${input.unitLabel}`;
}

function resolveHomeSpacePlanLabel(input: {
  plan: HomeSpacePlanCode;
  t: ReturnType<typeof getTranslations>;
}) {
  switch (input.plan) {
    case 'private':
      return input.t.messengerHome.spaceUsagePrivatePlanLabel;
    case 'community':
      return input.t.messengerHome.spaceUsageCommunityPlanLabel;
    default:
      return input.plan;
  }
}

function resolveHomeSpacePlanSummary(input: {
  plan: HomeSpacePlanCode;
  t: ReturnType<typeof getTranslations>;
}) {
  switch (input.plan) {
    case 'private':
      return input.t.messengerHome.spaceUsagePrivatePlanSummary;
    case 'community':
      return input.t.messengerHome.spaceUsageCommunityPlanSummary;
    default:
      return null;
  }
}

function resolveHomeSpaceMetricStateLabel(input: {
  state: HomeSpaceUsageState;
  t: ReturnType<typeof getTranslations>;
}) {
  switch (input.state) {
    case 'future':
      return input.t.messengerHome.spaceUsageFutureLabel;
    case 'nearing':
      return input.t.messengerHome.spaceUsageNearingLimitLabel;
    case 'over':
      return input.t.messengerHome.spaceUsageOverLimitLabel;
    default:
      return null;
  }
}

function resolveHomeSpacePlanStateLabel(input: {
  state: HomeSpaceUsageSnapshot['overallState'];
  t: ReturnType<typeof getTranslations>;
}) {
  switch (input.state) {
    case 'nearing':
      return input.t.messengerHome.spaceUsageNearingLimitLabel;
    case 'over':
      return input.t.messengerHome.spaceUsageUpgradeRecommendedLabel;
    default:
      return null;
  }
}

function resolveHomeSpaceUpgradeActionLabel(input: {
  nextPlan: HomeSpaceUsageSnapshot['nextPlan'];
  t: ReturnType<typeof getTranslations>;
}) {
  if (input.nextPlan === 'community') {
    return input.t.messengerHome.spaceUsageUpgradeToCommunityAction;
  }

  return input.t.messengerHome.spaceUsageViewUsageAction;
}

function buildPrivateSpaceCreateHref(spaceId: string) {
  return withSpaceParam('/spaces/new?profile=messenger_full', spaceId);
}

function buildMessengerSpaceUsageData(input: {
  managePlanHref: string;
  snapshot: HomeSpaceUsageSnapshot;
  t: ReturnType<typeof getTranslations>;
  upgradeHref: string;
}) {
  const metrics: SpaceUsageMetricViewModel[] = [
    {
      id: 'members',
      label: input.t.messengerHome.spaceUsageMembersLabel,
      limitLabel: String(input.snapshot.members.limit),
      progressPercent: resolveUsageProgressPercent({
        limit: input.snapshot.members.limit,
        used: input.snapshot.members.used,
      }),
      state: input.snapshot.members.state,
      stateLabel: resolveHomeSpaceMetricStateLabel({
        state: input.snapshot.members.state,
        t: input.t,
      }),
      tone: 'live',
      usedLabel: String(input.snapshot.members.used),
    },
    {
      id: 'admins',
      label: input.t.messengerHome.spaceUsageAdminsLabel,
      limitLabel: String(input.snapshot.admins.limit),
      progressPercent: resolveUsageProgressPercent({
        limit: input.snapshot.admins.limit,
        used: input.snapshot.admins.used,
      }),
      state: input.snapshot.admins.state,
      stateLabel: resolveHomeSpaceMetricStateLabel({
        state: input.snapshot.admins.state,
        t: input.t,
      }),
      tone: 'live',
      usedLabel: String(input.snapshot.admins.used),
    },
    {
      id: 'storage',
      label: input.t.messengerHome.spaceUsageStorageLabel,
      limitLabel: formatStorageUsageBytes({
        unitLabel: input.t.messengerHome.spaceUsageStorageUnit,
        valueBytes: input.snapshot.storage.limitBytes,
      }),
      progressPercent: resolveUsageProgressPercent({
        limit: input.snapshot.storage.limitBytes,
        used: input.snapshot.storage.usedBytes,
      }),
      state: input.snapshot.storage.state,
      stateLabel: resolveHomeSpaceMetricStateLabel({
        state: input.snapshot.storage.state,
        t: input.t,
      }),
      tone: 'live',
      usedLabel: formatStorageUsageBytes({
        unitLabel: input.t.messengerHome.spaceUsageStorageUnit,
        valueBytes: input.snapshot.storage.usedBytes,
      }),
    },
    {
      id: 'call-minutes',
      label: input.t.messengerHome.spaceUsageCallMinutesLabel,
      limitLabel: `${input.snapshot.callMinutes.limit} ${input.t.messengerHome.spaceUsageMinutesUnit}`,
      progressPercent: 0,
      state: input.snapshot.callMinutes.state,
      stateLabel: resolveHomeSpaceMetricStateLabel({
        state: input.snapshot.callMinutes.state,
        t: input.t,
      }),
      tone: 'future',
      usedLabel: `${input.snapshot.callMinutes.used} ${input.t.messengerHome.spaceUsageMinutesUnit}`,
    },
  ];

  return {
    copy: {
      body: input.t.messengerHome.spaceUsageBody,
      currentPlanLabel: input.t.messengerHome.spaceUsageCurrentPlanLabel,
      futureTrackingNote: input.t.messengerHome.spaceUsageFutureTrackingNote,
      managePlanAction: input.t.messengerHome.spaceUsageManagePlanAction,
      previewPill: input.t.messengerHome.spaceUsagePreviewPill,
      title: input.t.messengerHome.spaceUsageTitle,
    },
    managePlanHref: input.managePlanHref,
    metrics,
    planLabel: resolveHomeSpacePlanLabel({
      plan: input.snapshot.plan,
      t: input.t,
    }),
    planState: input.snapshot.overallState,
    planStateLabel: resolveHomeSpacePlanStateLabel({
      state: input.snapshot.overallState,
      t: input.t,
    }),
    planSummary: resolveHomeSpacePlanSummary({
      plan: input.snapshot.plan,
      t: input.t,
    }),
    upgradeHref: input.upgradeHref,
    upgradeActionLabel: resolveHomeSpaceUpgradeActionLabel({
      nextPlan: input.snapshot.nextPlan,
      t: input.t,
    }),
    upgradeRecommended: input.snapshot.upgradeRecommended,
  };
}

function HomeLogoutSection({
  t,
}: {
  t: ReturnType<typeof getTranslations>;
}) {
  return (
    <section className="card stack settings-surface settings-home-card settings-home-card-session messenger-home-session-card">
      <div className="stack settings-card-copy settings-section-copy">
        <h2 className="section-title">{t.settings.logoutTitle}</h2>
        <p className="muted">{t.settings.logoutSubtitle}</p>
      </div>
      <form action={logoutAction}>
        <button
          className="button button-secondary settings-logout-button"
          type="submit"
        >
          {t.settings.logoutButton}
        </button>
      </form>
    </section>
  );
}

function HomeDashboardSectionFlow({
  children,
  className,
  logoutSection,
}: {
  children: ReactNode;
  className?: string;
  logoutSection: ReactNode;
}) {
  return (
    <div
      className={
        className
          ? `stack home-dashboard-main-flow ${className}`
          : 'stack home-dashboard-main-flow'
      }
    >
      {children}
      {logoutSection}
    </div>
  );
}

async function requireHomeSpaceContext(requestedSpaceId?: string) {
  const [user, language] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
  ]);

  if (!user?.id) {
    redirect('/login');
  }

  const explicitV1TestSpace = await resolveV1TestSpaceFallback({
    requestedSpaceId,
    source: 'space-home-dashboard-explicit-v1-test-bypass',
  });

  if (explicitV1TestSpace) {
    const access = resolveSpaceAccessContract({
      governance: resolveSpaceGovernanceRoleForRuntimeSpaceRole('member'),
      profile: 'keepcozy_ops',
      role: 'member',
    });

    return {
      activeSpace: {
        access,
        canManageMembers: access.platform.governance.canManageMembers,
        defaultShellRoute: '/home' as const,
        governanceRole: access.platform.governance.governanceRole,
        governanceRoleSource: access.platform.governance.governanceRoleSource,
        id: explicitV1TestSpace.id,
        name: explicitV1TestSpace.name,
        profile: 'keepcozy_ops' as const,
        profileSource: 'space_name_test_default' as const,
        role: 'member' as const,
        theme: 'dark' as const,
        themeSource: 'default_dark' as const,
      },
      language,
      t: getTranslations(language),
      user,
    };
  }

  try {
    const activeSpaceState = await resolveActiveSpaceForUser({
      requestedSpaceId,
      source: 'space-home-dashboard',
      userEmail: user.email ?? null,
      userId: user.id,
    });

    if (!activeSpaceState.activeSpace || activeSpaceState.requestedSpaceWasInvalid) {
      redirect('/spaces');
    }

    return {
      activeSpace: activeSpaceState.activeSpace,
      language,
      t: getTranslations(language),
      user,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isSpaceMembersSchemaCacheErrorMessage(message)) {
      const fallbackSpace = await resolveV1TestSpaceFallback({
        requestedSpaceId,
        source: 'space-home-dashboard',
      });

      if (!fallbackSpace) {
        redirect('/spaces');
      }

      const access = resolveSpaceAccessContract({
        governance: resolveSpaceGovernanceRoleForRuntimeSpaceRole('member'),
        profile: 'keepcozy_ops',
        role: 'member',
      });

      return {
        activeSpace: {
          access,
          canManageMembers: access.platform.governance.canManageMembers,
          defaultShellRoute: '/home' as const,
          governanceRole: access.platform.governance.governanceRole,
          governanceRoleSource: access.platform.governance.governanceRoleSource,
          id: fallbackSpace.id,
          name: fallbackSpace.name,
          profile: 'keepcozy_ops' as const,
          profileSource: 'space_name_test_default' as const,
          role: 'member' as const,
          theme: 'dark' as const,
          themeSource: 'default_dark' as const,
        },
        language,
        t: getTranslations(language),
        user,
      };
    }

    throw error;
  }
}

export default async function HomeDashboardPage({
  searchParams,
}: HomeDashboardPageProps) {
  const query = await searchParams;
  const { activeSpace, language, t, user } = await requireHomeSpaceContext(
    query.space,
  );
  const currentZoomMode = await getRequestAppZoomMode();
  const activeProductPosture = resolveSpaceProductPosture(activeSpace.profile);
  const canManageSpaceAppearance =
    activeSpace.access.platform.governance.canManageMembers;
  const shouldShowPrivateSpaceCta =
    !activeSpace.access.platform.governance.canManageMembers;
  const privateSpaceCreateHref = buildPrivateSpaceCreateHref(activeSpace.id);

  if (activeProductPosture === 'messenger') {
    const canManageMessengerMembers =
      activeSpace.access.platform.governance.canManageMembers;
    const [currentUserProfile, manageableParticipants] = await Promise.all([
      getCurrentUserProfile(user.id, user.email ?? null),
      canManageMessengerMembers
        ? getManageableSpaceParticipantsForUser({
            requestedSpaceId: activeSpace.id,
            source: 'home:space-participants',
            userEmail: user.email ?? null,
            userId: user.id,
          })
        : null,
    ]);
    const visibleError = query.error
      ? sanitizeUserFacingErrorMessage({
          fallback: getUserFacingErrorFallback(language, 'settings'),
          language,
          rawMessage: query.error,
        })
      : null;
    const visibleMessage = query.message?.trim() || null;
    const participantsDefaultOpen = query.participants?.trim() === 'open';
    const spaceUsageSnapshot =
      canManageMessengerMembers && manageableParticipants
        ? await getHomeSpaceUsageSnapshot({
            participants: manageableParticipants.participants,
            spaceId: activeSpace.id,
          })
        : null;
    const spaceUsage = spaceUsageSnapshot
      ? buildMessengerSpaceUsageData({
          managePlanHref: withSpaceParam('/spaces', activeSpace.id),
          snapshot: spaceUsageSnapshot,
          t,
          upgradeHref: withSpaceParam('/spaces', activeSpace.id),
        })
      : null;
    const logoutSection = <HomeLogoutSection t={t} />;

    return (
      <section className="stack messenger-home-screen messenger-home-shell">
        {visibleMessage ? (
          <div aria-live="polite" className="notice notice-success notice-inline">
            <span aria-hidden="true" className="notice-check">
              ✓
            </span>
            <span className="notice-copy">{visibleMessage}</span>
          </div>
        ) : null}

        {visibleError ? <p className="notice notice-error">{visibleError}</p> : null}

        <HomeDashboardSectionFlow
          className="messenger-home-main-flow"
          logoutSection={logoutSection}
        >
          <section className="messenger-home-personal-grid">
            <section className="card stack settings-surface settings-home-card messenger-home-personal-card messenger-home-profile-editor-card">
              <div className="messenger-home-profile-header">
                <div className="messenger-home-profile-topline">
                  <div className="stack settings-card-copy settings-section-copy messenger-home-profile-copy">
                    <h2 className="section-title">{t.settings.profileTitle}</h2>
                  </div>

                  <div className="messenger-home-profile-controls">
                    <HomeLanguageSwitch
                      currentLanguage={language}
                      spaceId={activeSpace.id}
                    />
                    <HomeAppZoomControl
                      compact
                      initialZoomMode={currentZoomMode}
                      language={language}
                    />
                  </div>
                </div>
              </div>

              <ProfileSettingsForm
                avatarPath={currentUserProfile.avatarPath}
                defaultDisplayName={currentUserProfile.displayName ?? ''}
                defaultEmail={currentUserProfile.email ?? user.email ?? ''}
                defaultUsername={currentUserProfile.username ?? ''}
                hasAvatar={Boolean(currentUserProfile.avatarPath)}
                labels={{
                  profileTitle: t.settings.profileTitle,
                  profileSubtitle: t.settings.profileSubtitle,
                  profilePhoto: t.settings.profilePhoto,
                  profilePhotoNote: t.settings.profilePhotoNote,
                  profilePhotoCurrent: t.settings.profilePhotoCurrent,
                  profilePhotoEmpty: t.settings.profilePhotoEmpty,
                  displayName: t.settings.displayName,
                  displayNamePlaceholder: t.settings.displayNamePlaceholder,
                  saveChanges: t.settings.saveChanges,
                  editProfile: t.settings.editProfile,
                  cancelEdit: t.settings.cancelEdit,
                  tapPhotoToChange: t.settings.tapPhotoToChange,
                  removePhoto: t.settings.removePhoto,
                  avatarTooLarge: t.settings.avatarTooLarge,
                  avatarInvalidType: t.settings.avatarInvalidType,
                  avatarUploading: t.settings.avatarUploading,
                  avatarUploadFailed: t.settings.avatarUploadFailed,
                  avatarStorageUnavailable: t.settings.avatarStorageUnavailable,
                  profileUpdateFailed: t.settings.profileUpdateFailed,
                  avatarEditorHint: t.settings.avatarEditorHint,
                  avatarEditorZoom: t.settings.avatarEditorZoom,
                  avatarEditorApply: t.settings.avatarEditorApply,
                  avatarEditorDraftReady: t.settings.avatarEditorDraftReady,
                  avatarEditorPreparing: t.settings.avatarEditorPreparing,
                  avatarEditorLoadFailed: t.settings.avatarEditorLoadFailed,
                  avatarEditorApplyBeforeSave: t.settings.avatarEditorApplyBeforeSave,
                }}
                redirectSurface="home"
                spaceId={activeSpace.id}
                userId={user.id}
              />
            </section>

            <section className="card stack settings-surface settings-home-card messenger-home-personal-card messenger-home-status-card">
              <ProfileStatusForm
                key={`home-profile-status-${currentUserProfile.statusEmoji ?? ''}-${currentUserProfile.statusText ?? ''}-${currentUserProfile.statusUpdatedAt ?? ''}`}
                defaultStatusEmoji={currentUserProfile.statusEmoji ?? ''}
                defaultStatusText={currentUserProfile.statusText ?? ''}
                labels={{
                  statusTitle: t.settings.statusTitle,
                  statusSubtitle: t.settings.statusSubtitle,
                  statusEmpty: t.settings.statusEmpty,
                  statusEmoji: t.settings.statusEmoji,
                  statusText: t.settings.statusText,
                  statusEmojiPlaceholder: t.settings.statusEmojiPlaceholder,
                  statusTextPlaceholder: t.settings.statusTextPlaceholder,
                  statusSave: t.settings.statusSave,
                  statusEdit: t.settings.statusEdit,
                  statusClear: t.settings.statusClear,
                  cancelEdit: t.settings.cancelEdit,
                  statusTextHint: t.settings.statusTextHint,
                  statusEmojiTooLong: t.settings.statusEmojiTooLong,
                  statusTextTooLong: t.settings.statusTextTooLong,
                }}
                language={language}
                redirectSurface="home"
                spaceId={activeSpace.id}
                statusUpdatedAt={currentUserProfile.statusUpdatedAt}
              />
            </section>
          </section>

          {shouldShowPrivateSpaceCta ? (
            <PrivateSpaceCtaCard
              actionHref={privateSpaceCreateHref}
              copy={{
                action: t.homeDashboard.privateSpaceCtaAction,
                badge: t.homeDashboard.privateSpaceCtaBadge,
                body: t.homeDashboard.privateSpaceCtaBody,
                note: t.homeDashboard.privateSpaceCtaNote,
                title: t.homeDashboard.privateSpaceCtaTitle,
              }}
            />
          ) : null}

          {spaceUsage ? <SpaceUsageCard {...spaceUsage} /> : null}

          {canManageSpaceAppearance ? (
            <SpaceThemeCard
              currentTheme={activeSpace.theme}
              language={language}
              spaceId={activeSpace.id}
            />
          ) : null}

          {canManageMessengerMembers && manageableParticipants ? (
            <SpaceParticipantsModule
              copy={{
                adminSeatsLabel: t.messengerHome.participantsAdminSeatsLabel,
                body: t.messengerHome.participantsBody,
                cancelRemoveAction: t.messengerHome.participantsCancelRemoveAction,
                confirmRemoveAction: t.messengerHome.participantsConfirmRemoveAction,
                currentUserBadge: t.messengerHome.currentUserBadge,
                emptyBody: t.messengerHome.participantsEmptyBody,
                lockedHint: t.messengerHome.participantsLockedHint,
                makeAdminAction: t.messengerHome.participantsMakeAdminAction,
                makeAdminFailedLimit: t.messengerHome.participantsMakeAdminFailedLimit,
                makeAdminFailedSelection:
                  t.messengerHome.participantsMakeAdminFailedSelection,
                makeAdminFailedSelectionOverflow:
                  t.messengerHome.participantsMakeAdminFailedSelectionOverflow,
                makeAdminPending: t.messengerHome.participantsMakeAdminPending,
                removeAction: t.messengerHome.participantsRemoveAction,
                removeConfirmBody: t.messengerHome.participantsRemoveConfirmBody,
                removePending: t.messengerHome.participantsRemovePending,
                requestAction: t.messengerHome.participantsRequestAction,
                requestBody: t.messengerHome.participantsRequestBody,
                requestPending: t.messengerHome.participantsRequestPending,
                summaryValue: formatMemberCount(
                  language,
                  manageableParticipants.participants.length,
                ),
                title: t.messengerHome.participantsTitle,
              }}
              adminSeatLimit={spaceUsageSnapshot?.admins.limit ?? 0}
              adminSeatsUsed={spaceUsageSnapshot?.admins.used ?? 0}
              defaultOpen={participantsDefaultOpen}
              participants={manageableParticipants.participants}
              promoteAction={promoteSpaceParticipantsToAdminAction}
              removeAction={removeSpaceParticipantsAction}
              requestAction={requestAdditionalSpaceAccountsAction}
              roleLabels={{
                admin: t.chat.admin,
                member: t.chat.member,
                owner: t.chat.owner,
              }}
              spaceId={activeSpace.id}
            />
          ) : null}

        </HomeDashboardSectionFlow>
      </section>
    );
  }

  const { counts, primaryFlow } = await getKeepCozyHomeDashboardData({
    language,
    spaceId: activeSpace.id,
  });
  const primaryFlowHints = getKeepCozyPrimaryTestFlowHints();
  const showPrimaryFlow = isKeepCozyPrimaryTestHomeName(activeSpace.name);
  const testFlowHomeHint = primaryFlow?.homeNameHint ?? 'TEST';
  const visibleError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: getUserFacingErrorFallback(language, 'settings'),
        language,
        rawMessage: query.error,
      })
    : null;
  const visibleMessage = query.message?.trim() || null;
  const logoutSection = <HomeLogoutSection t={t} />;

  return (
    <section className="stack settings-screen settings-shell keepcozy-page">
      <div className="home-utility-topbar">
        <HomeAppZoomControl
          initialZoomMode={currentZoomMode}
          language={language}
        />
        <HomeLanguageSwitch currentLanguage={language} spaceId={activeSpace.id} />
      </div>

      {visibleMessage ? (
        <div aria-live="polite" className="notice notice-success notice-inline">
          <span aria-hidden="true" className="notice-check">
            ✓
          </span>
          <span className="notice-copy">{visibleMessage}</span>
        </div>
      ) : null}

      {visibleError ? <p className="notice notice-error">{visibleError}</p> : null}

      <HomeDashboardSectionFlow logoutSection={logoutSection}>
        <section className="stack settings-hero keepcozy-hero">
          <p className="eyebrow">{t.homeDashboard.eyebrow}</p>
          <div className="keepcozy-hero-header">
            <div className="stack keepcozy-hero-copy">
              <h1 className="settings-hero-title">{activeSpace.name}</h1>
              <p className="muted settings-hero-note">{t.homeDashboard.subtitle}</p>
            </div>
            <span className="summary-pill summary-pill-muted">
              {t.homeDashboard.previewPill}
            </span>
          </div>
        </section>

        {canManageSpaceAppearance ? (
          <SpaceThemeCard
            currentTheme={activeSpace.theme}
            language={language}
            spaceId={activeSpace.id}
          />
        ) : null}

        {shouldShowPrivateSpaceCta ? (
          <PrivateSpaceCtaCard
            actionHref={privateSpaceCreateHref}
            copy={{
              action: t.homeDashboard.privateSpaceCtaAction,
              badge: t.homeDashboard.privateSpaceCtaBadge,
              body: t.homeDashboard.privateSpaceCtaBody,
              note: t.homeDashboard.privateSpaceCtaNote,
              title: t.homeDashboard.privateSpaceCtaTitle,
            }}
          />
        ) : null}

        <section className="card stack settings-surface keepcozy-surface">
          <section className="keepcozy-focus-card">
            <div className="stack keepcozy-focus-copy">
              <span className="activity-focus-kicker">
                {t.homeDashboard.currentHomeLabel}
              </span>
              <h2 className="activity-focus-title">{activeSpace.name}</h2>
              <p className="muted activity-focus-body">{t.homeDashboard.previewBody}</p>
            </div>

            <div className="keepcozy-card-actions keepcozy-focus-actions">
              <Link
                className="button keepcozy-focus-action"
                href={withSpaceParam('/rooms', activeSpace.id)}
                prefetch={false}
              >
                {t.homeDashboard.openRooms}
              </Link>
              <Link
                className="button button-secondary keepcozy-focus-action"
                href={withSpaceParam('/spaces', activeSpace.id)}
                prefetch={false}
              >
                {t.homeDashboard.switchHome}
              </Link>
            </div>
          </section>

          <section className="stack settings-section keepcozy-section">
            <div className="stack keepcozy-section-copy">
              <h2 className="card-title">{t.homeDashboard.loopTitle}</h2>
              <p className="muted">{t.homeDashboard.loopBody}</p>
            </div>

            <div className="keepcozy-link-grid">
              <Link
                className="keepcozy-link-card"
                href={withSpaceParam('/rooms', activeSpace.id)}
                prefetch={false}
              >
                <span className="keepcozy-link-count">{counts.rooms}</span>
                <div className="stack keepcozy-link-copy">
                  <h3 className="card-title">{t.homeDashboard.roomsTitle}</h3>
                  <p className="muted">{t.homeDashboard.roomsBody}</p>
                </div>
                <span className="pill keepcozy-link-action">
                  {t.homeDashboard.openRooms}
                </span>
              </Link>

              <Link
                className="keepcozy-link-card"
                href={withSpaceParam('/issues', activeSpace.id)}
                prefetch={false}
              >
                <span className="keepcozy-link-count">{counts.issues}</span>
                <div className="stack keepcozy-link-copy">
                  <h3 className="card-title">{t.homeDashboard.issuesTitle}</h3>
                  <p className="muted">{t.homeDashboard.issuesBody}</p>
                </div>
                <span className="pill keepcozy-link-action">
                  {t.homeDashboard.openIssues}
                </span>
              </Link>

              <Link
                className="keepcozy-link-card"
                href={withSpaceParam('/tasks', activeSpace.id)}
                prefetch={false}
              >
                <span className="keepcozy-link-count">{counts.tasks}</span>
                <div className="stack keepcozy-link-copy">
                  <h3 className="card-title">{t.homeDashboard.tasksTitle}</h3>
                  <p className="muted">{t.homeDashboard.tasksBody}</p>
                </div>
                <span className="pill keepcozy-link-action">
                  {t.homeDashboard.openTasks}
                </span>
              </Link>

              <Link
                className="keepcozy-link-card"
                href={withSpaceParam('/activity', activeSpace.id)}
                prefetch={false}
              >
                <span className="keepcozy-link-count">{counts.history}</span>
                <div className="stack keepcozy-link-copy">
                  <h3 className="card-title">{t.homeDashboard.historyTitle}</h3>
                  <p className="muted">{t.homeDashboard.historyBody}</p>
                </div>
                <span className="pill keepcozy-link-action">
                  {t.homeDashboard.openHistory}
                </span>
              </Link>
            </div>
          </section>

          <section className="stack settings-section keepcozy-section">
            <div className="stack keepcozy-section-copy">
              <h2 className="card-title">{t.homeDashboard.testFlowTitle}</h2>
              <p className="muted">{t.homeDashboard.testFlowBody}</p>
            </div>

            {showPrimaryFlow && primaryFlow ? (
              <article className="keepcozy-detail-card">
                <div className="keepcozy-detail-header">
                  <div className="stack keepcozy-detail-heading">
                    <h3 className="card-title">{primaryFlow.issue.title}</h3>
                    <p className="muted">
                      {primaryFlow.issue.summary || t.issues.detailBody}
                    </p>
                  </div>
                  <span className="summary-pill summary-pill-muted">
                    {primaryFlow.homeNameHint}
                  </span>
                </div>

                <div className="keepcozy-meta-row">
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.currentHomeLabel}: {activeSpace.name}
                  </span>
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.roomsTitle}: {primaryFlow.room.name}
                  </span>
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.historyTitle}: {primaryFlow.history.length}
                  </span>
                </div>

                <p className="keepcozy-detail-body">{t.homeDashboard.testFlowBody}</p>

                <div className="keepcozy-card-actions">
                  <Link
                    className="pill"
                    href={withSpaceParam(`/rooms/${primaryFlow.room.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    {t.homeDashboard.openRooms}
                  </Link>
                  <Link
                    className="button button-secondary"
                    href={withSpaceParam(`/issues/${primaryFlow.issue.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    {t.homeDashboard.openIssues}
                  </Link>
                  <Link
                    className="button button-secondary"
                    href={withSpaceParam(`/tasks/${primaryFlow.task.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    {t.homeDashboard.openTasks}
                  </Link>
                  <Link
                    className="button button-secondary"
                    href={withSpaceParam('/activity', activeSpace.id)}
                    prefetch={false}
                  >
                    {t.homeDashboard.openHistory}
                  </Link>
                </div>

                <div className="keepcozy-stack-list keepcozy-flow-grid">
                  <section className="keepcozy-secondary-card">
                    <div className="stack keepcozy-link-copy">
                      <h4 className="card-title">
                        {t.homeDashboard.currentHomeLabel}
                      </h4>
                      <p className="muted">{activeSpace.name}</p>
                    </div>
                  </section>

                  <Link
                    className="keepcozy-secondary-card"
                    href={withSpaceParam(`/rooms/${primaryFlow.room.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    <div className="stack keepcozy-link-copy">
                      <h4 className="card-title">{t.homeDashboard.roomsTitle}</h4>
                      <p className="muted">{primaryFlow.room.name}</p>
                    </div>
                    <span className="summary-pill summary-pill-muted">
                      {t.homeDashboard.openRooms}
                    </span>
                  </Link>

                  <Link
                    className="keepcozy-secondary-card"
                    href={withSpaceParam(`/issues/${primaryFlow.issue.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    <div className="stack keepcozy-link-copy">
                      <h4 className="card-title">{t.homeDashboard.issuesTitle}</h4>
                      <p className="muted">{primaryFlow.issue.title}</p>
                    </div>
                    <span className="summary-pill summary-pill-muted">
                      {t.homeDashboard.openIssues}
                    </span>
                  </Link>

                  <Link
                    className="keepcozy-secondary-card"
                    href={withSpaceParam(`/tasks/${primaryFlow.task.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    <div className="stack keepcozy-link-copy">
                      <h4 className="card-title">{t.homeDashboard.tasksTitle}</h4>
                      <p className="muted">{primaryFlow.task.title}</p>
                    </div>
                    <span className="summary-pill summary-pill-muted">
                      {t.homeDashboard.openTasks}
                    </span>
                  </Link>

                  <Link
                    className="keepcozy-secondary-card"
                    href={withSpaceParam('/activity', activeSpace.id)}
                    prefetch={false}
                  >
                    <div className="stack keepcozy-link-copy">
                      <h4 className="card-title">{t.homeDashboard.historyTitle}</h4>
                      <p className="muted">{t.homeDashboard.historyBody}</p>
                    </div>
                    <span className="summary-pill summary-pill-muted">
                      {t.homeDashboard.openHistory}
                    </span>
                  </Link>
                </div>
              </article>
            ) : (
              <section className="empty-card keepcozy-preview-card">
                <h3 className="card-title">{testFlowHomeHint}</h3>
                <p className="muted">
                  {showPrimaryFlow
                    ? t.homeDashboard.testFlowPendingBody
                    : t.homeDashboard.testFlowMismatchBody}
                </p>
                <div className="keepcozy-meta-row">
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.currentHomeLabel}: {activeSpace.name}
                  </span>
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.roomsTitle}: {primaryFlowHints.roomNameHint}
                  </span>
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.issuesTitle}: {primaryFlowHints.issueTitleHint}
                  </span>
                </div>
                <div className="keepcozy-card-actions">
                  <Link
                    className="button"
                    href={withSpaceParam('/spaces', activeSpace.id)}
                    prefetch={false}
                  >
                    {t.homeDashboard.switchHome}
                  </Link>
                  <Link
                    className="button button-secondary"
                    href={withSpaceParam('/rooms', activeSpace.id)}
                    prefetch={false}
                  >
                    {t.homeDashboard.openRooms}
                  </Link>
                  <Link
                    className="pill"
                    href={withSpaceParam('/activity', activeSpace.id)}
                    prefetch={false}
                  >
                    {t.homeDashboard.openHistory}
                  </Link>
                </div>
              </section>
            )}
          </section>
        </section>

      </HomeDashboardSectionFlow>
    </section>
  );
}
