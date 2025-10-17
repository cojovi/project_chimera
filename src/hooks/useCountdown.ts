import { useState, useEffect } from 'react';
import { CountdownState } from '../types';
import { calculateCountdownState, determineVisualState, useStore } from '../store';

export const useCountdown = () => {
  const { targetDate, app, setVisualState } = useStore();
  const [countdown, setCountdown] = useState<CountdownState>(
    calculateCountdownState(targetDate)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const newCountdown = calculateCountdownState(targetDate);
      setCountdown(newCountdown);
      
      // Update visual state based on percentage
      const newVisualState = determineVisualState(newCountdown.percentage);
      if (newVisualState !== app.visualState) {
        setVisualState(newVisualState);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, app.visualState, setVisualState]);

  return countdown;
};