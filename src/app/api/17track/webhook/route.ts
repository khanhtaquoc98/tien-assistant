/**
 * 17TRACK Webhook Route Handler
 * Receives automatic shipment tracking event updates pushed from 17TRACK,
 * updates stored order state, and notifies subscribed Telegram chats.
 *
 * Endpoint:
 * POST /api/17track/webhook
 * GET  /api/17track/webhook (status & config info)
 */

import { type NextRequest } from 'next/server';
import {
  verify17TrackSignature,
  KNOWN_CARRIERS,
  STATUS_MAP,
  formatDateTimeVi,
  translateEventDescriptionVi,
  translateSubStatusVi,
} from '@/lib/tracking-service';
import {
  getTrackedOrder,
  updateOrderTrackingStatus,
  getTrackedOrders,
} from '@/lib/tracking-store';
import { sendMessage } from '@/lib/telegram';

interface WebhookItem {
  number?: string;
  carrier?: number;
  param?: string;
  tag?: string;
  track?: {
    z0?: {
      z?: number;
      s?: number;
      a?: string;
      c?: string;
      d?: string;
    };
    z1?: Array<{
      z?: number;
      s?: number;
      a?: string;
      c?: string;
      d?: string;
    }>;
  };
  track_info?: {
    shipping_info?: {
      shipper_address?: { country?: string };
      recipient_address?: { country?: string };
    };
    latest_status?: {
      status?: string;
      sub_status?: string;
      sub_status_descr?: string;
    };
    latest_event?: {
      time_iso?: string;
      description?: string;
      location?: string;
      stage?: string;
      address?: { city?: string; country?: string };
    };
    tracking?: {
      providers?: Array<{
        provider?: {
          key?: number;
          name?: string;
          alias?: string;
          country?: string;
        };
        events?: Array<{
          time_iso?: string;
          description?: string;
          location?: string;
        }>;
      }>;
    };
  };
}

function mapStageCodeToStatus(z?: number): string {
  switch (z) {
    case 0:
      return 'NotFound';
    case 10:
      return 'InTransit';
    case 20:
      return 'Expired';
    case 30:
      return 'AvailableForPickup';
    case 35:
      return 'OutForDelivery';
    case 40:
      return 'DeliveryFailure';
    case 50:
      return 'Delivered';
    default:
      return 'InTransit';
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return Response.json({ code: -1, message: 'Empty body' }, { status: 400 });
    }

    // Optional 17TRACK signature check
    const signature =
      request.headers.get('sign') || request.headers.get('x-17track-signature');
    const webhookSecret = process.env.TRACK17_WEBHOOK_SECRET;
    if (webhookSecret && !verify17TrackSignature(rawBody, signature, webhookSecret)) {
      console.warn('17TRACK Webhook signature verification failed');
      return Response.json({ code: -1, message: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Extract items array from various possible 17TRACK webhook schemas
    let items: WebhookItem[] = [];
    if (Array.isArray(payload.data)) {
      items = payload.data;
    } else if (payload.data && typeof payload.data === 'object') {
      items = [payload.data];
    } else if (Array.isArray(payload.payload?.data)) {
      items = payload.payload.data;
    } else if (payload.payload?.data && typeof payload.payload.data === 'object') {
      items = [payload.payload.data];
    } else if (payload.number) {
      items = [payload];
    }

    if (items.length === 0) {
      return Response.json({ code: 0, message: 'No tracking items in payload' });
    }

    const results: Array<{ number: string; notifiedChats: number; skippedDuplicate: boolean }> = [];

    for (const item of items) {
      const trackingNumber = item.number?.trim();
      if (!trackingNumber) continue;

      const carrierCode = item.carrier;
      const providerName =
        item.track_info?.tracking?.providers?.[0]?.provider?.name ||
        item.track_info?.tracking?.providers?.[0]?.provider?.alias;

      const carrierName =
        providerName ||
        (carrierCode ? KNOWN_CARRIERS[carrierCode] || `Carrier #${carrierCode}` : undefined);

      // Determine status & latest event
      let status = item.track_info?.latest_status?.status;
      let subStatus = item.track_info?.latest_status?.sub_status;
      let eventTime =
        item.track_info?.latest_event?.time_iso ||
        item.track?.z0?.d ||
        new Date().toISOString();
      const rawEventDesc =
        item.track_info?.latest_event?.description ||
        item.track?.z0?.c ||
        'Cập nhật tiến trình vận chuyển';
      const eventDesc = translateEventDescriptionVi(rawEventDesc);
      const subStatusVi = translateSubStatusVi(subStatus);
      let eventLocation =
        item.track_info?.latest_event?.location ||
        item.track_info?.latest_event?.address?.city ||
        item.track?.z0?.a ||
        '';

      if (!status && item.track?.z0) {
        status = mapStageCodeToStatus(item.track.z0.z);
      }
      if (!status) status = 'InTransit';

      const statusMeta = STATUS_MAP[status] || {
        label: status,
        icon: '📦',
      };

      // Retrieve existing order in store
      const order = getTrackedOrder(trackingNumber);

      // Avoid spamming if identical event has already been notified
      const isDuplicate =
        order &&
        order.lastStatus === status &&
        order.lastEventTime === eventTime &&
        order.lastEventDesc === eventDesc;

      if (isDuplicate) {
        results.push({ number: trackingNumber, notifiedChats: 0, skippedDuplicate: true });
        continue;
      }

      // Determine which Telegram chat IDs should receive notifications
      const chatIds =
        order && order.chatIds && order.chatIds.length > 0
          ? order.chatIds
          : process.env.TELEGRAM_CHAT_ID
          ? [process.env.TELEGRAM_CHAT_ID]
          : [];

      // Format Telegram message
      let msg = `🔔 <b>CẬP NHẬT ĐƠN HÀNG MỚI</b>\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🔖 Mã vận đơn: <code>${trackingNumber}</code>\n`;
      if (carrierName) {
        msg += `🏢 Hãng vận chuyển: <b>${carrierName}</b>${carrierCode ? ` (<code>${carrierCode}</code>)` : ''}\n`;
      }
      msg += `📍 Trạng thái: ${statusMeta.icon} <b>${statusMeta.label}</b>\n`;
      if (subStatusVi) {
        msg += `ℹ️ Chi tiết: <i>${subStatusVi}</i>\n`;
      }
      msg += `\n📌 <b>Sự kiện vừa ghi nhận:</b>\n`;
      msg += `🕒 <i>${formatDateTimeVi(eventTime)}</i>\n`;
      if (eventLocation) {
        msg += `📍 Vị trí: <b>${eventLocation}</b>\n`;
      }
      msg += `📝 Diễn biến: <b>${eventDesc}</b>\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `✨ <i>Thông báo tự động nhận từ Webhook 17TRACK</i>`;

      // Broadcast to all subscriber chats
      let sentCount = 0;
      for (const chatId of chatIds) {
        try {
          await sendMessage(chatId, msg, { parse_mode: 'HTML' });
          sentCount++;
        } catch (sendErr) {
          console.error(`Failed to send tracking update to chat ${chatId}:`, sendErr);
        }
      }

      // Update storage
      updateOrderTrackingStatus(trackingNumber, {
        carrier: carrierCode ?? order?.carrier,
        carrierName: carrierName ?? order?.carrierName,
        lastStatus: status,
        lastSubStatus: subStatus,
        lastEventTime: eventTime,
        lastEventDesc: eventDesc,
        lastEventLocation: eventLocation,
      });

      results.push({ number: trackingNumber, notifiedChats: sentCount, skippedDuplicate: false });
    }

    return Response.json({
      code: 0,
      message: 'success',
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('17TRACK Webhook error:', error);
    // Return 200 with error info so 17TRACK does not continuously loop-retry invalid payloads
    return Response.json(
      { code: -1, error: (error as Error).message },
      { status: 200 }
    );
  }
}

export async function GET() {
  const trackedOrders = getTrackedOrders();
  const count = Object.keys(trackedOrders).length;

  return Response.json({
    status: 'active',
    service: '17TRACK Webhook Receiver',
    endpoint: '/api/17track/webhook',
    trackedOrdersCount: count,
    instructions: {
      step1: 'Truy cập https://api.17track.net và đăng nhập vào tài khoản',
      step2: 'Vào Settings (Cài đặt) -> Webhook',
      step3: 'Nhập URL webhook công khai của bạn, ví dụ: https://<domain-cua-ban>/api/17track/webhook',
      step4: 'Nếu cài Security Key, điền vào TRACK17_WEBHOOK_SECRET trong file .env.local',
    },
    timestamp: new Date().toISOString(),
  });
}
