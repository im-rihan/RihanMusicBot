/**
 * Bot profile / About Me / presence branding.
 * Application description is applied on startup via the Discord API.
 */
module.exports = {
  // Shown as the bot's About Me / application description (max 400 chars)
  description: [
    'Rihan Music — your private Discord music bot.',
    '',
    'Play YouTube, Spotify links & SoundCloud.',
    'Queue • Loop • Shuffle • Filters • 24/7 • DJ roles',
    '',
    'Try /play  ·  /help for all commands',
    'github.com/im-rihan/RihanMusicBot',
  ].join('\n'),

  // Short line for embeds / help
  tagline: 'Private Discord music bot — YouTube, Spotify & SoundCloud',

  // Discord presence (Listening to …)
  activity: '/play • Rihan Music',

  // App Directory style tags (max 5, each max 20 chars)
  tags: ['music', 'youtube', 'entertainment', 'audio', 'fun'],

  // Support / links (optional display)
  github: 'https://github.com/im-rihan/RihanMusicBot',
  inviteHint: 'Invite with bot + applications.commands scopes',
};
