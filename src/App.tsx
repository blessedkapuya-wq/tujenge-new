import { useCallback, useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AuthModal, type AuthTab } from './components/AuthModal';
import { ContributeSection } from './components/ContributeSection';
import { LedgerAndLoansSection } from './components/LedgerAndLoansSection';
import { MeetingsAndDocsSection } from './components/MeetingsAndDocsSection';
import { OverviewHero } from './components/OverviewHero';
import { fetchWorkspace, logoutSession } from './lib/api';
import { type AuthUser, type WorkspacePayload } from './shared/vicoba';

const STORAGE_LANG_KEY = 'tujenge_hub_lang';

export default function App() {
  const [lang, setLang] = useState<'en' | 'sw'>(() => {
    try {
      return window.localStorage.getItem(STORAGE_LANG_KEY) === 'sw' ? 'sw' : 'en';
    } catch {
      return 'en';
    }
  });
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>('member');
  const [welcomeBanner, setWelcomeBanner] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const t = (en: string, sw: string) => (lang === 'sw' ? sw : en);

  const refreshWorkspace = useCallback(async () => {
    try {
      const data = await fetchWorkspace();
      setWorkspace(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  // Automatically open registration tab when visited via ?join=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('join') === '1') {
      setAuthTab('register');
      setAuthOpen(true);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_LANG_KEY, lang);
    } catch {
      // ignore storage errors
    }
  }, [lang]);

  function openAuth(tab: AuthTab) {
    setAuthTab(tab);
    setAuthOpen(true);
  }

  async function handleAuthSuccess(user: AuthUser, welcomeMemberNumber?: string) {
    if (welcomeMemberNumber) {
      setWelcomeBanner(
        t(
          `Welcome ${user.displayName}. Your assigned Member Number is ${welcomeMemberNumber}.`,
          `Karibu ${user.displayName}. Namba yako ya uanachama ni ${welcomeMemberNumber}.`
        )
      );
    } else {
      setWelcomeBanner(
        t(`Signed in as ${user.displayName}.`, `Umeingia kama ${user.displayName}.`)
      );
    }
    await refreshWorkspace();
  }

  async function handleSignOut() {
    await logoutSession();
    setWelcomeBanner(null);
    await refreshWorkspace();
  }

  const user = workspace?.user ?? null;

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F8F7F3] text-[#111C16]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element brand wordmark */}
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 rounded-sm"
          >
            Tujenge Hub
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600"
          >
            <a
              href="#overview"
              className="hover:text-slate-900 hover:underline underline-offset-4 decoration-slate-300 transition-colors whitespace-nowrap shrink-0"
            >
              {t('Overview', 'Muhtasari')}
            </a>
            <a
              href="#contribute"
              className="hover:text-slate-900 hover:underline underline-offset-4 decoration-slate-300 transition-colors whitespace-nowrap shrink-0"
            >
              {t('Contribute', 'Changia')}
            </a>
            <a
              href="#ledger"
              className="hover:text-slate-900 hover:underline underline-offset-4 decoration-slate-300 transition-colors whitespace-nowrap shrink-0"
            >
              {t('Ledger', 'Leja')}
            </a>
            <a
              href="#documents"
              className="hover:text-slate-900 hover:underline underline-offset-4 decoration-slate-300 transition-colors whitespace-nowrap shrink-0"
            >
              {t('Documents', 'Nyaraka')}
            </a>
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-slate-800 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('Sign Out', 'Toka')} ({user.memberNumber || 'Admin'})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('member')}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('Sign In', 'Ingia')}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-1"
          >
            <a
              href="#overview"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-2 text-sm font-medium text-slate-700"
            >
              {t('Overview', 'Muhtasari')}
            </a>
            <a
              href="#contribute"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-2 text-sm font-medium text-slate-700"
            >
              {t('Contribute', 'Changia')}
            </a>
            <a
              href="#ledger"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-2 text-sm font-medium text-slate-700"
            >
              {t('Ledger', 'Leja')}
            </a>
            <a
              href="#documents"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-2 text-sm font-medium text-slate-700"
            >
              {t('Documents', 'Nyaraka')}
            </a>
          </nav>
        )}
      </header>

      {welcomeBanner && (
        <div className="bg-emerald-900 text-white text-xs py-2.5 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <span>{welcomeBanner}</span>
            <button
              type="button"
              onClick={() => setWelcomeBanner(null)}
              className="text-emerald-200 hover:text-white underline cursor-pointer shrink-0"
            >
              {t('Dismiss', 'Funga')}
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {loading ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
            <div className="h-72 rounded-xl border border-slate-200 bg-white animate-pulse" />
            <div className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
          </div>
        ) : loadError || !workspace ? (
          <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
            <p className="text-sm text-red-700">{loadError || 'Unable to connect to workspace.'}</p>
            <button
              type="button"
              onClick={refreshWorkspace}
              className="px-4 py-2 rounded-lg bg-emerald-800 text-white text-sm font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <OverviewHero
              group={workspace.group}
              user={user}
              lang={lang}
              onChangeLang={setLang}
              onOpenJoin={() => openAuth('register')}
              onOpenSignIn={() => openAuth('member')}
              onGoToContribute={() =>
                document.getElementById('contribute')?.scrollIntoView({ behavior: 'smooth' })
              }
            />

            <ContributeSection
              user={user}
              members={workspace.members}
              payments={workspace.payments}
              lang={lang}
              onOpenSignIn={() => openAuth('member')}
              onPaymentRecorded={refreshWorkspace}
            />

            <LedgerAndLoansSection
              user={user}
              members={workspace.members}
              loans={workspace.loans}
              lang={lang}
              onOpenSignIn={() => openAuth('member')}
              onUpdated={refreshWorkspace}
            />

            <MeetingsAndDocsSection
              user={user}
              meetings={workspace.meetings}
              documents={workspace.documents}
              lang={lang}
              onUpdated={refreshWorkspace}
            />
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-display font-semibold text-slate-900">Tujenge Hub</span>
            <span aria-hidden="true">·</span>
            <span>{t('Women’s Digital VICOBA Platform', 'Jukwaa la Kidijitali la VICOBA')}</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="hover:text-slate-900 cursor-pointer"
            >
              {t('Member Registration', 'Usajili wa Mwanachama')}
            </button>
            <button
              type="button"
              onClick={() => openAuth('admin')}
              className="hover:text-slate-900 cursor-pointer"
            >
              {t('Chair Admin', 'Msimamizi')}
            </button>
          </div>
        </div>
      </footer>

      <AuthModal
        open={authOpen}
        initialTab={authTab}
        lang={lang}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
