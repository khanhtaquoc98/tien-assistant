/**
 * Exchange Rate API Route
 *
 * GET  /api/exchange - Lấy tỷ giá (cache 5 phút)
 * POST /api/exchange - Force crawl lại
 * PUT  /api/exchange - Edit tỷ giá
 */

import { type NextRequest } from 'next/server';
import { getExchangeRates, crawlExchangeRates, updateExchangeRate, readExchangeData } from '@/lib/exchange-scraper';

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get('force') === 'true';
    const { data, fromCache } = await getExchangeRates(force);
    return Response.json({ success: true, fromCache, data });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const data = await crawlExchangeRates();
    return Response.json({ success: true, fromCache: false, message: 'Đã crawl lại tỷ giá thành công', data });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, updates } = body as { code: string; updates: Partial<{ buyCash: string; buyTransfer: string; sell: string }> };
    if (!code) return Response.json({ success: false, error: 'Thiếu mã ngoại tệ (code)' }, { status: 400 });

    const data = updateExchangeRate(code, updates);
    if (!data) {
      const existing = readExchangeData();
      if (!existing) return Response.json({ success: false, error: 'Chưa có dữ liệu. Hãy crawl trước.' }, { status: 404 });
      return Response.json({ success: false, error: `Không tìm thấy: ${code}` }, { status: 404 });
    }
    return Response.json({ success: true, message: `Đã cập nhật tỷ giá ${code}`, data });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
