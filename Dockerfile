# Образ для размещения онлайн. Данные (база, секрет сессий, исходящие письма) — в томе /data.
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8787 FAZA_DATA_DIR=/data
VOLUME /data
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
