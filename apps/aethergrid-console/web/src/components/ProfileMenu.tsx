import { useEffect, useRef, useState } from 'react';

import {
  loadOperatorProfile,
  saveOperatorProfile,
  type OperatorProfile
} from '../services/profile-client';

const DEFAULT_PROFILE: OperatorProfile = {
  id: 'local-operator',
  displayName: 'Operator',
  initials: 'IM',
  title: 'ÆTHERGRID Operator',
  organization: '',
  homeRegion: 'New York Metro',
  timezone: 'America/New_York',
  bio: '',
  avatarDataUrl: '',
  updatedAt: null
};

async function avatarDataUrl(file: File): Promise<string> {
  if (!file.type.match(/^image\/(?:png|jpeg|webp)$/u)) {
    throw new Error('Avatar must be PNG, JPEG, or WebP');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Could not read avatar image'));
      element.src = objectUrl;
    });

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size
    );

    const dataUrl = canvas.toDataURL('image/webp', 0.78);
    if (dataUrl.length > 180_000) {
      throw new Error('Avatar remains too large after resizing');
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ProfileMenu() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [profile, setProfile] = useState<OperatorProfile>(DEFAULT_PROFILE);
  const [draft, setDraft] = useState<OperatorProfile>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadOperatorProfile()
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setDraft(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const open = () => {
    setDraft(profile);
    setError(null);
    dialogRef.current?.showModal();
  };

  const update = (key: keyof OperatorProfile, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await saveOperatorProfile(draft);
      setProfile(next);
      setDraft(next);
      dialogRef.current?.close();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="profile-trigger" type="button" onClick={open} aria-label="Operator profile">
        {profile.avatarDataUrl ? (
          <img src={profile.avatarDataUrl} alt="" />
        ) : (
          <span>{profile.initials || 'OP'}</span>
        )}
        <em>
          <strong>{profile.displayName}</strong>
          <small>{profile.title}</small>
        </em>
      </button>

      <dialog className="profile-dialog" ref={dialogRef}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <header>
            <span>
              <small>OPERATOR IDENTITY</small>
              <strong>PROFILE</strong>
            </span>
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close profile">
              ×
            </button>
          </header>

          <div className="profile-avatar-editor">
            <div className="profile-avatar-preview">
              {draft.avatarDataUrl ? (
                <img src={draft.avatarDataUrl} alt="Operator avatar preview" />
              ) : (
                <span>{draft.initials || 'OP'}</span>
              )}
            </div>
            <label>
              <span>CHANGE AVATAR</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) return;
                  void avatarDataUrl(file)
                    .then((value) => update('avatarDataUrl', value))
                    .catch((avatarError) =>
                      setError(
                        avatarError instanceof Error ? avatarError.message : String(avatarError)
                      )
                    );
                }}
              />
            </label>
          </div>

          <div className="profile-fields">
            <label>
              <span>DISPLAY NAME</span>
              <input
                value={draft.displayName}
                maxLength={80}
                onChange={(event) => update('displayName', event.currentTarget.value)}
              />
            </label>
            <label>
              <span>INITIALS</span>
              <input
                value={draft.initials}
                maxLength={4}
                onChange={(event) => update('initials', event.currentTarget.value.toUpperCase())}
              />
            </label>
            <label>
              <span>TITLE</span>
              <input
                value={draft.title}
                maxLength={100}
                onChange={(event) => update('title', event.currentTarget.value)}
              />
            </label>
            <label>
              <span>ORGANIZATION</span>
              <input
                value={draft.organization}
                maxLength={100}
                onChange={(event) => update('organization', event.currentTarget.value)}
              />
            </label>
            <label>
              <span>HOME REGION</span>
              <input
                value={draft.homeRegion}
                maxLength={100}
                onChange={(event) => update('homeRegion', event.currentTarget.value)}
              />
            </label>
            <label>
              <span>TIMEZONE</span>
              <input
                value={draft.timezone}
                maxLength={80}
                onChange={(event) => update('timezone', event.currentTarget.value)}
              />
            </label>
          </div>

          <label className="profile-bio">
            <span>BIO</span>
            <textarea
              rows={3}
              maxLength={500}
              value={draft.bio}
              onChange={(event) => update('bio', event.currentTarget.value)}
            />
          </label>

          {error ? <div className="agent-error">{error}</div> : null}

          <footer>
            <span>LOCAL PROFILE · NO PROVIDER SECRETS</span>
            <button type="submit" disabled={saving}>
              {saving ? 'SAVING…' : 'SAVE PROFILE'}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
