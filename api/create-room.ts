import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log('[create-room] Function invoked', { method: req.method });

  if (req.method !== 'POST') {
    console.log('[create-room] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DAILY_API_KEY;
  console.log('[create-room] API key check:', {
    exists: !!apiKey,
    length: apiKey?.length,
    preview: apiKey?.substring(0, 4)
  });

  if (!apiKey) {
    console.error('[create-room] DAILY_API_KEY not configured');
    return res.status(500).json({ error: 'DAILY_API_KEY not configured' });
  }

  try {
    // Set expiry to 35 minutes from now (in seconds since epoch)
    const expiryTime = Math.floor(Date.now() / 1000) + (35 * 60);
    console.log('[create-room] Expiry time calculated:', {
      expiryTime,
      expiresAt: new Date(expiryTime * 1000).toISOString()
    });

    console.log('[create-room] Making Daily.co API call...');
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        properties: {
          exp: expiryTime,
          max_participants: 2,
        },
      }),
    });

    console.log('[create-room] Daily.co API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[create-room] Daily.co API error:', {
        status: response.status,
        errorData
      });
      return res.status(response.status).json({
        error: 'Failed to create Daily room',
        details: errorData
      });
    }

    const data = await response.json();
    console.log('[create-room] Daily.co room created:', {
      roomUrl: data.url,
      roomName: data.name
    });

    return res.status(200).json({
      roomUrl: data.url,
      roomName: data.name,
      expiresAt: new Date(expiryTime * 1000).toISOString(),
    });
  } catch (error) {
    console.error('[create-room] Error creating Daily room:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
