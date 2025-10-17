import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-neutral-800 py-2 px-4 z-30">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-xs text-neutral-500 font-mono">
          PROJECT CHIMERA · SYSTEM INITIALIZED
        </div>
        
        <div className="text-xs text-neutral-500 font-mono flex items-center">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse mr-2"></div>
          TELEMETRY ACTIVE
        </div>
      </div>
    </footer>
  );
};

export default Footer;