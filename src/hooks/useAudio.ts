import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useStore } from '../store';

// Audio URLs
const AUDIO_URLS = {
  ambient: 'https://assets.mixkit.co/sfx/preview/mixkit-cinematic-mystery-background-loop-063.mp3',
  success: 'https://assets.mixkit.co/sfx/preview/mixkit-sci-fi-click-900.mp3',
  error: 'https://assets.mixkit.co/sfx/preview/mixkit-sci-fi-glitch-sound-2603.mp3',
  focus: 'https://assets.mixkit.co/sfx/preview/mixkit-tech-interface-click-1139.mp3',
  warning: 'https://assets.mixkit.co/sfx/preview/mixkit-sci-fi-positive-notification-266.mp3'
};

type SoundType = 'ambient' | 'success' | 'error' | 'focus' | 'warning';

export const useAudio = () => {
  const { audio, toggleMute, setVolume } = useStore();
  const soundsRef = useRef<Record<string, Howl>>({});

  // Initialize sounds
  useEffect(() => {
    // Create all sound instances
    Object.entries(AUDIO_URLS).forEach(([key, url]) => {
      soundsRef.current[key] = new Howl({
        src: [url],
        loop: key === 'ambient',
        volume: audio.volume,
        mute: audio.isMuted,
        html5: true
      });
    });

    // Start ambient sound
    soundsRef.current.ambient.play();

    return () => {
      // Clean up sounds on unmount
      Object.values(soundsRef.current).forEach(sound => {
        sound.stop();
      });
    };
  }, []);

  // Update sounds when audio state changes
  useEffect(() => {
    Object.values(soundsRef.current).forEach(sound => {
      sound.mute(audio.isMuted);
      sound.volume(audio.volume);
    });
  }, [audio.isMuted, audio.volume]);

  // Play a sound
  const playSound = (type: SoundType) => {
    if (type === 'ambient' || !soundsRef.current[type]) return;
    soundsRef.current[type].play();
  };

  return {
    playSound,
    isMuted: audio.isMuted,
    volume: audio.volume,
    toggleMute,
    setVolume
  };
};