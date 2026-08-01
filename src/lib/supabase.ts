import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://znnpklgdfgnnwrnvufgr.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpubnBrbGdkZmdubndybnZ1ZmdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxOTY1NzEsImV4cCI6MjEwMDc3MjU3MX0.9jzmScDfsY4Y7x5agig39du9LyeWzMMSQfRuQ-Tw4oY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
