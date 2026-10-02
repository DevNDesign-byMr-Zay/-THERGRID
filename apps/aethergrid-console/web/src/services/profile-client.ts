export interface OperatorProfile {
  id: string;
  displayName: string;
  initials: string;
  title: string;
  organization: string;
  homeRegion: string;
  timezone: string;
  bio: string;
  avatarDataUrl: string;
  updatedAt: string | null;
}

interface ProfileResponse {
  profile: OperatorProfile;
}

async function jsonRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `profile request failed with HTTP ${response.status}`);
  }
  return payload;
}

export async function loadOperatorProfile(): Promise<OperatorProfile> {
  const payload = await jsonRequest<ProfileResponse>('/api/aethergrid/profile');
  return payload.profile;
}

export async function saveOperatorProfile(
  profile: OperatorProfile
): Promise<OperatorProfile> {
  const payload = await jsonRequest<ProfileResponse>('/api/aethergrid/profile', {
    method: 'PUT',
    body: JSON.stringify({ profile })
  });
  return payload.profile;
}
