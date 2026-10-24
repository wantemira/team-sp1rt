# --- ЭТАП 1: СБОРКА ---
# Берем официальный образ Node.js (версия 20 на легком Alpine Linux)
FROM node:20-alpine AS build

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
FROM nginx:alpine

# Копируем наш конфиг Nginx (из Шага 2) в контейнер
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем готовую сборку (папку dist) из первого этапа в папку Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Открываем порт 80 (стандартный порт для сайтов)
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]