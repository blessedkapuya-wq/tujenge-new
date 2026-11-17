import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashSecret, signSessionToken, verifySecret, verifySessionToken } from './src/shared/cryptoAuth.ts';
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
} from './src/shared/vicoba.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'dev-tujenge-session-secret-change-in-prod';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'blessedkapuya@gmail.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TujengeAdmin2026!';
const DATA_DIR = path.join(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'tujenge-db.json');

let dbCache: PersistedDatabase | null = null;

async function getDb(): Promise<PersistedDatabase> {
  if (dbCache) return dbCache;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      dbCache = JSON.parse(raw) as PersistedDatabase;
      return dbCache;
    } catch {
      // Fall through to re-seed on corrupt file
    }
  }
  const defaultPinHash = await hashSecret('2026');
  dbCache = createSeedDatabase(defaultPinHash);
  saveDb(dbCache);
  return dbCache;
}

function saveDb(db: PersistedDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function extractToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const item of cookies) {
      const [k, ...rest] = item.trim().split('=');
      if (k === 'tujenge_session') {
        return decodeURIComponent(rest.join('='));
      }
    }
  }
  return null;
}

async function resolveUser(req: express.Request): Promise<AuthUser | null> {
  const token = extractToken(req);
  if (!token) return null;
  return verifySessionToken(token, SESSION_SECRET);
}

function setSessionCookie(res: express.Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  const flags = [
    `tujenge_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Max-Age=604800',
    isProd ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', flags.join('; '));
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

  const documents = db.documents.filter(
    (d) => d.visibility === 'all_members' || isAdmin
  );

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
    documents,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, runtime: 'node-express', auth: 'hmac-session' });
  });

  app.get('/api/scheduler/status', async (_req, res) => {
    const db = await getDb();
    const nextMeeting = db.meetings.find((m) => m.status === 'scheduled') ?? null;
    res.json({
      ok: true,
      pendingMembersCount: db.members.filter((m) => m.status === 'pending').length,
      activeMembersCount: db.members.filter((m) => m.status === 'active').length,
      nextMeetingTitle: nextMeeting?.title ?? null,
      nextMeetingDate: nextMeeting?.meetingDate ?? null,
    });
  });

  app.post('/api/scheduler/config', (_req, res) => {
    res.json({ ok: true, updatedAt: new Date().toISOString() });
  });

  app.get('/api/workspace', async (req, res) => {
    const db = await getDb();
    const user = await resolveUser(req);
    res.json(buildWorkspacePayload(db, user));
  });

  app.post('/api/auth/register', async (req, res) => {
    const db = await getDb();
    const body = (req.body || {}) as Record<string, unknown>;
    const fullName = String(body.fullName || '').trim();
    const phoneRaw = String(body.phone || '');
    const pin = String(body.pin || '').trim();
    const mtaaHouseNumber = String(body.mtaaHouseNumber || '').trim();
    const nationalId = String(body.nationalId || '').trim();
    const commitment = Math.min(20, Math.max(1, Number(body.startingCommitmentShares || 1)));

    if (fullName.length < 3) {
      res.status(400).json({ error: 'Enter your full name (at least 3 characters).' });
      return;
    }
    if (!isValidTzPhone(phoneRaw)) {
      res.status(400).json({
        error: 'Enter a valid Tanzanian mobile number (e.g. 0754 123 456 or +255 754 123 456).',
      });
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      res.status(400).json({ error: 'Create a 4 to 6 digit numeric PIN.' });
      return;
    }
    if (mtaaHouseNumber.length < 3) {
      res.status(400).json({ error: 'Enter your Mtaa and house or plot number.' });
      return;
    }
    if (nationalId.length < 6) {
      res.status(400).json({ error: 'Enter your NIDA or Voter ID number.' });
      return;
    }

    const phone = normalizeTzPhone(phoneRaw);
    const existing = db.users.find((u) => u.phone === phone);
    if (existing) {
      res.status(409).json({
        error: 'This mobile number is already registered. Sign in with your PIN instead.',
      });
      return;
    }

    const memberNumber = formatNextMemberNumber(db.members);
    const memberId = `mem-${Date.now().toString(36)}`;
    const userId = `usr-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const secretHash = await hashSecret(pin);

    const newMember: MemberRecord = {
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
    };

    const user: AuthUser = {
      id: userId,
      role: 'member',
      displayName: fullName,
      phone,
      email: null,
      memberId,
      memberNumber,
    };

    db.members.push(newMember);
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
    saveDb(db);

    const token = await signSessionToken(user, SESSION_SECRET);
    setSessionCookie(res, token);
    res.status(201).json({ token, user, memberNumber });
  });

  app.post('/api/auth/login-member', async (req, res) => {
    const db = await getDb();
    const body = (req.body || {}) as Record<string, unknown>;
    const phoneRaw = String(body.phone || '');
    const pin = String(body.pin || '').trim();

    if (!isValidTzPhone(phoneRaw)) {
      res.status(400).json({ error: 'Enter a valid Tanzanian mobile number.' });
      return;
    }
    const phone = normalizeTzPhone(phoneRaw);
    const credential = db.users.find((u) => u.role === 'member' && u.phone === phone);
    if (!credential) {
      res.status(401).json({ error: 'No member account found for this phone number.' });
      return;
    }

    const ok = await verifySecret(pin, credential.secretHash);
    if (!ok) {
      res.status(401).json({ error: 'Incorrect PIN. Please check your 4–6 digit PIN.' });
      return;
    }

    const user: AuthUser = {
      id: credential.id,
      role: 'member',
      displayName: credential.displayName,
      phone: credential.phone,
      email: credential.email,
      memberId: credential.memberId,
      memberNumber: credential.memberNumber,
    };
    const token = await signSessionToken(user, SESSION_SECRET);
    setSessionCookie(res, token);
    res.json({ token, user });
  });

  app.post('/api/auth/login-admin', async (req, res) => {
    const db = await getDb();
    const body = (req.body || {}) as Record<string, unknown>;
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      res.status(401).json({ error: 'Invalid admin email or passcode.' });
      return;
    }

    const chairMember = db.members.find((m) => m.role === 'admin') ?? db.members[0];
    const user: AuthUser = {
      id: 'admin-chair',
      role: 'admin',
      displayName: chairMember ? chairMember.fullName : 'Group Admin',
      phone: chairMember ? chairMember.phone : null,
      email: ADMIN_EMAIL,
      memberId: chairMember ? chairMember.id : null,
      memberNumber: chairMember ? chairMember.memberNumber : 'TJ-001',
    };
    const token = await signSessionToken(user, SESSION_SECRET);
    setSessionCookie(res, token);
    res.json({ token, user });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.setHeader('Set-Cookie', 'tujenge_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
    res.json({ ok: true });
  });

  app.post('/api/payments', async (req, res) => {
    const user = await resolveUser(req);
    if (!user) {
      res.status(401).json({ error: 'Please sign in first to record a contribution.' });
      return;
    }
    const db = await getDb();
    const body = (req.body || {}) as Record<string, unknown>;
    const smsText = String(body.smsText || '').trim();
    const parsed = smsText ? parseMobileMoneySms(smsText) : null;

    const targetMemberId =
      user.role === 'admin' && body.memberId ? String(body.memberId) : user.memberId;
    const member = db.members.find((m) => m.id === targetMemberId);
    if (!member) {
      res.status(404).json({ error: 'Target member record not found.' });
      return;
    }

    const amountTsh = Math.round(Number(body.amountTsh || parsed?.amountTsh || 0));
    const provider = (String(body.provider || parsed?.provider || 'M-Pesa') as PaymentRecord['provider']);
    const reference = String(body.reference || parsed?.reference || '')
      .trim()
      .toUpperCase();
    const weeklySplitMode = body.weeklySplitMode !== false;

    if (!amountTsh || amountTsh < 1000) {
      res.status(400).json({ error: 'Enter a valid contribution amount in TSH (min 1,000).' });
      return;
    }
    if (reference.length < 5) {
      res.status(400).json({ error: 'Enter a valid mobile money transaction reference.' });
      return;
    }
    if (db.payments.some((p) => p.reference.toUpperCase() === reference)) {
      res.status(409).json({
        error: `Transaction reference ${reference} has already been recorded.`,
      });
      return;
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
      rawSms: smsText || `${provider} manual entry ${reference}`,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    member.hisaShares += split.sharesAdded;
    member.hisaTotalTsh += split.hisaAllocatedTsh;
    member.jamiiTotalTsh += split.jamiiAllocatedTsh;
    db.payments.push(payment);
    saveDb(db);

    res.status(201).json({ payment });
  });

  app.post('/api/loans', async (req, res) => {
    const user = await resolveUser(req);
    if (!user) {
      res.status(401).json({ error: 'Please sign in to submit a loan request.' });
      return;
    }
    const db = await getDb();
    const body = (req.body || {}) as Record<string, unknown>;
    const targetMemberId =
      user.role === 'admin' && body.memberId ? String(body.memberId) : user.memberId;
    const member = db.members.find((m) => m.id === targetMemberId);
    if (!member) {
      res.status(404).json({ error: 'Member profile not found.' });
      return;
    }

    const amountTsh = Math.round(Number(body.amountTsh || 0));
    const purpose = String(body.purpose || '').trim();
    const guarantorName = String(body.guarantorName || '').trim();
    const termMonths = Math.min(12, Math.max(1, Number(body.termMonths || 3)));
    const maxEligible = member.hisaTotalTsh * MAX_LOAN_MULTIPLIER;

    if (maxEligible <= 0) {
      res.status(400).json({
        error: 'Contribute at least one Hisa share before requesting a group loan.',
      });
      return;
    }
    if (!amountTsh || amountTsh < 10000 || amountTsh > maxEligible) {
      res.status(400).json({
        error: `Loan amount must be between TSH 10,000 and TSH ${maxEligible.toLocaleString('en-US')} (3x your Hisa).`,
      });
      return;
    }
    if (purpose.length < 4 || guarantorName.length < 3) {
      res.status(400).json({ error: 'Provide both the loan purpose and guarantor full name.' });
      return;
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
    saveDb(db);
    res.status(201).json({ loan });
  });

  app.post('/api/loans/:id/action', async (req, res) => {
    const user = await resolveUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Admin permission required to update loans.' });
      return;
    }
    const db = await getDb();
    const loan = db.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Loan not found.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const action = String(body.action || '');
    if (action === 'approve') {
      loan.status = 'active';
    } else if (action === 'decline') {
      loan.status = 'declined';
    } else if (action === 'repay') {
      const repay = Math.round(Number(body.repaymentAmountTsh || 0));
      if (!repay || repay <= 0) {
        res.status(400).json({ error: 'Enter a valid repayment amount.' });
        return;
      }
      loan.repaidTsh = Math.min(loan.amountTsh, loan.repaidTsh + repay);
      if (loan.repaidTsh >= loan.amountTsh) {
        loan.status = 'repaid';
      }
    } else {
      res.status(400).json({ error: 'Unsupported loan action.' });
      return;
    }
    saveDb(db);
    res.json({ loan });
  });

  app.post('/api/documents', async (req, res) => {
    const user = await resolveUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Admin permission required to publish documents.' });
      return;
    }
    const db = await getDb();
    const body = (req.body || {}) as Record<string, unknown>;
    const title = String(body.title || '').trim();
    const category = String(body.category || 'Group Policy').trim();
    const summary = String(body.summary || '').trim();
    const externalUrl = String(body.externalUrl || '').trim();
    const visibility =
      body.visibility === 'admin_only' ? 'admin_only' : 'all_members';

    if (title.length < 3 || summary.length < 5) {
      res.status(400).json({ error: 'Document title and summary are required.' });
      return;
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
    saveDb(db);
    res.status(201).json({ document: doc });
  });

  app.post('/api/meetings', async (req, res) => {
    const user = await resolveUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Admin permission required to schedule meetings.' });
      return;
    }
    const db = await getDb();
    const body = (req.body || {}) as Record<string, unknown>;
    const title = String(body.title || '').trim();
    const quarterLabel = String(body.quarterLabel || 'Quarterly').trim();
    const meetingDate = String(body.meetingDate || '').trim();
    const location = String(body.location || 'Kinondoni Hub').trim();
    const agenda = String(body.agenda || '').trim();

    if (title.length < 3 || !meetingDate) {
      res.status(400).json({ error: 'Meeting title and date are required.' });
      return;
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
    saveDb(db);
    res.status(201).json({ meeting });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await import('vite');
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(viteServer.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tujenge Hub server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Tujenge Hub server:', err);
  process.exit(1);
});
