import { useCallback } from "react";
import { activeDataProvider } from "@/services";
import { useAsyncResource } from "./useAsyncResource";

export function useNotifications() {
  const fetcher = useCallback(() => activeDataProvider.getNotifications(), []);
  const resource = useAsyncResource(fetcher);

  const unreadCount = resource.data?.filter((n) => !n.read).length ?? 0;

  const markRead = useCallback(async (notificationId: string) => {
    await activeDataProvider.markNotificationRead(notificationId);
    resource.reload();
  }, [resource]);

  const markAllRead = useCallback(async (category?: string) => {
    await activeDataProvider.markAllNotificationsRead(category);
    resource.reload();
  }, [resource]);

  const getUnreadCount = useCallback(async (category?: string) => {
    return activeDataProvider.getUnreadCount(category);
  }, []);

  return {
    ...resource,
    notifications: resource.data ?? [],
    unreadCount,
    markRead,
    markAllRead,
    getUnreadCount,
    refetch: resource.reload,
  };
}

export function useNotificationCategories() {
  return useAsyncResource(() => activeDataProvider.getNotificationCategories());
}

export function useNotificationTypes() {
  return useAsyncResource(() => activeDataProvider.getNotificationTypes());
}