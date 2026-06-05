# Tramites Diamante

Plataforma web B2B para clientes mayoristas (papelerias) que solicitan actas en PDF
(nacimiento, matrimonio, defuncion) usando un **sistema de creditos**
(1 MXN = 1 credito).

> Stack: **Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL + NextAuth + S3 + Nodemailer + WhatsApp pluggable**.

---

## 1. Arquitectura

```
+---------------------+        +----------------------+
|  Cliente mayorista  |        |     Administrador    |
|   /dashboard/...    |        |        /admin/...    |
+----------+----------+        +-----------+----------+
           |                               |
           |        Next.js App Router     |
           |        (UI + API Routes)      |
           v                               v
+--------------------------------------------------------+
|                 Capa API (src/app/api)                 |
|  auth, pedidos, recargas, creditos, config, stats,     |
|  notificaciones, uploads/presign                       |
+----------+--------------------+----------+-------------+
           |                    |          |
           v                    v          v
     +----------+         +----------+   +-----------+
     | Prisma   |         |   S3     |   | SMTP      |
     | Postgres |         | bucket   |   | Nodemailer|
     +----------+         +----------+   +-----------+
                                |
                                v
                     +----------------------+
                     | WhatsApp (pluggable) |
                     | walink / Meta / Twilio
                     +----------------------+
                                |
                                v
                        +----------------+
                        |   Proveedor    |
                        | /proveedor/... |
                        +----------------+
```

### Decisiones clave

- **Auth**: NextAuth con CredentialsProvider + JWT en cookie httpOnly, bcryptjs.
  Sesiones de 8 horas. RBAC en `src/middleware.ts` + helpers en `src/lib/rbac.ts`.
- **Estado**: PostgreSQL via Prisma. Schema completo en `prisma/schema.prisma`.
- **Creditos**: Todo movimiento (alta, cargo, reembolso, ajuste) crea una fila en
  `MovimientoCredito` con `saldoAntes`/`saldoDespues`. Trazabilidad total.
- **Pedidos**: Folio unico `TD-YYYY-000123`. Cobros y reembolsos en transaccion
  atomica con re-lectura del saldo para evitar race conditions.
- **PDFs**: Se suben a S3 con clave determinista `pedidos/{pedidoId}/acta.pdf`.
  La descarga **siempre** es via URL firmada de corta duracion. Nunca se expone
  el bucket key crudo.
- **WhatsApp**: Driver pluggable (`WHATSAPP_DRIVER=walink|meta|twilio`). Por defecto
  arranca con `walink` (genera URL `wa.me`) para poder probar sin contratar API.
- **Horario**: Configurable desde admin. Bloqueo en API de crear pedido (HTTP 423).
  Endpoint publico `/api/horario` para que el frontend muestre el aviso.
- **Logs**: `LogAccion` registra cada operacion sensible (crear pedido, cambiar
  estado, aprobar recarga, ajustar creditos, etc.) con actor, IP y user-agent.

---

## 2. Estructura de archivos

```
tramites-diamante/
├─ prisma/
│  ├─ schema.prisma          # 9 modelos + enums (ver mas abajo)
│  └─ seed.ts                # Admin + Proveedor + Cliente demo
├─ src/
│  ├─ middleware.ts          # RBAC global + redireccion login
│  ├─ types/next-auth.d.ts   # Augmenta tipos de sesion
│  ├─ lib/
│  │  ├─ prisma.ts           # Cliente Prisma singleton
│  │  ├─ auth.ts             # NextAuth config (Credentials)
│  │  ├─ rbac.ts             # requireSession / requireRole / withAuth
│  │  ├─ config.ts           # Helpers de ConfigSistema
│  │  ├─ curp.ts             # Validacion CURP (regex + digito verificador)
│  │  ├─ schedule.ts         # Horario de servicio con dayjs+tz
│  │  ├─ email.ts            # Nodemailer + plantilla acta lista
│  │  ├─ whatsapp.ts         # Driver pluggable walink/meta/twilio
│  │  ├─ folio.ts            # Generador TD-YYYY-NNNNNN / RC-YYYY-NNNNNN
│  │  ├─ storage.ts          # S3 wrapper + validacion PDF magic bytes
│  │  └─ logger.ts           # logAccion -> tabla LogAccion
│  └─ app/
│     ├─ layout.tsx, page.tsx, globals.css
│     └─ api/
│        ├─ auth/[...nextauth]/route.ts
│        ├─ me/route.ts                  # GET perfil + creditos
│        ├─ horario/route.ts             # GET estado servicio (publico)
│        ├─ registro/route.ts            # POST registro publico (queda PENDIENTE)
│        ├─ notificaciones/route.ts      # GET listar / PATCH marcar leidas
│        ├─ uploads/presign/route.ts     # POST URL firmada subir comprobante
│        ├─ pedidos/
│        │  ├─ route.ts                  # GET listar / POST crear (+ creditos +
│        │  │                            #   horario + CURP + WhatsApp)
│        │  └─ [id]/
│        │     ├─ route.ts               # GET detalle + historial
│        │     ├─ estado/route.ts        # PATCH cambiar estado (admin/proveedor)
│        │     └─ pdf/route.ts           # GET URL firmada descarga (solo dueno)
│        ├─ proveedor/
│        │  └─ upload/route.ts           # POST subir PDF -> estado LISTO + email
│        └─ admin/
│           ├─ clientes/route.ts                       # GET listar / POST alta
│           ├─ clientes/[id]/route.ts                  # GET / PATCH / DELETE
│           ├─ clientes/[id]/creditos/route.ts         # POST ajuste / GET historial
│           ├─ recargas/route.ts                       # GET / POST
│           ├─ recargas/[id]/route.ts                  # PATCH aprobar/rechazar
│           ├─ config/route.ts                         # GET / PATCH config sistema
│           └─ stats/route.ts                          # GET metricas dashboard
└─ uploads_local/             # carpeta placeholder (no se usa con S3)
```

### Modelos Prisma

| Modelo | Proposito |
|---|---|
| `User` | Usuarios de los 3 roles (CLIENTE/ADMIN/PROVEEDOR) con `status` (PENDIENTE/APROBADO/SUSPENDIDO/ELIMINADO) |
| `Cliente` | Perfil B2B (razon social, RFC, telefono, **saldo de creditos**) |
| `Pedido` | Folio unico, tipo de acta, CURP validada, costo cobrado, estado, archivo PDF |
| `PedidoHistorial` | Timeline de cambios de estado por actor |
| `Recarga` | Solicitud de recarga (PENDIENTE -> APROBADA/RECHAZADA) con comprobante |
| `MovimientoCredito` | Libro mayor de todos los movimientos (saldoAntes/saldoDespues) |
| `ConfigSistema` | Singleton: horario, zona, costos, WhatsApp, plantillas |
| `Notificacion` | Notificaciones in-app por usuario |
| `LogAccion` | Audit log de operaciones sensibles |

---

## 3. Reglas de negocio implementadas

### Flujo de un pedido (POST `/api/pedidos`)
1. Verifica que el usuario sea CLIENTE.
2. Lee `ConfigSistema`, calcula horario en la zona configurada (default
   America/Mexico_City). Si esta cerrado responde **HTTP 423** con mensaje.
3. Valida CURP (18 chars, regex oficial, entidad federativa de lista cerrada,
   digito verificador).
4. Calcula costo segun tipo de acta (desde `ConfigSistema`).
5. Si el saldo es menor: **HTTP 402** con `requeridos` / `disponibles`.
6. Genera folio unico `TD-YYYY-NNNNNN`.
7. **Transaccion atomica**: re-lee saldo, crea Pedido, descuenta creditos,
   crea MovimientoCredito (`CARGO_PEDIDO` con saldos antes/despues),
   crea PedidoHistorial inicial, crea Notificacion.
8. Notifica al proveedor por WhatsApp (driver configurado).
9. Registra `LogAccion` con IP/user-agent.

### Subida de PDF (POST `/api/proveedor/upload`)
1. Solo PROVEEDOR o ADMIN.
2. Valida que el pedido este en PENDIENTE o EN_PROCESO.
3. Valida magic bytes `%PDF-` (rechaza archivos disfrazados).
4. Limite 20 MB.
5. Sube a S3 con SSE-AES256 y metadatos del pedido.
6. Transaccion: marca pedido como LISTO, crea PedidoHistorial, Notificacion.
7. Envia email al cliente con URL firmada de 1h.

### Descarga (GET `/api/pedidos/:id/pdf`)
- Solo dueno del pedido, ADMIN o PROVEEDOR.
- Solo si el pedido esta LISTO.
- Devuelve URL firmada de corta duracion (`S3_SIGNED_URL_TTL`, default 300s).
- Registra cada descarga en `LogAccion`.

### Reembolsos
Cuando admin pasa un pedido a RECHAZADO o CANCELADO desde un estado que no es
LISTO, automaticamente se reembolsan los creditos cobrados al cliente (con
movimiento `REEMBOLSO`).

---

## 4. Instalacion local

### Requisitos
- Node.js 18+ (recomendado 20 LTS)
- PostgreSQL 14+ (local, Docker o servicio gestionado)
- Cuenta AWS con bucket S3 (o R2/MinIO compatible)
- Cuenta SMTP (Gmail con app password sirve para empezar)

### Pasos

```powershell
# 1. Instalar dependencias
cd C:\Users\SPIN\centralunlock\tramites-diamante
npm install

# 2. Variables de entorno
Copy-Item .env.example .env.local
# Editar .env.local con tus credenciales reales

# 3. Crear DB y aplicar migraciones
npx prisma migrate dev --name init
# Esto crea la primera migracion y aplica el schema

# 4. Cargar datos iniciales (admin, proveedor, cliente demo)
npm run seed

# 5. Levantar el servidor
npm run dev
# http://localhost:3000
```

### Credenciales por defecto (cambialas en produccion)
- Admin:     `admin@tramitesdiamante.mx` / `Diamante123!`
- Proveedor: `proveedor@tramitesdiamante.mx` / `Proveedor123!`
- Cliente:   `demo@papeleria.mx` / `Cliente123!` (500 creditos de regalo)

---

## 5. Despliegue en produccion

### Opcion A — Railway (mas simple, recomendada)

1. **Postgres**: `railway add` -> Postgres. Te da `DATABASE_URL`.
2. **App**: en `package.json` ya esta `prisma generate` en el build.
   En el panel de Railway:
   - Variables: copia todo lo de `.env.example` con valores reales.
   - Start command: `npm run start`
   - Build command: `npm run build`
3. Antes del primer deploy ejecuta migraciones: `railway run npx prisma migrate deploy`
   y luego `railway run npm run seed`.
4. **NEXTAUTH_URL** debe ser el dominio publico (`https://xxx.up.railway.app`).

### Opcion B — Vercel + Postgres gestionado (Neon / Supabase)

1. Crea Postgres en Neon o Supabase, copia el connection string.
2. `vercel link` y `vercel env add` para cargar las variables del `.env.example`.
3. Vercel detecta Next.js automaticamente. El build hara `prisma generate`.
4. Despues del primer deploy ejecuta migraciones desde tu maquina:
   `DATABASE_URL=... npx prisma migrate deploy`
5. Asegura `NEXTAUTH_URL=https://tu-app.vercel.app`.

### Opcion C — VPS (Hetzner, DigitalOcean) + PM2 + Nginx

```bash
# En el servidor (Ubuntu)
git clone <tu-repo>
cd tramites-diamante
npm ci
cp .env.example .env.production
nano .env.production   # llena valores reales
npm run build
npx prisma migrate deploy
npm run seed   # solo la primera vez
npm i -g pm2
pm2 start "npm run start" --name tramites-diamante
pm2 save && pm2 startup

# Nginx (resumen)
# server { listen 443 ssl; server_name tramites.tu-dominio.mx;
#   location / { proxy_pass http://127.0.0.1:3000; ... } }
# certbot --nginx -d tramites.tu-dominio.mx
```

### S3 — bucket recomendado

```bash
aws s3api create-bucket --bucket tramites-diamante --region us-east-1
aws s3api put-bucket-encryption --bucket tramites-diamante \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket tramites-diamante \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

CORS minimo para que los presigned PUT funcionen desde el navegador:

```json
[{
  "AllowedOrigins": ["https://tu-dominio.mx"],
  "AllowedMethods": ["PUT", "GET"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3000
}]
```

Si prefieres Cloudflare R2: setea `S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`
y `S3_FORCE_PATH_STYLE=true`. Todo lo demas funciona igual.

---

## 6. WhatsApp — escalando del MVP

Por defecto el sistema arranca con `WHATSAPP_DRIVER=walink`, que genera un
enlace `wa.me/{telefono}?text=...` con el mensaje prellenado. El admin/proveedor
hace click y envia desde su WhatsApp. **No requiere API.**

Cuando quieras enviar automatico:

### Meta Cloud API
1. Crea una app en developers.facebook.com -> WhatsApp.
2. Configura un numero de telefono de negocio.
3. Crea una **plantilla** aprobada en es_MX con 4 variables (folio, tipo, curp, cliente).
4. Setea:
   ```
   WHATSAPP_DRIVER=meta
   WHATSAPP_META_TOKEN=...
   WHATSAPP_META_PHONE_NUMBER_ID=...
   WHATSAPP_META_TEMPLATE_NAME=pedido_diamante
   ```

### Twilio
```
WHATSAPP_DRIVER=twilio
WHATSAPP_TWILIO_SID=ACxxx
WHATSAPP_TWILIO_TOKEN=xxx
WHATSAPP_TWILIO_FROM=+14155238886
```

---

## 7. Endpoints (resumen)

| Metodo | Ruta | Rol | Proposito |
|---|---|---|---|
| GET  | `/api/horario` | publico | Estado del servicio |
| POST | `/api/registro` | publico | Solicitud de alta (queda PENDIENTE) |
| GET  | `/api/me` | autenticado | Perfil + creditos |
| GET  | `/api/notificaciones` | autenticado | Listar notificaciones |
| PATCH| `/api/notificaciones` | autenticado | Marcar leidas |
| POST | `/api/uploads/presign` | autenticado | URL firmada upload |
| GET  | `/api/pedidos` | autenticado | Listar (cliente solo los suyos) |
| POST | `/api/pedidos` | CLIENTE | Crear pedido (con horario+creditos+CURP+WA) |
| GET  | `/api/pedidos/:id` | autenticado | Detalle + historial |
| PATCH| `/api/pedidos/:id/estado` | ADMIN/PROVEEDOR | Cambiar estado |
| GET  | `/api/pedidos/:id/pdf` | dueno/ADMIN | URL firmada de descarga |
| POST | `/api/proveedor/upload` | PROVEEDOR/ADMIN | Subir PDF -> LISTO |
| GET  | `/api/admin/clientes` | ADMIN | Listar clientes |
| POST | `/api/admin/clientes` | ADMIN | Alta directa |
| GET  | `/api/admin/clientes/:id` | ADMIN | Detalle |
| PATCH| `/api/admin/clientes/:id` | ADMIN | Aprobar/suspender/editar |
| DELETE| `/api/admin/clientes/:id` | ADMIN | Eliminar (soft) |
| POST | `/api/admin/clientes/:id/creditos` | ADMIN | Ajustar saldo |
| GET  | `/api/admin/clientes/:id/creditos` | ADMIN | Historial movimientos |
| GET  | `/api/admin/recargas` | ADMIN/CLIENTE | Listar recargas |
| POST | `/api/admin/recargas` | ADMIN/CLIENTE | Crear recarga |
| PATCH| `/api/admin/recargas/:id` | ADMIN | Aprobar/rechazar |
| GET  | `/api/admin/config` | ADMIN | Ver config |
| PATCH| `/api/admin/config` | ADMIN | Editar horario, costos, WhatsApp, etc. |
| GET  | `/api/admin/stats` | ADMIN | Metricas dashboard |

---

## 8. UI completa

Todas las pantallas estan construidas:

**Publicas:** `/`, `/login`, `/registro`
**Cliente:** `/cliente/dashboard`, `/cliente/pedidos`, `/cliente/pedidos/nuevo`,
`/cliente/pedidos/[id]`, `/cliente/recargas`
**Admin:** `/admin`, `/admin/clientes`, `/admin/clientes/[id]`, `/admin/pedidos`,
`/admin/recargas`, `/admin/config`
**Proveedor:** `/proveedor`

Despues del login el usuario es redirigido automaticamente segun su rol. El
navbar muestra solo las opciones de su rol. Diseno responsive con Tailwind.

## 9. Deploy en linea — paso a paso

### Railway (recomendado, 5 minutos)

1. Crea cuenta en railway.app y conecta tu repo.
2. Anade Postgres: **New -> Database -> Postgres**. Copia `DATABASE_URL`.
3. **New -> GitHub Repo -> tramites-diamante** (Railway detecta `railway.json`).
4. En el servicio **Variables**, pega tu `.env.example` con valores reales.
   Critico: `DATABASE_URL`, `NEXTAUTH_URL` (= dominio Railway), `NEXTAUTH_SECRET`
   (`openssl rand -base64 32`).
5. Genera el dominio publico (Settings -> Networking -> Generate Domain).
6. Railway corre automaticamente `prisma migrate deploy` en cada deploy.
7. La primera vez, abre el shell: `railway run npm run seed`.
8. Login con credenciales del seed. Listo.

### Docker local / VPS

```bash
docker-compose up -d --build
# Levanta Postgres + MinIO (S3 local) + app
# El primer arranque ejecuta migraciones y seed automaticamente.
# http://localhost:3000 - app
# http://localhost:9001 - consola MinIO (minioadmin / minioadmin)
#   Crea el bucket "tramites-diamante" manualmente desde la consola.
```

Para un VPS de produccion sustituye MinIO por AWS S3 / R2 y agrega Nginx +
Certbot como reverse proxy hacia el container del app.

### Vercel + Neon

1. Crea Postgres en neon.tech, copia `DATABASE_URL`.
2. `vercel link` en el directorio del proyecto.
3. `vercel env add` para cada variable del `.env.example`.
4. `vercel deploy --prod`.
5. Desde tu maquina con la `DATABASE_URL` de Neon:
   ```bash
   npx prisma migrate deploy
   npm run seed
   ```

### Variables criticas para que arranque
| Variable | Donde | Ejemplo |
|---|---|---|
| `DATABASE_URL` | DB | `postgresql://user:pw@host:5432/db?schema=public` |
| `NEXTAUTH_URL` | dominio publico | `https://tramites.tu-dominio.mx` |
| `NEXTAUTH_SECRET` | aleatorio | `openssl rand -base64 32` |
| `S3_BUCKET`+keys | almacenamiento | bucket privado con SSE-AES256 |
| `SMTP_*` | opcional | sin esto, los emails se omiten silenciosamente |
| `WHATSAPP_PROVIDER_PHONE` | opcional | E.164 sin +, ej `5215555555555` |

---

## 10. Checklist de seguridad implementado

- [x] Contrasenas con bcrypt (12 rounds)
- [x] Sesiones JWT en cookie httpOnly via NextAuth
- [x] RBAC en middleware + por endpoint con `requireRole`
- [x] Validacion estricta de inputs con Zod en todos los POST/PATCH
- [x] CURP validada por regex + digito verificador
- [x] Headers de seguridad (X-Frame-Options, X-Content-Type-Options, etc.)
- [x] PDFs nunca expuestos publicamente — solo URL firmada efimera
- [x] Magic bytes en archivos PDF para evitar subir disfrazados
- [x] SSE-AES256 en S3
- [x] Logs de auditoria con actor + IP + UA
- [x] Saldo de creditos re-leido dentro de transaccion para evitar race condition
- [x] Registro de clientes requiere aprobacion de admin
- [x] Bloqueo de pedidos fuera de horario

Pendiente para produccion: rate limit (Upstash Redis o middleware), CSRF si
expones formularios fuera del dominio principal, y rotacion de
`NEXTAUTH_SECRET`.

---

## 11. Licencia

Propietario. Uso interno de Tramites Diamante.
