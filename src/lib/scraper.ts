/**
 * Web Scraping Utility
 * Uses axios + cheerio to scrape web pages
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  url: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  headings: { tag: string; text: string }[];
  links: { text: string; href: string }[];
  images: { src: string; alt: string }[];
  textContent: string;
  html: string;
  scrapedAt: string;
}

export interface ScrapeOptions {
  /** Extract headings (h1-h6) */
  headings?: boolean;
  /** Extract links */
  links?: boolean;
  /** Extract images */
  images?: boolean;
  /** Extract full text content */
  textContent?: boolean;
  /** Extract raw HTML */
  rawHtml?: boolean;
  /** Custom CSS selector to extract */
  selector?: string;
  /** Timeout in ms (default: 10000) */
  timeout?: number;
  /** Custom User-Agent */
  userAgent?: string;
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Scrape a web page and extract structured data
 */
export async function scrapeUrl(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const {
    headings = true,
    links = true,
    images = true,
    textContent = true,
    rawHtml = false,
    timeout = 10000,
    userAgent = DEFAULT_USER_AGENT,
  } = options;

  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Fetch the page
  const response = await axios.get(url, {
    timeout,
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
    },
    maxRedirects: 5,
    validateStatus: (status) => status < 400,
  });

  const html = response.data;
  const $ = cheerio.load(html);

  // Extract meta data
  const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || null;
  const description =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    null;
  const ogImage = $('meta[property="og:image"]').attr('content') || null;

  // Extract headings
  const extractedHeadings: { tag: string; text: string }[] = [];
  if (headings) {
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const tag = $(el).prop('tagName')?.toLowerCase() || '';
      const text = $(el).text().trim();
      if (text) {
        extractedHeadings.push({ tag, text });
      }
    });
  }

  // Extract links
  const extractedLinks: { text: string; href: string }[] = [];
  if (links) {
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        // Resolve relative URLs
        let absoluteHref = href;
        try {
          absoluteHref = new URL(href, url).toString();
        } catch {
          // Keep original href if URL resolution fails
        }
        extractedLinks.push({ text: text || href, href: absoluteHref });
      }
    });
  }

  // Extract images
  const extractedImages: { src: string; alt: string }[] = [];
  if (images) {
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src') || '';
      const alt = $(el).attr('alt') || '';
      if (src) {
        let absoluteSrc = src;
        try {
          absoluteSrc = new URL(src, url).toString();
        } catch {
          // Keep original src
        }
        extractedImages.push({ src: absoluteSrc, alt });
      }
    });
  }

  // Extract text content
  let extractedText = '';
  if (textContent) {
    // Remove script and style elements
    $('script, style, noscript').remove();
    extractedText = $('body').text().replace(/\s+/g, ' ').trim();
  }

  return {
    url,
    title,
    description,
    ogImage,
    headings: extractedHeadings,
    links: extractedLinks,
    images: extractedImages,
    textContent: extractedText,
    html: rawHtml ? html : '',
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Scrape with a custom CSS selector
 */
export async function scrapeSelector(
  url: string,
  selector: string,
  options: { timeout?: number; userAgent?: string } = {}
): Promise<{ elements: string[]; count: number }> {
  const { timeout = 10000, userAgent = DEFAULT_USER_AGENT } = options;

  const response = await axios.get(url, {
    timeout,
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    maxRedirects: 5,
    validateStatus: (status) => status < 400,
  });

  const $ = cheerio.load(response.data);
  const elements: string[] = [];

  $(selector).each((_, el) => {
    elements.push($(el).text().trim());
  });

  return {
    elements,
    count: elements.length,
  };
}
