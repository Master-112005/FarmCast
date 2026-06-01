# FarmCast Frontend

Enterprise dashboard UI for FarmCast. DeviceView is the default workspace. PredictorView is only reachable via the ViewSwitch, and ProfileView only via the ProfileButton.

## Environment Variables
Create `dashboard/frontend/.env`:

```
VITE_API_URL=http://localhost:5000/api/v1
VITE_API_ROOT_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

For Vercel production, set `VITE_API_URL` to the deployed backend API, for example:

```
VITE_API_URL=https://farmcast-nfd6.onrender.com/api/v1
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
