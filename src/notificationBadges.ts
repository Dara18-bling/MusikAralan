export type NotificationBadgeCounts = {
  total: number;
  adminAnnouncements: number;
  classAnnouncements: number;
  notifications: number;
  pendingAccountRequests: number;
  pendingProfileEditRequests: number;
};

export type NotificationBadgeCategory =
  | "adminAnnouncements"
  | "classAnnouncements"
  | "notifications";

const STORAGE_KEY = "musikAralanUnreadNotificationCounts";

const EMPTY_COUNTS: NotificationBadgeCounts = {
  total: 0,
  adminAnnouncements: 0,
  classAnnouncements: 0,
  notifications: 0,
  pendingAccountRequests: 0,
  pendingProfileEditRequests: 0,
};

const listeners = new Set<(counts: NotificationBadgeCounts) => void>();

function normalizeCounts(value: Partial<NotificationBadgeCounts> | null): NotificationBadgeCounts {
  if (!value) return { ...EMPTY_COUNTS };
  return {
    total: Math.max(0, Number(value.total) || 0),
    adminAnnouncements: Math.max(0, Number(value.adminAnnouncements) || 0),
    classAnnouncements: Math.max(0, Number(value.classAnnouncements) || 0),
    notifications: Math.max(0, Number(value.notifications) || 0),
    pendingAccountRequests: Math.max(0, Number(value.pendingAccountRequests) || 0),
    pendingProfileEditRequests: Math.max(0, Number(value.pendingProfileEditRequests) || 0),
  };
}

export function getNotificationBadgeCounts(): NotificationBadgeCounts {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return normalizeCounts(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...EMPTY_COUNTS };
  }
}

export function setNotificationBadgeCounts(
  counts: Partial<NotificationBadgeCounts>,
) {
  const normalized = normalizeCounts(counts);
  normalized.total =
    normalized.adminAnnouncements +
    normalized.classAnnouncements +
    normalized.notifications +
    normalized.pendingAccountRequests +
    normalized.pendingProfileEditRequests;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  listeners.forEach((listener) => listener(normalized));
}

export function setPendingRequestBadgeCounts(
  pendingAccountRequests: number,
  pendingProfileEditRequests: number,
) {
  const counts = getNotificationBadgeCounts();
  counts.adminAnnouncements = 0;
  counts.classAnnouncements = 0;
  counts.notifications = 0;
  counts.pendingAccountRequests = Math.max(0, pendingAccountRequests);
  counts.pendingProfileEditRequests = Math.max(0, pendingProfileEditRequests);
  counts.total =
    counts.adminAnnouncements +
    counts.classAnnouncements +
    counts.notifications +
    counts.pendingAccountRequests +
    counts.pendingProfileEditRequests;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  listeners.forEach((listener) => listener(counts));
}

export function decrementNotificationBadge(
  category: NotificationBadgeCategory,
) {
  const counts = getNotificationBadgeCounts();
  counts[category] = Math.max(0, counts[category] - 1);
  counts.total =
    counts.adminAnnouncements +
    counts.classAnnouncements +
    counts.notifications +
    counts.pendingAccountRequests +
    counts.pendingProfileEditRequests;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  listeners.forEach((listener) => listener(counts));
}

export function clearNotificationBadgeCounts() {
  sessionStorage.removeItem(STORAGE_KEY);
  listeners.forEach((listener) => listener({ ...EMPTY_COUNTS }));
}

export function subscribeToNotificationBadges(
  listener: (counts: NotificationBadgeCounts) => void,
) {
  listeners.add(listener);
  listener(getNotificationBadgeCounts());
  return () => {
    listeners.delete(listener);
  };
}
