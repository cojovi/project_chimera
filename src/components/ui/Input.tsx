import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { useAudio } from '../../hooks/useAudio';

type InputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  type?: string;
  className?: string;
  autoFocus?: boolean;
};

const Input: React.FC<InputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = '',
  type = 'text',
  className = '',
  autoFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { app } = useStore();
  const { playSound } = useAudio();
  
  // Handle focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);
  
  // Handle visual state based on app state
  const getInputClasses = () => {
    let baseClasses = `
      w-full bg-background border-2 rounded p-2 font-mono text-neutral-100
      outline-none transition-all duration-200
    `;
    
    if (isFocused) {
      switch (app.visualState) {
        case 'critical':
          baseClasses += ' border-error shadow-glow-accent animate-pulse';
          break;
        case 'warning':
          baseClasses += ' border-warning shadow-glow';
          break;
        default:
          baseClasses += ' border-primary shadow-glow';
      }
    } else {
      baseClasses += ' border-neutral-600';
    }
    
    return baseClasses;
  };
  
  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSubmit) {
      onSubmit();
    }
  };
  
  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setIsFocused(true);
          playSound('focus');
        }}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={getInputClasses()}
      />
      
      {/* Scanline effect when input is focused and in critical state */}
      {isFocused && app.visualState === 'critical' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
          <div className="h-px w-full bg-error animate-scanline"></div>
        </div>
      )}
    </div>
  );
};

export default Input;