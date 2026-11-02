export type NotificationCategory =
  | "business"
  | "payments"
  | "clients"
  | "products"
  | "settings"
  | "updates"
  | "system";

export type NotificationType =
  | "invoice_created"
  | "invoice_updated"
  | "invoice_cancelled"
  | "payment_received"
  | "payment_updated"
  | "client_created"
  | "client_updated"
  | "product_created"
  | "product_updated"
  | "settings_changed"
  | "update_available"
  | "update_downloaded"
  | "update_installed"
  | "update_failed"
  | "app_new_version"
  | "test_notification";

export interface Notification {
  id: string;
  type: NotificationType;
  category: string;
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
  read: boolean;
  occurredAt: string; // ISO datetime
  readAt?: string;
}

export interface NotificationCategories {
  [key: string]: string;
}

export interface NotificationTypes {
  [key: string]: [string, string]; // [category, label]
}