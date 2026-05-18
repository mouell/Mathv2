FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
RUN npm run db:generate || true
RUN mkdir -p logs
EXPOSE 3001
CMD ["node", "dist/index.js"]
