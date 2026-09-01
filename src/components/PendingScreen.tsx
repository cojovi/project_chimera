import React from 'react';
import { motion } from 'framer-motion';
import { LogOut, ShieldQuestion, ShieldX } from 'lucide-react';
import type { UserConfig } from '../lib/api';

interface Props {
  config: UserConfig;
  onLogout: () => void;
}

/**
 * Holding screen for accounts that have not been cleared. The account exists
 * and the operator can log in, but `user-api` refuses every switch action
 * until an admin flips them to `approved` — this is the honest UI for that.
 */
const PendingScreen: React.FC<Props> = ({ config, onLogout }) => {
  const denied = config.account_status === 'denied';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto w-full max-w-2xl py-10"
    >
      <div
        className={`hud-corner border bg-panel/70 p-8 text-center backdrop-blur ${
          denied ? 'border-alarm/50' : 'border-amber-dim'
        }`}
      >
        <div className="flex justify-center">
          {denied ? (
            <ShieldX size={34} className="text-alarm" />
          ) : (
            <ShieldQuestion size={34} className="text-amber animate-alarmpulse" />
          )}
        </div>

        <h2
          className={`mt-5 font-display text-[0.8rem] tracking-[0.4em] ${
            denied ? 'text-alarm' : 'text-amber glow-amber'
          }`}
        >
          {denied ? 'CLEARANCE DENIED' : 'AWAITING CLEARANCE'}
        </h2>

        <p className="mt-5 font-mono text-[0.75rem] leading-relaxed tracking-[0.12em] text-steel">
          OPERATOR <span className="text-amber">{config.callsign.toUpperCase()}</span> —{' '}
          {denied
            ? 'THIS ACCOUNT WAS NOT CLEARED FOR SERVICE.'
            : 'YOUR ENLISTMENT IS IN THE REVIEW QUEUE.'}
        </p>

        {denied && config.denial_reason && (
          <p className="mt-3 font-mono text-[0.68rem] leading-relaxed tracking-[0.1em] text-steel-dim">
            REASON: {config.denial_reason.toUpperCase()}
          </p>
        )}

        {!denied && (
          <p className="mt-3 font-mono text-[0.65rem] leading-relaxed tracking-[0.12em] text-steel-dim">
            EVERY ACCOUNT IS CLEARED BY HAND. THE SWITCH, THE PAYLOAD VAULT AND THE PUBLIC WALL
            STAY LOCKED UNTIL THEN. IF YOU HAVE A SIGN-UP CODE, ENLIST AGAIN WITH IT FOR
            IMMEDIATE ACCESS.
          </p>
        )}

        <div className="mt-8 border-t border-edge pt-5">
          <p className="font-mono text-[0.6rem] tracking-[0.2em] text-steel-faint">
            STATUS: {config.account_status.toUpperCase()} · CALLSIGN RESERVED
          </p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-4 inline-flex items-center gap-2 border border-edge px-4 py-2 font-display text-[0.6rem] tracking-[0.25em] text-steel-dim transition-colors hover:border-steel-dim hover:text-steel"
          >
            <LogOut size={13} /> SIGN OUT
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default PendingScreen;
