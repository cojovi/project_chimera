import React from 'react';
import { motion } from 'framer-motion';
import { useCountdown } from '../../hooks/useCountdown';
import { useStore } from '../../store';

const CountdownTimer: React.FC = () => {
  const countdown = useCountdown();
  const { app } = useStore();
  
  // Format two digits
  const formatNumber = (num: number): string => {
    return num.toString().padStart(2, '0');
  };
  
  // Determine color based on visual state
  const getColorClass = (): string => {
    switch (app.visualState) {
      case 'critical':
        return 'text-error';
      case 'warning':
        return 'text-warning';
      default:
        return 'text-primary';
    }
  };
  
  // Determine animation based on visual state
  const getAnimationClass = (): string => {
    switch (app.visualState) {
      case 'critical':
        return 'animate-glitch';
      case 'warning':
        return 'animate-pulse';
      default:
        return '';
    }
  };
  
  // Progress bar color
  const getProgressColor = (): string => {
    switch (app.visualState) {
      case 'critical':
        return 'bg-error';
      case 'warning':
        return 'bg-warning';
      default:
        return 'bg-primary';
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Progress Ring */}
      <div className="relative mb-4">
        <svg width="240" height="240" viewBox="0 0 240 240">
          {/* Background circle */}
          <circle 
            cx="120" 
            cy="120" 
            r="110" 
            fill="none" 
            stroke="#27272F" 
            strokeWidth="10" 
          />
          
          {/* Progress circle */}
          <motion.circle 
            cx="120" 
            cy="120" 
            r="110" 
            fill="none" 
            stroke={app.visualState === 'critical' ? '#FF3333' : app.visualState === 'warning' ? '#FFB800' : '#3A86FF'} 
            strokeWidth="10" 
            strokeLinecap="round" 
            strokeDasharray={2 * Math.PI * 110}
            strokeDashoffset={2 * Math.PI * 110 * (1 - countdown.percentage / 100)}
            initial={{ strokeDashoffset: 2 * Math.PI * 110 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 110 * (1 - countdown.percentage / 100) }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
        </svg>
        
        {/* Time display inside the circle */}
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <div className={`text-5xl font-bold font-mono ${getColorClass()} ${getAnimationClass()}`}>
            {formatNumber(countdown.days)}:{formatNumber(countdown.hours)}:
            {formatNumber(countdown.minutes)}:{formatNumber(countdown.seconds)}
          </div>
          
          <div className="text-neutral-400 text-sm mt-2">
            {countdown.isExpired ? "EXPIRED" : "REMAINING"}
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-1 bg-surface rounded-full overflow-hidden mb-4">
        <motion.div 
          className={`h-full ${getProgressColor()}`}
          initial={{ width: '0%' }}
          animate={{ width: `${countdown.percentage}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      {/* Status message */}
      <motion.div 
        className={`text-sm ${getColorClass()} font-mono`}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        {countdown.isExpired 
          ? "SYSTEM TRIGGER IMMINENT" 
          : app.visualState === 'critical'
          ? "CRITICAL: IMMEDIATE ACTION REQUIRED"
          : app.visualState === 'warning'
          ? "WARNING: APPROACHING DEADLINE"
          : "SYSTEM OPERATIONAL"
        }
      </motion.div>
    </div>
  );
};

export default CountdownTimer;