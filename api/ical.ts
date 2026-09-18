import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // Optional API Key Protection
  const requiredApiKey = process.env.ICAL_PROXY_API_KEY || process.env.VITE_ICAL_PROXY_API_KEY;
  if (requiredApiKey) {
    const providedKey = req.headers['x-api-key'] || req.query.key;
    if (providedKey !== requiredApiKey) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key.' });
    }
  }

  const queryUrl = req.query.url;
  const envUrl = process.env.AIRBNB_ICAL_URL || process.env.VITE_AIRBNB_ICAL_URL;
  const rawUrl = (typeof queryUrl === 'string' && queryUrl.trim()) || envUrl;

  if (!rawUrl) {
    return res.status(400).json({ error: 'Query parameter "url" or AIRBNB_ICAL_URL env variable is required.' });
  }

  try {
    const targetUrl = new URL(rawUrl);

    if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
      return res.status(400).json({ error: 'Invalid URL protocol. Only HTTP and HTTPS are supported.' });
    }

    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/calendar, text/plain, */*',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch iCal feed (${response.status}): ${response.statusText}`,
      });
    }

    const icsData = await response.text();

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');

    return res.status(200).send(icsData);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to process iCal request',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
