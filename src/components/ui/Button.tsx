import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../store';

type ButtonProps = {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  glitchEffect?: boolean;
};

const Button: React.FC<ButtonProps> = ({
  onClick,
  className = '',
  disabled = false,
  children,
  variant = 'primary',
  size = 'md',
  glitchEffect = false,
}) => {
  const { app } = useStore();
  
  // Determine variant styling
  const variantStyles = {
    primary: 'bg-primary hover:bg-primary-hover text-neutral-100 border-primary-900',
    secondary: 'bg-secondary hover:bg-secondary-hover text-neutral-100 border-secondary-900',
    accent: 'bg-accent hover:bg-accent-hover text-neutral-100 border-accent-900',
    ghost: 'bg-transparent hover:bg-surface border border-neutral-400 text-neutral-100',
  };
  
  // Determine size styling
  const sizeStyles = {
    sm: 'py-1 px-3 text-sm',
    md: 'py-2 px-4 text-base',
    lg: 'py-3 px-6 text-lg',
  };
  
  // Apply visual state effects
  const stateEffects = app.visualState === 'critical' && glitchEffect
    ? 'hover:animate-glitch'
    : '';
  
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        ${variantStyles[variant]} 
        ${sizeStyles[size]} 
        ${stateEffects}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        rounded font-mono font-bold border-2 transition-all duration-200
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
};

export default Button;