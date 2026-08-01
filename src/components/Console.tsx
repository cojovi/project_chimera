import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ShieldOff,
  Lock,
  UploadCloud,
  Trash2,
  Download,
  Send,
  KeyRound,
  RotateCcw,
  Plus,
  X,
  FileText
} from 'lucide-react';
import * as api from '../lib/api';
import type { SwitchConfig } from '../lib/api';
import { formatBytes, formatInterval, formatStamp } from '../lib/time';

interface Props {
  password: string;
  config: SwitchConfig;
  onConfig: (c: SwitchConfig) => void;
  onLock: () => void;
}

const INTERVALS: { label: string; minutes: number }[] = [
  { label: '24 HOURS', minutes: 1440 },
  { label: '72 HOURS', minutes: 4320 },
  { label: '7 DAYS', minutes: 10080 },
  { label: '30 DAYS', minutes: 43200 },
  { label: '180 DAYS', minutes: 259200 }
];

const panelVariants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.12, duration: 0.5, ease: 'easeOut' as const }
  })
};

const Panel: React.FC<{ title: string; index: number; children: React.ReactNode }> = ({
  title,
  index,
  children
}) => (
  <motion.section
    custom={index}
    variants={panelVariants}
    initial="hidden"
    animate="show"
    className="hud-corner border border-edge bg-panel/70 backdrop-blur"
  >
    <header className="flex items-center gap-3 border-b border-edge px-5 py-3">
      <span className="h-1.5 w-1.5 bg-amber" />
      <h2 className="font-display text-[0.65rem] tracking-[0.35em] text-amber">{title}</h2>
    </header>
    <div className="p-5">{children}</div>
  </motion.section>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="mb-1.5 block font-display text-[0.55rem] tracking-[0.3em] text-steel-dim">
    {children}
  </label>
);

const inputCls =
  'w-full border border-edge bg-void/60 px-3 py-2 font-mono text-sm text-steel focus:border-amber-dim transition-colors';

const btnCls =
  'inline-flex items-center gap-2 border px-4 py-2 font-display text-[0.6rem] tracking-[0.25em] transition-colors disabled:opacity-30';

const Console: React.FC<Props> = ({ password, config, onConfig, onLock }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);

  const [recipient, setRecipient] = useState(config.recipient_email);
  const [operatorEmail, setOperatorEmail] = useState(config.operator_email);
  const [ccInput, setCcInput] = useState('');
  const [ccList, setCcList] = useState<string[]>(config.cc_emails);
  const [subject, setSubject] = useState(config.email_subject);
  const [message, setMessage] = useState(config.email_message);
  const [customInterval, setCustomInterval] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const flash = (text: string, bad = false) => {
    setNotice({ text, bad });
    setTimeout(() => setNotice(null), 4000);
  };

  const run = useCallback(
    async (key: string, fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(key);
      try {
        await fn();
      } catch (e) {
        flash(String(e instanceof Error ? e.message : e).toUpperCase(), true);
      } finally {
        setBusy(null);
      }
    },
    [busy]
  );

  const armed = config.status === 'armed';

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    void run('upload', async () => {
      let latest = config;
      for (const f of list) {
        latest = await api.uploadFile(password, f);
      }
      onConfig(latest);
      flash(`${list.length} FILE(S) SECURED IN ENCRYPTED VAULT`);
    });
  };

  const addCc = () => {
    const v = ccInput.trim();
    if (!v || ccList.includes(v)) return;
    setCcList([...ccList, v]);
    setCcInput('');
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-16">
      {/* Top control strip */}
      <motion.div
        custom={0}
        variants={panelVariants}
        initial="hidden"
        animate="show"
        className="flex flex-wrap items-center justify-between gap-3 border border-edge bg-panel/70 px-5 py-4 backdrop-blur"
      >
        <div className="flex items-center gap-3">
          {armed ? (
            <ShieldCheck className="h-5 w-5 text-armed" />
          ) : (
            <ShieldOff className="h-5 w-5 text-steel-dim" />
          )}
          <div>
            <div
              className={`font-display text-[0.7rem] tracking-[0.3em] ${
                armed ? 'text-armed glow-green' : config.status === 'triggered' ? 'text-alarm' : 'text-steel'
              }`}
            >
              {config.status.toUpperCase()}
            </div>
            <div className="font-mono text-[0.65rem] text-steel-dim">
              LAST CHECK-IN {formatStamp(config.last_checkin_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`${btnCls} border-armed-dim text-armed hover:bg-armed hover:text-void`}
            disabled={busy !== null}
            onClick={() =>
              run('checkin', async () => {
                onConfig(await api.checkin(password));
                flash('CHECK-IN CONFIRMED — CLOCK RESET');
              })
            }
          >
            <RotateCcw className="h-3.5 w-3.5" /> CHECK IN
          </button>
          {armed ? (
            <button
              className={`${btnCls} border-alarm-dim text-alarm hover:bg-alarm hover:text-void`}
              disabled={busy !== null}
              onClick={() =>
                run('disarm', async () => {
                  onConfig(await api.disarm(password));
                  flash('SWITCH DISARMED — CLOCK SUSPENDED');
                })
              }
            >
              DISARM
            </button>
          ) : (
            <button
              className={`${btnCls} border-amber-dim text-amber hover:bg-amber hover:text-void`}
              disabled={busy !== null}
              onClick={() =>
                run('arm', async () => {
                  onConfig(await api.arm(password));
                  flash('SWITCH ARMED — CLOCK RUNNING');
                })
              }
            >
              ARM SWITCH
            </button>
          )}
          <button
            className={`${btnCls} border-edge text-steel hover:border-steel`}
            onClick={onLock}
            title="Lock console"
          >
            <Lock className="h-3.5 w-3.5" /> LOCK
          </button>
        </div>
      </motion.div>

      {notice && (
        <div
          className={`border px-4 py-2 font-mono text-xs tracking-[0.15em] ${
            notice.bad ? 'border-alarm-dim text-alarm' : 'border-armed-dim text-armed'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Switch timing */}
      <Panel title="SWITCH TIMING" index={1}>
        <FieldLabel>CHECK-IN INTERVAL — CURRENT: {formatInterval(config.interval_minutes)}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {INTERVALS.map((iv) => (
            <button
              key={iv.minutes}
              disabled={busy !== null}
              onClick={() =>
                run('interval', async () => {
                  onConfig(await api.updateConfig(password, { interval_minutes: iv.minutes }));
                  flash(`INTERVAL SET TO ${iv.label}${armed ? ' — CLOCK RESET' : ''}`);
                })
              }
              className={`${btnCls} ${
                config.interval_minutes === iv.minutes
                  ? 'border-amber bg-amber text-void'
                  : 'border-edge text-steel hover:border-amber-dim hover:text-amber'
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            className={`${inputCls} max-w-[180px]`}
            placeholder="CUSTOM (MINUTES)"
            value={customInterval}
            inputMode="numeric"
            onChange={(e) => setCustomInterval(e.target.value.replace(/\D/g, ''))}
          />
          <button
            className={`${btnCls} border-edge text-steel hover:border-amber-dim hover:text-amber`}
            disabled={busy !== null || !customInterval}
            onClick={() =>
              run('interval', async () => {
                onConfig(await api.updateConfig(password, { interval_minutes: Number(customInterval) }));
                setCustomInterval('');
                flash('CUSTOM INTERVAL COMMITTED');
              })
            }
          >
            SET
          </button>
          <span className="font-mono text-[0.65rem] text-steel-faint">MIN 5 — MAX 1 YEAR</span>
        </div>
      </Panel>

      {/* Payload */}
      <Panel title={`PAYLOAD VAULT — ${config.files.length} FILE(S)`} index={2}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInput.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center border border-dashed px-4 py-8 transition-colors ${
            dragOver ? 'border-amber bg-amber/5' : 'border-edge hover:border-amber-dim'
          }`}
        >
          <UploadCloud className="mb-2 h-6 w-6 text-amber" />
          <span className="font-display text-[0.6rem] tracking-[0.3em] text-steel">
            {busy === 'upload' ? 'ENCRYPTING + UPLOADING…' : 'DROP FILES OR CLICK TO ADD'}
          </span>
          <span className="mt-1 font-mono text-[0.65rem] text-steel-faint">
            AES-256 ENCRYPTED AT REST · 10 MB PER FILE
          </span>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {config.files.length > 0 && (
          <ul className="mt-4 divide-y divide-edge border border-edge">
            {config.files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-steel-dim" />
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-steel">{f.file_name}</span>
                <span className="shrink-0 font-mono text-[0.65rem] text-steel-dim">
                  {formatBytes(f.size_bytes)}
                </span>
                <button
                  title="Download decrypted copy"
                  className="p-1 text-steel-dim transition-colors hover:text-amber"
                  disabled={busy !== null}
                  onClick={() => run('dl', () => api.downloadFile(password, f.id))}
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  title="Remove from payload"
                  className="p-1 text-steel-dim transition-colors hover:text-alarm"
                  disabled={busy !== null}
                  onClick={() =>
                    run('del', async () => {
                      onConfig(await api.deleteFile(password, f.id));
                      flash('FILE PURGED FROM VAULT');
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Delivery */}
      <Panel title="DELIVERY DIRECTIVE" index={3}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>PRIMARY RECIPIENT</FieldLabel>
            <input className={inputCls} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </div>
          <div>
            <FieldLabel>CC RECIPIENTS ({ccList.length}/10)</FieldLabel>
            <div className="flex gap-2">
              <input
                className={inputCls}
                value={ccInput}
                placeholder="add address…"
                onChange={(e) => setCcInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCc();
                  }
                }}
              />
              <button
                className={`${btnCls} border-edge px-3 text-steel hover:border-amber-dim hover:text-amber`}
                onClick={addCc}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {ccList.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ccList.map((cc) => (
                  <span
                    key={cc}
                    className="inline-flex items-center gap-1 border border-edge bg-void/60 px-2 py-0.5 font-mono text-[0.7rem] text-steel"
                  >
                    {cc}
                    <button
                      onClick={() => setCcList(ccList.filter((c) => c !== cc))}
                      className="text-steel-dim hover:text-alarm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4">
          <FieldLabel>OPERATOR REMINDER EMAIL — YOU GET A CHECK-IN WARNING AT 10% TIME LEFT</FieldLabel>
          <input
            className={inputCls}
            value={operatorEmail}
            onChange={(e) => setOperatorEmail(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <FieldLabel>SUBJECT LINE</FieldLabel>
          <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="mt-4">
          <FieldLabel>MESSAGE BODY</FieldLabel>
          <textarea
            className={`${inputCls} min-h-[90px] resize-y`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className={`${btnCls} border-amber-dim text-amber hover:bg-amber hover:text-void`}
            disabled={busy !== null}
            onClick={() =>
              run('delivery', async () => {
                // sweep any address still sitting in the CC input into the list
                const pending = ccInput.trim();
                const finalCc =
                  pending && !ccList.includes(pending) ? [...ccList, pending] : ccList;
                onConfig(
                  await api.updateConfig(password, {
                    recipient_email: recipient.trim(),
                    cc_emails: finalCc,
                    operator_email: operatorEmail.trim(),
                    email_subject: subject,
                    email_message: message
                  })
                );
                setCcList(finalCc);
                setCcInput('');
                flash('DELIVERY DIRECTIVE COMMITTED');
              })
            }
          >
            COMMIT DIRECTIVE
          </button>
          <button
            className={`${btnCls} border-edge text-steel hover:border-armed-dim hover:text-armed`}
            disabled={busy !== null}
            onClick={() =>
              run('test', async () => {
                await api.sendTestEmail(password);
                flash('TEST TRANSMISSION SENT — CHECK RECIPIENT INBOX');
              })
            }
          >
            <Send className="h-3.5 w-3.5" /> {busy === 'test' ? 'TRANSMITTING…' : 'SEND TEST'}
          </button>
        </div>
      </Panel>

      {/* Security */}
      <Panel title="SECURITY" index={4}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>NEW AUTHORIZATION CODE (MIN 8 CHARS)</FieldLabel>
            <input
              type="password"
              className={inputCls}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <FieldLabel>CONFIRM NEW CODE</FieldLabel>
            <input
              type="password"
              className={inputCls}
              value={newPass2}
              onChange={(e) => setNewPass2(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <button
          className={`${btnCls} mt-4 border-alarm-dim text-alarm hover:bg-alarm hover:text-void`}
          disabled={busy !== null || newPass.length < 8 || newPass !== newPass2}
          onClick={() =>
            run('pass', async () => {
              await api.changePassword(password, newPass);
              setNewPass('');
              setNewPass2('');
              flash('AUTHORIZATION CODE ROTATED — RE-LOCKING CONSOLE');
              setTimeout(onLock, 1500);
            })
          }
        >
          <KeyRound className="h-3.5 w-3.5" /> ROTATE CODE
        </button>
        {newPass && newPass !== newPass2 && (
          <p className="mt-2 font-mono text-[0.7rem] text-alarm">CODES DO NOT MATCH</p>
        )}
      </Panel>
    </div>
  );
};

export default Console;
