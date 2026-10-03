FROM node:22-alpine
WORKDIR /app
COPY package.json server.js notifier.js ./
COPY public ./public
COPY test ./test
RUN mkdir -p data
ENV PORT=3000 NODE_ENV=production
EXPOSE 3000
CMD ["node","server.js"]
