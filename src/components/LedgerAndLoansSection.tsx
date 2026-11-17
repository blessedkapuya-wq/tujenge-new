import { useMemo, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { performLoanAction, submitLoanRequest } from '../lib/api';
import {
  formatTsh,
  MAX_LOAN_MULTIPLIER,
  type AuthUser,
  type LoanRecord,
  type MemberRecord,
} from '../shared/vicoba';

interface LedgerAndLoansSectionProps {
  user: AuthUser | null;
  members: MemberRecord[];
  loans: LoanRecord[];
  lang: 'en' | 'sw';
  onOpenSignIn: () => void;
  onUpdated: () => Promise<void>;
}

export function LedgerAndLoansSection({
  user,
  members,
  loans,
  lang,
  onOpenSignIn,
  onUpdated,
}: LedgerAndLoansSectionProps) {
  const [query, setQuery] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [termMonths, setTermMonths] = useState(3);
  const [busyLoan, setBusyLoan] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [loanSuccess, setLoanSuccess] = useState<string | null>(null);

  const t = (en: string, sw: string) => (lang === 'sw' ? sw : en);

  const currentMember = useMemo(
    () => (user?.memberId ? members.find((m) => m.id === user.memberId) ?? null : null),
    [members, user]
  );

  const maxEligibleTsh = currentMember ? currentMember.hisaTotalTsh * MAX_LOAN_MULTIPLIER : 0;

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        m.mtaaHouseNumber.toLowerCase().includes(q)
    );
  }, [members, query]);

  async function handleLoanSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      onOpenSignIn();
      return;
    }
    setLoanError(null);
    setLoanSuccess(null);
    setBusyLoan(true);
    try {
      const res = await submitLoanRequest({
        amountTsh: Number(loanAmount),
        purpose,
        guarantorName,
        termMonths,
      });
      setLoanSuccess(
        res.loan.status === 'active'
          ? t('Loan approved and active on ledger.', 'Mkopo umeidhinishwa.')
          : t('Loan request submitted for chair review.', 'Ombi la mkopo limetumwa kwa msimamizi.')
      );
      setLoanAmount('');
      setPurpose('');
      setGuarantorName('');
      await onUpdated();
    } catch (err) {
      setLoanError(err instanceof Error ? err.message : 'Unable to submit loan request.');
    } finally {
      setBusyLoan(false);
    }
  }

  async function handleAdminLoanAction(
    loanId: string,
    action: 'approve' | 'decline' | 'repay',
    repaymentAmountTsh?: number
  ) {
    try {
      await performLoanAction(loanId, { action, repaymentAmountTsh });
      await onUpdated();
    } catch (err) {
      setLoanError(err instanceof Error ? err.message : 'Could not update loan.');
    }
  }

  return (
    <section id="ledger" className="py-10 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Member Share Ledger Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                {t('Member Share & Jamii Ledger', 'Leja ya Hisa na Jamii ya Wanachama')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t(
                  'Automatic sequential member numbers with live TSH share balances.',
                  'Namba za uanachama zilizopangwa na salio la Hisa kwa TSH.'
                )}
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search name or TJ-00...', 'Tafuta jina au TJ-00...')}
                aria-label="Filter member ledger"
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">{t('Member #', 'Namba')}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t('Member & Mtaa', 'Mwanachama & Mtaa')}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t('Phone', 'Simu')}</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">{t('Shares', 'Hisa')}</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">{t('Hisa Total', 'Jumla Hisa')}</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">{t('Jamii Total', 'Jumla Jamii')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                      {t('No members match your filter.', 'Hakuna mwanachama anayelingana na utafutaji.')}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-emerald-900 whitespace-nowrap">
                        {m.memberNumber}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">
                          {m.fullName}
                          {user?.memberId === m.id && (
                            <span className="ml-2 text-xs font-normal text-emerald-800">
                              ({t('You', 'Wewe')})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {m.mtaaHouseNumber} · {m.role === 'admin' ? t('Chair', 'Mwenyekiti') : t('Member', 'Mwanachama')}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600 whitespace-nowrap">
                        {m.phone}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-slate-800 whitespace-nowrap">
                        {m.hisaShares}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                        {formatTsh(m.hisaTotalTsh)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-slate-700 whitespace-nowrap">
                        {formatTsh(m.jamiiTotalTsh)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Loans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleLoanSubmit}
            className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4"
          >
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-semibold text-slate-900">
                {t('Request Group Loan (3x Hisa Limit)', 'Omba Mkopo (Kikomo Mara 3 ya Hisa)')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {currentMember
                  ? `${t('Your borrowing limit:', 'Kikomo chako cha mkopo:')} ${formatTsh(maxEligibleTsh)}`
                  : t('Sign in to view your personal 3x Hisa borrowing capacity.', 'Ingia kuona kikomo chako cha mkopo.')}
              </p>
            </div>

            <div>
              <label htmlFor="loan-amount" className="block text-xs font-medium text-slate-700 mb-1">
                {t('Loan Amount (TSH)', 'Kiasi cha Mkopo (TSH)')}
              </label>
              <input
                id="loan-amount"
                type="number"
                min={10000}
                step={5000}
                required
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="150000"
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="loan-guarantor" className="block text-xs font-medium text-slate-700 mb-1">
                  {t('Member Guarantor', 'Mdhamini (Mwanachama)')}
                </label>
                <input
                  id="loan-guarantor"
                  type="text"
                  required
                  value={guarantorName}
                  onChange={(e) => setGuarantorName(e.target.value)}
                  placeholder="Grace Mushi"
                  className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label htmlFor="loan-term" className="block text-xs font-medium text-slate-700 mb-1">
                  {t('Repayment Term', 'Muda wa Marejesho')}
                </label>
                <select
                  id="loan-term"
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  <option value={1}>1 Month (5%)</option>
                  <option value={3}>3 Months (5%)</option>
                  <option value={6}>6 Months (5%)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="loan-purpose" className="block text-xs font-medium text-slate-700 mb-1">
                {t('Business / Need Purpose', 'Kusudio la Mkopo')}
              </label>
              <input
                id="loan-purpose"
                type="text"
                required
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder={t('e.g. Tailoring machine purchase', 'Mfano: Kununua cherehani')}
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            {loanError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {loanError}
              </div>
            )}
            {loanSuccess && (
              <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                {loanSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={busyLoan}
              className="w-full h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
            >
              {user
                ? busyLoan
                  ? t('Submitting...', 'Inatuma...')
                  : t('Submit Loan Request', 'Tuma Ombi la Mkopo')
                : t('Sign In to Request Loan', 'Ingia Kuomba Mkopo')}
            </button>
          </form>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="font-display text-lg font-semibold text-slate-900 mb-4">
              {t('Active & Pending Group Loans', 'Mikopo Hai na Inayosubiri')}
            </h3>
            <div className="divide-y divide-slate-100">
              {loans.length === 0 ? (
                <p className="py-6 text-xs text-slate-500">
                  {t('No loan records yet.', 'Hakuna rekodi ya mikopo bado.')}
                </p>
              ) : (
                loans.map((loan) => {
                  const balance = Math.max(0, loan.amountTsh - loan.repaidTsh);
                  return (
                    <div key={loan.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {loan.memberName} ·{' '}
                          <span className="font-mono-tabular text-xs font-normal text-slate-500">
                            {loan.memberNumber}
                          </span>
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {loan.purpose} · {t('Guarantor:', 'Mdhamini:')} {loan.guarantorName}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono-tabular">
                          {t('Status:', 'Hali:')} {loan.status.toUpperCase()} · {loan.termMonths} mo ({loan.interestRatePct}%)
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900 font-mono-tabular">
                            {formatTsh(loan.amountTsh)}
                          </p>
                          <p className="text-xs text-slate-500 font-mono-tabular">
                            {t('Remaining:', 'Baki:')} {formatTsh(balance)}
                          </p>
                        </div>

                        {user?.role === 'admin' && loan.status === 'pending' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAdminLoanAction(loan.id, 'approve')}
                              className="px-3 py-1.5 rounded-md bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-medium cursor-pointer"
                            >
                              {t('Approve', 'Idhinisha')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminLoanAction(loan.id, 'decline')}
                              className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer"
                            >
                              {t('Decline', 'Kataa')}
                            </button>
                          </div>
                        )}

                        {user?.role === 'admin' && loan.status === 'active' && balance > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleAdminLoanAction(loan.id, 'repay', Math.min(50000, balance))
                            }
                            className="px-3 py-1.5 rounded-md border border-emerald-700 text-emerald-800 hover:bg-emerald-50 text-xs font-medium cursor-pointer whitespace-nowrap"
                          >
                            {t('Log +50k Repay', 'Rekodi +50k')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
