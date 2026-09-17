/**
 * 17TRACK Integration Service
 * Handles auto-detection of logistics carriers, registering tracking numbers,
 * querying tracking status, and formatting updates for Telegram.
 */

import crypto from 'crypto';

const API_BASE_URL = 'https://api.17track.net/track/v2.2';

export interface TrackingEvent {
  time?: string;
  timeIso?: string;
  description?: string;
  location?: string;
  stage?: string;
}

export interface TrackingInfoResult {
  success: boolean;
  trackingNumber: string;
  carrier?: number;
  carrierName?: string;
  carrierAlias?: string;
  carrierCountry?: string;
  status: string;
  statusTextVi: string;
  statusIcon: string;
  subStatus?: string;
  latestEvent?: TrackingEvent;
  events?: TrackingEvent[];
  originCountry?: string;
  destinationCountry?: string;
  error?: string;
  raw?: unknown;
}

export interface TrackingRegisterResult {
  success: boolean;
  trackingNumber: string;
  carrier?: number;
  carrierName?: string;
  alreadyRegistered?: boolean;
  error?: string;
}

// Known carrier mapping for rapid lookup & enhanced Vietnamese names
export const KNOWN_CARRIERS: Record<number, string> = {
  100538: 'Shopee Xpress (SPX Express)',
  100456: 'J&T Express (VN)',
  100593: 'Giao Hàng Nhanh (GHN)',
  100611: 'Viettel Post',
  22041: 'Bưu điện Việt Nam (VNPost)',
  22043: 'VNPost EMS',
  100129: 'Ninja Van (VN)',
  100276: 'Boxme',
  100257: 'ISO Logistics',
  100294: 'Multrans Logistics',
  190008: 'YunExpress (云途物流)',
  100001: 'China Post (中国邮政)',
  100002: 'DHL Express',
  100003: 'UPS (United Parcel Service)',
  100004: 'FedEx',
  21051: 'USPS (United States Postal Service)',
  100084: 'Yanwen Express (燕文物流)',
  100346: 'Cainiao (菜鸟网络)',
  100014: 'Royal Mail',
  100018: 'Japan Post (日本郵便)',
  100040: 'Singapore Post (SingPost)',
  100057: 'SF Express (顺丰速运)',
  100099: 'Korea Post (우체국)',
};

// Status map with Vietnamese descriptions and emojis
export const STATUS_MAP: Record<string, { label: string; icon: string }> = {
  NotFound: { label: 'Chưa có thông tin vận đơn', icon: '❓' },
  InfoReceived: { label: 'Đã tạo vận đơn (Chờ lấy hàng)', icon: '📝' },
  PickedUp: { label: 'Đã nhận kiện hàng', icon: '📦' },
  Departure: { label: 'Rời bưu cục xuất phát', icon: '🛫' },
  Arrival: { label: 'Đến trung tâm phân loại / kho trung chuyển', icon: '🏢' },
  InTransit: { label: 'Đang vận chuyển', icon: '🚚' },
  AvailableForPickup: { label: 'Đã đến bưu cục / Sẵn sàng nhận hàng', icon: '📦' },
  OutForDelivery: { label: 'Đang phát hàng đến người nhận', icon: '🛵' },
  Delivered: { label: 'Giao hàng thành công', icon: '✅' },
  DeliveryFailure: { label: 'Giao hàng không thành công', icon: '⚠️' },
  Exception: { label: 'Có sự cố phát sinh trong hành trình', icon: '🚨' },
  Expired: { label: 'Vận đơn đã quá hạn theo dõi', icon: '⏳' },
};

function getApiKey(): string {
  const key = process.env.TRACK17_API_KEY || 'A32C33927C9C06266BC2C1452488E22F';
  if (!key) {
    throw new Error('Chưa cấu hình TRACK17_API_KEY trong .env.local');
  }
  return key;
}

/**
 * Register a tracking number with 17TRACK.
 * When carrier is omitted, 17TRACK automatically detects the carrier.
 */
export async function registerTracking(
  trackingNumber: string,
  carrier?: number
): Promise<TrackingRegisterResult> {
  const apiKey = getApiKey();
  const normalizedNumber = trackingNumber.trim();

  const payloadItem: { number: string; carrier?: number } = { number: normalizedNumber };
  if (carrier) payloadItem.carrier = carrier;

  try {
    const res = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey,
      },
      body: JSON.stringify([payloadItem]),
    });

    if (!res.ok) {
      throw new Error(`17TRACK HTTP error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data.code !== 0) {
      return {
        success: false,
        trackingNumber: normalizedNumber,
        error: data.message || `Lỗi API 17TRACK (code ${data.code})`,
      };
    }

    // Check accepted
    const accepted = data.data?.accepted?.[0];
    if (accepted) {
      const detectedCarrier = accepted.carrier;
      const carrierName = detectedCarrier
        ? KNOWN_CARRIERS[detectedCarrier] || `Carrier #${detectedCarrier}`
        : undefined;

      return {
        success: true,
        trackingNumber: normalizedNumber,
        carrier: detectedCarrier,
        carrierName,
        alreadyRegistered: false,
      };
    }

    // Check rejected
    const rejected = data.data?.rejected?.[0];
    if (rejected) {
      const errCode = rejected.error?.code;
      const errMsg = rejected.error?.message || 'Không thể đăng ký';

      // Code -18019901: already registered
      if (errCode === -18019901) {
        return {
          success: true,
          trackingNumber: normalizedNumber,
          alreadyRegistered: true,
        };
      }

      // Code -18019903: Carrier cannot be auto detected
      if (errCode === -18019903) {
        return {
          success: false,
          trackingNumber: normalizedNumber,
          error: `17TRACK không thể tự động nhận diện hãng vận chuyển cho mã "${normalizedNumber}". Vui lòng kiểm tra lại định dạng mã vận đơn!`,
        };
      }

      return {
        success: false,
        trackingNumber: normalizedNumber,
        error: errMsg,
      };
    }

    return {
      success: false,
      trackingNumber: normalizedNumber,
      error: 'Không nhận được kết quả xử lý từ 17TRACK',
    };
  } catch (err) {
    return {
      success: false,
      trackingNumber: normalizedNumber,
      error: (err as Error).message,
    };
  }
}

/**
 * Fetch detailed tracking info for a tracking number from 17TRACK
 */
export async function getTrackingInfo(
  trackingNumber: string,
  carrier?: number
): Promise<TrackingInfoResult> {
  const apiKey = getApiKey();
  const normalizedNumber = trackingNumber.trim();

  const payloadItem: { number: string; carrier?: number } = { number: normalizedNumber };
  if (carrier) payloadItem.carrier = carrier;

  try {
    const res = await fetch(`${API_BASE_URL}/gettrackinfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey,
      },
      body: JSON.stringify([payloadItem]),
    });

    if (!res.ok) {
      throw new Error(`17TRACK HTTP error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data.code !== 0) {
      return {
        success: false,
        trackingNumber: normalizedNumber,
        status: 'Error',
        statusTextVi: 'Lỗi tra cứu',
        statusIcon: '❌',
        error: data.message || `Lỗi API 17TRACK (code ${data.code})`,
      };
    }

    const accepted = data.data?.accepted?.[0];
    if (!accepted) {
      const rejectedMsg = data.data?.rejected?.[0]?.error?.message;
      return {
        success: false,
        trackingNumber: normalizedNumber,
        status: 'NotFound',
        statusTextVi: 'Không tìm thấy dữ liệu',
        statusIcon: '❓',
        error: rejectedMsg || 'Không tìm thấy thông tin đơn hàng này trên 17TRACK.',
      };
    }

    const carrierCode = accepted.carrier as number | undefined;
    const trackInfo = accepted.track_info || {};
    const latestStatus = trackInfo.latest_status || {};
    const rawStatus = latestStatus.status || 'NotFound';
    const subStatus = latestStatus.sub_status;
    const subStatusDescr = latestStatus.sub_status_descr;

    // Provider details
    const primaryProvider = trackInfo.tracking?.providers?.[0]?.provider;
    const providerName = primaryProvider?.name;
    const providerAlias = primaryProvider?.alias;
    const providerCountry = primaryProvider?.country;

    const carrierName =
      providerName ||
      (carrierCode ? KNOWN_CARRIERS[carrierCode] || `Carrier #${carrierCode}` : 'Chưa xác định');

    // Status translation
    const statusMeta = STATUS_MAP[rawStatus] || {
      label: rawStatus,
      icon: '📦',
    };

    // Latest event
    const rawLatestEvent = trackInfo.latest_event;
    let latestEvent: TrackingEvent | undefined;
    if (rawLatestEvent) {
      latestEvent = {
        time: rawLatestEvent.time_iso || rawLatestEvent.time_raw?.date || '',
        timeIso: rawLatestEvent.time_iso,
        description: rawLatestEvent.description,
        location: rawLatestEvent.location || rawLatestEvent.address?.city || '',
        stage: rawLatestEvent.stage,
      };
    }

    // Historical events
    const rawEvents = trackInfo.tracking?.providers?.[0]?.events || [];
    const events: TrackingEvent[] = rawEvents.map((e: any) => ({
      time: e.time_iso || e.time_raw?.date || '',
      timeIso: e.time_iso,
      description: e.description,
      location: e.location || e.address?.city || '',
      stage: e.stage,
    }));

    // Countries
    const originCountry = trackInfo.shipping_info?.shipper_address?.country;
    const destinationCountry = trackInfo.shipping_info?.recipient_address?.country;

    return {
      success: true,
      trackingNumber: normalizedNumber,
      carrier: carrierCode,
      carrierName,
      carrierAlias: providerAlias,
      carrierCountry: providerCountry,
      status: rawStatus,
      statusTextVi: statusMeta.label,
      statusIcon: statusMeta.icon,
      subStatus,
      latestEvent,
      events,
      originCountry,
      destinationCountry,
      raw: accepted,
    };
  } catch (err) {
    return {
      success: false,
      trackingNumber: normalizedNumber,
      status: 'Error',
      statusTextVi: 'Lỗi kết nối',
      statusIcon: '❌',
      error: (err as Error).message,
    };
  }
}

/**
 * Helper to format ISO or raw date to Vietnamese format
 */
export function formatDateTimeVi(isoOrRaw?: string): string {
  if (!isoOrRaw) return 'Chưa có thời gian';
  try {
    const d = new Date(isoOrRaw);
    if (isNaN(d.getTime())) return isoOrRaw;
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoOrRaw;
  }
}

/**
 * Format tracking information for Telegram HTML messages
 */
export function formatTrackingForTelegram(
  info: TrackingInfoResult,
  options?: { isWebhookUpdate?: boolean }
): string {
  const isUpdate = options?.isWebhookUpdate ?? false;
  const title = isUpdate
    ? `🔔 <b>CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG</b>`
    : `📦 <b>THÔNG TIN THEO DÕI ĐƠN HÀNG</b>`;

  const carrierDisplay = info.carrierName
    ? `<b>${info.carrierName}</b>${info.carrier ? ` (Mã: <code>${info.carrier}</code>)` : ''}`
    : '<i>Chưa xác định</i>';

  let text = `${title}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🔖 Mã vận đơn: <code>${info.trackingNumber}</code>\n`;
  text += `🏢 Hãng vận chuyển: ${carrierDisplay}\n`;
  text += `📍 Trạng thái: ${info.statusIcon} <b>${info.statusTextVi}</b>\n`;

  if (info.originCountry || info.destinationCountry) {
    const orig = info.originCountry || 'N/A';
    const dest = info.destinationCountry || 'N/A';
    text += `🌐 Lộ trình: <b>${orig}</b> ➔ <b>${dest}</b>\n`;
  }

  if (info.latestEvent) {
    text += `\n📌 <b>Sự kiện mới nhất:</b>\n`;
    if (info.latestEvent.time) {
      text += `🕒 <i>${formatDateTimeVi(info.latestEvent.time)}</i>\n`;
    }
    if (info.latestEvent.location) {
      text += `📍 Vị trí: <b>${info.latestEvent.location}</b>\n`;
    }
    if (info.latestEvent.description) {
      text += `📝 Diễn biến: <i>${info.latestEvent.description}</i>\n`;
    }
  } else {
    text += `\nℹ️ <i>Đang chờ hãng vận chuyển cập nhật sự kiện đầu tiên.</i>\n`;
  }

  // Show previous events if available (up to 3 recent events for initial check)
  if (!isUpdate && info.events && info.events.length > 1) {
    const recent = info.events.slice(1, 4);
    text += `\n📜 <b>Hành trình gần đây:</b>\n`;
    for (const ev of recent) {
      const timeStr = formatDateTimeVi(ev.time);
      const locStr = ev.location ? ` [${ev.location}]` : '';
      text += `• <i>${timeStr}</i>${locStr}: ${ev.description || ''}\n`;
    }
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  if (!isUpdate) {
    text += `🔔 <i>Hệ thống đã tự động thêm vào danh sách theo dõi. Khi hãng vận chuyển có cập nhật mới qua Webhook 17TRACK, bot sẽ tự động thông báo tại đây!</i>`;
  } else {
    text += `✨ <i>Thông báo tự động nhận từ Webhook 17TRACK.</i>`;
  }

  return text;
}

/**
 * Verify 17TRACK Webhook signature: sha256(raw_body + "/" + secret_key)
 */
export function verify17TrackSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string
): boolean {
  if (!secretKey) return true; // If no secret key configured, skip verification
  if (!signature) return false;

  try {
    const expected = crypto
      .createHash('sha256')
      .update(`${rawBody}/${secretKey}`, 'utf8')
      .digest('hex');
    return expected.toLowerCase() === signature.trim().toLowerCase();
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}
