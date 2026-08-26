# Anlora sunucusu.
#
# İKİ AŞAMALI: derleme araçları (TypeScript, Vite, esbuild) son imaja
# girmiyor. Böylece çalışan imaj hem küçük hem de içinde gereksiz araç
# barındırmadığı için saldırı yüzeyi dar.

# --- 1. Derleme ---
FROM node:22-slim AS derleme
WORKDIR /app

# Önce yalnızca bağımlılık dosyaları kopyalanır: kaynak kod değiştiğinde
# npm katmanı önbellekten gelir ve derleme dakikalarca kısalır.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- 2. Çalıştırma ---
FROM node:22-slim AS calisma
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Derlenmiş sunucu ve web arayüzü
COPY --from=derleme /app/dist ./dist

# Kullanıcı verisi buraya yazılır ve KALICI OLMALIDIR. Barındırma
# hizmetinde bu yola bir disk (volume) bağlanmazsa hesaplar, sözlük ve
# yedekler her yeniden başlatmada silinir.
VOLUME ["/app/data"]

# root olarak çalıştırmamak gerekir: bir açık bulunursa saldırganın
# yapabilecekleri sınırlı kalsın.
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Sağlık kontrolü: barındırma hizmeti sunucunun ayakta olduğunu buradan
# anlar ve düşerse yeniden başlatır.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.cjs"]
