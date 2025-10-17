import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../store';

const Background: React.FC = () => {
  const { app } = useStore();
  const [randomGlitches, setRandomGlitches] = useState<Array<{ id: number; top: string; left: string; delay: number }>>([]);
  
  // Create random glitches based on visual state
  useEffect(() => {
    if (app.visualState === 'critical') {
      const glitches = Array(20).fill(0).map((_, i) => ({
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        delay: Math.random() * 5
      }));
      setRandomGlitches(glitches);
    } else {
      setRandomGlitches([]);
    }
  }, [app.visualState]);
  
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base grid background */}
      <div 
        className="absolute inset-0 bg-grid opacity-10" 
        style={{ backgroundSize: '40px 40px' }}
      />
      
      {/* Overlay gradients */}
      <div className="absolute inset-0 bg-gradient-radial from-background/0 to-background/90" />
      
      {/* Vignette effect */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent to-background opacity-60" />
      
      {/* Visual state overlays */}
      {app.visualState === 'warning' && (
        <motion.div 
          className="absolute inset-0 bg-warning/5"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      )}
      
      {app.visualState === 'critical' && (
        <>
          <motion.div 
            className="absolute inset-0 bg-error/10"
            animate={{ opacity: [0.1, 0.4, 0.1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          {/* Random glitch elements */}
          {randomGlitches.map((glitch) => (
            <motion.div
              key={glitch.id}
              className="absolute w-1 h-10 bg-error/30"
              style={{ top: glitch.top, left: glitch.left }}
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scaleY: [0, 1, 0],
              }}
              transition={{ 
                duration: 0.3, 
                repeat: Infinity, 
                repeatDelay: 5 + glitch.delay,
                ease: "easeInOut"
              }}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default Background;