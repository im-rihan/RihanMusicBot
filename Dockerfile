FROM node:22-bookworm-slim

WORKDIR /app

# Build tools for @discordjs/opus; python3/ca-certs for yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
