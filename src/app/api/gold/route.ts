/**
 * Gold Price API Route
 *
 * GET  /api/gold - Lấy giá vàng (có cache 5 phút)
 * POST /api/gold - Force crawl lại hoặc update data
 * PUT  /api/gold - Edit một mục giá vàng
 */

import { type NextRequest } from 'next/server';
import { getGoldPrices, crawlGoldPrices, updateGoldPrice, readGoldData, getBTMHPrices, crawlBTMHPrices, getBTMCPrices, crawlBTMCPrices } from '@/lib/gold-scraper';

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get('force') === 'true';
    const source = request.nextUrl.searchParams.get('source');

    if (source === 'btmh') {
      const { data, fromCache } = await getBTMHPrices(force);
      return Response.json({
        success: true,
        fromCache,
        data,
      });
    }

    if (source === 'btmc') {
      const { data, fromCache } = await getBTMCPrices(force);
      return Response.json({
        success: true,
        fromCache,
        data,
      });
    }

    const { data, fromCache } = await getGoldPrices(force);

    return Response.json({
      success: true,
      fromCache,
      data,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const source = request.nextUrl.searchParams.get('source');

    if (source === 'btmh') {
      const data = await crawlBTMHPrices();
      return Response.json({
        success: true,
        fromCache: false,
        message: 'Đã crawl lại giá vàng BTMH thành công',
        data,
      });
    }

    if (source === 'btmc') {
      const data = await crawlBTMCPrices();
      return Response.json({
        success: true,
        fromCache: false,
        message: 'Đã crawl lại giá vàng BTMC thành công',
        data,
      });
    }

    // Force crawl mới
    const data = await crawlGoldPrices();

    return Response.json({
      success: true,
      fromCache: false,
      message: 'Đã crawl lại giá vàng thành công',
      data,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, updates } = body as {
      code: string;
      updates: { buyingPrice?: number; sellingPrice?: number };
    };

    if (!code) {
      return Response.json(
        { success: false, error: 'Thiếu mã vàng (code)' },
        { status: 400 }
      );
    }

    const data = updateGoldPrice(code, updates);
    if (!data) {
      const existing = readGoldData();
      if (!existing) {
        return Response.json(
          { success: false, error: 'Chưa có dữ liệu. Hãy crawl trước.' },
          { status: 404 }
        );
      }
      return Response.json(
        { success: false, error: `Không tìm thấy mã vàng: ${code}` },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: `Đã cập nhật giá vàng ${code}`,
      data,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
