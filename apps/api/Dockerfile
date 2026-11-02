FROM node:20-alpine
WORKDIR /repo
COPY . .
RUN npm install
WORKDIR /repo/apps/api
CMD ["npx","tsx","src/server.ts"]
