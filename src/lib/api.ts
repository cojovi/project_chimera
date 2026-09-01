import { supabase, SUPABASE_URL } from './supabase';

const WALL = `${SUPABASE_URL}/functions/v1/wall`;
const USER_API = `${SUPABASE_URL}/functions/v1/user-api`;

export type SwitchStatus = 'armed' | 'disarmed' | 'triggered';

export interface WallTimer {
  callsign: string;
  status: SwitchStatus;
  interval_minutes: number;
  next_trigger_at: string;
  mock: boolean;
}

export interface WallFeed {
  timers: WallTimer[];
  server_time: string;
}

export interface PayloadFile {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export type AccountStatus = 'pending' | 'approved' | 'denied';

export interface PendingAccount {
  user_id: string;
  callsign: string;
  signup_email: string | null;
  signup_note: string | null;
  created_at: string;
}

export interface ReviewedAccount extends PendingAccount {
  status: AccountStatus;
  invite_code: string | null;
  reviewed_at: string | null;
  denial_reason: string | null;
}

export interface InviteCode {
  id: string;
  code: string;
  label: string;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface AdminOverview {
  pending: PendingAccount[];
  recent: ReviewedAccount[];
  codes: InviteCode[];
  server_time: string;
}

export interface UserConfig {
  status: SwitchStatus;
  interval_minutes: number;
  next_trigger_at: string;
  last_checkin_at: string | null;
  recipient_email: string;
  cc_emails: string[];
  operator_email: string;
  email_subject: string;
  email_message: string;
  triggered_at: string | null;
  callsign: string;
  show_on_wall: boolean;
  account_status: AccountStatus;
  is_admin: boolean;
  denial_reason: string | null;
  files: PayloadFile[];
}

async function post<T>(url: string, body: Record<string, unknown>, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `request failed (${res.status})`);
  }
  return data as T;
}

async function authed<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('NOT AUTHENTICATED');
  return post<T>(USER_API, { action, ...body }, token);
}

// ---- public ----
export const getFeed = () => post<WallFeed>(WALL, { action: 'feed' });

export const signup = (
  email: string,
  password: string,
  callsign: string,
  inviteCode?: string,
  note?: string
) =>
  post<{ ok: boolean; status: AccountStatus }>(WALL, {
    action: 'signup',
    email,
    password,
    callsign,
    invite_code: inviteCode ?? '',
    note: note ?? ''
  });

export async function login(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export const logout = () => supabase.auth.signOut();

// ---- authenticated ----
export const getConfig = () => authed<UserConfig>('config');
export const checkin = () => authed<UserConfig>('checkin');
export const arm = () => authed<UserConfig>('arm');
export const disarm = () => authed<UserConfig>('disarm');

export const updateConfig = (
  patch: Partial<
    Pick<
      UserConfig,
      | 'interval_minutes'
      | 'recipient_email'
      | 'cc_emails'
      | 'operator_email'
      | 'email_subject'
      | 'email_message'
      | 'callsign'
      | 'show_on_wall'
    >
  >
) => authed<UserConfig>('update_config', patch);

export const deleteFile = (fileId: string) => authed<UserConfig>('delete_file', { file_id: fileId });
export const sendTestEmail = () => authed<{ ok: boolean }>('test_email');

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function downloadFile(fileId: string): Promise<void> {
  const { file_name, mime_type, data_b64 } = await authed<{
    file_name: string;
    mime_type: string;
    data_b64: string;
  }>('download_file', { file_id: fileId });
  const bytes = Uint8Array.from(atob(data_b64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime_type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file_name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadFile(file: File): Promise<UserConfig> {
  const dataB64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',', 2)[1] ?? '');
    reader.onerror = () => reject(new Error('could not read file'));
    reader.readAsDataURL(file);
  });
  return authed<UserConfig>('upload', {
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    data_b64: dataB64
  });
}

// ---- admin ----
export const adminOverview = () => authed<AdminOverview>('admin_overview');

export const adminReview = (userId: string, decision: 'approved' | 'denied', reason?: string) =>
  authed<{ ok: boolean }>('admin_review', { user_id: userId, decision, reason: reason ?? '' });

export const adminDeleteAccount = (userId: string) =>
  authed<{ ok: boolean }>('admin_delete_account', { user_id: userId });

export const adminCreateCode = (opts: {
  code: string;
  label?: string;
  max_uses?: number | null;
  expires_in_days?: number | null;
}) => authed<{ ok: boolean }>('admin_create_code', { ...opts });

export const adminSetCodeActive = (codeId: string, active: boolean) =>
  authed<{ ok: boolean }>('admin_set_code_active', { code_id: codeId, active });

export const adminDeleteCode = (codeId: string) =>
  authed<{ ok: boolean }>('admin_delete_code', { code_id: codeId });
