/**
 * Tracking Order Storage
 * Manages persistence for tracked shipment orders and their Telegram subscriber chats.
 * Synchronizes with 17TRACK Cloud API to ensure order persistence across Vercel serverless cold starts.
 */

import { readJsonFile, writeJsonFile } from './data-store';
import {
  getTrackedListFrom17Track,
  stopTracking17Track,
  KNOWN_CARRIERS,
} from './tracking-service';

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

export async function getTrackedOrderWithSync(
  trackingNumber: string
): Promise<TrackedOrderRecord | null> {
  const existing = getTrackedOrder(trackingNumber);
  if (existing) return existing;
  await syncOrdersFrom17Track();
  return getTrackedOrder(trackingNumber);
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

/**
 * Synchronize local order records with 17TRACK Cloud API.
 * This guarantees that even if Vercel serverless /tmp is wiped, orders are restored.
 */
export async function syncOrdersFrom17Track(
  chatId?: number | string
): Promise<Record<string, TrackedOrderRecord>> {
  const all = getTrackedOrders();
  const cloudList = await getTrackedListFrom17Track();
  if (!cloudList || cloudList.length === 0) {
    return all;
  }

  const defaultChatId = process.env.TELEGRAM_CHAT_ID || (chatId ? String(chatId) : undefined);
  const now = new Date().toISOString();

  for (const item of cloudList) {
    if (item.tracking_status === 'Stopped') {
      continue;
    }

    const key = item.number.trim().toUpperCase();
    const existing = all[key];

    // Determine chats
    const chatIds: (number | string)[] = existing ? [...existing.chatIds] : [];
    if (item.tag && !chatIds.some((id) => String(id) === String(item.tag))) {
      chatIds.push(item.tag);
    }
    if (defaultChatId && !chatIds.some((id) => String(id) === String(defaultChatId))) {
      chatIds.push(defaultChatId);
    }
    if (chatId && !chatIds.some((id) => String(id) === String(chatId))) {
      chatIds.push(chatId);
    }

    const carrierName = item.carrier
      ? KNOWN_CARRIERS[item.carrier] || `Carrier #${item.carrier}`
      : existing?.carrierName;

    all[key] = {
      number: key,
      carrier: item.carrier ?? existing?.carrier,
      carrierName: carrierName ?? existing?.carrierName,
      chatIds,
      createdAt: existing?.createdAt || item.register_time || now,
      updatedAt: item.track_time || existing?.updatedAt || now,
      lastStatus: item.package_status || existing?.lastStatus,
      lastSubStatus: existing?.lastSubStatus,
      lastEventTime: item.latest_event_time || existing?.lastEventTime,
      lastEventDesc: item.latest_event_info || existing?.lastEventDesc,
      lastEventLocation: existing?.lastEventLocation,
    };
  }

  writeJsonFile(FILE_NAME, all);
  return all;
}

export async function unsubscribeChatFromOrder(
  trackingNumber: string,
  chatId: number | string
): Promise<boolean> {
  const all = getTrackedOrders();
  const key = trackingNumber.trim().toUpperCase();
  const existing = all[key];
  if (!existing) {
    // Also stop on 17TRACK cloud
    await stopTracking17Track(key);
    return false;
  }

  const originalCount = existing.chatIds.length;
  existing.chatIds = existing.chatIds.filter((id) => String(id) !== String(chatId));

  let shouldStopRemote = false;
  if (existing.chatIds.length === 0) {
    delete all[key];
    shouldStopRemote = true;
  } else {
    existing.updatedAt = new Date().toISOString();
    all[key] = existing;
  }

  writeJsonFile(FILE_NAME, all);

  if (shouldStopRemote) {
    await stopTracking17Track(key, existing.carrier);
  }

  return existing.chatIds.length < originalCount || shouldStopRemote;
}

export function getOrdersForChat(chatId: number | string): TrackedOrderRecord[] {
  const all = getTrackedOrders();
  const target = String(chatId);
  return Object.values(all).filter((order) =>
    order.chatIds.some((id) => String(id) === target)
  );
}

/**
 * Get orders for chat, automatically synchronizing from 17TRACK Cloud
 * if local store is empty (e.g. after a Vercel serverless cold start).
 */
export async function getOrdersForChatWithSync(
  chatId: number | string
): Promise<TrackedOrderRecord[]> {
  let orders = getOrdersForChat(chatId);
  if (orders.length === 0) {
    await syncOrdersFrom17Track(chatId);
    orders = getOrdersForChat(chatId);
  }
  return orders;
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

