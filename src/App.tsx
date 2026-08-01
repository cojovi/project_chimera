import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import * as api from './lib/api';
import type { UserConfig, WallTimer } from './lib/api';
import { remainingUntil } from './lib/time';
import Countdown, { urgencyOf } from './components/Countdown';
import TimerWall from './components/TimerWall';
import AuthPanel from './components/AuthPanel';
import Console from './components/Console';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [booted, setBooted] = useState(false);
  const [timers, setTimers] = useState<WallTimer[]>([]);
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0);

  const refreshFeed = useCallback(async () => {
    try {
      const feed = await api.getFeed();
      offsetRef.current = new Date(feed.server_time).getTime() - Date.now();
      setTimers(feed.timers);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  // auth session tracking
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooted(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // load config when authed; clear when not
  useEffect(() => {
    if (session) {
      void api.getConfig().then(setConfig).catch(() => setConfig(null));
    } else {
      setConfig(null);
    }
  }, [session]);

  // clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // feed refresh on landing
  useEffect(() => {
    void refreshFeed();
    if (session) return;
    const t = setInterval(() => void refreshFeed(), 60_000);
    return () => clearInterval(t);
  }, [session, refreshFeed]);

  const nowMs = now + offsetRef.current;

  const remaining = useMemo(
    () => remainingUntil(config ? new Date(config.next_trigger_at) : new Date(), nowMs),
    [config, nowMs]
  );
  const urgency = config ? urgencyOf(remaining, config.interval_minutes) : 'normal';

  const handleLogout = useCallback(() => {
    void api.logout();
    void refreshFeed();
  }, [refreshFeed]);

  const lampColor = !config
    ? 'bg-amber'
    : config.status === 'triggered'
      ? 'bg-alarm animate-alarmpulse'
      : config.status === 'disarmed'
        ? 'bg-steel-dim'
        : urgency === 'critical'
          ? 'bg-alarm animate-alarmpulse'
          : 'bg-armed';

  return (
    <div className="crt relative flex min-h-screen flex-col">
      <div className="border-b border-edge bg-panel/60 py-1 text-center font-display text-[0.5rem] tracking-[0.5em] text-steel-dim">
        AUTOMATED FAILSAFE NETWORK // MISS A CHECK-IN AND THE PAYLOAD FLIES
      </div>

      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${lampColor}`} />
          <h1 className="font-display text-sm tracking-[0.45em] text-steel sm:text-base">
            PROTOCOL <span className="text-amber glow-amber">CHIMERA</span>
          </h1>
        </div>
        <div className="hidden font-mono text-[0.65rem] tracking-[0.2em] text-steel-dim sm:block">
          {offline ? (
            <span className="text-alarm">LINK DOWN — RETRYING</span>
          ) : session ? (
            `OPERATOR ${config?.callsign ?? '…'}`
          ) : (
            'UPLINK NOMINAL'
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 sm:px-10">
        <AnimatePresence mode="wait">
          {!booted && (
            <motion.div
              key="boot"
              className="flex flex-1 items-center font-mono text-xs tracking-[0.4em] text-steel-dim"
              exit={{ opacity: 0 }}
            >
              ESTABLISHING UPLINK<span className="animate-blink">_</span>
            </motion.div>
          )}

          {booted && !session && (
            <motion.div
              key="landing"
              className="flex w-full max-w-6xl flex-1 flex-col items-center gap-10 py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
            >
              <div className="text-center">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="font-display text-[clamp(1.2rem,3.5vw,2.4rem)] tracking-[0.25em] text-steel"
                >
                  IF THE CLOCK HITS ZERO, <span className="text-amber glow-amber">IT SENDS</span>
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-3 font-mono text-[0.7rem] tracking-[0.25em] text-steel-dim"
                >
                  ENCRYPTED PAYLOADS · SERVER-SIDE TIMERS · AUTOMATIC RELEASE
                </motion.p>
              </div>

              <TimerWall timers={timers} nowMs={nowMs} />

              <AuthPanel onAuthed={() => void refreshFeed()} />
            </motion.div>
          )}

          {booted && session && config && (
            <motion.div
              key="console"
              className="w-full py-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
            >
              <div className="mx-auto mb-8 max-w-3xl">
                <Countdown
                  remaining={remaining}
                  status={config.status}
                  urgency={urgency}
                  intervalMinutes={config.interval_minutes}
                />
              </div>
              <Console config={config} onConfig={setConfig} onLogout={handleLogout} />
            </motion.div>
          )}

          {booted && session && !config && (
            <motion.div
              key="loading-config"
              className="flex flex-1 items-center font-mono text-xs tracking-[0.4em] text-steel-dim"
              exit={{ opacity: 0 }}
            >
              LOADING SWITCH STATE<span className="animate-blink">_</span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="flex items-center justify-between border-t border-edge px-6 py-3 font-mono text-[0.6rem] tracking-[0.25em] text-steel-faint sm:px-10">
        <span>PROJECT CHIMERA v2.0</span>
        <span className="hidden sm:inline">SERVER-SIDE FAILSAFE · AES-256 VAULT · RESEND RELAY</span>
        <span>{new Date(now).toUTCString().slice(17, 25)} UTC</span>
      </footer>
    </div>
  );
};

export default App;
