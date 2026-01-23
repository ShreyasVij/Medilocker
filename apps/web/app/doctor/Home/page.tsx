import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Hero from "@/app/home/HeroSection";
import Awards from "@/app/home/Awards";
import Stats from "@/app/home/Stats";
import Pricing from "@/app/home/Pricing";
import Education from "@/app/home/Education";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const isAuthed = !!session;

  return (
    <>
      <Hero isAuthed={isAuthed} />
      <Awards />
      <Stats />
      <Pricing />
      <Education />
    </>
  );
}