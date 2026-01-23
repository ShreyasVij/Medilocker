import { redirect } from 'next/navigation';

export default function Root() {
  // Always show the marketing home route first
  redirect('/home');
}