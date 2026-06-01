FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development
ENV DB_HOST=host.docker.internal
ENV MQTT_BROKER_URL=mqtt://host.docker.internal:2883
ENV ML_SERVICE_URL=http://host.docker.internal:8000

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY .env ./
COPY src ./src
COPY migrations ./migrations
COPY seeders ./seeders
COPY .sequelizerc ./

RUN mkdir -p uploads && chown -R node:node /app

USER node

EXPOSE 5000

CMD ["npm", "start"]
