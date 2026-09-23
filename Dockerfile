FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY src ./src
COPY scripts/runtime-service.mjs ./scripts/runtime-service.mjs

ENV NODE_ENV=production
ENV THERGRID_PORT=8080
ENV THERGRID_LOG_LEVEL=info

EXPOSE 8080

USER node

CMD ["npm", "run", "start:runtime"]
