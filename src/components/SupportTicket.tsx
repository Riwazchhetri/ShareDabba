import React, { useState, useEffect } from 'react';
import { LifeBuoy, Send, CheckCircle2, AlertCircle, MessageSquare, Clock } from 'lucide-react';

export interface SupportTicketItem {
  id: number;
  ticketNumber: string;
  subject: string;
  category: string;
  priority?: string;
  message?: string;
  status: string;
  adminReply?: string;
  email?: string;
  createdAt: string;
}

export interface SupportTicketProps {
  defaultEmail?: string;
  defaultCategory?: '' | 'Technical' | 'Payout' | 'Copyright';
  uid?: string;
  authHeaders?: Record<string, string>;
  initialTickets?: SupportTicketItem[];
  onTicketSubmitted?: (createdTicket: SupportTicketItem) => Promise<void> | void;
  title?: string;
  subtitle?: string;
}

export const SupportTicket: React.FC<SupportTicketProps> = ({
  defaultEmail = '',
  defaultCategory = '',
  uid,
  authHeaders = {},
  initialTickets,
  onTicketSubmitted,
  title = 'Support Ticket Desk',
  subtitle = 'Submit a support message with an optional category (Technical, Payout, Copyright). All submissions are saved directly to the support_tickets database table.',
}) => {
  const [category, setCategory] = useState<string>(defaultCategory);
  const [subject, setSubject] = useState<string>('');
  const [email, setEmail] = useState<string>(defaultEmail);
  const [message, setMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
    ticketNumber?: string;
    savedCategory?: string;
  } | null>(null);

  const [tickets, setTickets] = useState<SupportTicketItem[]>(initialTickets || []);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    if (defaultEmail) {
      setEmail(defaultEmail);
    }
  }, [defaultEmail]);

  useEffect(() => {
    if (initialTickets) {
      setTickets(initialTickets);
    }
  }, [initialTickets]);

  useEffect(() => {
    if (!initialTickets) {
      fetchTicketsFromDb();
    }
  }, []);

  const fetchTicketsFromDb = async () => {
    try {
      const res = await fetch('/api/support', {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tickets)) {
          setTickets(data.tickets);
        }
      }
    } catch (e) {
      console.error('Failed to fetch support_tickets:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      setFeedback({
        type: 'err',
        text: 'Please enter a message before submitting your support ticket.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const selectedCat = category.trim() || 'General';
      const finalSubject =
        subject.trim() ||
        `${selectedCat} Inquiry: ${trimmedMsg.slice(0, 48)}${trimmedMsg.length > 48 ? '...' : ''}`;

      const res = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          type: 'ticket',
          uid,
          email: email.trim() || defaultEmail || 'creator@sharedabba.in',
          category: selectedCat,
          subject: finalSubject,
          message: trimmedMsg,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save support ticket.');
      }

      const createdRecord: SupportTicketItem | undefined = data.record || data.ticket;
      setFeedback({
        type: 'ok',
        text: `Support ticket ${createdRecord?.ticketNumber || ''} saved to support_tickets table under category "${createdRecord?.category || selectedCat}".`,
        ticketNumber: createdRecord?.ticketNumber,
        savedCategory: createdRecord?.category || selectedCat,
      });

      setMessage('');
      setSubject('');

      if (createdRecord) {
        setTickets((prev) => [createdRecord, ...prev.filter((t) => t.id !== createdRecord.id)]);
      }

      if (onTicketSubmitted && createdRecord) {
        await onTicketSubmitted(createdRecord);
      } else {
        await fetchTicketsFromDb();
      }
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err.message || 'Could not submit support ticket.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (categoryFilter === 'ALL') return true;
    return (t.category || '').toLowerCase().includes(categoryFilter.toLowerCase());
  });

  return (
    <div id="support-ticket-component" className="space-y-6">
      {/* Support Ticket Submission Form Card */}
      <div className="p-6 rounded-2xl color-graded-panel space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>SUPPORT_TICKETS DATABASE DESK · 24/7 CREATOR &amp; DMCA QUEUE</span>
            </div>
            <h2 className="text-lg font-bold text-neutral-950 dark:text-white">{title}</h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{subtitle}</p>
          </div>
          <div className="text-left sm:text-right font-mono text-[11px] text-neutral-500 shrink-0">
            <p>Table: support_tickets</p>
            <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {tickets.length} Active / Logged Tickets
            </p>
          </div>
        </div>

        {feedback && (
          <div
            id="support-ticket-feedback"
            className={`p-3.5 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
              feedback.type === 'ok'
                ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/95 border-red-500/40 text-red-200'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <p className="font-semibold">{feedback.text}</p>
              {feedback.ticketNumber && (
                <p className="text-[11px] text-emerald-300/90">
                  Ticket ID: {feedback.ticketNumber} · Category: {feedback.savedCategory} · Status: OPEN
                </p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Optional Category Dropdown: Technical, Payout, Copyright */}
            <div>
              <label
                htmlFor="support-ticket-category"
                className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1"
              >
                Category <span className="text-neutral-400 font-normal">(Optional)</span>
              </label>
              <select
                id="support-ticket-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Optional — Select Category</option>
                <option value="Technical">Technical</option>
                <option value="Payout">Payout</option>
                <option value="Copyright">Copyright</option>
              </select>
            </div>

            {/* Optional Subject Input */}
            <div>
              <label
                htmlFor="support-ticket-subject"
                className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1"
              >
                Subject <span className="text-neutral-400 font-normal">(Optional)</span>
              </label>
              <input
                id="support-ticket-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary (e.g. UPI UTR check, 4K HLS)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Contact Email Input */}
            <div>
              <label
                htmlFor="support-ticket-email"
                className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1"
              >
                Contact Email
              </label>
              <input
                id="support-ticket-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@sharedabba.in"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Message Input */}
          <div>
            <label
              htmlFor="support-ticket-message"
              className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1"
            >
              Support Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="support-ticket-message"
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your Technical, Payout (UPI / USDT), or Copyright inquiry in detail..."
              className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-neutral-500">
              <span>Quick Category:</span>
              {(['Technical', 'Payout', 'Copyright'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(category === cat ? '' : cat)}
                  className={`px-2.5 py-1 rounded-md border transition-colors ${
                    category === cat
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                      : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              id="support-ticket-submit-btn"
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving to support_tickets...' : 'Submit Support Ticket'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Saved Support Tickets List from support_tickets Table */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950">
        <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
              Submitted Support Tickets ({filteredTickets.length})
            </h3>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 self-start sm:self-auto">
            {(['ALL', 'Technical', 'Payout', 'Copyright'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCategoryFilter(tab)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                  categoryFilter === tab
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                {tab === 'ALL' ? `All (${tickets.length})` : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
          {filteredTickets.length === 0 ? (
            <div className="p-6 text-center text-neutral-500 font-mono">
              No support tickets matching "{categoryFilter}". Submit a ticket above to create a record in support_tickets.
            </div>
          ) : (
            filteredTickets.map((t) => (
              <div key={t.id || t.ticketNumber} className="p-4 sm:px-5 space-y-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {t.ticketNumber}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-neutral-950 dark:text-white">{t.subject}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-500">
                    <span>Category: {t.category}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold uppercase ${
                        t.status === 'resolved'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-sky-600 dark:text-sky-400'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>

                {t.message && (
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {t.message}
                  </p>
                )}

                {t.adminReply && (
                  <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300">
                    <span className="font-mono font-bold text-neutral-950 dark:text-white">
                      Support Desk Reply:{' '}
                    </span>
                    {t.adminReply}
                  </div>
                )}

                <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
                  <Clock className="w-3 h-3" />
                  <span>{t.email || defaultEmail}</span>
                  {t.createdAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
