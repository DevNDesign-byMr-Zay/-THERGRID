import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DEFAULT_PROFILE = Object.freeze({
  id: 'local-operator',
  displayName: 'Operator',
  initials: 'IM',
  title: 'ÆTHERGRID Operator',
  organization: '',
  homeRegion: 'New York Metro',
  timezone: 'America/New_York',
  bio: '',
  avatarDataUrl: '',
  updatedAt: null,
});

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function cleanAvatar(value) {
  const avatar = String(value ?? '');
  if (!avatar) return '';
  if (!/^data:image\/(?:png|jpeg|webp);base64,/u.test(avatar)) {
    throw new Error('avatar must be a PNG, JPEG, or WebP data URL');
  }
  if (avatar.length > 180_000) throw new Error('avatar exceeds 180 KB encoded limit');
  return avatar;
}

export function sanitizeProfile(input = {}, now = () => new Date().toISOString()) {
  return {
    id: 'local-operator',
    displayName: cleanText(input.displayName || DEFAULT_PROFILE.displayName, 80),
    initials: cleanText(input.initials || DEFAULT_PROFILE.initials, 4).toUpperCase(),
    title: cleanText(input.title || DEFAULT_PROFILE.title, 100),
    organization: cleanText(input.organization, 100),
    homeRegion: cleanText(input.homeRegion || DEFAULT_PROFILE.homeRegion, 100),
    timezone: cleanText(input.timezone || DEFAULT_PROFILE.timezone, 80),
    bio: cleanText(input.bio, 500),
    avatarDataUrl: cleanAvatar(input.avatarDataUrl),
    updatedAt: now(),
  };
}

export function createProfileStore({
  dataDir = process.env.AETHERGRID_DATA_DIR || resolve('.aethergrid-data'),
  now = () => new Date().toISOString(),
} = {}) {
  const profilePath = join(dataDir, 'operator-profile.json');

  async function load() {
    try {
      const raw = await readFile(profilePath, 'utf8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PROFILE, ...parsed, id: 'local-operator' };
    } catch (error) {
      if (error?.code === 'ENOENT') return { ...DEFAULT_PROFILE };
      throw error;
    }
  }

  async function save(input) {
    const profile = sanitizeProfile(input, now);
    await mkdir(dataDir, { recursive: true });
    await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    return profile;
  }

  return {
    load,
    save,
    profilePath,
    safeSummary: () => ({ persistence: 'local-json', profilePath: 'operator-profile.json' }),
  };
}

export { DEFAULT_PROFILE };
