/**
 * Exchange Rate Scraper - Vietcombank
 * Crawl tỷ giá ngoại tệ từ API Vietcombank và lưu vào file JSON
 * Có cache 5 phút
 */

import fs from 'fs';
import path from 'path';

const VCB_API = 'https://www.vietcombank.com.vn/api/exchangerates?date=';
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'exchange_rates.json');
const CACHE_DURATION_MS = 5 * 60 * 1000;

export interface ExchangeRate {
  code: string;
  name: string;
  buyCash: string;
  buyTransfer: string;
  sell: string;
}

export interface ExchangeData {
  rates: ExchangeRate[];
  updatedDate: string;
  crawledAt: string;
  crawledAtMs: number;
  source: string;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readExchangeData(): ExchangeData | null {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as ExchangeData;
  } catch {
    return null;
  }
}

export function writeExchangeData(data: ExchangeData): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function isExchangeDataStale(data: ExchangeData | null): boolean {
  if (!data) return true;
  return Date.now() - data.crawledAtMs > CACHE_DURATION_MS;
}

interface VCBRate {
  currencyName: string;
  currencyCode: string;
  cash: string;
  transfer: string;
  sell: string;
}

interface VCBResponse {
  Count: number;
  Date: string;
  UpdatedDate: string;
  Data: VCBRate[];
}

/**
 * Crawl tỷ giá từ Vietcombank API
 */
export async function crawlExchangeRates(): Promise<ExchangeData> {
  const response = await fetch(VCB_API, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Lỗi API Vietcombank: ${response.status} ${response.statusText}`);
  }

  const vcbData: VCBResponse = await response.json();

  if (!vcbData.Data || vcbData.Data.length === 0) {
    throw new Error('Không có dữ liệu tỷ giá từ Vietcombank');
  }

  const rates: ExchangeRate[] = vcbData.Data.map((r) => ({
    code: r.currencyCode,
    name: r.currencyName,
    buyCash: r.cash || '-',
    buyTransfer: r.transfer || '-',
    sell: r.sell || '-',
  }));

  const now = new Date();
  const exchangeData: ExchangeData = {
    rates,
    updatedDate: vcbData.UpdatedDate || vcbData.Date,
    crawledAt: now.toISOString(),
    crawledAtMs: now.getTime(),
    source: 'Vietcombank API',
  };

  writeExchangeData(exchangeData);
  return exchangeData;
}

export async function getExchangeRates(forceCrawl = false): Promise<{ data: ExchangeData; fromCache: boolean }> {
  const existing = readExchangeData();
  if (!forceCrawl && !isExchangeDataStale(existing)) {
    return { data: existing!, fromCache: true };
  }
  const freshData = await crawlExchangeRates();
  return { data: freshData, fromCache: false };
}

export function updateExchangeRate(code: string, updates: Partial<ExchangeRate>): ExchangeData | null {
  const data = readExchangeData();
  if (!data) return null;
  const idx = data.rates.findIndex((r) => r.code === code);
  if (idx === -1) return null;
  data.rates[idx] = { ...data.rates[idx], ...updates };
  writeExchangeData(data);
  return data;
}

export function formatExchangeForTelegram(data: ExchangeData): string {
  const crawlTime = new Date(data.crawledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const flagMap: Record<string, string> = {
    USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺',
    CAD: '🇨🇦', CHF: '🇨🇭', SGD: '🇸🇬', KRW: '🇰🇷', CNY: '🇨🇳',
    THB: '🇹🇭', HKD: '🇭🇰', TWD: '🇹🇼', NZD: '🇳🇿', MYR: '🇲🇾',
    INR: '🇮🇳', DKK: '🇩🇰', NOK: '🇳🇴', SEK: '🇸🇪', RUB: '🇷🇺',
  };

  // Show main currencies first
  const mainCodes = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'KRW', 'CNY', 'THB'];
  const mainRates = data.rates.filter((r) => mainCodes.includes(r.code));
  const otherCount = data.rates.length - mainRates.length;

  let msg = `💱 <b>TỶ GIÁ NGOẠI TỆ VIETCOMBANK</b>\n`;
  msg += `🕐 Cập nhật: <code>${crawlTime}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n\n`;

  for (const r of mainRates) {
    const flag = flagMap[r.code] || '💵';
    msg += `${flag} <b>${r.code}</b>\n`;
    msg += `   Mua: <code>${r.buyCash}</code> | Bán: <code>${r.sell}</code>\n\n`;
  }

  if (otherCount > 0) {
    msg += `... và ${otherCount} ngoại tệ khác\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Nguồn: Vietcombank`;

  return msg;
}
