import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DAILY_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'DAILY_API_KEY not configured' });
  }

  try {
    // Set expiry to 35 minutes from now (in seconds since epoch)
    const expiryTime = Math.floor(Date.now() / 1000) + (35 * 60);

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

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: 'Failed to create Daily room',
        details: errorData
      });
    }

    const data = await response.json();

    return res.status(200).json({
      roomUrl: data.url,
      roomName: data.name,
      expiresAt: new Date(expiryTime * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Error creating Daily room:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
