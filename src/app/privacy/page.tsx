import LegalPage from '@/components/LegalPage';
import { getLegalDoc, legalMetadata } from '@/lib/legal/content';

export const metadata = legalMetadata('privacy');

export default function Page() {
  return <LegalPage doc={getLegalDoc('privacy')!} />;
}
