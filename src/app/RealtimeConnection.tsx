import { useEffect } from "react";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import {
  apiGet,
  getApiToken,
  handleRealtimeDataChange,
  refreshAllApiWatchers,
  type RealtimeDataChange,
} from "../api";
import type { Role } from "./AppTypes";

interface ClassSubscription {
  id: string;
  enrolledStudentIds?: string[];
}

interface ClassesResponse {
  data: ClassSubscription[];
}

interface DataChangedPayload {
  topics?: unknown;
  classId?: unknown;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000/api" : "/api")
).replace(/\/+$/, "");

export function RealtimeConnection({
  role,
  userId,
}: {
  role: Role;
  userId: string;
}) {
  useEffect(() => {
    const key = import.meta.env.VITE_REVERB_APP_KEY;
    const token = getApiToken();
    if (!key || !token || !userId) {
      console.error("Realtime updates are unavailable: Reverb key or API session is missing.");
      return;
    }

    const scheme = import.meta.env.VITE_REVERB_SCHEME || "http";
    const host = import.meta.env.VITE_REVERB_HOST || window.location.hostname;
    const port = Number(import.meta.env.VITE_REVERB_PORT || (scheme === "https" ? 443 : 8080));
    const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
    const authEndpoint =
      import.meta.env.VITE_BROADCAST_AUTH_URL || `${apiOrigin}/broadcasting/auth`;
    const echo = new Echo({
      broadcaster: "reverb",
      key,
      Pusher,
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS: scheme === "https",
      enabledTransports: ["ws", "wss"],
      authEndpoint,
      auth: {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const subscriptions = new Set<string>();
    let firstConnection = true;
    let disconnected = false;
    const seenEvents = new Set<string>();

    const onDataChanged = (payload: DataChangedPayload) => {
      if (!Array.isArray(payload.topics) || !payload.topics.every((topic) => typeof topic === "string")) {
        console.error("Received an invalid realtime update payload.");
        return;
      }

      const classId = typeof payload.classId === "number" ? payload.classId : null;
      const change: RealtimeDataChange = {
        topics: payload.topics as string[],
        classId,
      };
      const fingerprint = `${classId ?? ""}:${change.topics.join("|")}`;
      if (seenEvents.has(fingerprint)) return;
      seenEvents.add(fingerprint);
      window.setTimeout(() => seenEvents.delete(fingerprint), 250);
      handleRealtimeDataChange(change);

      if (change.topics.includes("/classes")) {
        void syncClassSubscriptions();
      }
    };

    const subscribe = (channelName: string) => {
      if (subscriptions.has(channelName)) return;
      subscriptions.add(channelName);
      echo.private(channelName).listen(".data.changed", onDataChanged);
    };

    const syncClassSubscriptions = async () => {
      if (role === "admin") return;
      try {
        const { data } = await apiGet<ClassesResponse>("/classes");
        for (const item of data) {
          if (
            role === "teacher" ||
            item.enrolledStudentIds?.includes(userId)
          ) {
            subscribe(`classes.${item.id}`);
          }
        }
      } catch (error) {
        console.error("Could not refresh realtime class subscriptions:", error);
      }
    };

    subscribe(`users.${userId}`);
    subscribe(`roles.${role}`);
    void syncClassSubscriptions();

    const unsubscribeConnection = echo.connector.onConnectionChange((status) => {
      if (status === "connected") {
        if (disconnected || !firstConnection) refreshAllApiWatchers();
        firstConnection = false;
        disconnected = false;
      } else if (status === "disconnected" || status === "failed") {
        disconnected = true;
      }
    });

    const refreshOnResume = () => {
      if (document.visibilityState === "visible") refreshAllApiWatchers();
    };
    document.addEventListener("visibilitychange", refreshOnResume);
    window.addEventListener("focus", refreshOnResume);

    return () => {
      unsubscribeConnection();
      document.removeEventListener("visibilitychange", refreshOnResume);
      window.removeEventListener("focus", refreshOnResume);
      echo.disconnect();
    };
  }, [role, userId]);

  return null;
}
