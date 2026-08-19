export const PUBLIC_ALBUM_CATEGORIES = new Set(['activity', 'club_life']);

export function isPublicAlbumCategory(category) {
  return PUBLIC_ALBUM_CATEGORIES.has(String(category || ''));
}

export function serializePublicAlbum(album) {
  if (!album || !isPublicAlbumCategory(album.category)) return null;
  const images = (Array.isArray(album.images) ? album.images : [])
    .filter((image) => typeof image?.url === 'string' && image.url)
    .map((image) => ({ id: image.id, url: image.url }));
  if (images.length === 0) return null;
  return {
    id: album.id,
    title: album.title || '',
    date: album.date || '',
    category: album.category,
    location: album.location || '',
    description: album.description || '',
    images,
  };
}
