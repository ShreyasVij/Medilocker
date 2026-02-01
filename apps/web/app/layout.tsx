import React from 'react'
import { AppLayout } from '@/components/AppLayout'
import './globals.css'
import 'bootstrap/dist/css/bootstrap.min.css';

import Providers from "./api/auth/[...nextauth]/providers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const metadata = {
  title: 'MEDILOCKER',
  description: 'Web app',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userName = (session as any)?.user?.name || (session as any)?.user?.email || undefined;
  const role = (((session as any)?.user?.roles || [])[0] || 'patient') as 'patient' | 'doctor' | 'admin';
  
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  return (
    <html lang="en">
      <head>
        {/* Load Google Maps API */}
        {apiKey && (
          <script
            src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`}
            async
            defer
          />
        )}
      </head>
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
