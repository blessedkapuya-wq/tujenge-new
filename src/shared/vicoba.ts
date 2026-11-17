export type UserRole = 'admin' | 'member';

export interface AuthUser {
  id: string;
  role: UserRole;
  displayName: string;
  phone: string | null;
  email: string | null;
  memberId: string | null;
  memberNumber: string | null;
}

export interface MemberRecord {
  id: string;
  memberNumber: string;
  fullName: string;
  phone: string;
  mtaaHouseNumber: string;
  nationalIdMasked: string;
  role: UserRole;
  status: 'active' | 'pending';
  hisaShares: number;
  hisaTotalTsh: number;
  jamiiTotalTsh: number;
  commitmentSharesPerWeek: number;
  joinedAt: string;
}

export interface PaymentRecord {
  id: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  provider: 'M-Pesa' | 'Mixx by Yas' | 'Airtel Money' | 'Halopesa' | 'Admin Adjustment';
  reference: string;
  amountTsh: number;
  hisaAllocatedTsh: number;
  jamiiAllocatedTsh: number;
  sharesAdded: number;
  rawSms: string;
  status: 'confirmed' | 'recorded';
  createdAt: string;
}

export interface LoanRecord {
  id: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  amountTsh: number;
  repaidTsh: number;
  purpose: string;
  guarantorName: string;
  termMonths: number;
  interestRatePct: number;
  status: 'pending' | 'active' | 'repaid' | 'declined';
  requestedAt: string;
}

export interface MeetingRecord {
  id: string;
  title: string;
  quarterLabel: string;
  meetingDate: string;
  location: string;
  agenda: string;
  status: 'scheduled' | 'completed';
}

export interface DocumentRecord {
  id: string;
  title: string;
  category: string;
  summary: string;
  externalUrl: string;
  visibility: 'all_members' | 'admin_only';
  updatedAt: string;
}

export interface GroupOverview {
  groupName: string;
  ward: string;
  cycleLabel: string;
  sharePriceTsh: number;
  jamiiFeeTsh: number;
  totalFundTsh: number;
  totalHisaTsh: number;
  totalJamiiTsh: number;
  activeLoansOutstandingTsh: number;
  memberCount: number;
}

export interface WorkspacePayload {
  user: AuthUser | null;
  group: GroupOverview;
  members: MemberRecord[];
  payments: PaymentRecord[];
  loans: LoanRecord[];
  meetings: MeetingRecord[];
  documents: DocumentRecord[];
}

export const SHARE_PRICE_TSH = 10000;
export const JAMII_FEE_TSH = 2000;
export const MIN_WEEKLY_TSH = 12000;
export const MAX_LOAN_MULTIPLIER = 3;
export const HERO_FOUNDERS_IMAGE = '/src/assets/images/tujenge_founders_hero_1794916896229.jpg';

export function formatTsh(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `TSH ${safe.toLocaleString('en-US')}`;
}

export function normalizeTzPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('255') && digits.length >= 12) {
    return `+${digits.slice(0, 12)}`;
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return `+255${digits.slice(1, 10)}`;
  }
  if ((digits.startsWith('7') || digits.startsWith('6')) && digits.length >= 9) {
    return `+255${digits.slice(0, 9)}`;
  }
  return `+${digits}`;
}

export function isValidTzPhone(raw: string): boolean {
  const normalized = normalizeTzPhone(raw);
  return /^\+255[67]\d{8}$/.test(normalized);
}

export interface ParsedSmsResult {
  amountTsh: number | null;
  reference: string | null;
  provider: 'M-Pesa' | 'Mixx by Yas' | 'Airtel Money' | 'Halopesa' | null;
  detectedShares: number | null;
  detectedWeeks: number | null;
}

export const SAMPLE_SMS_RECEIPTS: {
  label: string;
  provider: 'M-Pesa' | 'Mixx by Yas' | 'Airtel Money' | 'Halopesa';
  text: string;
}[] = [
  {
    label: 'M-Pesa (12,000 Min)',
    provider: 'M-Pesa',
    text: 'RL94K2M81P Confirmed. Tsh12,000.00 sent to TUJENGE HUB 5548920 on 15/11/26 at 10:42 AM. New M-Pesa balance is Tsh120,000.00.',
  },
  {
    label: 'M-Pesa Swahili (12,000)',
    provider: 'M-Pesa',
    text: 'RL98W4K20N Imethibitishwa. Umelipa Tsh 12,000.00 kwenda TUJENGE HUB kwa Wakala 448120. Ada Tsh 0. Salio jipya la M-Pesa ni Tsh 82,000.00.',
  },
  {
    label: 'Mixx by Yas (22,000)',
    provider: 'Mixx by Yas',
    text: 'Umefanikiwa kutuma Tsh 22,000 kwenda TUJENGE HUB (8823104). Kumbukumbu: TY88492019. Salio jipya ni Tsh 95,000.',
  },
  {
    label: 'Airtel Money (24,000)',
    provider: 'Airtel Money',
    text: 'Muamala umekamilika. Tsh 24,000 imetumwa kwa TUJENGE HUB 6120938. TID: PP261115.1422.A01234. Salio jipya Tsh 64,500.',
  },
  {
    label: 'Halopesa (12,000)',
    provider: 'Halopesa',
    text: 'Halopesa: Umelipa Tsh 12,000 kwenda TUJENGE HUB (901122). Namba ya muamala: HP2611159912. Salio jipya ni Tsh 58,000.',
  },
];

function parseAmount(raw: string): number | null {
  const num = Math.round(Number(raw.replace(/,/g, '')));
  if (Number.isNaN(num) || num < 500) return null;
  return num;
}

export function parseMobileMoneySms(rawText: string): ParsedSmsResult {
  const text = rawText.trim();
  if (!text) {
    return {
      amountTsh: null,
      reference: null,
      provider: null,
      detectedShares: null,
      detectedWeeks: null,
    };
  }

  const lower = text.toLowerCase();
  let provider: ParsedSmsResult['provider'] = null;
  if (lower.includes('m-pesa') || lower.includes('mpesa') || lower.includes('vodacom')) {
    provider = 'M-Pesa';
  } else if (
    lower.includes('mixx') ||
    lower.includes('yas') ||
    lower.includes('tigo pesa') ||
    lower.includes('tigopesa') ||
    lower.includes('tigo')
  ) {
    provider = 'Mixx by Yas';
  } else if (lower.includes('airtel')) {
    provider = 'Airtel Money';
  } else if (lower.includes('halopesa') || lower.includes('halotel') || lower.includes('halo')) {
    provider = 'Halopesa';
  }

  let amountTsh: number | null = null;
  const actionMatch = text.match(
    /(?:sent|paid|transferred|umetuma|umelipa|imewekwa|umeweka|umetumia|kutuma|kulipa|pokea)\s+(?:kiasi\s+cha\s+)?(?:tsh|tzs|sh)\.?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
  );
  if (actionMatch?.[1]) {
    amountTsh = parseAmount(actionMatch[1]);
  }
  if (amountTsh === null) {
    const beforeBalance =
      text.split(/(?:new\s+.*balance|salio\s+jipya|salio\s+lako|ada\b|fee\b)/i)[0] || text;
    const tshRegex = /(?:tsh|tzs|sh)\.?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;
    const m = beforeBalance.match(tshRegex) || text.match(tshRegex);
    if (m?.[1]) {
      amountTsh = parseAmount(m[1]);
    }
  }

  let reference: string | null = null;
  const refPatterns = [
    /(?:kumbukumbu|namba ya muamala|tid|ref(?:erence)?|txn(?:\s*id)?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._-]{5,24})/i,
    /^([A-Z0-9]{8,14})\s+(?:Confirmed|Imethibitishwa)/i,
  ];
  for (const pat of refPatterns) {
    const m = text.match(pat);
    if (m?.[1]) {
      reference = m[1].toUpperCase();
      break;
    }
  }
  if (!reference && text.length >= 6) {
    const token = text.match(/\b([A-Z]{2,4}[0-9]{4,10}[A-Z0-9]*)\b/);
    if (token?.[1]) {
      reference = token[1].toUpperCase();
    }
  }

  const detectedShares =
    amountTsh && amountTsh >= SHARE_PRICE_TSH
      ? Math.max(1, Math.floor((amountTsh - JAMII_FEE_TSH) / SHARE_PRICE_TSH))
      : null;
  const detectedWeeks =
    amountTsh && amountTsh >= MIN_WEEKLY_TSH
      ? Math.max(1, Math.floor(amountTsh / MIN_WEEKLY_TSH))
      : null;

  return {
    amountTsh,
    reference,
    provider,
    detectedShares,
    detectedWeeks,
  };
}

export function splitContributionTsh(
  amountTsh: number,
  weeklySplitMode = true
): { hisaAllocatedTsh: number; jamiiAllocatedTsh: number; sharesAdded: number } {
  if (amountTsh <= 0) {
    return { hisaAllocatedTsh: 0, jamiiAllocatedTsh: 0, sharesAdded: 0 };
  }
  const jamiiAllocatedTsh = weeklySplitMode && amountTsh >= MIN_WEEKLY_TSH ? JAMII_FEE_TSH : 0;
  const hisaAllocatedTsh = Math.max(0, amountTsh - jamiiAllocatedTsh);
  const sharesAdded = Math.floor(hisaAllocatedTsh / SHARE_PRICE_TSH);
  return { hisaAllocatedTsh, jamiiAllocatedTsh, sharesAdded };
}

export function maskNationalId(raw: string): string {
  const clean = raw.replace(/\s+/g, '');
  if (clean.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

export interface StoredUserCredential {
  id: string;
  role: UserRole;
  displayName: string;
  phone: string | null;
  email: string | null;
  memberId: string | null;
  memberNumber: string | null;
  secretHash: string;
  createdAt: string;
}

export interface PersistedDatabase {
  users: StoredUserCredential[];
  members: MemberRecord[];
  payments: PaymentRecord[];
  loans: LoanRecord[];
  meetings: MeetingRecord[];
  documents: DocumentRecord[];
}

export function createSeedDatabase(defaultMemberPinHash: string): PersistedDatabase {
  const members: MemberRecord[] = [
    {
      id: 'founder-1',
      memberNumber: 'TJ-001',
      fullName: 'Sarah Kapuya',
      phone: '+255754100001',
      mtaaHouseNumber: 'Kinondoni Studio · House 14',
      nationalIdMasked: '****************8812',
      role: 'admin',
      status: 'active',
      hisaShares: 42,
      hisaTotalTsh: 420000,
      jamiiTotalTsh: 84000,
      commitmentSharesPerWeek: 2,
      joinedAt: '2026-01-11T09:00:00.000Z',
    },
    {
      id: 'founder-2',
      memberNumber: 'TJ-002',
      fullName: 'Neema Mwanga',
      phone: '+255754100002',
      mtaaHouseNumber: 'Mikocheni B · Plot 48',
      nationalIdMasked: '****************4409',
      role: 'member',
      status: 'active',
      hisaShares: 36,
      hisaTotalTsh: 360000,
      jamiiTotalTsh: 72000,
      commitmentSharesPerWeek: 1,
      joinedAt: '2026-01-11T09:15:00.000Z',
    },
    {
      id: 'founder-3',
      memberNumber: 'TJ-003',
      fullName: 'Amina Juma',
      phone: '+255713100003',
      mtaaHouseNumber: 'Sinza Mori · House 22B',
      nationalIdMasked: '****************1934',
      role: 'member',
      status: 'active',
      hisaShares: 28,
      hisaTotalTsh: 280000,
      jamiiTotalTsh: 56000,
      commitmentSharesPerWeek: 1,
      joinedAt: '2026-01-18T10:00:00.000Z',
    },
    {
      id: 'founder-4',
      memberNumber: 'TJ-004',
      fullName: 'Grace Mushi',
      phone: '+255688100004',
      mtaaHouseNumber: 'Mbezi Beach · Lane 7',
      nationalIdMasked: '****************5520',
      role: 'member',
      status: 'active',
      hisaShares: 30,
      hisaTotalTsh: 300000,
      jamiiTotalTsh: 60000,
      commitmentSharesPerWeek: 1,
      joinedAt: '2026-01-25T10:30:00.000Z',
    },
  ];

  const users: StoredUserCredential[] = [
    {
      id: 'user-founder-2',
      role: 'member',
      displayName: 'Neema Mwanga',
      phone: '+255754100002',
      email: null,
      memberId: 'founder-2',
      memberNumber: 'TJ-002',
      secretHash: defaultMemberPinHash,
      createdAt: '2026-01-11T09:15:00.000Z',
    },
    {
      id: 'user-founder-3',
      role: 'member',
      displayName: 'Amina Juma',
      phone: '+255713100003',
      email: null,
      memberId: 'founder-3',
      memberNumber: 'TJ-003',
      secretHash: defaultMemberPinHash,
      createdAt: '2026-01-18T10:00:00.000Z',
    },
    {
      id: 'user-founder-4',
      role: 'member',
      displayName: 'Grace Mushi',
      phone: '+255688100004',
      email: null,
      memberId: 'founder-4',
      memberNumber: 'TJ-004',
      secretHash: defaultMemberPinHash,
      createdAt: '2026-01-25T10:30:00.000Z',
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'seed-pay-1',
      memberId: 'founder-2',
      memberNumber: 'TJ-002',
      memberName: 'Neema Mwanga',
      provider: 'M-Pesa',
      reference: 'RL91M4K10A',
      amountTsh: 12000,
      hisaAllocatedTsh: 10000,
      jamiiAllocatedTsh: 2000,
      sharesAdded: 1,
      rawSms: 'RL91M4K10A Confirmed. Tsh12,000.00 sent to TUJENGE HUB 5548920.',
      status: 'confirmed',
      createdAt: '2026-11-10T10:15:00.000Z',
    },
    {
      id: 'seed-pay-2',
      memberId: 'founder-3',
      memberNumber: 'TJ-003',
      memberName: 'Amina Juma',
      provider: 'Mixx by Yas',
      reference: 'TY88192045',
      amountTsh: 22000,
      hisaAllocatedTsh: 20000,
      jamiiAllocatedTsh: 2000,
      sharesAdded: 2,
      rawSms: 'Umefanikiwa kutuma Tsh 22,000 kwenda TUJENGE HUB. Kumbukumbu: TY88192045.',
      status: 'confirmed',
      createdAt: '2026-11-10T11:05:00.000Z',
    },
  ];

  const loans: LoanRecord[] = [
    {
      id: 'loan-founder-3',
      memberId: 'founder-3',
      memberNumber: 'TJ-003',
      memberName: 'Amina Juma',
      amountTsh: 450000,
      repaidTsh: 150000,
      purpose: 'Wholesale fabric stock replenishment',
      guarantorName: 'Grace Mushi',
      termMonths: 3,
      interestRatePct: 5,
      status: 'active',
      requestedAt: '2026-10-04T08:30:00.000Z',
    },
  ];

  const meetings: MeetingRecord[] = [
    {
      id: 'seed-mtg-q4-2026',
      title: 'Q4 2026 Quarterly VICOBA Audit & Share Review',
      quarterLabel: 'Q4 2026',
      meetingDate: '2026-12-13T14:00:00.000Z',
      location: 'Kinondoni Hub & WhatsApp Video',
      agenda:
        'Review every member Hisa & Jamii share report, confirm Sunday collections, audit active loans, and plan Q1 2027 goals.',
      status: 'scheduled',
    },
    {
      id: 'seed-mtg-q1-2027',
      title: 'Q1 2027 Quarterly VICOBA General Meeting',
      quarterLabel: 'Q1 2027',
      meetingDate: '2027-03-14T14:00:00.000Z',
      location: 'Kinondoni Hub & WhatsApp Video',
      agenda:
        'Quarterly share dividend projection, new member admissions, and emergency Jamii fund review.',
      status: 'scheduled',
    },
  ];

  const documents: DocumentRecord[] = [
    {
      id: 'seed-doc-official-policy',
      title: 'Tujenge Hub VICOBA Constitution & Share Rules',
      category: 'Constitution',
      summary:
        'Weekly share value (TSH 10,000 Hisa + TSH 2,000 Jamii), automatic sequential member numbering, and Sunday 18:00 collection cutoff.',
      externalUrl: '',
      visibility: 'all_members',
      updatedAt: '2026-01-11T09:00:00.000Z',
    },
    {
      id: 'seed-doc-loan-policy',
      title: 'Member Loan & Guarantor Policy',
      category: 'Lending Policy',
      summary:
        'Active members may borrow up to 3x accumulated Hisa savings at 5% flat service fee over 3 months with one active guarantor.',
      externalUrl: '',
      visibility: 'all_members',
      updatedAt: '2026-02-02T12:00:00.000Z',
    },
  ];

  return { users, members, payments, loans, meetings, documents };
}

export function computeGroupOverview(db: PersistedDatabase): GroupOverview {
  const totalHisaTsh = db.members.reduce((sum, m) => sum + m.hisaTotalTsh, 0);
  const totalJamiiTsh = db.members.reduce((sum, m) => sum + m.jamiiTotalTsh, 0);
  const activeLoansOutstandingTsh = db.loans
    .filter((l) => l.status === 'active')
    .reduce((sum, l) => sum + Math.max(0, l.amountTsh - l.repaidTsh), 0);

  return {
    groupName: 'Tujenge Hub VICOBA',
    ward: 'Kinondoni · Dar es Salaam',
    cycleLabel: '2026 Cycle',
    sharePriceTsh: SHARE_PRICE_TSH,
    jamiiFeeTsh: JAMII_FEE_TSH,
    totalFundTsh: totalHisaTsh + totalJamiiTsh,
    totalHisaTsh,
    totalJamiiTsh,
    activeLoansOutstandingTsh,
    memberCount: db.members.length,
  };
}

export function formatNextMemberNumber(members: MemberRecord[]): string {
  let maxNum = 0;
  for (const m of members) {
    const match = m.memberNumber.match(/TJ-(\d+)/i);
    if (match?.[1]) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `TJ-${String(maxNum + 1).padStart(3, '0')}`;
}
