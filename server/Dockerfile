# Usa la imagen oficial de Bun
FROM --platform=linux/arm64 oven/bun:1 AS base

# Directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Configura el entorno para desarrollo
FROM --platform=linux/arm64 base AS dev
# Copia solo los archivos necesarios para instalar las dependencias
COPY package.json bun.lockb ./
# Instala dependencias (incluye devDependencies)
RUN bun install --ignore-scripts
# Expone el puerto
EXPOSE 7555/tcp
RUN echo "Hola mundo"
# Activa el servidor
CMD ["bun", "--watch", "index.ts"]

# Configura el entorno para producción
FROM --platform=linux/arm64 base AS prod
# Copia los archivos de producción (sin devDependencies)
COPY package.json bun.lockb ./
RUN bun install --ignore-scripts --production
# Copia el código fuente
COPY . .
# Expone el puerto
EXPOSE 7555/tcp
# Activa el servidor
CMD ["bun", "run", "index.ts"]
