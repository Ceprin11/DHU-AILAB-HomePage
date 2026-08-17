export const hasBilibiliVideoId = (value = '') => /BV[0-9A-Za-z]{10}/i.test(String(value));

export const findBilibiliVideoUrl = (...values) => values.find((value) => hasBilibiliVideoId(value)) || '';

export const getBilibiliThumbnailSource = (value = '') => {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (hostname.endsWith('.hdslb.com') || hostname.endsWith('.biliimg.com')) {
      return `/api/bilibili/cover?${new URLSearchParams({ url: url.href })}`;
    }
  } catch {
    // Local upload paths are intentionally returned unchanged.
  }
  return value;
};
