# Образ для размещения онлайн. Данные (база, секрет сессий, исходящие письма) — в /data; постоянный диск подключает хостинг.
FROM node:24-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# В рабочем образе нет компилятора, тестового сервера и optional peer Vitest.
FROM node:24-slim AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/content ./content
ENV NODE_ENV=production PORT=8787 FAZA_DATA_DIR=/data
EXPOSE 8787
CMD ["node", "dist-server/index.js"]
