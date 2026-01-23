// OAuth provider adapters for Google, GitHub, and institutional providers.
export interface OAuthProfile {
  id: string;
  email: string;
  name?: string;
  provider: 'google' | 'github' | 'institution';
}

export async function getAuthorizationUrl(provider: OAuthProfile['provider']): Promise<string> {
  return '';
}

export async function exchangeCodeForToken(provider: OAuthProfile['provider'], code: string): Promise<string> {
  return '';
}

export async function fetchUserProfile(provider: OAuthProfile['provider'], accessToken: string): Promise<OAuthProfile> {
  return { id: '', email: '', provider };
}
