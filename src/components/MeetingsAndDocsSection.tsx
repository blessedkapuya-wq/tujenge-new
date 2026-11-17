import { useState, type FormEvent } from 'react';
import { Calendar, FileText } from 'lucide-react';
import { publishDocument, scheduleMeeting } from '../lib/api';
import type { AuthUser, DocumentRecord, MeetingRecord } from '../shared/vicoba';

interface MeetingsAndDocsSectionProps {
  user: AuthUser | null;
  meetings: MeetingRecord[];
  documents: DocumentRecord[];
  lang: 'en' | 'sw';
  onUpdated: () => Promise<void>;
}

export function MeetingsAndDocsSection({
  user,
  meetings,
  documents,
  lang,
  onUpdated,
}: MeetingsAndDocsSectionProps) {
  const [showDocForm, setShowDocForm] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('Group Policy');
  const [docSummary, setDocSummary] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docBusy, setDocBusy] = useState(false);

  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [mtgTitle, setMtgTitle] = useState('');
  const [mtgQuarter, setMtgQuarter] = useState('Q2 2027');
  const [mtgDate, setMtgDate] = useState('2027-06-13');
  const [mtgAgenda, setMtgAgenda] = useState('');
  const [mtgBusy, setMtgBusy] = useState(false);

  const t = (en: string, sw: string) => (lang === 'sw' ? sw : en);

  async function handlePublishDoc(e: FormEvent) {
    e.preventDefault();
    setDocBusy(true);
    try {
      await publishDocument({
        title: docTitle,
        category: docCategory,
        summary: docSummary,
        externalUrl: docUrl,
        visibility: 'all_members',
      });
      setDocTitle('');
      setDocSummary('');
      setDocUrl('');
      setShowDocForm(false);
      await onUpdated();
    } finally {
      setDocBusy(false);
    }
  }

  async function handleScheduleMeeting(e: FormEvent) {
    e.preventDefault();
    setMtgBusy(true);
    try {
      await scheduleMeeting({
        title: mtgTitle,
        quarterLabel: mtgQuarter,
        meetingDate: new Date(`${mtgDate}T14:00:00.000Z`).toISOString(),
        location: 'Kinondoni Hub & WhatsApp Video',
        agenda: mtgAgenda,
      });
      setMtgTitle('');
      setMtgAgenda('');
      setShowMeetingForm(false);
      await onUpdated();
    } finally {
      setMtgBusy(false);
    }
  }

  return (
    <section id="documents" className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Quarterly Meetings */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-800" aria-hidden="true" />
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {t('Quarterly Meetings', 'Mikutano ya Robo Mwaka')}
              </h2>
            </div>
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setShowMeetingForm((prev) => !prev)}
                className="text-xs font-medium text-emerald-800 hover:underline cursor-pointer"
              >
                {showMeetingForm ? t('Cancel', 'Ghairi') : t('Add Meeting', 'Ongeza Mkutano')}
              </button>
            )}
          </div>

          {showMeetingForm && user?.role === 'admin' && (
            <form onSubmit={handleScheduleMeeting} className="space-y-3 pb-4 border-b border-slate-100">
              <input
                type="text"
                required
                value={mtgTitle}
                onChange={(e) => setMtgTitle(e.target.value)}
                placeholder="Meeting title"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={mtgQuarter}
                  onChange={(e) => setMtgQuarter(e.target.value)}
                  placeholder="Q2 2027"
                  className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs"
                />
                <input
                  type="date"
                  required
                  value={mtgDate}
                  onChange={(e) => setMtgDate(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs font-mono-tabular"
                />
              </div>
              <input
                type="text"
                value={mtgAgenda}
                onChange={(e) => setMtgAgenda(e.target.value)}
                placeholder="Agenda summary"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs"
              />
              <button
                type="submit"
                disabled={mtgBusy}
                className="px-4 py-1.5 rounded-lg bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
              >
                {mtgBusy ? 'Saving...' : 'Save Meeting'}
              </button>
            </form>
          )}

          <div className="divide-y divide-slate-100">
            {meetings.map((m) => (
              <div key={m.id} className="py-3.5">
                <p className="text-xs font-mono-tabular text-emerald-800">
                  {m.quarterLabel} · {new Date(m.meetingDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
                <h3 className="font-display text-sm font-semibold text-slate-900 mt-0.5">
                  {m.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{m.agenda}</p>
                <p className="text-xs text-slate-500 mt-1">{m.location}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Policy & Constitution Documents */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-800" aria-hidden="true" />
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {t('Constitution & Policy Library', 'Katiba na Sera za Kikundi')}
              </h2>
            </div>
            {user?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setShowDocForm((prev) => !prev)}
                className="text-xs font-medium text-emerald-800 hover:underline cursor-pointer"
              >
                {showDocForm ? t('Cancel', 'Ghairi') : t('Publish Document', 'Chapisha Nyaraka')}
              </button>
            )}
          </div>

          {showDocForm && user?.role === 'admin' && (
            <form onSubmit={handlePublishDoc} className="space-y-3 pb-4 border-b border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Document title"
                  className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs"
                />
                <input
                  type="text"
                  required
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  placeholder="Category"
                  className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <input
                type="text"
                required
                value={docSummary}
                onChange={(e) => setDocSummary(e.target.value)}
                placeholder="Key rules or summary"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs"
              />
              <input
                type="url"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="External PDF / Drive link (optional)"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs"
              />
              <button
                type="submit"
                disabled={docBusy}
                className="px-4 py-1.5 rounded-lg bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
              >
                {docBusy ? 'Publishing...' : 'Publish'}
              </button>
            </form>
          )}

          <div className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <div key={doc.id} className="py-4 flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-xl">
                  <p className="text-xs text-slate-500">
                    {doc.category} · {new Date(doc.updatedAt).toLocaleDateString('en-GB', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <h3 className="font-display text-sm font-semibold text-slate-900 mt-0.5">
                    {doc.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{doc.summary}</p>
                </div>
                {doc.externalUrl && (
                  <a
                    href={doc.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-emerald-800 hover:underline whitespace-nowrap"
                  >
                    {t('Open PDF', 'Fungua PDF')}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
