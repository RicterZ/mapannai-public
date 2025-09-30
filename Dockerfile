FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ARG NEXT_PUBLIC_MAPBOX_STYLE
ARG NEXT_PUBLIC_IMAGE_DOMAINS

ENV NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ENV NEXT_PUBLIC_MAPBOX_STYLE=$NEXT_PUBLIC_MAPBOX_STYLE
ENV NEXT_PUBLIC_IMAGE_DOMAINS=$NEXT_PUBLIC_IMAGE_DOMAINS

COPY package*.json ./

RUN npm ci --silent

COPY . .

RUN npm run build

FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p ./public
COPY --from=builder /app/public/ ./public/

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]