# Usa la imagen oficial de Bun
FROM oven/bun:1 AS base

# Directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Configura el entorno para desarrollo
FROM base AS dev
# Copia solo los archivos necesarios para instalar las dependencias
COPY package.json bun.lockb ./
# Instala dependencias (incluye devDependencies)
RUN bun install
# Expone el puerto
EXPOSE 7555/tcp
# Activa el servidor
CMD ["bun", "run", "index.ts"]

# Configura el entorno para producción
FROM base AS prod
# Copia los archivos de producción (sin devDependencies)
COPY package.json bun.lockb ./
RUN bun install --production
# Copia el código fuente
COPY . .
# Expone el puerto
EXPOSE 7555/tcp
# Activa el servidor
CMD ["bun", "run", "index.ts"]
