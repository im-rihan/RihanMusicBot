const play = require('play-dl');
const { createLogger } = require('../utils/logger');

const logger = createLogger('resolver');

function detectSource(query) {
  if (/spotify\.com/i.test(query)) return 'spotify';
  if (/soundcloud\.com/i.test(query)) return 'soundcloud';
  if (/youtube\.com|youtu\.be/i.test(query)) return 'youtube';
  return 'search';
}

function normalizeTrack(raw, requestedBy, source) {
  return {
    title: raw.title || raw.name || 'Unknown Title',
    url: raw.url || raw.video_url || raw.link,
    duration: (raw.durationInSec || raw.duration || 0) * (raw.durationInSec ? 1000 : (raw.duration > 10000 ? 1 : 1000)),
    thumbnail: raw.thumbnails?.[0]?.url || raw.thumbnail?.url || raw.thumbnail || null,
    channel: raw.channel?.name || raw.artist || raw.uploader || 'Unknown',
    requestedBy,
    source,
  };
}

async function resolveYouTubeUrl(url, requestedBy) {
  const info = await play.video_info(url);
  const details = info.video_details;
  return [
    {
      title: details.title,
      url: details.url,
      duration: (details.durationInSec || 0) * 1000,
      thumbnail: details.thumbnails?.[details.thumbnails.length - 1]?.url || null,
      channel: details.channel?.name || 'Unknown',
      requestedBy,
      source: 'YouTube',
    },
  ];
}

async function resolveYouTubePlaylist(url, requestedBy) {
  const playlist = await play.playlist_info(url, { incomplete: true });
  const videos = await playlist.all_videos();
  return videos.map((v) => ({
    title: v.title,
    url: v.url,
    duration: (v.durationInSec || 0) * 1000,
    thumbnail: v.thumbnails?.[v.thumbnails.length - 1]?.url || null,
    channel: v.channel?.name || 'Unknown',
    requestedBy,
    source: 'YouTube',
  }));
}

async function searchYouTube(query, requestedBy, limit = 1) {
  const results = await play.search(query, { limit, source: { youtube: 'video' } });
  return results.map((r) => ({
    title: r.title,
    url: r.url,
    duration: (r.durationInSec || 0) * 1000,
    thumbnail: r.thumbnails?.[r.thumbnails.length - 1]?.url || null,
    channel: r.channel?.name || 'Unknown',
    requestedBy,
    source: 'YouTube',
  }));
}

async function resolveSpotify(url, requestedBy) {
  if (play.is_expired()) {
    try {
      await play.refreshToken();
    } catch (err) {
      logger.warn('Spotify token refresh failed, falling back to search:', err.message);
    }
  }

  const sp = await play.spotify(url);

  if (sp.type === 'track') {
    const query = `${sp.artists?.[0]?.name || ''} ${sp.name}`.trim();
    const yt = await searchYouTube(query, requestedBy, 1);
    if (yt[0]) {
      yt[0].title = `${sp.artists?.[0]?.name || 'Unknown'} - ${sp.name}`;
      yt[0].source = 'Spotify';
      yt[0].thumbnail = sp.thumbnail?.url || yt[0].thumbnail;
    }
    return yt;
  }

  if (sp.type === 'playlist' || sp.type === 'album') {
    const tracks = [];
    const all = await sp.all_tracks();
    for (const t of all.slice(0, 50)) {
      const query = `${t.artists?.[0]?.name || ''} ${t.name}`.trim();
      try {
        const yt = await searchYouTube(query, requestedBy, 1);
        if (yt[0]) {
          yt[0].title = `${t.artists?.[0]?.name || 'Unknown'} - ${t.name}`;
          yt[0].source = 'Spotify';
          tracks.push(yt[0]);
        }
      } catch (err) {
        logger.warn(`Failed to resolve Spotify track: ${query}`, err.message);
      }
    }
    return tracks;
  }

  return [];
}

async function resolveSoundCloud(url, requestedBy) {
  const so = await play.soundcloud(url);
  if (so.type === 'track') {
    return [
      {
        title: so.name,
        url: so.url,
        duration: (so.durationInMs || 0),
        thumbnail: so.thumbnail || null,
        channel: so.user?.name || 'SoundCloud',
        requestedBy,
        source: 'SoundCloud',
      },
    ];
  }
  if (so.type === 'playlist') {
    const tracks = await so.all_tracks();
    return tracks.map((t) => ({
      title: t.name,
      url: t.url,
      duration: t.durationInMs || 0,
      thumbnail: t.thumbnail || null,
      channel: t.user?.name || 'SoundCloud',
      requestedBy,
      source: 'SoundCloud',
    }));
  }
  return [];
}

async function resolveQuery(query, requestedBy) {
  const source = detectSource(query);

  if (source === 'youtube') {
    if (play.yt_validate(query) === 'playlist') {
      return resolveYouTubePlaylist(query, requestedBy);
    }
    if (play.yt_validate(query) === 'video') {
      return resolveYouTubeUrl(query, requestedBy);
    }
  }

  if (source === 'spotify') {
    return resolveSpotify(query, requestedBy);
  }

  if (source === 'soundcloud') {
    return resolveSoundCloud(query, requestedBy);
  }

  return searchYouTube(query, requestedBy, 1);
}

async function searchRelated(track) {
  try {
    const results = await play.search(`${track.title} ${track.channel}`, {
      limit: 5,
      source: { youtube: 'video' },
    });
    const next = results.find((r) => r.url !== track.url);
    if (!next) return null;
    return {
      title: next.title,
      url: next.url,
      duration: (next.durationInSec || 0) * 1000,
      thumbnail: next.thumbnails?.[next.thumbnails.length - 1]?.url || null,
      channel: next.channel?.name || 'Unknown',
      requestedBy: track.requestedBy,
      source: 'Autoplay',
    };
  } catch (err) {
    logger.warn('Related search failed:', err.message);
    return null;
  }
}

module.exports = {
  detectSource,
  resolveQuery,
  searchYouTube,
  searchRelated,
  normalizeTrack,
};
