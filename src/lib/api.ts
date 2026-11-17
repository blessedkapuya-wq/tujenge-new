import type {
  AuthUser,
  DocumentRecord,
  LoanRecord,
  MeetingRecord,
  PaymentRecord,
  WorkspacePayload,
} from '../shared/vicoba';

const TOKEN_KEY = 'tujenge_session_token';

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function fetchWorkspace(): Promise<WorkspacePayload> {
  return requestJson<WorkspacePayload>('/api/workspace');
}

export async function registerMember(payload: {
  fullName: string;
  phone: string;
  pin: string;
  mtaaHouseNumber: string;
  nationalId: string;
  startingCommitmentShares: number;
}): Promise<{ token: string; user: AuthUser; memberNumber: string }> {
  const res = await requestJson<{ token: string; user: AuthUser; memberNumber: string }>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  setStoredToken(res.token);
  return res;
}

export async function loginMember(payload: {
  phone: string;
  pin: string;
}): Promise<{ token: string; user: AuthUser }> {
  const res = await requestJson<{ token: string; user: AuthUser }>(
    '/api/auth/login-member',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  setStoredToken(res.token);
  return res;
}

export async function loginAdmin(payload: {
  email: string;
  password: string;
}): Promise<{ token: string; user: AuthUser }> {
  const res = await requestJson<{ token: string; user: AuthUser }>(
    '/api/auth/login-admin',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  setStoredToken(res.token);
  return res;
}

export async function logoutSession(): Promise<void> {
  try {
    await requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  } finally {
    setStoredToken(null);
  }
}

export function submitPayment(payload: {
  smsText?: string;
  amountTsh?: number;
  provider?: PaymentRecord['provider'];
  reference?: string;
  memberId?: string;
  weeklySplitMode?: boolean;
}): Promise<{ payment: PaymentRecord }> {
  return requestJson<{ payment: PaymentRecord }>('/api/payments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function submitLoanRequest(payload: {
  amountTsh: number;
  purpose: string;
  guarantorName: string;
  termMonths: number;
  memberId?: string;
}): Promise<{ loan: LoanRecord }> {
  return requestJson<{ loan: LoanRecord }>('/api/loans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function performLoanAction(
  loanId: string,
  payload: { action: 'approve' | 'decline' | 'repay'; repaymentAmountTsh?: number }
): Promise<{ loan: LoanRecord }> {
  return requestJson<{ loan: LoanRecord }>(`/api/loans/${encodeURIComponent(loanId)}/action`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function publishDocument(payload: {
  title: string;
  category: string;
  summary: string;
  externalUrl: string;
  visibility: 'all_members' | 'admin_only';
}): Promise<{ document: DocumentRecord }> {
  return requestJson<{ document: DocumentRecord }>('/api/documents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function scheduleMeeting(payload: {
  title: string;
  quarterLabel: string;
  meetingDate: string;
  location: string;
  agenda: string;
}): Promise<{ meeting: MeetingRecord }> {
  return requestJson<{ meeting: MeetingRecord }>('/api/meetings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
