import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import { useStore } from '../store';

const Header: React.FC = () => {
  const { app } = useStore();
  
  // Determine header color based on visual state
  const getHeaderClass = (): string => {
    switch (app.visualState) {
      case 'critical':
        return 'border-error';
      case 'warning':
        return 'border-warning';
      default:
        return 'border-neutral-700';
    }
  };
  
  // Determine status icon based on visual state
  const getStatusIcon = () => {
    switch (app.visualState) {
      case 'critical':
        return <AlertTriangle size={18} className="text-error animate-pulse" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-warning" />;
      default:
        return <Shield size={18} className="text-primary" />;
    }
  };
  
  // Determine status text based on visual state
  const getStatusText = (): string => {
    switch (app.visualState) {
      case 'critical':
        return 'CRITICAL';
      case 'warning':
        return 'WARNING';
      default:
        return 'SECURE';
    }
  };

  return (
    <header className={`fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-md border-b ${getHeaderClass()} z-40`}>
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <div className="mr-2 text-lg font-bold text-neutral-100 font-mono">CHIMERA</div>
          <div className="text-xs font-mono text-neutral-500">v0.1.0</div>
        </div>
        
        <div className="flex items-center space-x-1 bg-surface px-2 py-1 rounded">
          {getStatusIcon()}
          <span className={`text-xs font-mono ${app.visualState === 'critical' ? 'text-error' : app.visualState === 'warning' ? 'text-warning' : 'text-primary'}`}>
            {getStatusText()}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;