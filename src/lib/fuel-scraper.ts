import axios from 'axios';
import * as cheerio from 'cheerio';
import { readJsonFile, writeJsonFile } from './data-store';

const FUEL_URL = 'https://www.pvoil.com.vn/tin-gia-xang-dau';
const DATA_FILENAME = 'fuel_prices.json';
const CACHE_DURATION_MS = 5 * 60 * 1000;

export interface FuelPrice {
  index: number;
  product: string;
  price: number;
  priceText: string;
  change: number;
  unit: string;
}

export interface FuelData {
  prices: FuelPrice[];
  priceDate: string;
  crawledAt: string;
  crawledAtMs: number;
  source: string;
}

export function readFuelData(): FuelData | null {
  return readJsonFile<FuelData>(DATA_FILENAME);
}

export function writeFuelData(data: FuelData): void {
  writeJsonFile(DATA_FILENAME, data);
}

export function isFuelDataStale(data: FuelData | null): boolean {
  if (!data) return true;
  return Date.now() - data.crawledAtMs > CACHE_DURATION_MS;
}

/**
 * Crawl giá xăng từ PVOIL (server-side rendered)
 * Table: TT | Mặt hàng | Giá điều chỉnh (đ) | Chênh lệch
 */
export async function crawlFuelPrices(): Promise<FuelData> {
  const response = await axios.get(FUEL_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);
  const prices: FuelPrice[] = [];

  // Extract price date from header text
  let priceDate = '';
  $('th').each((_, el) => {
    const text = $(el).text();
    const dateMatch = text.match(/(\d{2}:\d{2}\s+ngày\s+\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) {
      priceDate = dateMatch[1];
    }
  });

  // Parse table - PVOIL table is inside .oilpricescontainer or first table
  const table = $('.oilpricescontainer table').first().length
    ? $('.oilpricescontainer table').first()
    : $('table').first();

  table.find('tbody tr, tr').each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 3) {
      const indexText = $(cells[0]).text().trim();
      const idx = parseInt(indexText);
      if (isNaN(idx)) return; // Skip header/non-data rows

      const product = $(cells[1]).text().trim();
      const priceText = $(cells[2]).text().trim();
      // Parse "30.690 đ" -> 30690
      const priceNum = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(/,/g, '.')) || 0;

      let change = 0;
      if (cells.length >= 4) {
        const changeText = $(cells[3]).text().trim();
        change = parseInt(changeText.replace(/[^\d+-]/g, '')) || 0;
        if (changeText.includes('-')) change = -Math.abs(change);
      }

      if (product) {
        prices.push({
          index: idx,
          product,
          price: priceNum,
          priceText: priceText.replace(/\s+/g, ' ').trim(),
          change,
          unit: 'đồng/lít',
        });
      }
    }
  });

  if (prices.length === 0) {
    throw new Error('Không tìm thấy dữ liệu giá xăng dầu trên PVOIL');
  }

  const now = new Date();
  const fuelData: FuelData = {
    prices,
    priceDate: priceDate || 'N/A',
    crawledAt: now.toISOString(),
    crawledAtMs: now.getTime(),
    source: FUEL_URL,
  };

  writeFuelData(fuelData);
  return fuelData;
}

export async function getFuelPrices(forceCrawl = false): Promise<{ data: FuelData; fromCache: boolean }> {
  const existing = readFuelData();
  if (!forceCrawl && !isFuelDataStale(existing)) {
    return { data: existing!, fromCache: true };
  }
  const freshData = await crawlFuelPrices();
  return { data: freshData, fromCache: false };
}

export function updateFuelPrice(product: string, updates: Partial<FuelPrice>): FuelData | null {
  const data = readFuelData();
  if (!data) return null;
  const idx = data.prices.findIndex((p) => p.product === product);
  if (idx === -1) return null;
  data.prices[idx] = { ...data.prices[idx], ...updates };
  writeFuelData(data);
  return data;
}

export function formatFuelForTelegram(data: FuelData): string {
  const crawlTime = new Date(data.crawledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  let msg = `⛽ <b>GIÁ XĂNG DẦU PVOIL</b>\n`;
  msg += `🕐 ${data.priceDate || crawlTime}\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n\n`;

  for (const p of data.prices) {
    const icon = p.product.includes('Xăng') ? '⛽' : '🛢';
    const changeIcon = p.change > 0 ? '🔺' : p.change < 0 ? '🔻' : '➖';
    const changeText = p.change !== 0 ? ` ${changeIcon} ${p.change > 0 ? '+' : ''}${p.change.toLocaleString('vi-VN')}` : '';

    msg += `${icon} <b>${p.product}</b>${changeText}\n`;
    msg += `   Giá: <code>${p.priceText}</code>\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Nguồn: PVOIL`;

  return msg;
}
