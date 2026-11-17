import { useState } from 'react';
import { formatTsh, HERO_FOUNDERS_IMAGE, type AuthUser, type GroupOverview } from '../shared/vicoba';

interface OverviewHeroProps {
  group: GroupOverview;
  user: AuthUser | null;
  lang: 'en' | 'sw';
  onChangeLang: (lang: 'en' | 'sw') => void;
  onOpenJoin: () => void;
  onOpenSignIn: () => void;
  onGoToContribute: () => void;
}

export function OverviewHero({
  group,
  user,
  lang,
  onChangeLang,
  onOpenJoin,
  onOpenSignIn,
  onGoToContribute,
}: OverviewHeroProps) {
  const [imgError, setImgError] = useState(false);
  const t = (en: string, sw: string) => (lang === 'sw' ? sw : en);

  return (
    <section id="overview" className="pt-8 pb-10 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Sub-header context & language bar (kept outside the 3-zone top bar) */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium text-slate-800">{group.groupName}</span>
            <span aria-hidden="true">·</span>
            <span>{group.ward}</span>
            <span aria-hidden="true">·</span>
            <span>{group.cycleLabel}</span>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => onChangeLang('en')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                lang === 'en'
                  ? 'bg-emerald-800 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onChangeLang('sw')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                lang === 'sw'
                  ? 'bg-emerald-800 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kiswahili
            </button>
          </div>
        </div>

        {/* Hero 2-column split with items-stretch */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="space-y-4">
              <p className="text-xs font-medium text-emerald-800 tracking-wide">
                {t(
                  'Hisa TSH 10,000 · Jamii TSH 2,000 · Weekly Sunday Cutoff',
                  'Hisa TSH 10,000 · Jamii TSH 2,000 · Mwisho Jumapili'
                )}
              </p>
              <h1
                className="font-display font-bold tracking-tight text-slate-900 leading-[1.08]"
                style={{ fontSize: 'clamp(2rem, 3.6vw, 3.1rem)', textWrap: 'balance' }}
              >
                {t(
                  'Transparent VICOBA shares, loans, and member ledgers.',
                  'Akiba ya VICOBA, mikopo, na leja ya wanachama kwa uwazi.'
                )}
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                {t(
                  'Join with automatic sequential member numbering, log M-Pesa, Mixx by Yas, Airtel Money, or Halopesa SMS receipts in TSH, and verify group balances without third-party auth popups.',
                  'Jiunge na upate namba ya uanachama moja kwa moja, rekodi risiti za SMS za M-Pesa, Mixx by Yas, Airtel Money, au Halopesa kwa TSH, na fuatilia salio la kikundi kwa uhakika.'
                )}
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 flex flex-wrap items-center gap-3">
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={onGoToContribute}
                    className="px-5 py-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {t('Record Mobile Money Share', 'Wasilisha Malipo ya Simu')}
                  </button>
                  <span className="text-xs text-slate-600 font-mono-tabular">
                    {user.displayName} · {user.memberNumber || 'Admin'}
                  </span>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onOpenJoin}
                    className="px-5 py-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {t('Join VICOBA & Get Member #', 'Jiunge na Pata Namba')}
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSignIn}
                    className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {t('Member / Admin Sign In', 'Ingia Mwanachama / Msimamizi')}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white overflow-hidden">
            {imgError ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center bg-slate-100 text-slate-500 p-8">
                <svg
                  className="w-10 h-10 mb-3 text-emerald-800"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M4 19h16M6 15l4-4 3 3 5-6" />
                </svg>
                <span className="text-xs font-medium text-slate-700">
                  Tujenge Hub VICOBA Members · Dar es Salaam
                </span>
              </div>
            ) : (
              <img
                src={HERO_FOUNDERS_IMAGE}
                alt="Four East African women VICOBA founders reviewing their savings ledger and mobile phone together"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover aspect-video lg:aspect-auto"
              />
            )}
          </div>
        </div>

        {/* Full-width 4-column KPI strip below hero split */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs text-slate-500">{t('Total Group Fund', 'Jumla ya Mfuko')}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 font-mono-tabular">
              {formatTsh(group.totalFundTsh)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t('Hisa Share Pool', 'Mfuko wa Hisa')}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 font-mono-tabular">
              {formatTsh(group.totalHisaTsh)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t('Jamii Welfare Fund', 'Mfuko wa Jamii')}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 font-mono-tabular">
              {formatTsh(group.totalJamiiTsh)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">
              {t('Active Loans · Members', 'Mikopo Hai · Wanachama')}
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-900 font-mono-tabular">
              {formatTsh(group.activeLoansOutstandingTsh)} · {group.memberCount}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
