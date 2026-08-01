import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onSubmit: (password: string) => Promise<void>;
}

const PasswordGate: React.FC<Props> = ({ onSubmit }) => {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || busy) return;
    setBusy(true);
    setDenied(false);
    try {
      await onSubmit(value);
      setValue('');
    } catch {
      setDenied(true);
      setValue('');
      setTimeout(() => setDenied(false), 2200);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.6 }}
      className="w-full max-w-md"
    >
      <div
        className={`hud-corner border bg-panel/80 px-5 py-4 backdrop-blur transition-colors ${
          denied ? 'border-alarm animate-shake' : 'border-edge focus-within:border-amber-dim'
        }`}
      >
        <label className="mb-2 block font-display text-[0.6rem] tracking-[0.35em] text-steel-dim">
          {denied ? (
            <span className="text-alarm">ACCESS DENIED — INCIDENT LOGGED</span>
          ) : (
            'ENTER AUTHORIZATION CODE'
          )}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-amber">&gt;</span>
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="current-password"
            spellCheck={false}
            disabled={busy}
            className="w-full bg-transparent font-mono tracking-[0.4em] text-amber-glow placeholder:text-steel-faint"
            placeholder="••••••••••"
            aria-label="authorization code"
          />
          <button
            type="submit"
            disabled={busy || !value}
            className="shrink-0 border border-amber-dim px-3 py-1 font-display text-[0.6rem] tracking-[0.25em] text-amber transition-colors hover:bg-amber hover:text-void disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-amber"
          >
            {busy ? 'VERIFYING' : 'COMMIT'}
          </button>
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[0.65rem] tracking-[0.2em] text-steel-faint">
        VALID CODE RESETS THE CLOCK AND OPENS THE CONSOLE
      </p>
    </motion.form>
  );
};

export default PasswordGate;
