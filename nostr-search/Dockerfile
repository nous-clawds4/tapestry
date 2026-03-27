FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY src/ src/
COPY public/ public/

EXPOSE 3069

CMD ["node", "src/startup.js"]
