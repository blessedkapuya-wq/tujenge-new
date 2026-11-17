import { hashSecret, signSessionToken, verifySecret, verifySessionToken } from './shared/cryptoAuth';
import {
  computeGroupOverview,
  createSeedDatabase,
  formatNextMemberNumber,
  isValidTzPhone,
  maskNationalId,
  MAX_LOAN_MULTIPLIER,
  normalizeTzPhone,
  parseMobileMoneySms,
  splitContributionTsh,
  type AuthUser,
  type DocumentRecord,
  type LoanRecord,
  type MeetingRecord,
  type MemberRecord,
  type PaymentRecord,
  type PersistedDatabase,
  type WorkspacePayload,
} from './shared/vicoba';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface WorkerEnv {
  DB?: D1Database;
  ASSETS: AssetFetcher;
  SESSION_SECRET?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
}

const DEFAULT_SECRET = 'dev-tujenge-session-secret-change-in-prod';

let fallbackMemoryDb: PersistedDatabase | null = null;

async function ensureSchema(db: D1Database): Promise<void> {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);'
  );
}

async function loadDatabase(env: WorkerEnv): Promise<PersistedDatabase> {
  if (!env.DB) {
    if (!fallbackMemoryDb) {
      const pinHash = await hashSecret('2026');
      fallbackMemoryDb = createSeedDatabase(pinHash);
    }
    return fallbackMemoryDb;
  }

  await ensureSchema(env.DB);
  const row = await env.DB.prepare('SELECT payload FROM app_state WHERE id = ?')
    .bind('main')
    .first<{ payload: string }>();

  if (row?.payload) {
    return JSON.parse(row.payload) as PersistedDatabase;
  }

  const pinHash = await hashSecret('2026');
  const seeded = createSeedDatabase(pinHash);
  await saveDatabase(env, seeded);
  return seeded;
}

async function saveDatabase(env: WorkerEnv, data: PersistedDatabase): Promise<void> {
  if (!env.DB) {
    fallbackMemoryDb = data;
    return;
  }
  await ensureSchema(env.DB);
  await env.DB.prepare(
    'INSERT INTO app_state (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at'
  )
    .bind('main', JSON.stringify(data), new Date().toISOString())
    .run();
}

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function extractToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookie = request.headers.get('Cookie');
  if (cookie) {
    for (const part of cookie.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === 'tujenge_session') {
        return decodeURIComponent(rest.join('='));
      }
    }
  }
  return null;
}

function buildCookieHeader(token: string): string {
  return `tujenge_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}

function buildWorkspacePayload(db: PersistedDatabase, user: AuthUser | null): WorkspacePayload {
  const isAdmin = user?.role === 'admin';
  const members: MemberRecord[] = db.members.map((m) => {
    if (isAdmin || (user?.memberId && user.memberId === m.id)) {
      return m;
    }
    return {
      ...m,
      phone: m.phone.slice(0, 6) + '****' + m.phone.slice(-2),
    };
  });

  return {
    user,
    group: computeGroupOverview(db),
    members,
    payments: [...db.payments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    loans: [...db.loans].sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    ),
    meetings: [...db.meetings].sort(
      (a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime()
    ),
    documents: db.documents.filter((d) => d.visibility === 'all_members' || isAdmin),
  };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const secret = env.SESSION_SECRET || DEFAULT_SECRET;
    const adminEmail = (env.ADMIN_EMAIL || 'blessedkapuya@gmail.com').trim().toLowerCase();
    const adminPassword = env.ADMIN_PASSWORD || 'TujengeAdmin2026!';

    const token = extractToken(request);
    const user = token ? await verifySessionToken(token, secret) : null;

    if (pathname === '/api/health' && request.method === 'GET') {
      return json({
        ok: true,
        runtime: 'cloudflare-worker',
        database: env.DB ? 'd1' : 'memory',
        auth: 'hmac-session',
      });
    }

    if (pathname === '/api/scheduler/status' && request.method === 'GET') {
      const db = await loadDatabase(env);
      const nextMeeting = db.meetings.find((m) => m.status === 'scheduled') ?? null;
      return json({
        ok: true,
        pendingMembersCount: db.members.filter((m) => m.status === 'pending').length,
        activeMembersCount: db.members.filter((m) => m.status === 'active').length,
        nextMeetingTitle: nextMeeting?.title ?? null,
        nextMeetingDate: nextMeeting?.meetingDate ?? null,
      });
    }

    if (pathname === '/api/scheduler/config' && request.method === 'POST') {
      return json({ ok: true, updatedAt: new Date().toISOString() });
    }

    if (pathname === '/api/workspace' && request.method === 'GET') {
      const db = await loadDatabase(env);
      return json(buildWorkspacePayload(db, user));
    }

    if (pathname === '/api/auth/register' && request.method === 'POST') {
      const db = await loadDatabase(env);
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const fullName = String(body.fullName || '').trim();
      const phoneRaw = String(body.phone || '');
      const pin = String(body.pin || '').trim();
      const mtaaHouseNumber = String(body.mtaaHouseNumber || '').trim();
      const nationalId = String(body.nationalId || '').trim();
      const commitment = Math.min(20, Math.max(1, Number(body.startingCommitmentShares || 1)));

      if (fullName.length < 3) {
        return json({ error: 'Enter your full name (at least 3 characters).' }, 400);
      }
      if (!isValidTzPhone(phoneRaw)) {
        return json({ error: 'Enter a valid Tanzanian mobile number.' }, 400);
      }
      if (!/^\d{4,6}$/.test(pin)) {
        return json({ error: 'Create a 4 to 6 digit numeric PIN.' }, 400);
      }
      if (mtaaHouseNumber.length < 3 || nationalId.length < 6) {
        return json({ error: 'Provide your Mtaa/house number and National ID.' }, 400);
      }

      const phone = normalizeTzPhone(phoneRaw);
      if (db.users.some((u) => u.phone === phone)) {
        return json({ error: 'Mobile number already registered. Sign in instead.' }, 409);
      }

      const memberNumber = formatNextMemberNumber(db.members);
      const memberId = `mem-${Date.now().toString(36)}`;
      const userId = `usr-${Date.now().toString(36)}`;
      const now = new Date().toISOString();
      const secretHash = await hashSecret(pin);

      db.members.push({
        id: memberId,
        memberNumber,
        fullName,
        phone,
        mtaaHouseNumber,
        nationalIdMasked: maskNationalId(nationalId),
        role: 'member',
        status: 'active',
        hisaShares: 0,
        hisaTotalTsh: 0,
        jamiiTotalTsh: 0,
        commitmentSharesPerWeek: commitment,
        joinedAt: now,
      });

      db.users.push({
        id: userId,
        role: 'member',
        displayName: fullName,
        phone,
        email: null,
        memberId,
        memberNumber,
        secretHash,
        createdAt: now,
      });

      await saveDatabase(env, db);

      const newUser: AuthUser = {
        id: userId,
        role: 'member',
        displayName: fullName,
        phone,
        email: null,
        memberId,
        memberNumber,
      };
      const sessionToken = await signSessionToken(newUser, secret);
      return json(
        { token: sessionToken, user: newUser, memberNumber },
        201,
        { 'Set-Cookie': buildCookieHeader(sessionToken) }
      );
    }

    if (pathname === '/api/auth/login-member' && request.method === 'POST') {
      const db = await loadDatabase(env);
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const phoneRaw = String(body.phone || '');
      const pin = String(body.pin || '').trim();

      if (!isValidTzPhone(phoneRaw)) {
        return json({ error: 'Enter a valid Tanzanian mobile number.' }, 400);
      }
      const phone = normalizeTzPhone(phoneRaw);
      const cred = db.users.find((u) => u.role === 'member' && u.phone === phone);
      if (!cred || !(await verifySecret(pin, cred.secretHash))) {
        return json({ error: 'Invalid mobile number or PIN.' }, 401);
      }

      const authUser: AuthUser = {
        id: cred.id,
        role: 'member',
        displayName: cred.displayName,
        phone: cred.phone,
        email: cred.email,
        memberId: cred.memberId,
        memberNumber: cred.memberNumber,
      };
      const sessionToken = await signSessionToken(authUser, secret);
      return json(
        { token: sessionToken, user: authUser },
        200,
        { 'Set-Cookie': buildCookieHeader(sessionToken) }
      );
    }

    if (pathname === '/api/auth/login-admin' && request.method === 'POST') {
      const db = await loadDatabase(env);
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (email !== adminEmail || password !== adminPassword) {
        return json({ error: 'Invalid admin email or passcode.' }, 401);
      }

      const chair = db.members.find((m) => m.role === 'admin') ?? db.members[0];
      const authUser: AuthUser = {
        id: 'admin-chair',
        role: 'admin',
        displayName: chair ? chair.fullName : 'Group Admin',
        phone: chair ? chair.phone : null,
        email: adminEmail,
        memberId: chair ? chair.id : null,
        memberNumber: chair ? chair.memberNumber : 'TJ-001',
      };
      const sessionToken = await signSessionToken(authUser, secret);
      return json(
        { token: sessionToken, user: authUser },
        200,
        { 'Set-Cookie': buildCookieHeader(sessionToken) }
      );
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      return json(
        { ok: true },
        200,
        { 'Set-Cookie': 'tujenge_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' }
      );
    }

    if (pathname === '/api/payments' && request.method === 'POST') {
      if (!user) return json({ error: 'Please sign in first to record a contribution.' }, 401);
      const db = await loadDatabase(env);
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const smsText = String(body.smsText || '').trim();
      const parsed = smsText ? parseMobileMoneySms(smsText) : null;

      const targetMemberId =
        user.role === 'admin' && body.memberId ? String(body.memberId) : user.memberId;
      const member = db.members.find((m) => m.id === targetMemberId);
      if (!member) return json({ error: 'Target member record not found.' }, 404);

      const amountTsh = Math.round(Number(body.amountTsh || parsed?.amountTsh || 0));
      const provider = String(body.provider || parsed?.provider || 'M-Pesa') as PaymentRecord['provider'];
      const reference = String(body.reference || parsed?.reference || '').trim().toUpperCase();
      const weeklySplitMode = body.weeklySplitMode !== false;

      if (!amountTsh || amountTsh < 1000) {
        return json({ error: 'Enter a valid contribution amount in TSH.' }, 400);
      }
      if (reference.length < 5) {
        return json({ error: 'Enter a valid mobile money transaction reference.' }, 400);
      }
      if (db.payments.some((p) => p.reference.toUpperCase() === reference)) {
        return json({ error: `Transaction reference ${reference} already exists.` }, 409);
      }

      const split = splitContributionTsh(amountTsh, weeklySplitMode);
      const payment: PaymentRecord = {
        id: `pay-${Date.now().toString(36)}`,
        memberId: member.id,
        memberNumber: member.memberNumber,
        memberName: member.fullName,
        provider,
        reference,
        amountTsh,
        hisaAllocatedTsh: split.hisaAllocatedTsh,
        jamiiAllocatedTsh: split.jamiiAllocatedTsh,
        sharesAdded: split.sharesAdded,
        rawSms: smsText || `${provider} entry ${reference}`,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };

      member.hisaShares += split.sharesAdded;
      member.hisaTotalTsh += split.hisaAllocatedTsh;
      member.jamiiTotalTsh += split.jamiiAllocatedTsh;
      db.payments.push(payment);
      await saveDatabase(env, db);
      return json({ payment }, 201);
    }

    if (pathname === '/api/loans' && request.method === 'POST') {
      if (!user) return json({ error: 'Please sign in to submit a loan request.' }, 401);
      const db = await loadDatabase(env);
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const targetMemberId =
        user.role === 'admin' && body.memberId ? String(body.memberId) : user.memberId;
      const member = db.members.find((m) => m.id === targetMemberId);
      if (!member) return json({ error: 'Member profile not found.' }, 404);

      const amountTsh = Math.round(Number(body.amountTsh || 0));
      const purpose = String(body.purpose || '').trim();
      const guarantorName = String(body.guarantorName || '').trim();
      const termMonths = Math.min(12, Math.max(1, Number(body.termMonths || 3)));
      const maxEligible = member.hisaTotalTsh * MAX_LOAN_MULTIPLIER;

      if (maxEligible <= 0) {
        return json({ error: 'Contribute at least one Hisa share before requesting a loan.' }, 400);
      }
      if (!amountTsh || amountTsh < 10000 || amountTsh > maxEligible) {
        return json({ error: `Loan amount must be between TSH 10,000 and TSH ${maxEligible.toLocaleString('en-US')}.` }, 400);
      }
      if (purpose.length < 4 || guarantorName.length < 3) {
        return json({ error: 'Provide both loan purpose and guarantor name.' }, 400);
      }

      const loan: LoanRecord = {
        id: `loan-${Date.now().toString(36)}`,
        memberId: member.id,
        memberNumber: member.memberNumber,
        memberName: member.fullName,
        amountTsh,
        repaidTsh: 0,
        purpose,
        guarantorName,
        termMonths,
        interestRatePct: 5,
        status: user.role === 'admin' ? 'active' : 'pending',
        requestedAt: new Date().toISOString(),
      };
      db.loans.push(loan);
      await saveDatabase(env, db);
      return json({ loan }, 201);
    }

    const loanMatch = pathname.match(/^\/api\/loans\/([^/]+)\/action$/);
    if (loanMatch && request.method === 'POST') {
      if (!user || user.role !== 'admin') {
        return json({ error: 'Admin permission required.' }, 403);
      }
      const db = await loadDatabase(env);
      const loan = db.loans.find((l) => l.id === loanMatch[1]);
      if (!loan) return json({ error: 'Loan not found.' }, 404);

      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const action = String(body.action || '');
      if (action === 'approve') loan.status = 'active';
      else if (action === 'decline') loan.status = 'declined';
      else if (action === 'repay') {
        const repay = Math.round(Number(body.repaymentAmountTsh || 0));
        if (!repay || repay <= 0) return json({ error: 'Invalid repayment amount.' }, 400);
        loan.repaidTsh = Math.min(loan.amountTsh, loan.repaidTsh + repay);
        if (loan.repaidTsh >= loan.amountTsh) loan.status = 'repaid';
      } else {
        return json({ error: 'Unsupported action.' }, 400);
      }
      await saveDatabase(env, db);
      return json({ loan });
    }

    if (pathname === '/api/documents' && request.method === 'POST') {
      if (!user || user.role !== 'admin') {
        return json({ error: 'Admin permission required.' }, 403);
      }
      const db = await loadDatabase(env);
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const title = String(body.title || '').trim();
      const category = String(body.category || 'Group Policy').trim();
      const summary = String(body.summary || '').trim();
      const externalUrl = String(body.externalUrl || '').trim();
      const visibility = body.visibility === 'admin_only' ? 'admin_only' : 'all_members';
      if (title.length < 3 || summary.length < 5) {
        return json({ error: 'Document title and summary are required.' }, 400);
      }
      const doc: DocumentRecord = {
        id: `doc-${Date.now().toString(36)}`,
        title,
        category,
        summary,
        externalUrl,
        visibility,
        updatedAt: new Date().toISOString(),
      };
      db.documents.unshift(doc);
      await saveDatabase(env, db);
      return json({ document: doc }, 201);
    }

    if (pathname === '/api/meetings' && request.method === 'POST') {
      if (!user || user.role !== 'admin') {
        return json({ error: 'Admin permission required.' }, 403);
      }
      const db = await loadDatabase(env);
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const title = String(body.title || '').trim();
      const quarterLabel = String(body.quarterLabel || 'Quarterly').trim();
      const meetingDate = String(body.meetingDate || '').trim();
      const location = String(body.location || 'Kinondoni Hub').trim();
      const agenda = String(body.agenda || '').trim();
      if (title.length < 3 || !meetingDate) {
        return json({ error: 'Meeting title and date are required.' }, 400);
      }
      const meeting: MeetingRecord = {
        id: `mtg-${Date.now().toString(36)}`,
        title,
        quarterLabel,
        meetingDate,
        location,
        agenda: agenda || 'Share audit, loan review, and member updates.',
        status: 'scheduled',
      };
      db.meetings.push(meeting);
      await saveDatabase(env, db);
      return json({ meeting }, 201);
    }

    return json({ error: 'Endpoint not found.' }, 404);
  },
};
