import { useEffect, useRef, useState, useCallback } from 'react';
import { UserProfile } from '../types/frontend';
import { ApiService } from '../services/api';

export const INACTIVITY_STORAGE_KEY = 'subligestao_inactivity_timeout_minutes';
export const DEFAULT_INACTIVITY_MINUTES = 5;
export const PRESENCE_TIMEOUT_EVENT = 'subligestao_presence_timeout_changed';

/**
 * Returns the configured inactivity timeout in minutes (defaults to 5 minutes).
 */
export function getInactivityTimeoutMinutes(): number {
  if (typeof window === 'undefined') return DEFAULT_INACTIVITY_MINUTES;
  try {
    const saved = localStorage.getItem(INACTIVITY_STORAGE_KEY);
    if (!saved) return DEFAULT_INACTIVITY_MINUTES;
    const parsed = parseInt(saved, 10);
    return isNaN(parsed) || parsed <= 0 ? DEFAULT_INACTIVITY_MINUTES : parsed;
  } catch {
    return DEFAULT_INACTIVITY_MINUTES;
  }
}

/**
 * Updates the configured inactivity timeout in minutes and notifies listeners.
 */
export function setInactivityTimeoutMinutes(minutes: number): void {
  if (typeof window === 'undefined') return;
  const safeMinutes = Math.max(1, Math.min(120, Math.round(minutes)));
  try {
    localStorage.setItem(INACTIVITY_STORAGE_KEY, safeMinutes.toString());
    window.dispatchEvent(
      new CustomEvent(PRESENCE_TIMEOUT_EVENT, { detail: { minutes: safeMinutes } })
    );
  } catch (err) {
    console.error('Failed to save inactivity timeout:', err);
  }
}

/**
 * Hook to read and subscribe to the configured inactivity timeout.
 */
export function useInactivityTimeout(): [number, (val: number) => void] {
  const [minutes, setMinutes] = useState<number>(getInactivityTimeoutMinutes);

  useEffect(() => {
    const handleStorage = () => setMinutes(getInactivityTimeoutMinutes());
    const handleCustom = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.minutes) {
        setMinutes(custom.detail.minutes);
      } else {
        setMinutes(getInactivityTimeoutMinutes());
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(PRESENCE_TIMEOUT_EVENT, handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(PRESENCE_TIMEOUT_EVENT, handleCustom);
    };
  }, []);

  const update = useCallback((val: number) => {
    setInactivityTimeoutMinutes(val);
    setMinutes(val);
  }, []);

  return [minutes, update];
}

/**
 * Global User Presence and Inactivity Tracker:
 * - Emits periodic heartbeats (every 15s) while the ERP window is open.
 * - Detects user activity (mouse movement, clicks, keystrokes, scroll).
 * - Transitions to 'away' (ausente) when idle for the configured duration (default: 5 min).
 * - Transitions back to 'online' instantly when mouse or keyboard is touched.
 * - Emits 'offline' on unload/logout.
 */
export function useUserPresence(user: UserProfile | null): {
  presenceStatus: 'online' | 'away' | 'offline';
  inactivityMinutes: number;
  setInactivityMinutes: (m: number) => void;
} {
  const [inactivityMinutes, setInactivityMinutes] = useInactivityTimeout();
  const [presenceStatus, setPresenceStatus] = useState<'online' | 'away' | 'offline'>('online');

  const lastActivityRef = useRef<number>(Date.now());
  const currentStatusRef = useRef<'online' | 'away' | 'offline'>('online');
  const awaySinceRef = useRef<number | null>(null);
  const lastThrottleRef = useRef<number>(0);

  useEffect(() => {
    if (!user) {
      setPresenceStatus('offline');
      currentStatusRef.current = 'offline';
      awaySinceRef.current = null;
      return;
    }

    // Set initial online status and trigger immediate heartbeat
    lastActivityRef.current = Date.now();
    currentStatusRef.current = 'online';
    awaySinceRef.current = null;
    setPresenceStatus('online');
    ApiService.sendChatHeartbeat('online');

    // Throttled user activity handler (max once per second)
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottleRef.current < 800) {
        lastActivityRef.current = now;
        return;
      }
      lastThrottleRef.current = now;
      lastActivityRef.current = now;

      // If currently away, instantly return to online
      if (currentStatusRef.current === 'away') {
        currentStatusRef.current = 'online';
        awaySinceRef.current = null;
        setPresenceStatus('online');
        ApiService.sendChatHeartbeat('online');
      }
    };

    // Activity event listeners
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    // Inactivity checker interval (runs every 5 seconds)
    const idleCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeoutMs = getInactivityTimeoutMinutes() * 60 * 1000;
      const idleTime = now - lastActivityRef.current;

      if (idleTime >= timeoutMs) {
        if (currentStatusRef.current === 'online') {
          currentStatusRef.current = 'away';
          const awayTime = lastActivityRef.current || (now - timeoutMs);
          awaySinceRef.current = awayTime;
          setPresenceStatus('away');
          ApiService.sendChatHeartbeat('away', awayTime);
        }
      }
    }, 5000);

    // Regular heartbeat interval (every 15 seconds)
    const heartbeatInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        // If tab is hidden for longer than the timeout, mark away
        const idleTime = Date.now() - lastActivityRef.current;
        const timeoutMs = getInactivityTimeoutMinutes() * 60 * 1000;
        if (idleTime >= timeoutMs && currentStatusRef.current === 'online') {
          currentStatusRef.current = 'away';
          const awayTime = lastActivityRef.current || (Date.now() - timeoutMs);
          awaySinceRef.current = awayTime;
          setPresenceStatus('away');
        }
      }
      ApiService.sendChatHeartbeat(currentStatusRef.current, awaySinceRef.current);
    }, 15000);

    // Tab visibility change listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleUserActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Unload listener
    const handleBeforeUnload = () => {
      try {
        const token = ApiService.getAccessToken();
        if (token) {
          const payload = JSON.stringify({ status: 'offline' });
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon?.('/api/v1/messages/heartbeat', blob);
        }
      } catch {
        // best effort
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(idleCheckInterval);
      clearInterval(heartbeatInterval);
      // Best-effort offline signal on cleanup
      ApiService.sendChatHeartbeat('offline');
    };
  }, [user?.id]);

  return {
    presenceStatus,
    inactivityMinutes,
    setInactivityMinutes,
  };
}
