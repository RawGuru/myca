import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DAILY_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      configured: false,
      message: 'DAILY_API_KEY is not configured'
    });
  }

  return res.status(200).json({
    configured: true,
    message: 'DAILY_API_KEY is configured',
    preview: apiKey.substring(0, 4) + '...',
    length: apiKey.length
  });
}
