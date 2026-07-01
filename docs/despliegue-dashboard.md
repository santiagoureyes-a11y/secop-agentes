# Despliegue del dashboard en Railway (acceso permanente para varias personas)

El código ya está preparado para esto: el backend sirve el build del frontend desde el mismo
servicio (un solo deploy, una sola URL).

**Paso 0 (antes de desplegar):** `dashboard/backend/prisma/schema.prisma` quedó temporalmente en
SQLite para seguir desarrollando localmente sin Postgres. Cambiar `provider = "sqlite"` a
`provider = "postgresql"` en el `datasource db` antes de seguir con el paso 7 de abajo.

**Nota de seguridad:** este dashboard, por decisión explícita, queda **sin login** por ahora.
Cualquiera con la URL puede ver procesos, costos y márgenes reales de la empresa. Recomendado
agregar autenticación básica pronto — avísame cuando quieras hacerlo.

## Pasos

1. **Crear cuenta en Railway**: entra a railway.app y crea una cuenta (con GitHub es lo más
   simple, porque luego conecta el repo directo).

2. **Subir este repo a GitHub** (si no lo has hecho):
   ```bash
   cd ~/secop-agentes
   git add -A
   git commit -m "Preparar despliegue del dashboard"
   gh repo create secop-agentes --private --source=. --push
   ```
   (o crea el repo manualmente en GitHub y haz `git remote add origin <url> && git push -u origin main`)

3. **Nuevo proyecto en Railway** → "New Project" → "Deploy from GitHub repo" → selecciona
   `secop-agentes`.

4. **Agregar Postgres**: dentro del proyecto, "New" → "Database" → "Add PostgreSQL". Railway
   crea automáticamente la variable `DATABASE_URL` — cópiala (la vas a necesitar también en tu
   `.env` local si quieres seguir desarrollando contra esa misma base).

5. **Variables de entorno del servicio** (en el servicio de la app, no el de Postgres, pestaña
   "Variables"):
   ```
   DATABASE_URL=<la misma de Postgres, Railway permite referenciarla automáticamente>
   PORT=4000
   CORS_ORIGIN=<la URL pública que Railway te asigne, ej. https://secop-agentes.up.railway.app>
   GERENTE_EMAIL=gerente@verdeecologico.com.co
   SMTP_HOST=smtp-relay.sendinblue.com
   SMTP_PORT=587
   SMTP_USER=b02c98001@smtp-brevo.com
   SMTP_PASS=<la misma clave SMTP de Brevo que ya tienes en tu .env local>
   SMTP_FROM=santiagoureyes@gmail.com
   ```
   Las credenciales de SECOP (`SECOP_VERDE_ECOLOGICO_USER`/`_PASS`) **no es necesario subirlas
   aquí** — solo se usan localmente para que un humano las use al loguearse manualmente.

6. **Build/start command**: Railway debería detectar automáticamente el `package.json` en la
   raíz del repo y usar `npm run build` / `npm run start`. Si no lo detecta solo, en Settings →
   "Build Command" pon `npm run build` y en "Start Command" pon `npm run start`.

7. **Generar la migración inicial contra Postgres** (una sola vez, desde tu máquina, apuntando
   ya al `DATABASE_URL` de Railway):
   ```bash
   cd ~/secop-agentes/dashboard/backend
   echo 'DATABASE_URL="<pega aquí la URL de Postgres de Railway>"' >> .env
   npx prisma migrate dev --name init_postgres
   npm run seed   # opcional: carga empresas/procesos de ejemplo
   ```
   Después de esto, súbelo a GitHub (`git add -A && git commit -m "Migración inicial Postgres" && git push`)
   para que Railway tenga la carpeta `prisma/migrations` y pueda correr `prisma migrate deploy`
   automáticamente en cada deploy (ya está en el script `start` del `package.json` raíz).

8. **Deploy**: Railway despliega automáticamente al hacer push a `main`. Cuando termine, te da
   una URL pública (Settings → "Generate Domain" si no la ves de una). Esa es la URL que puedes
   compartir — funcionará desde cualquier computador con internet.

## Próximos pasos recomendados
- Agregar login básico antes de compartir la URL ampliamente.
- Mover las credenciales de SECOP a un gestor de secretos si el equipo crece.
