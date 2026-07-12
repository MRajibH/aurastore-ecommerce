import { validateSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { PAYMENT_LABELS } from './constants';
import PosClient from './PosClient';

export const dynamic = 'force-dynamic';

export default async function PosPage() {
  const session = await validateSession();
  if (!session || session.user.role !== 'admin') {
    redirect('/login?next=/admin/pos');
  }

  return <PosClient cashierName={session.user.name} paymentLabels={PAYMENT_LABELS} />;
}
