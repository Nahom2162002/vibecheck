// Intentionally vulnerable fixture: Next.js App Router handler with no auth check.
import { db } from '../../../db';

export async function GET() {
  // VULNERABLE: returns all orders with no session/auth check.
  const orders = await db.query('SELECT * FROM orders');
  return Response.json(orders);
}

export async function POST(req: Request) {
  // SAFE: session verified before touching data — should NOT be flagged.
  const session = await getServerSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  const body = await req.json();
  const order = await db.query('INSERT INTO orders (data) VALUES ($1)', [body]);
  return Response.json(order);
}

declare function getServerSession(): Promise<{ userId: string } | null>;
