
import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getCollection } from "@/lib/db";
import type { ObjectId } from "mongodb";

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

  jwt: { // basically its an encoded ticket types which has all the data required 
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

        // Track if this is a new user BEFORE we insert them
        const isNewUser = !dbUser;

        if (!dbUser) {
          const result = await users.insertOne({
            email: user.email,
            name: user.name,
            identityProvider: "google",
            identityId: account.providerAccountId,
            roles: ["patient"],
            status: "active",
            createdAt: new Date(),
            lastLoginAt: new Date(),
          });

          dbUser = { _id: result.insertedId };
        } else {
          await users.updateOne(
            { _id: dbUser._id },
            { $set: { lastLoginAt: new Date() } }
          );
        }

        token.id = dbUser._id.toString();
        token.isNewUser = isNewUser; // Added: Store flag in JWT
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.isNewUser = token.isNewUser as boolean; // Added: Pass to session
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
export { authOptions };