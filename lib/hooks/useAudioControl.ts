// lib/hooks/useAudioControl.ts
"use client";

import { useCallback, useRef, useState } from "react";

const COUNTDOWN_SEQUENCE = [
  { name: "3", path: "/sounds/3.wav", duration: 800 },
  { name: "2", path: "/sounds/2.wav", duration: 800 },
  { name: "1", path: "/sounds/1.wav", duration: 800 },
  { name: "VIZ", path: "/sounds/VIZ.wav", duration: 600 },
];

export function useAudioControl() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const playSound = useCallback((path: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(path);
      audioRef.current = audio;

      const onEnded = () => {
        cleanup();
        resolve();
      };

      const onError = (e: Event) => {
        console.error(`Erreur lecture audio ${path}:`, e);
        cleanup();
        reject(e);
      };

      const cleanup = () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        audioRef.current = null;
      };

      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      
      audio.play().catch(reject);
    });
  }, []);

  // Version avec callback optionnel
  const playCountdown = useCallback(async (
    onValueChange?: (value: number) => void
  ): Promise<void> => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    abortControllerRef.current = new AbortController();
    
    try {
      for (let i = 0; i < COUNTDOWN_SEQUENCE.length; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        
        const clip = COUNTDOWN_SEQUENCE[i];
        
        // Mettre à jour la valeur visuelle (3,2,1,0)
        if (onValueChange) {
          onValueChange(i < 3 ? 3 - i : 0);
        }
        
        await playSound(clip.path);
        
        // Petit silence entre les clips
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Remettre à zéro
      if (onValueChange) {
        onValueChange(0);
      }
    } catch (error) {
      console.error("Erreur pendant le décompte vocal:", error);
    } finally {
      setIsPlaying(false);
      abortControllerRef.current = null;
    }
  }, [isPlaying, playSound]);

  const stopCountdown = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  return {
    playCountdown,
    stopCountdown,
    isPlaying,
  };
}
