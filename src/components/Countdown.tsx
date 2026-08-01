import React from 'react';
import { motion } from 'framer-motion';
import type { SwitchStatus } from '../lib/api';
import { pad, type Remaining } from '../lib/time';

export type Urgency = 'normal' | 'warning' | 'critical';

export function urgencyOf(remaining: Remaining, intervalMinutes: number): Urgency {
  const pct = remaining.totalMs / (intervalMinutes * 60_000);
  if (remaining.totalMs <= 60 * 60_000 || pct <= 0.1) return 'critical';
  if (pct <= 0.25) return 'warning';
  return 'normal';
}

interface Props {
  remaining: Remaining;
  status: SwitchStatus;
  urgency: Urgency;
  intervalMinutes: number;
  compact?: boolean;
}

const COLOR: Record<Urgency, { text: string; glow: string; bar: string }> = {
  normal: { text: 'text-amber', glow: 'glow-amber', bar: 'bg-amber' },
  warning: { text: 'text-orange-400', glow: 'glow-amber', bar: 'bg-orange-400' },
  critical: { text: 'text-alarm', glow: 'glow-red', bar: 'bg-alarm' }
};

const Cell: React.FC<{ value: string; label: string; className: string }> = ({
  value,
  label,
  className
}) => (
  <div className="flex flex-col items-center">
    <span className={`tabular font-mono font-bold leading-none text-[clamp(3rem,10vw,7.5rem)] ${className}`}>
      {value}
    </span>
    <span className="mt-2 font-display text-[0.6rem] tracking-[0.35em] text-steel-dim">{label}</span>
  </div>
);

const Sep: React.FC<{ className: string; pulse: boolean }> = ({ className, pulse }) => (
  <span
    className={`tabular font-mono font-bold leading-none text-[clamp(2rem,7vw,5rem)] pb-6 ${className} ${
      pulse ? 'animate-blink' : 'opacity-40'
    }`}
  >
    :
  </span>
);

const Countdown: React.FC<Props> = ({ remaining, status, urgency, intervalMinutes }) => {
  if (status === 'triggered') {
    return (
      <div className="text-center">
        <div className="font-display text-[clamp(1.6rem,5vw,3.5rem)] tracking-[0.2em] text-alarm glow-red animate-alarmpulse">
          T-ZERO REACHED
        </div>
        <div className="mt-4 font-mono text-sm tracking-[0.3em] text-steel">
          PAYLOAD RELEASED // SWITCH EXPENDED
        </div>
      </div>
    );
  }

  const dim = status === 'disarmed';
  const c = COLOR[urgency];
  const textCls = dim ? 'text-steel-dim' : `${c.text} ${c.glow}`;
  const pct = Math.min(1, remaining.totalMs / (intervalMinutes * 60_000));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className={urgency === 'critical' && !dim ? 'animate-flicker' : ''}
    >
      <div className="flex items-end justify-center gap-[clamp(0.4rem,2vw,1.5rem)]">
        <Cell value={pad(remaining.days)} label="DAYS" className={textCls} />
        <Sep className={textCls} pulse={!dim} />
        <Cell value={pad(remaining.hours)} label="HOURS" className={textCls} />
        <Sep className={textCls} pulse={!dim} />
        <Cell value={pad(remaining.minutes)} label="MINUTES" className={textCls} />
        <Sep className={textCls} pulse={!dim} />
        <Cell value={pad(remaining.seconds)} label="SECONDS" className={textCls} />
      </div>

      <div className="mx-auto mt-8 h-[3px] w-full max-w-2xl bg-edge">
        <div
          className={`h-full transition-all duration-1000 ${dim ? 'bg-steel-dim' : c.bar} ${
            urgency === 'critical' && !dim ? 'animate-alarmpulse' : ''
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </motion.div>
  );
};

export default Countdown;
