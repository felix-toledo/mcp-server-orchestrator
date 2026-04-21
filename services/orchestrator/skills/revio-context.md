# REVIO — Contexto completo para LLM

## ¿Qué es Revio?

Revio es una plataforma de **comisiones por referidos** que conecta tres tipos de actores:

1. **Empresas (EMPRESA)**: negocios que quieren conseguir clientes a través de recomendadores.
2. **Recomendadores (RECOMENDADOR)**: personas que recomiendan empresas a clientes y cobran una comisión por cada venta exitosa.
3. **Administradores (ADMIN)**: equipo interno de Revio que valida documentos, gestiona liquidaciones y supervisa la plataforma.

El flujo central es: **Empresa publica → Recomendador difunde → Cliente compra → Empresa registra la venta → Revio acredita comisión al recomendador → Revio liquida cada viernes**.

---

## Stack tecnológico

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui, iron-session (cookies cifradas), AWS Amplify para Cognito.
- **Backend**: NestJS, Prisma ORM, PostgreSQL.
- **Infraestructura**: AWS Cognito (autenticación), AWS SES (emails), AWS S3 (documentos KYC), Mercado Pago (pagos de empresas).
- **Monorepo**: Yarn Workspaces. `apps/web/` (puerto 3000) y `apps/api/` (puerto 3001).

---

## Roles y permisos

| Rol            | Descripción                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `EMPRESA`      | Registra ventas, gestiona productos/servicios, ve su billetera, paga deuda de comisiones a Revio |
| `RECOMENDADOR` | Ve empresas aprobadas, difunde links con código de referido, ve sus ventas y cobros              |
| `ADMIN`        | Valida/rechaza empresas y recomendadores, ve estadísticas, descarga CSV de liquidaciones         |

Los roles se almacenan en la base de datos (`users.role`). El JWT de Cognito es validado en cada request por el `JwtAuthGuard`; el rol se lee de la DB (fuente de verdad), no del token.

---

## Flujo de autenticación

1. El usuario se registra con email/contraseña o Google OAuth vía AWS Cognito.
2. Tras el registro, el frontend llama a `POST /users/sync` (endpoint público) para crear/actualizar el usuario en la DB.
3. En el primer login, se guarda el `idToken` de Cognito en una cookie cifrada (`iron-session`).
4. Todas las llamadas al API incluyen `Authorization: Bearer <idToken>` en el header.
5. El `JwtAuthGuard` del backend valida la firma del JWT contra las JWKS públicas de Cognito y adjunta el usuario al request.
6. El `RolesGuard` verifica que el rol del usuario en DB coincida con el rol requerido por el endpoint.

### Flujo Google OAuth

```
Frontend → POST /api/auth/google-login → redirect a Cognito OAuth
→ Cognito redirige a Google → Google autentica → Cognito devuelve code
→ Frontend /api/auth/callback → intercambia code por tokens
→ Guarda sesión y sincroniza usuario con DB
```

### Emails automáticos al registrarse

- Bienvenida al usuario nuevo.
- Notificación a todos los admins de "nueva solicitud de validación".

---

## Flujo de Onboarding

Después del primer login, todos los usuarios sin perfil son redirigidos a `/onboarding`.

### Onboarding de Recomendador (`POST /onboarding/recomendador`)

El usuario debe proveer:

- Nombre, apellido, DNI (7-8 dígitos), fecha de nacimiento.
- Datos bancarios: nombre del banco + CBU (22 dígitos) **o** alias.
- Documentos KYC (subidos previamente a S3): frente del DNI, dorso del DNI, selfie.

Resultado: crea el perfil `Recommender` en DB + cuenta bancaria `BankAccount` + genera `referral_code` único. El estado inicial de validación es `pending`.

### Onboarding de Empresa (`POST /onboarding/empresa`)

El usuario debe proveer:

- Nombre de la empresa, categoría (UUID de una categoría existente).
- Descripción, teléfono, página web (opcional).
- Documentos KYC (subidos previamente a S3): constancia ARCA, constancia, DNI del titular.

Resultado: crea el perfil `Enterprise` en DB + billetera `Wallet` asociada. El estado inicial de validación es `pending`.

### Restricciones de Onboarding

- Un usuario no puede tener AMBOS perfiles (empresa + recomendador).
- No se puede repetir el onboarding si ya fue completado.
- Los documentos KYC son opcionales en el onboarding inicial, pero el Admin no puede aprobar un perfil sin ellos.

### Reenvío de documentos

- `PATCH /onboarding/kyc-documents`: permite subir nuevamente los documentos KYC si el admin los rechazó.
- `PATCH /onboarding/bank-account`: permite actualizar CBU/alias bancario.
- Tras el reenvío, se notifica a los admins con tipo `DOCS_RESUBMITTED`.

### Upload de archivos (`POST /upload`)

- El frontend sube archivos a S3 **antes** de completar el onboarding.
- El backend recibe el archivo en memoria (hasta 10 MB), lo sube a S3 y devuelve la **key** (ruta dentro del bucket).
- Esa key se guarda en el formulario y se envía al completar el onboarding.
- Requiere JWT válido.

---

## Flujo de Validación (Admin)

### Estados de validación

```
pending → approved
pending → rejected
rejected → (el usuario reenvía docs) → pending (implícito al re-llamar onboarding/kyc-documents)
```

### Endpoints del Admin

| Método | Ruta                                                | Descripción                                                                                   |
| ------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| GET    | `/admin/stats`                                      | Total de empresas y recomendadores                                                            |
| GET    | `/admin/validations`                                | Lista de todos los pendientes/aprobados/rechazados                                            |
| GET    | `/admin/validations/:id?type=EMPRESA\|RECOMENDADOR` | Detalle con URLs prefirmadas de S3 (expiran en 15 min)                                        |
| PATCH  | `/admin/validations/:id/approve?type=...`           | Aprueba el perfil, envía email al usuario                                                     |
| PATCH  | `/admin/validations/:id/reject?type=...`            | Rechaza el perfil completo                                                                    |
| PATCH  | `/admin/validations/:id/reject-docs?type=...`       | Rechaza documentos específicos, los pone en null en DB, envía email con lista de correcciones |
| PATCH  | `/admin/validations/:id/approve-alias`              | Valida manualmente el alias/CBU bancario de un recomendador                                   |

### Regla especial para aprobar un Recomendador

El admin **no puede aprobar** un recomendador que tenga datos bancarios si el alias/CBU no fue validado previamente (`alias_validated = false`). El admin debe hacer `approve-alias` primero.

### Emails automáticos en validación

- **Aprobación**: email de "¡Tu cuenta fue validada!" + notificación `VALIDATION_APPROVED`.
- **Rechazo de docs**: email con la lista de documentos a corregir + notificación `DOCS_REJECTED`.

---

## Flujo de Productos/Servicios

Solo disponible para usuarios con rol `EMPRESA` y estado de validación `approved`.

| Método | Ruta                   | Descripción                                 |
| ------ | ---------------------- | ------------------------------------------- |
| GET    | `/products`            | Lista productos/servicios de la empresa     |
| POST   | `/products`            | Crea un nuevo producto o servicio           |
| PATCH  | `/products/:id`        | Actualiza nombre, precio, descripción, etc. |
| PATCH  | `/products/:id/toggle` | Activa/desactiva un producto (`is_active`)  |
| DELETE | `/products/:id`        | Elimina el producto (204 sin body)          |

### DTO de creación

```typescript
{
  type: 'product' | 'service',  // enum PRODUCT_SERVICE
  name: string,                  // máx 60 chars
  description?: string,          // máx 255 chars
  price?: Decimal,
  shipping_condition?: string
}
```

---

## Flujo de Ventas

La empresa registra manualmente cada venta atribuida a un recomendador.

### Crear una venta (`POST /sales`)

Solo `EMPRESA`. Requiere:

```typescript
{
  recommender_id: string,   // UUID del recomendador
  total_amount: number,     // monto total de la venta
  sale_commision: number,   // tasa de comisión (0-1, ej: 0.10 = 10%)
  description?: string
}
```

El estado inicial es `pending`.

### Aprobar una venta (`PATCH /sales/:id/approve`)

Solo la empresa dueña puede aprobar su venta. Lógica dentro de una **transacción de DB**:

1. Verifica que la venta sea `pending`.
2. Calcula cuántas ventas aprobadas tiene el recomendador → determina su nivel y bonus.
3. Calcula la comisión: `total_amount × enterprise.commission_rate × (1 + bonus)`.
4. El resto queda para la empresa: `total_amount - commissionAmount`.
5. Actualiza la venta a `approved`.
6. Incrementa `wallet.pending` de la empresa con el monto neto.
7. Incrementa `wallet.pending` del recomendador con la comisión.

### Rechazar una venta (`PATCH /sales/:id/reject`)

Solo la empresa dueña puede rechazar. Si la venta estaba `pending` → simplemente se marca `rejected`. Si estaba `approved` → se revierte el balance (decrementa `wallet.pending` de empresa y recomendador con los montos originales).

### Estados de venta

```
pending → approved  (empresa aprueba)
pending → rejected  (empresa rechaza)
approved → rejected (empresa revierte)
approved → payed    (ocurre en liquidación)
```

---

## Sistema de Niveles del Recomendador

Los recomendadores acumulan un bonus extra según la cantidad de ventas aprobadas históricas.

| Nivel    | Ventas aprobadas mínimas | Bonus sobre comisión |
| -------- | ------------------------ | -------------------- |
| `NONE`   | 0                        | 0%                   |
| `BRONZE` | 2                        | +5%                  |
| `SILVER` | 4                        | +7%                  |
| `GOLD`   | 5                        | +12%                 |

**Ejemplo**: empresa tiene `commission_rate = 0.10` (10%), venta de $1000, recomendador nivel GOLD:

- Comisión = 1000 × 0.10 × (1 + 0.12) = $112
- Neto para empresa = $1000 - $112 = $888

**Endpoint**: `GET /recommenders/level` → devuelve nivel actual, bonus, ventas aprobadas, y cuántas ventas faltan para el siguiente nivel.

---

## Billeteras (Wallets)

Cada usuario tiene exactamente una billetera con dos campos:

- `available`: saldo disponible para liquidar (fondos confirmados listos para pago).
- `pending`: fondos en espera (ventas aprobadas, aún no liquidadas).

### Para Empresa

`GET /wallet` → devuelve `{ available: number, pending: number }`.

El `pending` aumenta cuando la empresa aprueba ventas (acumula el monto neto). El `available` se maneja en el flujo de pagos a Revio (pendiente de implementar completamente).

### Para Recomendador

`GET /recommenders/balance` → devuelve balance consolidado + fecha del próximo viernes (próxima liquidación).

---

## Flujo de Liquidaciones (Cronjob)

Se ejecuta **automáticamente cada viernes a las 00:00** (`@Cron('0 0 * * 5')`).

### Proceso dentro de una transacción de DB:

1. Busca todos los recomendadores con `wallet.available > 0`.
2. Calcula el total global.
3. Crea un registro `Liquidation` con estado `pending`.
4. Por cada recomendador:
   - Crea un `LiquidationItem` con el monto.
   - Resetea su `wallet.available = 0`.
5. Genera un CSV con nombre, apellido, DNI, banco, alias/CBU, monto.
6. Marca la liquidación como `payed`.
7. Envía el CSV por email al equipo de operaciones (`SES_FROM_EMAIL`).

### El equipo de operaciones

Con el CSV en mano, ejecuta manualmente las transferencias bancarias a cada recomendador.

### Endpoints Admin para Liquidaciones

| Método | Ruta                          | Descripción                        |
| ------ | ----------------------------- | ---------------------------------- |
| GET    | `/admin/liquidations`         | Historial de liquidaciones         |
| GET    | `/admin/liquidations/:id/csv` | Descarga el CSV de una liquidación |

### Endpoint Recomendador

| Método | Ruta                         | Descripción                                          |
| ------ | ---------------------------- | ---------------------------------------------------- |
| GET    | `/recommenders/liquidations` | Historial de liquidaciones del recomendador logueado |

---

## Movimientos Financieros (Admin)

| Método | Ruta                                                           | Descripción                                |
| ------ | -------------------------------------------------------------- | ------------------------------------------ |
| GET    | `/admin/movements/summary`                                     | Resumen de entradas y salidas              |
| GET    | `/admin/movements?type=entrada\|salida&from=&to=&page=&limit=` | Lista paginada con filtros de fecha y tipo |

---

## Perfil de Empresa Pública

Las empresas tienen un `slug` único que permite acceder a su perfil público sin autenticación:

`GET /enterprises/public/:slug` → devuelve datos públicos: nombre, categoría, descripción, dirección, teléfono, web, y lista de productos/servicios activos con precios y tasa de comisión.

Esta ruta es usada en la página `/empresa/[slug]` del frontend, a la que los recomendadores pueden llevar clientes con su código de referido en la query string (`?ref=CODIGO`).

---

## Código de Referido

`GET /recommenders/enterprises/:id/referral-code` → devuelve:

```json
{
  "code": "JUAN-1234",
  "link": "https://revio.app/empresa/mi-empresa?ref=JUAN-1234"
}
```

El recomendador comparte este link. Cuando un cliente visita ese link, el frontend puede capturar el `ref` para asociar la futura venta al recomendador.

---

## Endpoints de Recomendadores

Todos requieren rol `RECOMENDADOR`.

| Método | Ruta                                          | Descripción                                  |
| ------ | --------------------------------------------- | -------------------------------------------- |
| GET    | `/recommenders/me`                            | Perfil completo del recomendador             |
| PATCH  | `/recommenders/me`                            | Actualiza datos del perfil                   |
| GET    | `/recommenders/level`                         | Nivel actual y progreso                      |
| GET    | `/recommenders/balance`                       | Balance consolidado + próxima liquidación    |
| GET    | `/recommenders/sales`                         | Historial de ventas atribuidas               |
| GET    | `/recommenders/liquidations`                  | Historial de liquidaciones recibidas         |
| GET    | `/recommenders/enterprises`                   | Lista de empresas aprobadas en la plataforma |
| GET    | `/recommenders/enterprises/:id`               | Detalle de una empresa                       |
| GET    | `/recommenders/enterprises/:id/referral-code` | Genera link de referido para esa empresa     |

---

## Notificaciones

Sistema de notificaciones internas. Todos los usuarios autenticados pueden acceder.

| Método | Ruta                  | Descripción                                            |
| ------ | --------------------- | ------------------------------------------------------ |
| GET    | `/notifications`      | Todas las notificaciones del usuario                   |
| PATCH  | `/notifications/:id`  | Marca como leída                                       |
| DELETE | `/notifications/:id`  | Elimina notificación                                   |
| POST   | `/notifications/test` | Endpoint de test: envía email SES y registra resultado |

### Tipos de notificaciones (`NOTIFICATION_TYPE`)

| Tipo                          | Cuándo se genera                                         |
| ----------------------------- | -------------------------------------------------------- |
| `REGISTRATION_SUCCESS`        | Al crear cuenta por primera vez                          |
| `NEW_VALIDATION_REQUEST`      | Al completar onboarding (se notifica a admins)           |
| `DOCS_RESUBMITTED`            | Al reenviar documentos rechazados (se notifica a admins) |
| `VALIDATION_APPROVED`         | Cuando el admin aprueba el perfil                        |
| `DOCS_REJECTED`               | Cuando el admin rechaza documentos específicos           |
| `PAYMENT_UPDATED`             | Cambio en estado de pago                                 |
| `LIQUIDATION_IN_PROGRESS`     | Cuando arranca la liquidación                            |
| `EMAIL_SENT` / `EMAIL_FAILED` | Test de email desde el dashboard                         |

---

## Categorías

`GET /categories` → lista todas las categorías disponibles (sin autenticación). Se usan al crear una empresa en el onboarding.

---

## Endpoints de Usuarios

| Método | Ruta                | Autenticación | Descripción                                                  |
| ------ | ------------------- | ------------- | ------------------------------------------------------------ |
| POST   | `/users/sync`       | Público       | Upsert de usuario desde Cognito. Se llama en signup y login  |
| GET    | `/users/profile`    | JWT           | Fila básica del usuario en DB (para redirect check en login) |
| GET    | `/users/me`         | JWT           | Perfil completo (incluye Recommender o Enterprise con joins) |
| PATCH  | `/users/enterprise` | JWT + EMPRESA | Actualiza datos de la empresa (nombre, descripción, etc.)    |

---

## Modelos de Datos (Prisma Schema)

### User

```
id (uuid), cognito_id (único), email, role (EMPRESA|RECOMENDADOR|ADMIN|null),
active_in_enterprise (bool), created_at
→ tiene: enterprises[], recommender?, notifications[], wallets[], verifications[]
```

### Enterprise

```
id, category_id, company_name, slug (único), description, web_page, phone_number,
user_id, wallet_id, arca_key, const_key, dni_key (keys S3),
validation_status (pending|approved|rejected), rejection_reasons (JSON),
commission_rate (Decimal 0.00-0.99)
→ tiene: addresses[], products[], verifications[], payments[], sales[], areas[]
```

### Recommender

```
id, user_id (único), name, last_name, dni (único), date_of_birth,
dni_frente_key, dni_dorso_key, selfie_key (keys S3),
referral_code (único), validation_status, alias_validated (bool), rejection_reasons (JSON)
→ tiene: bank_accounts[], sales[], liquidation_items[]
```

### Wallet

```
id, user_id, available (Decimal), pending (Decimal)
→ pertenece a: User; referenciada por Enterprise
```

### Sale

```
id, enterprise_id, product_service_id (nullable), recommender_id,
total_amount, sale_commision, description, transaction_status (pending|approved|rejected|payed),
created_at
```

### ProductService

```
id, enterprise_id, type (product|service), name, description, price, shipping_condition, is_active
```

### EnterprisePayment

```
id, enterprise_id, ammount, status (PAYMENT_STATUS), mercadopago_id, receiptURL, created_at
```

### Liquidation

```
id, total_amount, status (PAYMENT_STATUS), period_end, created_at
→ tiene: items[] (LiquidationItem)
```

### LiquidationItem

```
id, liquidation_id, recommender_id, amount
```

### BankAccount

```
id, recommender_id, bankName, accountNumber (CBU), alias, isActive
```

### Notification

```
id, user_id, type (NOTIFICATION_TYPE), title, message, read, created_at
```

### Category

```
id, name (único), description
```

### Province / Address / EnterpriseOperatesInArea

```
Province: id, state, country
Address: id, enterprise_id, area_id (province_id), address_1/2/3, city, postal_code
EnterpriseOperatesInArea: id, enterprise_id, province_id
```

### OwnershipVerification

```
id, created_by_id, enterprise_id, documentation_urls (JSON), payed, status (VERIFICATION_STATUS)
VERIFICATION_STATUS: publicated | checking | waitin_payment | payed | approved
```

---

## Flujo Financiero Completo (Resumen)

```
1. Empresa aprueba venta ($1000, commission_rate=10%, recomendador GOLD→ +12%)
   ├── Comisión = $1000 × 0.10 × 1.12 = $112 → wallet.pending del recomendador
   └── Neto = $1000 - $112 = $888 → wallet.pending de la empresa

2. Empresa acumula deuda de comisiones con Revio (futuro: EnterprisePayment via Mercado Pago)
   → El backend rechaza pagos parciales (debe ser 100% de la deuda total)

3. Cada viernes (cron) → Liquidación:
   ├── Se toma wallet.available de cada recomendador
   ├── Se genera CSV con datos bancarios
   ├── Se resetea wallet.available = 0
   └── Equipo de operaciones ejecuta las transferencias manuales
```

**Regla crítica**: Toda operación que mueva saldos (`approve`/`reject` ventas, liquidación) usa `prisma.$transaction()` para garantizar atomicidad.

---

## Páginas Frontend (Next.js)

### Rutas públicas

| Ruta               | Descripción                                                      |
| ------------------ | ---------------------------------------------------------------- |
| `/login`           | Login con email/password o Google OAuth                          |
| `/signup`          | Registro de nuevo usuario                                        |
| `/signup/confirm`  | Confirmación de código de Cognito                                |
| `/forgot-password` | Solicitud de reset de contraseña                                 |
| `/empresa/[slug]`  | Perfil público de una empresa (con productos y link de referido) |
| `/landing`         | Landing page de la plataforma                                    |

### Rutas protegidas (requieren sesión)

| Ruta                       | Rol                | Descripción                                       |
| -------------------------- | ------------------ | ------------------------------------------------- |
| `/onboarding`              | Todos              | Formulario de onboarding (EMPRESA o RECOMENDADOR) |
| `/dashboard`               | Todos              | Dashboard principal (diferente por rol)           |
| `/dashboard/ventas`        | EMPRESA            | Tabla de ventas con acciones aprobar/rechazar     |
| `/dashboard/productos`     | EMPRESA            | Gestión de productos y servicios                  |
| `/dashboard/catalogo`      | RECOMENDADOR       | Catálogo de empresas disponibles                  |
| `/dashboard/balance`       | EMPRESA            | Balance de billetera                              |
| `/dashboard/balances`      | RECOMENDADOR       | Balance del recomendador                          |
| `/dashboard/transacciones` | Todos              | Historial de transacciones                        |
| `/dashboard/liquidaciones` | RECOMENDADOR/ADMIN | Historial de liquidaciones                        |
| `/dashboard/validacion`    | ADMIN              | Panel de validación de perfiles                   |
| `/dashboard/verificacion`  | EMPRESA            | Verificación de titularidad                       |
| `/dashboard/profile`       | Todos              | Perfil del usuario                                |

### Dashboard por rol

- **ADMIN**: ve estadísticas (cantidad de empresas/recomendadores) + tabla de validaciones pendientes.
- **EMPRESA**: ve resumen de ventas recientes, balance de billetera, cantidad de productos.
- **RECOMENDADOR**: ve balance (disponible + pendiente), ventas recientes, nivel y progreso.

---

## Variables de Entorno Requeridas

### Backend (`apps/api/.env`)

```
DATABASE_URL=postgresql://...
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxx
AWS_COGNITO_CLIENT_ID=xxxxxx
AWS_COGNITO_CLIENT_SECRET=xxxxxx
AWS_REGION=us-east-1
SES_FROM_EMAIL=noreply@revio.app
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=revio-documents
MERCADO_PAGO_ACCESS_TOKEN=...
FRONTEND_URL=http://localhost:3000
```

### Frontend (`apps/web/.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID=...
NEXT_PUBLIC_COGNITO_DOMAIN=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=... (para iron-session)
```

---

## Reglas de Negocio No Negociables

1. **Atomicidad financiera**: Cualquier operación que modifique saldos de wallet DEBE usar `prisma.$transaction()`. Nunca hacer dos `update` consecutivos sin transacción.
2. **Pagos completos**: El backend rechaza con `BadRequestException` si el monto de un pago no es exactamente igual a la deuda total de la empresa.
3. **Validación de alias antes de aprobar**: No se puede aprobar un recomendador con datos bancarios hasta que el admin haya marcado `alias_validated = true`.
4. **Un perfil por usuario**: Un usuario no puede ser a la vez EMPRESA y RECOMENDADOR.
5. **Liquidación semanal**: Solo los fondos en `wallet.available` se liquidan. Los fondos en `wallet.pending` (ventas aprobadas pero no pagadas por la empresa) no se tocan hasta que la empresa pague.
6. **Recomendador sin referral_code no puede generar links**: Se lanza `BadRequestException` si `recommender.referral_code` es null.
7. **Empresa sin slug no puede generar links**: Se lanza `BadRequestException` si `enterprise.slug` es null.
8. **URLs de S3 prefirmadas expiran en 15 minutos**: Solo el admin puede verlas para revisar documentos KYC.

---

## Emails Automáticos del Sistema

| Evento                | Destinatario                  | Plantilla                                                       |
| --------------------- | ----------------------------- | --------------------------------------------------------------- |
| Registro nuevo        | Usuario                       | `registration-success` — bienvenida con rol                     |
| Validación aprobada   | Usuario                       | `validation-approved` — confirmación con link al dashboard      |
| Documentos rechazados | Usuario                       | `rejected-docs` — lista de docs a corregir + link al onboarding |
| Liquidación semanal   | Equipo ops (`SES_FROM_EMAIL`) | Email con adjunto CSV de transferencias                         |

---

## Resumen de Todos los Endpoints REST

```
GET    /categories                                  → Público. Lista categorías.

POST   /users/sync                                  → Público. Upsert usuario desde Cognito.
GET    /users/profile                               → JWT. Fila básica del usuario.
GET    /users/me                                    → JWT. Perfil completo.
PATCH  /users/enterprise                            → EMPRESA. Actualiza datos empresa.

POST   /onboarding/recomendador                     → JWT. Completa onboarding recomendador.
POST   /onboarding/empresa                          → JWT. Completa onboarding empresa.
PATCH  /onboarding/kyc-documents                    → JWT. Reenvía documentos KYC.
PATCH  /onboarding/bank-account                     → JWT. Actualiza cuenta bancaria.

POST   /upload                                      → JWT. Sube archivo a S3, devuelve key.

GET    /enterprises/public/:slug                    → Público. Perfil público de empresa.

GET    /products                                    → EMPRESA. Lista productos/servicios.
POST   /products                                    → EMPRESA. Crea producto/servicio.
PATCH  /products/:id                                → EMPRESA. Actualiza producto.
PATCH  /products/:id/toggle                         → EMPRESA. Activa/desactiva producto.
DELETE /products/:id                                → EMPRESA. Elimina producto.

GET    /sales                                       → EMPRESA. Lista ventas de la empresa.
POST   /sales                                       → EMPRESA. Registra nueva venta.
PATCH  /sales/:id/approve                           → EMPRESA. Aprueba venta (mueve wallets en tx).
PATCH  /sales/:id/reject                            → EMPRESA. Rechaza venta (revierte wallets en tx si era approved).

GET    /wallet                                      → EMPRESA. Balance de billetera.

GET    /recommenders/me                             → RECOMENDADOR. Perfil.
PATCH  /recommenders/me                             → RECOMENDADOR. Actualiza perfil.
GET    /recommenders/level                          → RECOMENDADOR. Nivel y progreso.
GET    /recommenders/balance                        → RECOMENDADOR. Balance + próxima liquidación.
GET    /recommenders/sales                          → RECOMENDADOR. Historial de ventas.
GET    /recommenders/liquidations                   → RECOMENDADOR. Historial de liquidaciones.
GET    /recommenders/enterprises                    → RECOMENDADOR. Lista empresas aprobadas.
GET    /recommenders/enterprises/:id                → RECOMENDADOR. Detalle de empresa.
GET    /recommenders/enterprises/:id/referral-code  → RECOMENDADOR. Link de referido.

GET    /notifications                               → JWT. Notificaciones del usuario.
PATCH  /notifications/:id                           → JWT. Marca como leída.
DELETE /notifications/:id                           → JWT. Elimina notificación.
POST   /notifications/test                          → JWT. Test de email SES.

GET    /admin/stats                                 → ADMIN. Estadísticas generales.
GET    /admin/validations                           → ADMIN. Lista todas las validaciones.
GET    /admin/validations/:id?type=EMPRESA|RECOMENDADOR    → ADMIN. Detalle con docs S3.
PATCH  /admin/validations/:id/approve?type=...      → ADMIN. Aprueba perfil.
PATCH  /admin/validations/:id/reject?type=...       → ADMIN. Rechaza perfil.
PATCH  /admin/validations/:id/reject-docs?type=...  → ADMIN. Rechaza documentos específicos.
PATCH  /admin/validations/:id/approve-alias         → ADMIN. Valida alias bancario.
GET    /admin/liquidations                          → ADMIN. Historial de liquidaciones.
GET    /admin/liquidations/:id/csv                  → ADMIN. Descarga CSV de liquidación.
GET    /admin/movements/summary                     → ADMIN. Resumen de movimientos.
GET    /admin/movements?type=&from=&to=&page=&limit= → ADMIN. Movimientos paginados.
```
