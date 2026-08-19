export function getAlbumPhotos(album) {
  if (!Array.isArray(album?.images)) return [];
  return album.images.filter((image) => image?.id && image?.url);
}

export function getFeaturedHomePhotos(albums) {
  return (albums || []).flatMap((album) => getAlbumPhotos(album)
    .filter((image) => image.is_home_featured === true)
    .map((image) => ({
      id: `${album.id}:${image.id}`,
      url: image.url,
      alt: album.title || '实验室相册照片',
      albumId: album.id,
      photoId: image.id,
    })));
}
