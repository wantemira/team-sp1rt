# --- ЭТАП 1: СБОРКА ---
# Берем официальный образ Node.js (версия 20 на легком Alpine Linux)
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS build

# Создаем рабочую папку внутри контейнера
WORKDIR /app

# Копируем только файлы с зависимостями
COPY package*.json ./

# Устанавливаем зависимости (npm ci — это чистая установка, как npm install)
RUN npm ci

# Копируем весь остальной код проекта
COPY . .

# Собираем проект (Vite создаст папку dist)
RUN npm run build


# --- ЭТАП 2: ЗАПУСК ---
# Берем официальный образ Nginx
FROM nginx:alpine@sha256:a3554c0d0b48177b1413c26e01f695334428020d9df01243fbae3e11cfd17417

# Копируем наш конфиг Nginx (из Шага 2) в контейнер
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем готовую сборку (папку dist) из первого этапа в папку Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Открываем порт 80 (стандартный порт для сайтов)
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]