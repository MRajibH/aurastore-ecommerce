import { NextResponse } from 'next/server';
import { z } from 'zod';
import { subscribeEmail, sendEmail, newsletterWelcomeEmail } from '@/lib/email';
import { enforceRateLimit } from '@/lib/security/rate-limit';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  source: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  try {
    const limited = enforceRateLimit(request, 'newsletter', 10, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { email, source } = result.data;
    const { created } = subscribeEmail(email, source ?? 'footer');

    // Only send the welcome offer to genuinely new subscribers.
    if (created) {
      sendEmail(newsletterWelcomeEmail(email)).catch((e) => console.error('Newsletter email failed:', e));
    }

    return NextResponse.json({ success: true, alreadySubscribed: !created });
  } catch (error) {
    console.error('Newsletter error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
