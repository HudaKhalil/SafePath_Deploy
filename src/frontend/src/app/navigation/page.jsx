// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import dynamic from 'next/dynamic';

const NavigationClient = dynamic(() => import('./NavigationClient'), {
  ssr: false,
});

export default function NavigationPage() {
  return <NavigationClient />;
}
