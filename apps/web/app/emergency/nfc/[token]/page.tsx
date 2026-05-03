import { redirect } from 'next/navigation';

interface LegacyNfcRedirectPageProps {
  params: {
    token: string;
  };
}

export default function LegacyNfcRedirectPage({ params }: LegacyNfcRedirectPageProps) {
  redirect(`/emergency/public/nfc/${params.token}`);
}