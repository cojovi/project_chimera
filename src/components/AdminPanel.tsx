import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  X,
  RefreshCw,
  Ticket,
  Trash2,
  Power,
  PowerOff,
  Inbox,
  ArrowLeft,
  UserX
} from 'lucide-react';
import * as api from '../lib/api';
import type { AdminOverview, InviteCode, PendingAccount } from '../lib/api';

interface Props {
  onExit: () => void;
}

const inputCls =
  'w-full border border-edge bg-void/60 px-3 py-2 font-mono text-sm text-steel focus:border-amber-dim transition-colors';
const btnCls =
  'inline-flex items-center gap-2 border px-3 py-1.5 font-display text-[0.55rem] tracking-[0.2em] transition-colors disabled:opacity-30';

const Panel: React.FC<{ title: string; badge?: string; children: React.ReactNode }> = ({
  title,
  badge,
  children
}) => (
  <section className="hud-corner border border-edge bg-panel/70 backdrop-blur">
    <header className="flex items-center gap-3 border-b border-edge px-5 py-3">
      <span className="h-1.5 w-1.5 bg-amber" />
      <h2 className="font-display text-[0.65rem] tracking-[0.35em] text-amber">{title}</h2>
      {badge && (
        <span className="ml-auto border border-amber-dim px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.15em] text-amber">
          {badge}
        </span>
      )}
    </header>
    <div className="p-5">{children}</div>
  </section>
);

function stamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

function codeState(c: InviteCode): { text: string; cls: string } {
  if (!c.active) return { text: 'REVOKED', cls: 'text-steel-dim' };
  if (c.expires_at && new Date(c.expires_at).getTime() <= Date.now())
    return { text: 'EXPIRED', cls: 'text-alarm' };
  if (c.max_uses !== null && c.used_count >= c.max_uses)
    return { text: 'EXHAUSTED', cls: 'text-alarm' };
  return { text: 'LIVE', cls: 'text-armed' };
}

const AdminPanel: React.FC<Props> = ({ onExit }) => {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);

  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');
  const [newExpiry, setNewExpiry] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.adminOverview());
    } catch (e) {
      setNotice({ text: String(e instanceof Error ? e.message : e).toUpperCase(), bad: true });
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    if (busy) return;
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      await load();
      setNotice({ text: ok });
    } catch (e) {
      setNotice({ text: String(e instanceof Error ? e.message : e).toUpperCase(), bad: true });
    } finally {
      setBusy(null);
    }
  };

  const review = (p: PendingAccount, decision: 'approved' | 'denied') => {
    const reason =
      decision === 'denied' ? window.prompt(`REASON FOR DENYING ${p.callsign} (optional):`) ?? '' : '';
    void run(
      `review-${p.user_id}`,
      () => api.adminReview(p.user_id, decision, reason),
      `${p.callsign.toUpperCase()} ${decision === 'approved' ? 'CLEARED' : 'DENIED'}`
    );
  };

  const createCode = (e: React.FormEvent) => {
    e.preventDefault();
    void run(
      'create-code',
      async () => {
        await api.adminCreateCode({
          code: newCode.trim().toUpperCase(),
          label: newLabel.trim(),
          max_uses: newMaxUses.trim() ? Number(newMaxUses) : null,
          expires_in_days: newExpiry.trim() ? Number(newExpiry) : null
        });
        setNewCode('');
        setNewLabel('');
        setNewMaxUses('');
        setNewExpiry('');
      },
      'CODE ISSUED'
    );
  };

  const pendingCount = data?.pending.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-5xl space-y-6 py-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[0.75rem] tracking-[0.4em] text-amber glow-amber">
          COMMAND
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className={`${btnCls} border-edge text-steel-dim hover:border-steel-dim hover:text-steel`}
          >
            <RefreshCw size={12} /> REFRESH
          </button>
          <button
            type="button"
            onClick={onExit}
            className={`${btnCls} border-edge text-steel-dim hover:border-amber-dim hover:text-amber`}
          >
            <ArrowLeft size={12} /> MY CONSOLE
          </button>
        </div>
      </div>

      {notice && (
        <p
          className={`font-mono text-[0.68rem] tracking-[0.15em] ${
            notice.bad ? 'text-alarm' : 'text-armed'
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* ------------------------------------------------ review queue */}
      <Panel title="ENLISTMENT QUEUE" badge={pendingCount ? `${pendingCount} WAITING` : 'CLEAR'}>
        {!data && (
          <p className="font-mono text-[0.7rem] tracking-[0.2em] text-steel-dim">
            LOADING<span className="animate-blink">_</span>
          </p>
        )}

        {data && pendingCount === 0 && (
          <div className="flex items-center gap-3 font-mono text-[0.7rem] tracking-[0.15em] text-steel-dim">
            <Inbox size={15} /> NOTHING AWAITING REVIEW.
          </div>
        )}

        <div className="space-y-3">
          {data?.pending.map((p) => (
            <div
              key={p.user_id}
              className="border border-edge bg-void/40 p-4 sm:flex sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="font-display text-[0.7rem] tracking-[0.3em] text-amber">
                  {p.callsign.toUpperCase()}
                </p>
                <p className="mt-1 break-all font-mono text-[0.68rem] tracking-[0.1em] text-steel">
                  {p.signup_email ?? '—'}
                </p>
                <p className="mt-1 font-mono text-[0.6rem] tracking-[0.15em] text-steel-faint">
                  REQUESTED {stamp(p.created_at)}
                </p>
                {p.signup_note && (
                  <p className="mt-2 border-l border-amber-dim pl-3 font-mono text-[0.68rem] leading-relaxed text-steel-dim">
                    {p.signup_note}
                  </p>
                )}
              </div>
              <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
                <button
                  type="button"
                  disabled={busy === `review-${p.user_id}`}
                  onClick={() => review(p, 'approved')}
                  className={`${btnCls} border-armed-dim text-armed hover:bg-armed hover:text-void`}
                >
                  <Check size={12} /> CLEAR
                </button>
                <button
                  type="button"
                  disabled={busy === `review-${p.user_id}`}
                  onClick={() => review(p, 'denied')}
                  className={`${btnCls} border-alarm-dim text-alarm hover:bg-alarm hover:text-void`}
                >
                  <X size={12} /> DENY
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* ------------------------------------------------ invite codes */}
      <Panel title="SIGN-UP CODES">
        <form onSubmit={createCode} className="mb-5 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-1">
            <label className="mb-1.5 block font-display text-[0.5rem] tracking-[0.25em] text-steel-dim">
              CODE
            </label>
            <input
              className={inputCls}
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="NIGHTFALL"
              maxLength={64}
              required
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1.5 block font-display text-[0.5rem] tracking-[0.25em] text-steel-dim">
              LABEL
            </label>
            <input
              className={inputCls}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="podcast drop"
              maxLength={120}
            />
          </div>
          <div>
            <label className="mb-1.5 block font-display text-[0.5rem] tracking-[0.25em] text-steel-dim">
              MAX USES
            </label>
            <input
              className={inputCls}
              value={newMaxUses}
              onChange={(e) => setNewMaxUses(e.target.value.replace(/\D/g, ''))}
              placeholder="∞"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-display text-[0.5rem] tracking-[0.25em] text-steel-dim">
              EXPIRES (DAYS)
            </label>
            <input
              className={inputCls}
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value.replace(/\D/g, ''))}
              placeholder="never"
              inputMode="numeric"
            />
          </div>
          <button
            type="submit"
            disabled={busy === 'create-code'}
            className={`${btnCls} border-amber-dim text-amber hover:bg-amber hover:text-void sm:col-span-4 sm:justify-self-start`}
          >
            <Ticket size={12} /> {busy === 'create-code' ? 'ISSUING…' : 'ISSUE CODE'}
          </button>
        </form>

        <div className="space-y-2">
          {data?.codes.length === 0 && (
            <p className="font-mono text-[0.68rem] tracking-[0.15em] text-steel-dim">
              NO CODES ISSUED.
            </p>
          )}
          {data?.codes.map((c) => {
            const st = codeState(c);
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-edge bg-void/40 px-4 py-3"
              >
                <span className="font-display text-[0.68rem] tracking-[0.25em] text-steel">
                  {c.code}
                </span>
                <span className={`font-mono text-[0.58rem] tracking-[0.2em] ${st.cls}`}>
                  {st.text}
                </span>
                <span className="font-mono text-[0.62rem] tracking-[0.12em] text-steel-dim">
                  {c.used_count}/{c.max_uses ?? '∞'} USED
                </span>
                <span className="font-mono text-[0.6rem] tracking-[0.12em] text-steel-faint">
                  {c.expires_at ? `EXPIRES ${stamp(c.expires_at)}` : 'NO EXPIRY'}
                </span>
                {c.label && (
                  <span className="font-mono text-[0.6rem] tracking-[0.12em] text-steel-faint">
                    · {c.label}
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    disabled={busy === `code-${c.id}`}
                    onClick={() =>
                      void run(
                        `code-${c.id}`,
                        () => api.adminSetCodeActive(c.id, !c.active),
                        c.active ? 'CODE REVOKED' : 'CODE REINSTATED'
                      )
                    }
                    className={`${btnCls} border-edge text-steel-dim hover:border-amber-dim hover:text-amber`}
                  >
                    {c.active ? <PowerOff size={11} /> : <Power size={11} />}
                    {c.active ? 'REVOKE' : 'REINSTATE'}
                  </button>
                  <button
                    type="button"
                    disabled={busy === `code-${c.id}`}
                    onClick={() =>
                      void run(`code-${c.id}`, () => api.adminDeleteCode(c.id), 'CODE DELETED')
                    }
                    className={`${btnCls} border-edge text-steel-dim hover:border-alarm-dim hover:text-alarm`}
                  >
                    <Trash2 size={11} /> DELETE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* ------------------------------------------------ roster */}
      <Panel title="OPERATOR ROSTER">
        {data?.recent.length === 0 && (
          <p className="font-mono text-[0.68rem] tracking-[0.15em] text-steel-dim">
            NO REVIEWED ACCOUNTS YET.
          </p>
        )}
        <div className="space-y-2">
          {data?.recent.map((r) => (
            <div
              key={r.user_id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-edge bg-void/40 px-4 py-3"
            >
              <span className="font-display text-[0.66rem] tracking-[0.25em] text-steel">
                {r.callsign.toUpperCase()}
              </span>
              <span
                className={`font-mono text-[0.58rem] tracking-[0.2em] ${
                  r.status === 'approved' ? 'text-armed' : 'text-alarm'
                }`}
              >
                {r.status.toUpperCase()}
              </span>
              <span className="break-all font-mono text-[0.62rem] tracking-[0.1em] text-steel-dim">
                {r.signup_email ?? '—'}
              </span>
              {r.invite_code && (
                <span className="font-mono text-[0.58rem] tracking-[0.15em] text-amber-dim">
                  VIA {r.invite_code}
                </span>
              )}
              {r.denial_reason && (
                <span className="font-mono text-[0.58rem] tracking-[0.12em] text-steel-faint">
                  · {r.denial_reason}
                </span>
              )}
              <div className="ml-auto flex gap-2">
                {r.status === 'denied' && (
                  <button
                    type="button"
                    disabled={busy === `roster-${r.user_id}`}
                    onClick={() =>
                      void run(
                        `roster-${r.user_id}`,
                        () => api.adminReview(r.user_id, 'approved'),
                        `${r.callsign.toUpperCase()} CLEARED`
                      )
                    }
                    className={`${btnCls} border-armed-dim text-armed hover:bg-armed hover:text-void`}
                  >
                    <Check size={11} /> CLEAR
                  </button>
                )}
                {r.status === 'approved' && (
                  <button
                    type="button"
                    disabled={busy === `roster-${r.user_id}`}
                    onClick={() =>
                      void run(
                        `roster-${r.user_id}`,
                        () =>
                          api.adminReview(
                            r.user_id,
                            'denied',
                            window.prompt(`REASON FOR REVOKING ${r.callsign} (optional):`) ?? ''
                          ),
                        `${r.callsign.toUpperCase()} REVOKED`
                      )
                    }
                    className={`${btnCls} border-edge text-steel-dim hover:border-alarm-dim hover:text-alarm`}
                  >
                    <X size={11} /> REVOKE
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy === `roster-${r.user_id}`}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `PERMANENTLY DELETE ${r.callsign.toUpperCase()} and all their encrypted payload files? This cannot be undone.`
                      )
                    )
                      return;
                    void run(
                      `roster-${r.user_id}`,
                      () => api.adminDeleteAccount(r.user_id),
                      `${r.callsign.toUpperCase()} PURGED`
                    );
                  }}
                  className={`${btnCls} border-edge text-steel-faint hover:border-alarm-dim hover:text-alarm`}
                >
                  <UserX size={11} /> PURGE
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </motion.div>
  );
};

export default AdminPanel;
