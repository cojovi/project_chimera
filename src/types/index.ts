// Core application types

export interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  percentage: number;
  isExpired: boolean;
}

export interface TaskState {
  id: string;
  createdAt: string;
  nextTriggerAt: string;
  payloadPath: string;
  recipientEmail: string;
  postponementInterval: number; // in days
  status: 'pending' | 'triggered' | 'paused';
}

export interface UserInput {
  password: string;
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface AudioState {
  isMuted: boolean;
  volume: number;
}

export interface AppState {
  isDarkMode: boolean;
  isFirstVisit: boolean;
  visualState: 'normal' | 'warning' | 'critical';
  isAuthenticated: boolean;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}