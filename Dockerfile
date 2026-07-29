FROM node:22-bookworm-slim

WORKDIR /app

# Build tools for @discordjs/opus; curl/unzip for yt-dlp + deno
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    curl \
    unzip \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Latest yt-dlp (youtube-dl-exec's bundled binary can be stale)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Deno is required by modern yt-dlp for YouTube JS / nsig challenges
RUN curl -fsSL https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip \
      -o /tmp/deno.zip \
    && unzip -o /tmp/deno.zip -d /usr/local/bin \
    && chmod a+rx /usr/local/bin/deno \
    && rm /tmp/deno.zip

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV YTDLP_PATH=/usr/local/bin/yt-dlp

CMD ["node", "src/index.js"]
