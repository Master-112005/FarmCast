FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p uploads/community uploads/predictors uploads/profiles && \
    chown -R node:node /app/uploads

USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
