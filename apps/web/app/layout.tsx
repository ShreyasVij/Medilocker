import React from 'react'
import { AppLayout } from '@/components/AppLayout'
import './globals.css'
import 'bootstrap/dist/css/bootstrap.min.css';

import Providers from "./api/auth/[...nextauth]/providers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const metadata = {
  title: 'MEDILOCKER',
  description: 'Web app',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userName = (session as any)?.user?.name || (session as any)?.user?.email || undefined;
  const role = (((session as any)?.user?.roles || [])[0] || 'patient') as 'patient' | 'doctor' | 'admin';
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          <AppLayout userName={userName} role={role}>
            <div className="container py-4">{children}</div>
          </AppLayout>
        </Providers>
      </body>
    </html>
  );
}
