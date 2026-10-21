FROM node:24-slim

WORKDIR /app

# Dependencies first so this layer stays cached until package.json changes.
# (package-lock.json is gitignored in this repo, so `npm ci` is not an option.)
COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
