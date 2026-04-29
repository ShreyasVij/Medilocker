import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getCollection } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/emailHooks";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 4 * 60 * 60,
  },

  jwt: {
    maxAge: 4 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user && account?.provider === "google") {
        const users = await getCollection<any>("users");

        let dbUser = await users.findOne({
          identityProvider: "google",
          identityId: account.providerAccountId,
        });

        const isNewUser = !dbUser;

        if (!dbUser) {
          const result = await users.insertOne({
            email: (user as any).email,
            name: (user as any).name,
            identityProvider: "google",
            identityId: account.providerAccountId,
            roles: ["patient"],
            status: "active",
            createdAt: new Date(),
            lastLoginAt: new Date(),
          });

          dbUser = { _id: result.insertedId } as any;

          if ((user as any).email) {
            try {
              await sendWelcomeEmail((user as any).email, (user as any).name);
            } catch (error) {
              console.error("Failed to send welcome email:", error);
            }
          }
        } else {
          await users.updateOne(
            { _id: dbUser._id },
            { $set: { lastLoginAt: new Date() } }
          );
        }

        (token as any).id = (dbUser as any)._id.toString();
        (token as any).isNewUser = isNewUser;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && (token as any).id) {
        (session.user as any).id = (token as any).id as string;
        (session.user as any).isNewUser = (token as any).isNewUser as boolean;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
