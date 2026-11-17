import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck, UserPlus, X } from 'lucide-react';
import { loginAdmin, loginMember, registerMember } from '../lib/api';
import type { AuthUser } from '../shared/vicoba';

export type AuthTab = 'member' | 'register' | 'admin';

interface AuthModalProps {
  open: boolean;
  initialTab: AuthTab;
  lang: 'en' | 'sw';
  onClose: () => void;
  onSuccess: (user: AuthUser, welcomeNumber?: string) => void;
}

export function AuthModal({
  open,
  initialTab,
  lang,
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Member login fields
  const [loginPhone, setLoginPhone] = useState('+255 ');
  const [loginPin, setLoginPin] = useState('');

  // Join / register fields
  const [fullName, setFullName] = useState('');
  const [regPhone, setRegPhone] = useState('+255 ');
  const [regPin, setRegPin] = useState('');
  const [mtaaHouseNumber, setMtaaHouseNumber] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [commitment, setCommitment] = useState(1);

  // Admin login fields
  const [adminEmail, setAdminEmail] = useState('blessedkapuya@gmail.com');
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
    }
  }, [open, initialTab]);

  if (!open) return null;

  const t = (en: string, sw: string) => (lang === 'sw' ? sw : en);

  async function handleMemberLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await loginMember({ phone: loginPhone, pin: loginPin });
      onSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await registerMember({
        fullName,
        phone: regPhone,
        pin: regPin,
        mtaaHouseNumber,
        nationalId,
        startingCommitmentShares: commitment,
      });
      onSuccess(res.user, res.memberNumber);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete registration.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await loginAdmin({ email: adminEmail, password: adminPassword });
      onSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="auth-modal-title" className="font-display text-lg font-semibold text-slate-900">
              {tab === 'register'
                ? t('Join Tujenge Hub VICOBA', 'Jiunge na Tujenge Hub VICOBA')
                : tab === 'admin'
                ? t('Group Admin Sign In', 'Ingia kama Msimamizi')
                : t('Member Sign In', 'Ingia kama Mwanachama')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t(
                'Direct mobile number & PIN authentication — works on preview and Cloudflare Workers.',
                'Uthibitishaji wa moja kwa moja kwa namba ya simu na PIN.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Auth Mode Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setTab('member');
                setError(null);
              }}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'member'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('Member Sign In', 'Ingia')}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
              }}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('New Member', 'Jiunge Sasa')}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('admin');
                setError(null);
              }}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'admin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('Admin Access', 'Msimamizi')}
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
            >
              {error}
            </div>
          )}

          {tab === 'member' && (
            <form onSubmit={handleMemberLogin} className="space-y-4">
              <div>
                <label htmlFor="member-login-phone" className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('Tanzanian Mobile Number', 'Namba ya Simu ya Tanzania')}
                </label>
                <input
                  id="member-login-phone"
                  type="tel"
                  required
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="+255 754 100 002"
                  className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label htmlFor="member-login-pin" className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('Member PIN (4–6 digits)', 'PIN ya Mwanachama (tarakimu 4–6)')}
                </label>
                <input
                  id="member-login-pin"
                  type="password"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  placeholder="••••"
                  className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginPhone('+255754100002');
                    setLoginPin('2026');
                  }}
                  className="text-xs font-medium text-emerald-800 hover:underline cursor-pointer"
                >
                  {t('Fill demo member (TJ-002 · PIN 2026)', 'Jaza mwanachama wa majaribio (TJ-002)')}
                </button>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                {busy ? t('Signing in...', 'Inaingia...') : t('Sign In to Ledger', 'Ingia Kwenye Leja')}
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700 mb-1">
                    {t('Full Name', 'Jina Kamili')}
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Rehema Hassan"
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-700 mb-1">
                    {t('Mobile Number', 'Namba ya Simu')}
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0754 123 456"
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="reg-pin" className="block text-xs font-medium text-slate-700 mb-1">
                    {t('Create 4–6 Digit PIN', 'Unda PIN ya Tarakimu 4–6')}
                  </label>
                  <input
                    id="reg-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4,6}"
                    maxLength={6}
                    required
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value)}
                    placeholder="e.g. 4820"
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label htmlFor="reg-shares" className="block text-xs font-medium text-slate-700 mb-1">
                    {t('Weekly Hisa Commitment', 'Ahadi ya Hisa kwa Wiki')}
                  </label>
                  <select
                    id="reg-shares"
                    value={commitment}
                    onChange={(e) => setCommitment(Number(e.target.value))}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    <option value={1}>1 Hisa / week (TSH 12,000)</option>
                    <option value={2}>2 Hisa / week (TSH 22,000)</option>
                    <option value={3}>3 Hisa / week (TSH 32,000)</option>
                    <option value={5}>5 Hisa / week (TSH 52,000)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="reg-mtaa" className="block text-xs font-medium text-slate-700 mb-1">
                    {t('Mtaa & House Number', 'Mtaa na Namba ya Nyumba')}
                  </label>
                  <input
                    id="reg-mtaa"
                    type="text"
                    required
                    value={mtaaHouseNumber}
                    onChange={(e) => setMtaaHouseNumber(e.target.value)}
                    placeholder="Kinondoni Mkwajuni · 18"
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div>
                  <label htmlFor="reg-nida" className="block text-xs font-medium text-slate-700 mb-1">
                    {t('NIDA / Voter ID Number', 'Namba ya NIDA / Kura')}
                  </label>
                  <input
                    id="reg-nida"
                    type="text"
                    required
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="19920418-14102-00001-21"
                    className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer mt-1"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                {busy
                  ? t('Assigning Member Number...', 'Inasajili Namba...')
                  : t('Register & Get Member Number', 'Sajili & Pata Namba ya Uanachama')}
              </button>
            </form>
          )}

          {tab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('Chair / Admin Email', 'Barua Pepe ya Msimamizi')}
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('Admin Passcode', 'Nenosiri la Msimamizi')}
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin passcode"
                  className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAdminEmail('blessedkapuya@gmail.com');
                    setAdminPassword('TujengeAdmin2026!');
                  }}
                  className="font-medium text-emerald-800 hover:underline cursor-pointer"
                >
                  {t('Use default dev passcode', 'Tumia nenosiri la majaribio')}
                </button>
                <span className="text-slate-500">
                  {t('Set via ADMIN_PASSWORD secret', 'Inadhibitiwa na ADMIN_PASSWORD')}
                </span>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                {busy ? t('Verifying Admin...', 'Inathibitisha...') : t('Sign In as Group Admin', 'Ingia kama Msimamizi')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
