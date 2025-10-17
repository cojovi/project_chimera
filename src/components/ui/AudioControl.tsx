import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useAudio } from '../../hooks/useAudio';

const AudioControl: React.FC = () => {
  const { isMuted, toggleMute, volume, setVolume } = useAudio();

  return (
    <div className="fixed bottom-4 right-4 flex items-center space-x-2 z-50">
      <button
        onClick={toggleMute}
        className="text-neutral-400 hover:text-neutral-100 transition-colors"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
      
      {!isMuted && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-20 accent-primary"
          aria-label="Volume"
        />
      )}
    </div>
  );
};

export default AudioControl;