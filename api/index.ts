import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({})
}
