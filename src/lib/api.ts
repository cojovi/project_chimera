const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://znnpklgdfgnnwrnvufgr.supabase.co';

const API = `${SUPABASE_URL}/functions/v1/switch-api`;

export type SwitchStatus = 'armed' | 'disarmed' | 'triggered';

export interface PublicStatus {
  status: SwitchStatus;
  next_trigger_at: string;
  interval_minutes: number;
  server_time: string;
}

export interface PayloadFile {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface SwitchConfig {
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
  files: PayloadFile[];
}

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `request failed (${res.status})`);
  }
  return data as T;
}

export const getStatus = () => call<PublicStatus>('status');
export const unlock = (password: string) => call<SwitchConfig>('unlock', { password });
export const checkin = (password: string) => call<SwitchConfig>('checkin', { password });
export const arm = (password: string) => call<SwitchConfig>('arm', { password });
export const disarm = (password: string) => call<SwitchConfig>('disarm', { password });

export const updateConfig = (
  password: string,
  patch: Partial<
    Pick<
      SwitchConfig,
      | 'interval_minutes'
      | 'recipient_email'
      | 'cc_emails'
      | 'operator_email'
      | 'email_subject'
      | 'email_message'
    >
  >
) => call<SwitchConfig>('update_config', { password, ...patch });

export const deleteFile = (password: string, fileId: string) =>
  call<SwitchConfig>('delete_file', { password, file_id: fileId });

export const changePassword = (password: string, newPassword: string) =>
  call<{ ok: boolean }>('change_password', { password, new_password: newPassword });

export const sendTestEmail = (password: string) => call<{ ok: boolean }>('test_email', { password });

export async function downloadFile(password: string, fileId: string): Promise<void> {
  const { file_name, mime_type, data_b64 } = await call<{
    file_name: string;
    mime_type: string;
    data_b64: string;
  }>('download_file', { password, file_id: fileId });
  const bytes = Uint8Array.from(atob(data_b64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime_type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file_name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadFile(password: string, file: File): Promise<SwitchConfig> {
  const dataB64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',', 2)[1] ?? '');
    reader.onerror = () => reject(new Error('could not read file'));
    reader.readAsDataURL(file);
  });
  return call<SwitchConfig>('upload', {
    password,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    data_b64: dataB64
  });
}
