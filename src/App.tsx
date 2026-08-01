import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as api from './lib/api';
import type { PublicStatus, SwitchConfig, SwitchStatus } from './lib/api';
import { remainingUntil } from './lib/time';
import Countdown, { urgencyOf } from './components/Countdown';
import PasswordGate from './components/PasswordGate';
import Console from './components/Console';

type View = 'boot' | 'locked' | 'unlocked';

const STATUS_LINE: Record<SwitchStatus, string> = {
  armed: 'SWITCH ARMED — CHECK-IN REQUIRED BEFORE T-ZERO',
  disarmed: 'SWITCH DISARMED — CLOCK SUSPENDED',
  triggered: 'FAILSAFE EXECUTED — PAYLOAD DELIVERED TO DESIGNATED RECIPIENTS'
};

const App: React.FC = () => {
  const [view, setView] = useState<View>('boot');
  const [pub, setPub] = useState<PublicStatus | null>(null);
  const [config, setConfig] = useState<SwitchConfig | null>(null);
  const [password, setPassword] = useState('');
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.getStatus();
      offsetRef.current = new Date(s.server_time).getTime() - Date.now();
      setPub(s);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  // boot: fetch public status
  useEffect(() => {
    void refreshStatus().then(() => setView((v) => (v === 'boot' ? 'locked' : v)));
  }, [refreshStatus]);

  // clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // poll public status while locked
  useEffect(() => {
    if (view !== 'locked') return;
    const t = setInterval(() => void refreshStatus(), 30_000);
    return () => clearInterval(t);
  }, [view, refreshStatus]);

  const status: SwitchStatus = config?.status ?? pub?.status ?? 'disarmed';
  const nextTriggerAt = config?.next_trigger_at ?? pub?.next_trigger_at;
  const intervalMinutes = config?.interval_minutes ?? pub?.interval_minutes ?? 1440;

  const remaining = useMemo(
    () => remainingUntil(nextTriggerAt ? new Date(nextTriggerAt) : new Date(), now + offsetRef.current),
    [nextTriggerAt, now]
  );
  const urgency = urgencyOf(remaining, intervalMinutes);

  const handleUnlock = useCallback(async (pw: string) => {
    const cfg = await api.checkin(pw);
    setPassword(pw);
    setConfig(cfg);
    setView('unlocked');
  }, []);

  const handleLock = useCallback(() => {
    setPassword('');
    setConfig(null);
    setView('locked');
    void refreshStatus();
  }, [refreshStatus]);

  const handleConfig = useCallback((c: SwitchConfig) => setConfig(c), []);

  const lampColor =
    status === 'triggered'
      ? 'bg-alarm animate-alarmpulse'
      : status === 'disarmed'
        ? 'bg-steel-dim'
        : urgency === 'critical'
          ? 'bg-alarm animate-alarmpulse'
          : urgency === 'warning'
            ? 'bg-orange-400'
            : 'bg-armed';

  return (
    <div className="crt relative flex min-h-screen flex-col">
      {/* Classification strip */}
      <div className="border-b border-edge bg-panel/60 py-1 text-center font-display text-[0.5rem] tracking-[0.5em] text-steel-dim">
        EYES ONLY // SINGLE OPERATOR FAILSAFE // UNAUTHORIZED ACCESS IS LOGGED
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${lampColor}`} />
          <h1 className="font-display text-sm tracking-[0.45em] text-steel sm:text-base">
            PROTOCOL <span className="text-amber glow-amber">CHIMERA</span>
          </h1>
        </div>
        <div className="hidden font-mono text-[0.65rem] tracking-[0.2em] text-steel-dim sm:block">
          {offline ? <span className="text-alarm">LINK DOWN — RETRYING</span> : 'UPLINK NOMINAL'}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 sm:px-10">
        <AnimatePresence mode="wait">
          {view === 'boot' && (
            <motion.div
              key="boot"
              className="flex flex-1 items-center font-mono text-xs tracking-[0.4em] text-steel-dim"
              exit={{ opacity: 0 }}
            >
              ESTABLISHING UPLINK<span className="animate-blink">_</span>
            </motion.div>
          )}

          {view === 'locked' && (
            <motion.div
              key="locked"
              className="flex w-full flex-1 flex-col items-center justify-center gap-12 py-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
            >
              <div className="text-center">
                <Countdown
                  remaining={remaining}
                  status={status}
                  urgency={urgency}
                  intervalMinutes={intervalMinutes}
                />
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className={`mt-6 font-mono text-[0.7rem] tracking-[0.3em] ${
                    status === 'triggered' ? 'text-alarm' : 'text-steel-dim'
                  }`}
                >
                  {STATUS_LINE[status]}
                </motion.p>
              </div>
              <PasswordGate onSubmit={handleUnlock} />
            </motion.div>
          )}

          {view === 'unlocked' && config && (
            <motion.div
              key="unlocked"
              className="w-full py-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
            >
              {/* compact countdown strip */}
              <div className="mx-auto mb-6 flex w-full max-w-3xl items-center justify-between border border-edge bg-panel/70 px-5 py-3 backdrop-blur">
                <span className="font-display text-[0.55rem] tracking-[0.35em] text-steel-dim">
                  TIME TO T-ZERO
                </span>
                <span
                  className={`tabular font-mono text-lg font-bold ${
                    status !== 'armed'
                      ? 'text-steel-dim'
                      : urgency === 'critical'
                        ? 'text-alarm glow-red'
                        : 'text-amber glow-amber'
                  }`}
                >
                  {status === 'triggered'
                    ? 'EXPENDED'
                    : `${String(remaining.days).padStart(2, '0')}:${String(remaining.hours).padStart(2, '0')}:${String(remaining.minutes).padStart(2, '0')}:${String(remaining.seconds).padStart(2, '0')}`}
                </span>
              </div>
              <Console
                password={password}
                config={config}
                onConfig={handleConfig}
                onLock={handleLock}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-edge px-6 py-3 font-mono text-[0.6rem] tracking-[0.25em] text-steel-faint sm:px-10">
        <span>PROJECT CHIMERA v1.0</span>
        <span className="hidden sm:inline">SERVER-SIDE FAILSAFE · AES-256 VAULT · RESEND RELAY</span>
        <span>{new Date(now).toUTCString().slice(17, 25)} UTC</span>
      </footer>
    </div>
  );
};

export default App;
