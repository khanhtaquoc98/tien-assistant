/**
 * Tracking Order Storage
 * Manages persistence for tracked shipment orders and their Telegram subscriber chats.
 */

import { readJsonFile, writeJsonFile } from './data-store';

const FILE_NAME = 'tracked_orders.json';

export interface TrackedOrderRecord {
  number: string;
  carrier?: number;
  carrierName?: string;
  chatIds: (number | string)[];
  createdAt: string;
  updatedAt: string;
  lastStatus?: string;
  lastSubStatus?: string;
  lastEventTime?: string;
  lastEventDesc?: string;
  lastEventLocation?: string;
}

export function getTrackedOrders(): Record<string, TrackedOrderRecord> {
  const data = readJsonFile<Record<string, TrackedOrderRecord>>(FILE_NAME);
  return data || {};
}

export function getTrackedOrder(trackingNumber: string): TrackedOrderRecord | null {
  const all = getTrackedOrders();
  const key = trackingNumber.trim().toUpperCase();
  return all[key] || null;
}

export function saveTrackedOrder(order: TrackedOrderRecord): void {
  const all = getTrackedOrders();
  const key = order.number.trim().toUpperCase();
  all[key] = {
    ...order,
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(FILE_NAME, all);
}

export function subscribeChatToOrder(
  trackingNumber: string,
  chatId: number | string,
  extra?: Partial<TrackedOrderRecord>
): TrackedOrderRecord {
  const all = getTrackedOrders();
  const key = trackingNumber.trim().toUpperCase();
  const now = new Date().toISOString();

  const existing = all[key];
  let chatIds: (number | string)[] = existing ? [...existing.chatIds] : [];
  if (!chatIds.some((id) => String(id) === String(chatId))) {
    chatIds.push(chatId);
  }

  const record: TrackedOrderRecord = {
    number: key,
    carrier: extra?.carrier ?? existing?.carrier,
    carrierName: extra?.carrierName ?? existing?.carrierName,
    chatIds,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastStatus: extra?.lastStatus ?? existing?.lastStatus,
    lastSubStatus: extra?.lastSubStatus ?? existing?.lastSubStatus,
    lastEventTime: extra?.lastEventTime ?? existing?.lastEventTime,
    lastEventDesc: extra?.lastEventDesc ?? existing?.lastEventDesc,
    lastEventLocation: extra?.lastEventLocation ?? existing?.lastEventLocation,
  };

  all[key] = record;
  writeJsonFile(FILE_NAME, all);
  return record;
}

export function unsubscribeChatFromOrder(
  trackingNumber: string,
  chatId: number | string
): boolean {
  const all = getTrackedOrders();
  const key = trackingNumber.trim().toUpperCase();
  const existing = all[key];
  if (!existing) return false;

  const originalCount = existing.chatIds.length;
  existing.chatIds = existing.chatIds.filter((id) => String(id) !== String(chatId));

  if (existing.chatIds.length === 0) {
    // Optionally retain record or keep it
    existing.updatedAt = new Date().toISOString();
  } else {
    existing.updatedAt = new Date().toISOString();
  }

  all[key] = existing;
  writeJsonFile(FILE_NAME, all);
  return existing.chatIds.length < originalCount;
}

export function getOrdersForChat(chatId: number | string): TrackedOrderRecord[] {
  const all = getTrackedOrders();
  const target = String(chatId);
  return Object.values(all).filter((order) =>
    order.chatIds.some((id) => String(id) === target)
  );
}

export function updateOrderTrackingStatus(
  trackingNumber: string,
  update: Partial<TrackedOrderRecord>
): TrackedOrderRecord | null {
  const all = getTrackedOrders();
  const key = trackingNumber.trim().toUpperCase();
  const existing = all[key];
  if (!existing) return null;

  const updated: TrackedOrderRecord = {
    ...existing,
    ...update,
    updatedAt: new Date().toISOString(),
  };

  all[key] = updated;
  writeJsonFile(FILE_NAME, all);
  return updated;
}
