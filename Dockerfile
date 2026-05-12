FROM node:20-slim

WORKDIR /app

# Install build tools needed for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

RUN mkdir -p /data
ENV DB_PATH=/data/leads.db
ENV NODE_ENV=production

EXPOSE 8080

CMD ["npm", "start"]
