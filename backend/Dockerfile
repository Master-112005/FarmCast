FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY src ./src
COPY migrations ./migrations
COPY seeders ./seeders
COPY .sequelizerc ./

RUN mkdir -p uploads && chown -R node:node /app

USER node

EXPOSE 5000

CMD ["sh", "-c", "npm run migrate && npm start"]
