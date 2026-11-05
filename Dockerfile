FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY playfiver-proxy.js ./
CMD ["node", "playfiver-proxy.js"]
