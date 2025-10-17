import { create } from 'zustand';
import { TaskState, AppState, AudioState } from '../types';
import { addMinutes, differenceInSeconds } from 'date-fns';

interface Store {
  // Task state
  task: TaskState | null;
  setTask: (task: TaskState | null) => void;
  
  // Countdown state
  targetDate: Date | null;
  setTargetDate: (date: Date | null) => void;
  
  // Audio state
  audio: AudioState;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  
  // App state
  app: AppState;
  setDarkMode: (isDark: boolean) => void;
  setVisualState: (state: AppState['visualState']) => void;
  setAuthenticated: (isAuth: boolean) => void;
  completeFirstVisit: () => void;
  
  // Validation state
  passwordAttempts: number;
  incrementPasswordAttempts: () => void;
  resetPasswordAttempts: () => void;
}

export const useStore = create<Store>((set) => ({
  // Task state
  task: null,
  setTask: (task) => set({ task }),
  
  // Countdown state
  targetDate: null,
  setTargetDate: (date) => set({ targetDate: date }),
  
  // Audio state
  audio: {
    isMuted: false,
    volume: 0.7,
  },
  toggleMute: () => set((state) => ({ 
    audio: { 
      ...state.audio, 
      isMuted: !state.audio.isMuted 
    } 
  })),
  setVolume: (volume) => set((state) => ({ 
    audio: { 
      ...state.audio, 
      volume 
    } 
  })),
  
  // App state
  app: {
    isDarkMode: true,
    isFirstVisit: true,
    visualState: 'normal',
    isAuthenticated: false,
  },
  setDarkMode: (isDarkMode) => set((state) => ({ 
    app: { 
      ...state.app, 
      isDarkMode 
    } 
  })),
  setVisualState: (visualState) => set((state) => ({ 
    app: { 
      ...state.app, 
      visualState 
    } 
  })),
  setAuthenticated: (isAuthenticated) => set((state) => ({ 
    app: { 
      ...state.app, 
      isAuthenticated 
    } 
  })),
  completeFirstVisit: () => set((state) => ({ 
    app: { 
      ...state.app, 
      isFirstVisit: false 
    } 
  })),
  
  // Validation state
  passwordAttempts: 0,
  incrementPasswordAttempts: () => set((state) => ({ 
    passwordAttempts: state.passwordAttempts + 1 
  })),
  resetPasswordAttempts: () => set({ passwordAttempts: 0 }),
}));

// Helper functions
export const calculateCountdownState = (targetDate: Date | null) => {
  if (!targetDate) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      percentage: 100,
      isExpired: true
    };
  }

  const now = new Date();
  const difference = differenceInSeconds(targetDate, now);
  
  // If the target date is in the past
  if (difference <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      percentage: 100,
      isExpired: true
    };
  }
  
  // Calculate time components
  const totalMinutes = Math.floor(difference / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor(difference % 60);
  
  // Calculate percentage elapsed for 10-minute interval
  const totalSeconds = 10 * 60; // 10 minutes in seconds
  const elapsed = totalSeconds - difference;
  const percentage = Math.min(100, Math.max(0, (elapsed / totalSeconds) * 100));
  
  return {
    days: 0,
    hours: 0,
    minutes,
    seconds,
    percentage,
    isExpired: false
  };
};

export const determineVisualState = (percentage: number): AppState['visualState'] => {
  if (percentage >= 90) return 'critical';
  if (percentage >= 70) return 'warning';
  return 'normal';
};