/**
 * Routes the user to the right screen when they tap a push notification,
 * including when the tap cold-starts the app.
 */

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import type { NotificationData } from '@sync/shared';

function destinationFor(data: Partial<NotificationData> | undefined): string | null {
  if (!data?.tripId) return null;
  // Trips detail screens land in Phase 2+; until then every notification opens
  // the trips list, which is a sensible, always-valid destination.
  return '/trips';
}

export function NotificationRouter() {
  const router = useRouter();
  const handledColdStart = useRef(false);

  useEffect(() => {
    const go = (data: Partial<NotificationData> | undefined) => {
      const href = destinationFor(data);
      if (href) router.push(href as never);
    };

    // Tapped while the app was running (foreground or background).
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      go(response.notification.request.content.data as Partial<NotificationData>);
    });

    // Tapped while the app was closed — the response is waiting for us.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || handledColdStart.current) return;
      handledColdStart.current = true;
      go(response.notification.request.content.data as Partial<NotificationData>);
    });

    return () => sub.remove();
  }, [router]);

  return null;
}
