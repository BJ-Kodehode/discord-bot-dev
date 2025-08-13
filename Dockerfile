# Bruk den offisielle Node-versjonen
FROM node:22-alpine

# Sett arbeidskatalog i containeren
WORKDIR /app

# Kopier package.json og låsfil for å kunne installere dependencies
COPY package.json package-lock.json ./

RUN npm ci --only=production

# Kopier resten av koden
COPY . .

# Exponer Discord-bot vanligvis via nettverksport kun internt; Discord bruker websocket, så ingen port behøves kanskje
# EXPOSE 3000

# Kommando for å starte boten
CMD ["node", "index.js"]
