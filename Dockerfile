# Образ для размещения онлайн. Данные (база, секрет сессий, исходящие письма) — в /data; постоянный диск подключает хостинг.
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8787 FAZA_DATA_DIR=/data
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
