FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

RUN npm install pm2 -g

COPY . .

COPY ecosystem.config.cjs-sample ecosystem.config.cjs

EXPOSE 3000

CMD [ "pm2-runtime", "start", "ecosystem.config.cjs", "--raw" ]