import { redirect } from 'next/navigation';

export default function OverviewPage() {
  // Server-side redirect
  redirect('/agents');
}
