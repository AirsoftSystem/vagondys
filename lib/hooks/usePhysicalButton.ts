// lib/hooks/usePhysicalButton.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Simulation du bouton physique via événements clavier (pour développement)
// En production, remplacer par WebSocket/Serial vers le hardware
export function usePhysicalButton(laneId: number) {
  const [isLedOn, setIsLedOn] = useState(false);
  const actionRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Simulation de l'état de la LED (pour développement)
  // En production, envoyer une commande WebSocket pour allumer/éteindre la LED physique
  const setLed = useCallback((on: boolean) => {
    setIsLedOn(on);
    
    // Simulation d'envoi à l'ESP32 via WebSocket
    // TODO: remplacer par un appel WebSocket réel
    console.log(`[Couloir ${laneId}] LED ${on ? 'ALLUMÉE' : 'ÉTEINTE'}`);
  }, [laneId]);

  // Déclencher l'action associée au bouton
  const triggerAction = useCallback(() => {
    if (actionRef.current) {
      console.log(`[Couloir ${laneId}] Bouton physique appuyé`);
      actionRef.current();
    }
  }, [laneId]);

  // Enregistrer l'action à exécuter quand le bouton est appuyé
  // ✅ CORRECTION : Accepte null pour désenregistrer l'action
  const registerAction = useCallback((action: (() => void) | null) => {
    actionRef.current = action;
    
    if (action) {
      // Allumer la LED pour indiquer que l'action est disponible
      setLed(true);
      
      // Timeout pour éteindre la LED après 30 secondes si pas d'action
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setLed(false);
        actionRef.current = null;
      }, 30000);
    } else {
      // Éteindre la LED et désenregistrer l'action
      setLed(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setLed(false);
      actionRef.current = null;
    };
  }, [setLed]);

  // Écouter les événements clavier (simulation du bouton physique)
  // En production, remplacer par WebSocket/Serial
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Touche "Enter" ou "Espace" pour simuler le bouton physique
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        triggerAction();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerAction]);

  return {
    isLedOn,
    registerAction,
    triggerAction,
  };
}
