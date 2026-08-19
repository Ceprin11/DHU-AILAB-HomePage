export function applyHomeSelectionPolicy(role, nextImages = [], previousImages = []) {
  if (role === 'admin') return nextImages;
  const previousSelection = new Map(previousImages.map((image) => [image.id, image.is_home_featured === true]));
  return nextImages.map((image) => ({
    ...image,
    is_home_featured: previousSelection.get(image.id) === true,
  }));
}
