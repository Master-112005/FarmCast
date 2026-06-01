FROM node:20-bookworm-slim AS build

WORKDIR /app

ARG VITE_API_URL=http://localhost:5000/api/v1
ARG VITE_API_BASE_URL=http://localhost:5000/api
ARG VITE_API_ROOT_URL=http://localhost:5000
ARG VITE_SOCKET_URL=http://localhost:5000

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_ROOT_URL=${VITE_API_ROOT_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}

COPY package*.json ./
RUN npm ci

COPY index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM nginx:1.27-alpine

RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '}' \
  > /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
