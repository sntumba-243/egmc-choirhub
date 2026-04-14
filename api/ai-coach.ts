import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify auth header exists
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { messages, model, max_tokens, system } = req.body;

    const requestBody: any = { model, max_tokens, messages };
    if (system) {
      requestBody.system = system;
    }

    const response = await client.messages.create(requestBody);
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('AI Coach API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
