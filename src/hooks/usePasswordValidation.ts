import { useState } from 'react';
import { useStore } from '../store';
import { validatePassword, postponeTask } from '../services/supabase';
import { useAudio } from './useAudio';

export const usePasswordValidation = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { task, passwordAttempts, incrementPasswordAttempts, resetPasswordAttempts } = useStore();
  const { playSound } = useAudio();

  const validateInput = async (input: string): Promise<boolean> => {
    setIsValidating(true);
    setError(null);

    try {
      // Introduce a small delay to simulate processing
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const isValid = await validatePassword(input);
      
      if (isValid) {
        playSound('success');
        resetPasswordAttempts();
        
        // If there's a task, postpone it
        if (task) {
          await postponeTask(task.id, task.postponementInterval);
        }
        
        return true;
      } else {
        playSound('error');
        incrementPasswordAttempts();
        
        // Only set error message after multiple attempts
        if (passwordAttempts > 2) {
          setError('Invalid input. System integrity compromised.');
        }
        
        return false;
      }
    } catch (err) {
      console.error('Error during validation:', err);
      setError('System error. Please try again.');
      playSound('error');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  return {
    validateInput,
    isValidating,
    error,
    attempts: passwordAttempts
  };
};