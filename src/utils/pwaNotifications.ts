const MOBILE_NOTIF_PREF_KEY = 'almadar_mobile_notifications_enabled_v1';

export type NotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export function isMobileNotificationEnabledInApp(): boolean {
  try {
    const val = localStorage.getItem(MOBILE_NOTIF_PREF_KEY);
    return val !== 'false';
  } catch {
    return true;
  }
}

export function setMobileNotificationEnabledInApp(enabled: boolean): void {
  try {
    localStorage.setItem(MOBILE_NOTIF_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
}

export function getNotificationPermissionStatus(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Play a clean two-tone chime for mobile/desktop alert
    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + startOffset + duration
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    };

    playTone(587.33, 0, 0.16); // D5
    playTone(880, 0.18, 0.26); // A5
  } catch {
    // AudioContext may be blocked if no user gesture yet
  }
}

export async function requestMobileNotificationPermission(): Promise<NotificationPermissionState> {
  setMobileNotificationEnabledInApp(true);
  playNotificationSound();

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionState;
  } catch {
    return Notification.permission as NotificationPermissionState;
  }
}

export async function sendPwaNotification(options: {
  title: string;
  body: string;
  tag?: string;
}): Promise<boolean> {
  if (!isMobileNotificationEnabledInApp()) {
    return false;
  }

  // Trigger audio chime and phone vibration
  playNotificationSound();
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // ignore
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const notifOptions: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: options.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: options.tag || `almadar-notif-${Date.now()}`,
    renotify: true,
    vibrate: [200, 100, 200],
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(options.title, notifOptions);
        return true;
      }
    }
  } catch {
    // Fallback to standard Notification constructor below
  }

  try {
    new Notification(options.title, notifOptions);
    return true;
  } catch {
    return false;
  }
}
