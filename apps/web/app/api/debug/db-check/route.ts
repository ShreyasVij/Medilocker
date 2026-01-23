import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usersCol = await getCollection('users');
    const profilesCol = await getCollection('profiles');
    const documentsCol = await getCollection('documents');

    const user = await usersCol.findOne({ email: session.user.email });
    const userId = (user as any)?.id || (user as any)?._id?.toString();

    const allProfiles = await profilesCol.find({ userId }).toArray();
    const allDocuments = await documentsCol.find({}).limit(20).toArray();
    const userDocuments = await documentsCol.find({ ownerUserId: userId }).toArray();

    return NextResponse.json({
      session: {
        email: session.user.email,
      },
      user: {
        id: (user as any)?.id,
        _id: (user as any)?._id?.toString(),
        userId,
        keys: user ? Object.keys(user) : [],
      },
      profiles: {
        count: allProfiles.length,
        data: allProfiles.map((p: any) => ({
          id: p.id,
          _id: p._id?.toString(),
          userId: p.userId,
          displayName: p.displayName,
        })),
      },
      documents: {
        totalInDB: allDocuments.length,
        userDocuments: userDocuments.length,
        allSamples: allDocuments.map((d: any) => ({
          id: d.id,
          profileId: d.profileId,
          ownerUserId: d.ownerUserId,
          status: d.status,
          docType: d.docType,
        })),
        userSamples: userDocuments.map((d: any) => ({
          id: d.id,
          profileId: d.profileId,
          ownerUserId: d.ownerUserId,
          status: d.status,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
