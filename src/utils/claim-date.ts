import { ExpenseClaim } from '../types';

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const parseSapDateValue = (value?: string) => {
  if (!value) return NaN;

  if (value.includes('Date(')) {
    const match = value.match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : NaN;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? NaN : parsed;
};

const parseSapTimeOffset = (value?: string) => {
  if (!value) return 0;

  const hours = Number.parseInt(value.match(/(\d+)H/)?.[1] || '0', 10);
  const minutes = Number.parseInt(value.match(/(\d+)M/)?.[1] || '0', 10);
  const seconds = Number.parseInt(value.match(/(\d+)S/)?.[1] || '0', 10);

  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
};

export const getClaimCreatedTimestamp = (claim: Pick<ExpenseClaim, 'createdOn' | 'createdTime' | 'claimDate'>) => {
  const baseTimestamp = parseSapDateValue(claim.createdOn);
  if (!Number.isNaN(baseTimestamp)) {
    return baseTimestamp + parseSapTimeOffset(claim.createdTime);
  }

  const fallbackTimestamp = new Date(claim.claimDate).getTime();
  return Number.isNaN(fallbackTimestamp) ? 0 : fallbackTimestamp;
};

export const formatClaimDisplayDate = (claim: Pick<ExpenseClaim, 'createdOn' | 'createdTime' | 'claimDate'>) => {
  const timestamp = getClaimCreatedTimestamp(claim);
  if (!timestamp) return claim.claimDate || '';

  return MONTH_FORMATTER.format(new Date(timestamp));
};
