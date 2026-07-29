FROM node:22-bookworm-slim

WORKDIR /app

# yt-dlp / ffmpeg helpers often need these at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
