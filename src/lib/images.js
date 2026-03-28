export function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img) => typeof img === 'string')
    .map((img) => img.trim())
    .filter(Boolean);
}

export function getPrimaryImage(images) {
  const normalized = normalizeImages(images);
  return normalized.length ? normalized[0] : null;
}

