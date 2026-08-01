import React from 'react';
import { motion } from 'framer-motion';
import type { WallTimer } from '../lib/api';
import { pad, remainingUntil } from '../lib/time';
import { formatInterval } from '../lib/time';

interface Props {
  timers: WallTimer[];
  nowMs: number; // server-corrected clock
}

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.08, duration: 0.45, ease: 'easeOut' as const }
  })
};

const TimerCard: React.FC<{ t: WallTimer; nowMs: number; index: number }> = ({ t, nowMs, index }) => {
  const r = remainingUntil(new Date(t.next_trigger_at), nowMs);
  const pct = Math.min(1, r.totalMs / (t.interval_minutes * 60_000));
  const critical = pct <= 0.1;
  const triggered = t.status === 'triggered';

  const clockCls = triggered
    ? 'text-alarm glow-red'
    : critical
      ? 'text-alarm glow-red'
      : 'text-amber glow-amber';

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="show"
      className="hud-corner border border-edge bg-panel/70 p-4 backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-[0.6rem] tracking-[0.3em] text-steel">{t.callsign}</span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            triggered ? 'bg-alarm' : critical ? 'bg-alarm animate-alarmpulse' : 'bg-armed'
          }`}
        />
      </div>

      <div className={`tabular mt-3 text-center font-mono text-2xl font-bold ${clockCls}`}>
        {triggered
          ? 'EXPENDED'
          : `${pad(r.days)}:${pad(r.hours)}:${pad(r.minutes)}:${pad(r.seconds)}`}
      </div>

      <div className="mt-3 h-[2px] w-full bg-edge">
        <div
          className={`h-full ${triggered || critical ? 'bg-alarm' : 'bg-amber'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[0.6rem] tracking-[0.2em] text-steel-dim">
        <span>{formatInterval(t.interval_minutes)} CYCLE</span>
        <span>{triggered ? 'RELEASED' : 'ARMED'}</span>
      </div>
    </motion.div>
  );
};

const TimerWall: React.FC<Props> = ({ timers, nowMs }) => (
  <div className="w-full">
    <div className="mb-4 flex items-center gap-3">
      <span className="h-1.5 w-1.5 bg-amber" />
      <h2 className="font-display text-[0.65rem] tracking-[0.35em] text-amber">
        ACTIVE PROTOCOLS — {timers.length} SWITCHES LIVE
      </h2>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {timers.map((t, i) => (
        <TimerCard key={`${t.callsign}-${i}`} t={t} nowMs={nowMs} index={i} />
      ))}
    </div>
  </div>
);

export default TimerWall;
