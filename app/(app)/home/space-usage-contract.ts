export type HomeSpaceUsageCardMetric = {
  id: 'admins' | 'call-minutes' | 'members' | 'storage';
  label: string;
  limitLabel: string;
  progressPercent: number;
  state: 'future' | 'nearing' | 'normal' | 'over';
  stateLabel?: string | null;
  tone: 'future' | 'live';
  usedLabel: string;
};

export type HomeSpaceUsageCardData = {
  adminSeatUsage: {
    limit: number;
    used: number;
  };
  copy: {
    body: string;
    currentPlanLabel: string;
    futureTrackingNote: string;
    managePlanAction: string;
    previewPill: string;
    title: string;
  };
  managePlanHref: string;
  metrics: HomeSpaceUsageCardMetric[];
  planLabel: string;
  planState: 'nearing' | 'normal' | 'over';
  planStateLabel?: string | null;
  planSummary?: string | null;
  upgradeRecommended?: boolean;
  upgradeActionLabel: string;
  upgradeHref: string;
};
