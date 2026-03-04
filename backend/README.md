# FarmCast Backend

Enterprise-grade REST API for FarmCast. This service owns authentication, RBAC, device management, soil telemetry, and ML orchestration.

## Architecture
- `src/app.js` Express app (middleware, routes, error handlers)
- `src/server.js` process bootstrap + graceful shutdown
- `src/routes` versioned routing
- `src/modules/*` domain modules: routes -> controllers -> services -> models
- `src/models` Sequelize models
- `src/middlewares` auth, RBAC, validation, uploads
- `src/integrations/mlClient.js` ML service client

## Environment Variables
Create `dashboard/backend/.env`:

```
NODE_ENV=development
PORT=5000
APP_BASE_URL=http://localhost:5000
API_VERSION=v1
HEALTH_ROUTE=/health

DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=farmcast_db
DB_USER=YOUR_DB_USER
DB_PASSWORD=YOUR_DB_PASSWORD

JWT_SECRET=REPLACE_WITH_32+_CHAR_SECRET
JWT_EXPIRES_IN=1h
JWT_ISSUER=farmcast
JWT_AUDIENCE=farmcast-users
JWT_ALGORITHM=HS256

REFRESH_TOKEN_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=REPLACE_WITH_32+_CHAR_SECRET

RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

CORS_ORIGIN=http://localhost:5173
CORS_CREDENTIALS=false

UPLOAD_DIR=uploads
UPLOAD_MAX_SIZE_MB=5
UPLOAD_ALLOWED_MIME=image/jpeg,image/png,image/webp

LOG_LEVEL=info
HTTP_LOGGING_ENABLED=true

# ML Integration
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_AUTH_MODE=api_key  # api_key | jwt
ML_SERVICE_API_KEY=REPLACE_WITH_ML_API_KEY
ML_SERVICE_JWT_SECRET=REPLACE_WITH_32+_CHAR_SECRET
ML_SERVICE_JWT_ISSUER=farmcast
ML_SERVICE_JWT_AUDIENCE=farmcast-users
ML_SERVICE_JWT_ALGORITHM=HS256
ML_SERVICE_TIMEOUT_MS=10000

# Admin Seeder (optional)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=REPLACE_WITH_STRONG_PASSWORD
ADMIN_NAME=System Administrator
```

All `REPLACE_`/`CHANGE_ME` values are placeholders and must be updated before production.

## Install & Run
```
cd dashboard/backend
npm install
npm run migrate
npm run dev
```

## ML Service Integration (Required for /predictors)
To avoid `ML service unavailable` errors, the ML API must be running and its auth must match the backend:
1. Start the ML service (`uvicorn ml.api.ml_service:app --host 0.0.0.0 --port 8000`) from `ml/`.
2. If `ML_SERVICE_AUTH_MODE=api_key`:
`ML_SERVICE_API_KEY` in `dashboard/backend/.env` must match a key in the ML service env:
`ML_API_KEYS=backend:<same_token_here>`
3. If `ML_SERVICE_AUTH_MODE=jwt`, the ML service must be configured with the same JWT settings used by the backend.

## Scripts
- `npm run dev` local dev (nodemon)
- `npm start` production start
- `npm run migrate` apply migrations
- `npm run seed` seed admin user (optional)

## Security
- JWT access tokens + hashed refresh tokens
- RBAC enforcement (`user` / `admin`) with strict ownership isolation
- Admin roles do not bypass ownership checks for user resources
- Input validation with Joi
- Rate limiting + secure headers (Helmet)
- CORS locked to approved origins

## Health Check
- `GET /health`

