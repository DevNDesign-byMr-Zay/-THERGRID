import { useState } from 'react';

import {
  createSpatialBookmark,
  loadSpatialBookmarks,
  saveSpatialBookmarks,
  type SpatialViewBookmark
} from '../services/view-bookmarks';

interface ViewBookmarksPanelProps {
  current: Omit<SpatialViewBookmark, 'id' | 'createdAt' | 'name'>;
  onRestore(bookmark: SpatialViewBookmark): void;
}

export function ViewBookmarksPanel({
  current,
  onRestore
}: ViewBookmarksPanelProps) {
  const [bookmarks, setBookmarks] = useState<SpatialViewBookmark[]>(
    loadSpatialBookmarks
  );
  const [name, setName] = useState('');

  const save = () => {
    const trimmed = name.trim();
    const label =
      trimmed ||
      (current.scope === 'world'
        ? 'Global Live View'
        : current.target.name || current.target.id || 'Spatial View');

    const bookmark = createSpatialBookmark({
      ...current,
      name: label
    });
    const next = saveSpatialBookmarks([
      bookmark,
      ...bookmarks.filter((item) => item.name !== label)
    ]);
    setBookmarks(next);
    setName('');
  };

  const remove = (id: string) => {
    setBookmarks(saveSpatialBookmarks(bookmarks.filter((item) => item.id !== id)));
  };

  return (
    <section className="bookmark-panel">
      <span className="rail-kicker">SAVED VIEWS</span>
      <div className="bookmark-compose">
        <input
          value={name}
          maxLength={60}
          placeholder="Name current view"
          aria-label="Bookmark name"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <button type="button" onClick={save}>SAVE</button>
      </div>
      <div className="bookmark-list">
        {bookmarks.length ? (
          bookmarks.map((bookmark) => (
            <div key={bookmark.id}>
              <button
                className="bookmark-restore"
                type="button"
                onClick={() => onRestore(bookmark)}
              >
                <strong>{bookmark.name}</strong>
                <small>
                  {bookmark.scope.toUpperCase()} · {bookmark.visualMode.toUpperCase()} ·{' '}
                  {bookmark.temporalMode.toUpperCase()}
                </small>
              </button>
              <button
                className="bookmark-remove"
                type="button"
                aria-label={`Remove ${bookmark.name}`}
                onClick={() => remove(bookmark.id)}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <p>No saved spatial views.</p>
        )}
      </div>
    </section>
  );
}
