# Control de Stock JLMoraga

Sistema web completo para control de stock de gomas/neumaticos de tractores y semis, con autenticacion, dashboard visual, ubicacion actual, movimientos auditables e historial por goma.

## Estructura

- `backend-control-stock`: API REST con Express, Prisma y PostgreSQL.
- `frontend-control-stock`: interfaz web en Angular 15 responsive.

## Backend

### 1. Instalar dependencias

```bash
cd backend-control-stock
npm install
```

### 2. Crear base PostgreSQL

Ejemplo con `psql`:

```sql
CREATE DATABASE control_stock;
```

### 3. Configurar variables de entorno

Copiar `backend-control-stock/.env.example` a `.env` y completar:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/control_stock?schema=public"
JWT_SECRET="tu-clave-segura"
PORT=3000
```

### 4. Correr migraciones

```bash
npx prisma migrate dev --name init
```

### 5. Generar cliente Prisma

```bash
npx prisma generate
```

### 6. Crear usuarios iniciales

```bash
npm run seed
```

Se crean estos 3 usuarios:

- `octavio@jlmoraga.com` / `Octavio1234` / `ADMIN`
- `admin@jlmoraga.com` / `Admin1234` / `ADMIN`
- `cmedina@jlmoraga.com` / `Operador123` / `OPERATOR`
- `ltorres@jlmoraga.com` / `Operador123` / `OPERATOR`

### 7. Levantar backend

```bash
npm run dev
```

La API queda disponible en:

- `http://localhost:3000/health`
- `http://localhost:3000/auth/register`
- `http://localhost:3000/auth/login`
- `http://localhost:3000/auth/me`
- `http://localhost:3000/users`
- `http://localhost:3000/gomas`
- `http://localhost:3000/tires`
- `http://localhost:3000/tractors`
- `http://localhost:3000/semis`
- `http://localhost:3000/deposits`
- `http://localhost:3000/movimientos`
- `http://localhost:3000/dashboard/resumen`

## Frontend

### 1. Instalar dependencias

```bash
cd frontend-control-stock
npm install
```

### 2. Verificar URL del backend

El frontend usa por defecto:

`frontend-control-stock/src/environments/environment.ts`

```ts
apiUrl: 'http://localhost:3000'
```

### 3. Levantar frontend

```bash
npm start
```

Angular queda disponible en:

- `http://localhost:4200`

## Flujo sugerido para probar

1. Crear al menos un deposito desde la pantalla `Recursos`.
2. Crear tractores y semis con patente.
3. Iniciar sesion con `admin@jlmoraga.com`.
4. Si hace falta, crear mas usuarios desde la pantalla `Usuarios`.
5. Dar de alta gomas indicando ubicacion inicial.
6. Entrar a `Movimientos` y mover gomas entre deposito, tractores y semis.
7. Revisar dashboard e historial desde la pantalla `Gomas`.

## Endpoints principales

### Auth

- `POST /auth/login`
- `GET /auth/me`

### Usuarios

- `GET /users`
- `POST /users`

### Gomas

- `GET /gomas`
- `POST /gomas`
- `GET /gomas/:id`
- `PUT /gomas/:id`
- `DELETE /gomas/:id`
- `GET /gomas/:id/historial`

### Recursos

- `GET|POST|PUT|DELETE /deposits`
- `GET|POST|PUT|DELETE /tractors`
- `GET|POST|PUT|DELETE /semis`

### Movimientos y dashboard

- `POST /movimientos`
- `GET /movimientos`
- `GET /dashboard/resumen`

## Notas

- Cada movimiento guarda usuario, fecha, ubicacion previa, ubicacion nueva, patente previa, patente nueva y observaciones.
- Cada goma mantiene una unica ubicacion actual.
- No se elimina historial de movimientos.
- El registro publico fue removido; solo un administrador puede crear usuarios desde la app.
- Angular 15 compilo correctamente en este entorno.
- Prisma Client se genero correctamente; las migraciones requieren una instancia PostgreSQL disponible.
