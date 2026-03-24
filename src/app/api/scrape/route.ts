/**
 * Web Scraping Route Handler
 *
 * POST /api/scrape - Scrape a URL
 * Body: { url: string, options?: ScrapeOptions }
 *
 * GET /api/scrape?url=... - Quick scrape a URL
 */

import { type NextRequest } from 'next/server';
import { scrapeUrl, scrapeSelector, type ScrapeOptions } from '@/lib/scraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, selector, options = {} } = body as {
      url: string;
      selector?: string;
      options?: ScrapeOptions;
    };

    if (!url) {
      return Response.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    if (selector) {
      const result = await scrapeSelector(url, selector, options);
      return Response.json({ success: true, data: result });
    }

    const result = await scrapeUrl(url, options);
    return Response.json({ success: true, data: result });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes('Invalid URL') ? 400 : 500;
    return Response.json(
      { success: false, error: message },
      { status }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');
    const selector = request.nextUrl.searchParams.get('selector');

    if (!url) {
      return Response.json(
        { success: false, error: 'URL query parameter is required. Usage: /api/scrape?url=https://example.com' },
        { status: 400 }
      );
    }

    if (selector) {
      const result = await scrapeSelector(url, selector);
      return Response.json({ success: true, data: result });
    }

    const result = await scrapeUrl(url);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
