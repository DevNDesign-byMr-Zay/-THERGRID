FROM reg.mini.dev/node:22-dev AS builder
USER root
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM reg.mini.dev/node:22
WORKDIR /app
COPY --from=builder --chown=1000:1000 /app/node_modules ./node_modules
COPY --chown=1000:1000 src ./src
COPY package.json ./
ENV NODE_ENV=production PORT=8080 SERVICE_NAME=thergrid
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "src/platform-health-service.mjs"]
