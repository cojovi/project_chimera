import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as api from '../lib/api';

// Cloudflare Turnstile. Renders only when a site key is configured, so the
// panel keeps working unchanged until the key is set in the environment.
const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

function useTurnstile(active: boolean, onToken: (t: string) => void) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !active) return;
    let cancelled = false;

    const mount = () => {
      if (cancelled || !boxRef.current || widgetRef.current || !window.turnstile) return;
      widgetRef.current = window.turnstile.render(boxRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (token: string) => onToken(token),
        'error-callback': () => onToken(''),
        'expired-callback': () => onToken('')
      });
    };

    if (window.turnstile) {
      mount();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
      const script = existing ?? document.createElement('script');
      if (!existing) {
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.turnstile = 'true';
        document.head.appendChild(script);
      }
      script.addEventListener('load', mount);
    }

    return () => {
      cancelled = true;
      widgetRef.current = null;
    };
  }, [active, onToken]);

  const reset = () => {
    if (widgetRef.current && window.turnstile) window.turnstile.reset(widgetRef.current);
    onToken('');
  };

  return { boxRef, reset, enabled: !!TURNSTILE_SITE_KEY };
}

interface Props {
  onAuthed: () => void;
}

const inputCls =
  'w-full border border-edge bg-void/60 px-3 py-2 font-mono text-sm text-steel focus:border-amber-dim transition-colors';

const AuthPanel: React.FC<Props> = ({ onAuthed }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [callsign, setCallsign] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [captcha, setCaptcha] = useState('');

  const handleToken = React.useCallback((t: string) => setCaptcha(t), []);
  const turnstile = useTurnstile(mode === 'signup', handleToken);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        if (password.length < 12) {
          throw new Error('PASSPHRASE MUST BE AT LEAST 12 CHARACTERS');
        }
        if (turnstile.enabled && !captcha) {
          throw new Error('COMPLETE THE HUMAN VERIFICATION CHECK FIRST');
        }
        const res = await api.signup(
          email.trim(),
          password,
          callsign.trim(),
          inviteCode.trim(),
          note.trim(),
          captcha
        );
        if (res.status === 'pending') {
          // No code supplied — the account exists but is locked. Show the
          // holding screen rather than dropping them into a dead console.
          setSubmitted(true);
          return;
        }
      }
      await api.login(email.trim(), password);
      onAuthed();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err).toUpperCase());
      // A Turnstile token is single-use — a failed submit needs a fresh one.
      if (turnstile.enabled) turnstile.reset();
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="hud-corner w-full max-w-md border border-amber-dim bg-panel/80 p-6 text-center backdrop-blur"
      >
        <h2 className="font-display text-[0.65rem] tracking-[0.35em] text-amber">
          REQUEST LOGGED
        </h2>
        <p className="mt-4 font-mono text-[0.72rem] leading-relaxed tracking-[0.12em] text-steel">
          CALLSIGN <span className="text-amber">{callsign.toUpperCase()}</span> IS HELD PENDING
          REVIEW. AN OPERATOR CLEARS EACH ENLISTMENT BY HAND.
        </p>
        <p className="mt-3 font-mono text-[0.62rem] leading-relaxed tracking-[0.12em] text-steel-dim">
          YOU CAN LOG IN NOW, BUT THE SWITCH STAYS LOCKED UNTIL CLEARANCE COMES THROUGH.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setMode('login');
            setPassword('');
          }}
          className="mt-6 w-full border border-amber-dim px-4 py-2.5 font-display text-[0.65rem] tracking-[0.3em] text-amber transition-colors hover:bg-amber hover:text-void"
        >
          RETURN TO LOGIN
        </button>
      </motion.div>
    );
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="hud-corner w-full max-w-md border border-edge bg-panel/80 p-6 backdrop-blur"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-[0.65rem] tracking-[0.35em] text-amber">
          {mode === 'login' ? 'OPERATOR LOGIN' : 'ENLIST NEW OPERATOR'}
        </h2>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
          }}
          className="font-mono text-[0.65rem] tracking-[0.2em] text-steel-dim underline-offset-4 hover:text-amber hover:underline"
        >
          {mode === 'login' ? 'NEED AN ACCOUNT?' : 'HAVE AN ACCOUNT?'}
        </button>
      </div>

      <label className="mb-1.5 block font-display text-[0.55rem] tracking-[0.3em] text-steel-dim">
        OPERATOR ID (EMAIL)
      </label>
      <input
        className={inputCls}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />

      {mode === 'signup' && (
        <>
          <label className="mb-1.5 mt-4 block font-display text-[0.55rem] tracking-[0.3em] text-steel-dim">
            CALLSIGN — SHOWN ON THE PUBLIC WALL
          </label>
          <input
            className={inputCls}
            value={callsign}
            onChange={(e) => setCallsign(e.target.value.toUpperCase())}
            placeholder="e.g. NIGHTHAWK"
            maxLength={24}
            required
          />

          <label className="mb-1.5 mt-4 block font-display text-[0.55rem] tracking-[0.3em] text-steel-dim">
            SIGN-UP CODE <span className="text-steel-faint">— OPTIONAL</span>
          </label>
          <input
            className={inputCls}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="LEAVE BLANK TO REQUEST MANUAL CLEARANCE"
            maxLength={64}
          />
          <p className="mt-1.5 font-mono text-[0.58rem] leading-relaxed tracking-[0.12em] text-steel-faint">
            A VALID CODE OPENS THE CONSOLE IMMEDIATELY. WITHOUT ONE, YOUR REQUEST GOES INTO
            THE REVIEW QUEUE.
          </p>

          {!inviteCode.trim() && (
            <>
              <label className="mb-1.5 mt-4 block font-display text-[0.55rem] tracking-[0.3em] text-steel-dim">
                WHY YOU WANT IN <span className="text-steel-faint">— OPTIONAL</span>
              </label>
              <textarea
                className={`${inputCls} h-20 resize-none`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A line or two helps your request get cleared faster."
                maxLength={500}
              />
            </>
          )}
        </>
      )}

      <label className="mb-1.5 mt-4 block font-display text-[0.55rem] tracking-[0.3em] text-steel-dim">
        PASSPHRASE {mode === 'signup' && '(MIN 12 CHARS)'}
      </label>
      <input
        className={inputCls}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        minLength={mode === 'signup' ? 12 : undefined}
        required
      />

      {mode === 'signup' && turnstile.enabled && (
        <div ref={turnstile.boxRef} className="mt-4 flex justify-center" />
      )}

      {error && (
        <p className="mt-3 font-mono text-[0.7rem] tracking-[0.15em] text-alarm">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full border border-amber-dim px-4 py-2.5 font-display text-[0.65rem] tracking-[0.3em] text-amber transition-colors hover:bg-amber hover:text-void disabled:opacity-40"
      >
        {busy
          ? 'AUTHENTICATING…'
          : mode === 'login'
            ? 'OPEN CONSOLE'
            : inviteCode.trim()
              ? 'REDEEM CODE + OPEN CONSOLE'
              : 'SUBMIT ENLISTMENT REQUEST'}
      </button>

      <p className="mt-4 text-center font-mono text-[0.6rem] tracking-[0.2em] text-steel-faint">
        EACH OPERATOR RUNS THEIR OWN FAILSAFE. MISS A CHECK-IN, THE PAYLOAD FLIES.
      </p>
    </motion.form>
  );
};

export default AuthPanel;
