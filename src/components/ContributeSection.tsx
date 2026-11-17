import { useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Smartphone } from 'lucide-react';
import { submitPayment } from '../lib/api';
import {
  formatTsh,
  parseMobileMoneySms,
  SAMPLE_SMS_RECEIPTS,
  splitContributionTsh,
  type AuthUser,
  type MemberRecord,
  type PaymentRecord,
} from '../shared/vicoba';

interface ContributeSectionProps {
  user: AuthUser | null;
  members: MemberRecord[];
  payments: PaymentRecord[];
  lang: 'en' | 'sw';
  onOpenSignIn: () => void;
  onPaymentRecorded: () => Promise<void>;
}

export function ContributeSection({
  user,
  members,
  payments,
  lang,
  onOpenSignIn,
  onPaymentRecorded,
}: ContributeSectionProps) {
  const [smsText, setSmsText] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualReference, setManualReference] = useState('');
  const [provider, setProvider] = useState<PaymentRecord['provider']>('M-Pesa');
  const [weeklySplitMode, setWeeklySplitMode] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedRef, setConfirmedRef] = useState<string | null>(null);

  const t = (en: string, sw: string) => (lang === 'sw' ? sw : en);

  const parsed = useMemo(() => parseMobileMoneySms(smsText), [smsText]);
  const effectiveAmount = Number(manualAmount) || parsed.amountTsh || 0;
  const effectiveProvider = parsed.provider || provider;
  const effectiveRef = (manualReference || parsed.reference || '').trim().toUpperCase();
  const split = useMemo(
    () => splitContributionTsh(effectiveAmount, weeklySplitMode),
    [effectiveAmount, weeklySplitMode]
  );

  function handleSelectSample(sample: (typeof SAMPLE_SMS_RECEIPTS)[number]) {
    setSmsText(sample.text);
    setProvider(sample.provider);
    setManualAmount('');
    setManualReference('');
    setError(null);
    setConfirmedRef(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      onOpenSignIn();
      return;
    }
    setError(null);
    setConfirmedRef(null);
    setBusy(true);
    try {
      const res = await submitPayment({
        smsText,
        amountTsh: effectiveAmount,
        provider: effectiveProvider,
        reference: effectiveRef,
        memberId: user.role === 'admin' && selectedMemberId ? selectedMemberId : undefined,
        weeklySplitMode,
      });
      setConfirmedRef(res.payment.reference);
      setSmsText('');
      setManualAmount('');
      setManualReference('');
      await onPaymentRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record contribution.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="contribute" className="py-10 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              {t('Mobile Money Share Contribution', 'Wasilisha Malipo ya Hisa kwa Simu')}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {t(
                'Paste your M-Pesa, Mixx by Yas, Airtel Money, or Halopesa confirmation SMS to split Hisa and Jamii automatically.',
                'Bandika ujumbe wa uthibitisho wa M-Pesa, Mixx by Yas, Airtel Money, au Halopesa ili kugawa Hisa na Jamii moja kwa moja.'
              )}
            </p>
          </div>
          <span className="text-xs font-mono-tabular text-slate-500">
            {t('1 Hisa = TSH 10,000 · Jamii = TSH 2,000', 'Hisa 1 = TSH 10,000 · Jamii = TSH 2,000')}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-5"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label htmlFor="sms-receipt-input" className="text-xs font-medium text-slate-700">
                  {t('Paste Mobile Money Confirmation SMS', 'Bandika Ujumbe wa SMS wa Malipo')}
                </label>
                <span className="text-xs text-slate-500">
                  {t('Or try a sample receipt:', 'Au jaribu mfano:')}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {SAMPLE_SMS_RECEIPTS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => handleSelectSample(sample)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>

              <textarea
                id="sms-receipt-input"
                rows={3}
                value={smsText}
                onChange={(e) => {
                  setSmsText(e.target.value);
                  setError(null);
                  setConfirmedRef(null);
                }}
                placeholder="e.g. RL94K2M81P Confirmed. Tsh12,000.00 sent to TUJENGE HUB 5548920..."
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="pay-provider" className="block text-xs font-medium text-slate-700 mb-1">
                  {t('Network Provider', 'Mtandao')}
                </label>
                <select
                  id="pay-provider"
                  value={effectiveProvider}
                  onChange={(e) => setProvider(e.target.value as PaymentRecord['provider'])}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Mixx by Yas">Mixx by Yas</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="Halopesa">Halopesa</option>
                </select>
              </div>

              <div>
                <label htmlFor="pay-amount" className="block text-xs font-medium text-slate-700 mb-1">
                  {t('Amount (TSH)', 'Kiasi (TSH)')}
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  min={1000}
                  step={1000}
                  value={manualAmount || (parsed.amountTsh ?? '')}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="12000"
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label htmlFor="pay-reference" className="block text-xs font-medium text-slate-700 mb-1">
                  {t('Transaction Ref', 'Namba ya Muamala')}
                </label>
                <input
                  id="pay-reference"
                  type="text"
                  value={manualReference || (parsed.reference ?? '')}
                  onChange={(e) => setManualReference(e.target.value)}
                  placeholder="RL94K2M81P"
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 font-mono-tabular uppercase focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>

            {user?.role === 'admin' && (
              <div>
                <label htmlFor="pay-member" className="block text-xs font-medium text-slate-700 mb-1">
                  {t('Record on Behalf of Member (Admin)', 'Rekodi kwa Niaba ya Mwanachama')}
                </label>
                <select
                  id="pay-member"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  <option value="">
                    {user.displayName} ({user.memberNumber || 'Chair'})
                  </option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.memberNumber} — {m.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={weeklySplitMode}
                  onChange={(e) => setWeeklySplitMode(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-800 focus:ring-emerald-700"
                />
                {t(
                  'Include weekly Jamii fee (TSH 2,000) when total >= TSH 12,000',
                  'Tenga ada ya Jamii ya wiki (TSH 2,000) kiasi kikiwa >= TSH 12,000'
                )}
              </label>

              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer inline-flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4" aria-hidden="true" />
                {user
                  ? busy
                    ? t('Recording...', 'Inarekodi...')
                    : t('Confirm Contribution', 'Thibitisha Malipo')
                  : t('Sign In to Submit Payment', 'Ingia Kuthibitisha Malipo')}
              </button>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                {error}
              </div>
            )}
            {confirmedRef && (
              <div
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                <span>
                  {t('Contribution confirmed and added to the ledger:', 'Malipo yamethibitishwa kwenye leja:')}{' '}
                  <strong className="font-mono-tabular">{confirmedRef}</strong>
                </span>
              </div>
            )}
          </form>

          {/* Right column: Live Split Preview & Recent Receipts */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  {t('Allocation Breakdown', 'Mgawanyo wa Malipo')}
                </h3>
                <span className="text-xs font-mono-tabular text-slate-500">
                  {effectiveRef || t('Awaiting ref', 'Inasubiri ref')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">{t('Hisa Allocation', 'Funguo la Hisa')}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 font-mono-tabular">
                    {formatTsh(split.hisaAllocatedTsh)}
                  </p>
                  <p className="text-xs text-emerald-800 font-mono-tabular">
                    +{split.sharesAdded} {t('shares', 'hisa')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('Jamii Welfare', 'Mfuko wa Jamii')}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 font-mono-tabular">
                    {formatTsh(split.jamiiAllocatedTsh)}
                  </p>
                  <p className="text-xs text-slate-500">{effectiveProvider}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-base font-semibold text-slate-900 mb-3">
                {t('Recent Confirmed Receipts', 'Risiti za Hivi Karibuni')}
              </h3>
              <div className="divide-y divide-slate-100">
                {payments.slice(0, 4).map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {p.memberName} · <span className="font-mono-tabular text-slate-500">{p.memberNumber}</span>
                      </p>
                      <p className="text-slate-500 mt-0.5 truncate">
                        {p.provider} · <span className="font-mono-tabular">{p.reference}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-slate-900 font-mono-tabular">
                        {formatTsh(p.amountTsh)}
                      </p>
                      <p className="text-emerald-800 font-mono-tabular">+{p.sharesAdded} Hisa</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
