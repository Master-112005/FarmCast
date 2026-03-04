# FarmCast Frontend

Enterprise dashboard UI for FarmCast. DeviceView is the default workspace. PredictorView is only reachable via the ViewSwitch, and ProfileView only via the ProfileButton.

## Environment Variables
Create `dashboard/frontend/.env`:

```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_API_ROOT_URL=http://localhost:5000
```

## Install & Run
```
cd dashboard/frontend
npm install
npm run dev
```

## Build
```
npm run build
npm run preview
```

## Notes
- The UI assumes the backend serves `/uploads` for profile and predictor images.
- API base URL must align with backend `CORS_ORIGIN` and `APP_BASE_URL`.
