# FarmCast Technical Report

## 1. Purpose of This Report

This report explains the FarmCast codebase in clear terms:

- what each folder is
- what each component is used for
- what technologies are used
- what Docker is used for
- what MQTT is used for
- what the frontend does
- what the backend does
- what the firmware does
- what the ML service does
- what algorithms and techniques are used
- what the important methods and flows are

This report is based on direct inspection of the repository source code and configuration files.

---

## 2. What FarmCast Is

FarmCast is an end-to-end smart agriculture platform.

It combines:

- an ESP32 field device
- MQTT messaging
- a backend API
- a web dashboard
- a machine learning service

The goal is to:

- collect field telemetry such as soil moisture, temperature, battery, and GPS
- securely provision and manage devices
- show device data in a web dashboard
- generate farming recommendations
- run AI/ML predictions such as crop yield and plant disease detection
- support admin, chat, and community features

In simple terms:

- the **firmware** runs on the physical device
- the **backend** controls the system and stores data
- the **frontend** is the user-facing dashboard
- the **ML service** does prediction and model lifecycle work
- **MQTT** carries device messages
- **Docker** runs the local MQTT broker

---

## 3. Repository Structure

### 3.1 Top-Level Folders

- `frontend/`
  - React dashboard application
- `backend/`
  - Node.js API, auth, device management, data storage, MQTT ingestion, realtime, admin, chat, and community logic
- `farmcast-ml/`
  - Python ML service for inference, training, retraining, registry, and monitoring
- `firmware/`
  - ESP32 PlatformIO firmware
- `docker/`
  - Docker files for the MQTT broker
- `mqtt/`
  - Mosquitto runtime config, data, and logs

### 3.2 Important Root Files

- `README.md`
  - high-level system overview and setup
- `FARMCAST.md`
  - extended architecture and implementation notes
- `Report.md`
  - this report

---

## 4. High-Level Architecture

### 4.1 Main Components

1. ESP32 device firmware
2. MQTT broker
3. Node.js backend
4. MySQL database
5. Python ML service
6. React frontend

### 4.2 Communication Flow

1. The ESP32 device reads sensor and GPS data.
2. The device authenticates with the backend over HTTP.
3. The backend returns a short-lived device JWT.
4. The device connects to MQTT using:
   - username = device ID
   - password = device JWT
5. The device publishes telemetry and heartbeat messages through MQTT.
6. The backend subscribes to those MQTT topics and processes incoming messages.
7. The backend stores data in MySQL and emits live updates using Socket.IO.
8. The frontend calls the backend with REST APIs and receives live updates from Socket.IO.
9. For prediction features, the backend calls the ML service through HTTP.

---

## 5. Tech Stack

## 5.1 Frontend Stack

- React 18
- Vite
- Axios
- React Router
- Socket.IO client
- Leaflet
- CSS modules and global CSS files

### What it is used for

- login and registration
- dashboard views
- device monitoring
- prediction UI
- disease image upload
- profile management
- chat and community
- admin workflows
- USB serial provisioning and secure delete flows

## 5.2 Backend Stack

- Node.js
- Express
- Sequelize
- MySQL
- JWT
- bcrypt
- Joi
- Socket.IO
- MQTT client
- Nodemailer
- Winston

### What it is used for

- authentication and authorization
- device provisioning and lifecycle
- telemetry ingestion
- database access
- alerting
- audit logging
- admin APIs
- chat/community APIs
- realtime dashboard updates
- ML orchestration

## 5.3 ML Stack

- Python 3.10+
- FastAPI
- LightGBM
- TensorFlow / Keras
- scikit-learn
- Optuna
- pandas
- numpy
- Pillow
- joblib

### What it is used for

- yield prediction
- price forecasting
- disease detection from images
- training and retraining pipelines
- model promotion and registry management
- drift and performance monitoring

## 5.4 Firmware Stack

- ESP32
- PlatformIO
- Arduino framework
- PubSubClient
- TinyGPSPlus
- ArduinoJson

### What it is used for

- Wi-Fi connectivity
- backend authentication
- MQTT connection
- telemetry publishing
- heartbeat publishing
- OTA updates
- USB provisioning
- secure factory reset

## 5.5 Infrastructure Stack

- Mosquitto MQTT broker
- mosquitto-go-auth plugin
- Docker Compose

### What it is used for

- MQTT session handling
- topic authorization
- real-time device message transport

---

## 6. What Docker Is Used For

Docker is used only for the MQTT broker stack in this repository.

### Docker files

- `docker/docker-compose.mqtt.yml`
- `docker/mosquitto.conf`
- `docker/aclfile`

### What Docker runs

- `iegomez/mosquitto-go-auth:latest`

This container runs:

- Mosquitto broker
- `go-auth` plugin for dynamic authentication and ACL checks

### Why Docker is used here

- quick local setup of the broker
- consistent broker environment
- separate broker runtime from backend/frontend processes
- easy restart after config changes

### What Docker is not used for here

- backend is not containerized here
- frontend is not containerized here
- ML service is not containerized here
- firmware obviously is not containerized

---

## 7. What MQTT Is Used For

MQTT is the messaging layer between devices and the platform.

### Why MQTT is used

MQTT is useful for IoT because it is:

- lightweight
- good for unreliable networks
- low-overhead
- suitable for publish/subscribe communication

### Topics used in FarmCast

- `devices/<deviceId>/telemetry`
  - device publishes sensor data
- `devices/<deviceId>/heartbeat`
  - device publishes status/online events
- `devices/<deviceId>/ota`
  - backend or system can send OTA update commands to device
- `devices/<deviceId>/wifi/update`
  - backend can send Wi-Fi credential updates to device
- `devices/<deviceId>/system/reset`
  - device publishes factory reset/system reset events

### How MQTT authentication works

The broker does not blindly trust clients.

It uses:

- username = device ID
- password = device JWT

The broker then calls the backend endpoint:

- `POST /api/v1/mqtt/validate`

The backend decides:

- whether the device may connect
- whether the device may publish to a topic
- whether the device may subscribe to a topic

### Why this matters

This gives FarmCast:

- per-device topic protection
- live JWT validation
- access revocation when a device is deleted or disabled
- no wildcard topic abuse

---

## 8. Frontend: What It Is and What It Does

The frontend is the web dashboard used by farmers and admins.

### Core frontend responsibilities

- user login and registration
- protected routing
- device visualization
- prediction workflows
- profile and account management
- community posting and chat
- admin overview
- serial provisioning through browser USB

### Main frontend architecture

#### App shell

- `src/app/App.jsx`
- `src/app/Router.jsx`
- `src/app/DashboardShell.jsx`
- `src/pages/Workspace.jsx`

These files control:

- routing
- authentication gating
- main dashboard shell
- active view switching

#### Context providers

- `src/context/AuthContext.jsx`
- `src/context/SocketContext.jsx`
- `src/context/ViewContext.jsx`

These manage:

- current user and session state
- Socket.IO connection
- current active dashboard view

### Main frontend views

#### 1. Device View

File:

- `src/pages/DeviceView.jsx`

Used for:

- listing devices
- selecting a device
- showing live data
- showing latest soil data
- secure delete workflow

#### 2. Predictor View

File:

- `src/pages/PredictorView.jsx`

Used for:

- yield prediction
- fertilizer recommendation
- water recommendation
- disease image prediction
- prediction email flow

#### 3. Profile View

File:

- `src/pages/ProfileView.jsx`

Used for:

- profile editing
- profile image upload
- device provisioning via USB
- account actions

#### 4. Community View

File:

- `src/pages/CommunityView.jsx`

Used for:

- community posts
- image sharing
- feed interactions
- user chat entry points

#### 5. Admin View

File:

- `src/pages/AdminView.jsx`

Used for:

- user management
- system overview
- prediction history inspection

### Frontend service layer

The frontend uses service modules for backend communication.

#### API client

- `src/services/api.js`

Used for:

- Axios instance creation
- auth token injection
- refresh-token flow
- transient retry logic
- correlation ID generation

#### User methods

- `registerUser`
- `loginUser`
- `logoutUser`
- `getMyProfile`
- `updateMyProfile`
- `deleteMyAccount`
- `uploadProfilePicture`

#### Device methods

- `getDevices`
- `getDeviceById`
- `addDevice`
- `updateDevice`
- `deleteDevice`
- `preDeleteDevice`
- `finalizeDeleteDevice`
- `getLiveDeviceData`
- `getLatestSoilRecord`
- `syncDeviceData`

#### Provisioning methods

- `requestPort`
- `openPort`
- `closePort`
- `writeLine`
- `readLine`
- `getFirmwareInfo`
- `claimDevice`
- `sendProvisioningPayload`
- `sendFactoryResetCommand`
- `runBackendDeleteFlow`
- `runSecureDeleteFlow`
- `getDeviceStatus`
- `waitUntilOnline`
- `runProvisioningFlow`

#### Predictor methods

- `runPrediction`
- `getFertilizerRecommendation`
- `getWaterRecommendation`
- `calculateYieldAndProfit`
- `uploadCropImage`
- `sendPredictionEmail`

#### Chat/community/admin methods

- `getChatContacts`
- `getChatMessages`
- `sendChatMessage`
- `deleteChatThread`
- `getCommunityPosts`
- `createCommunityPost`
- `deleteCommunityPost`
- `getAdminUsers`
- `getAdminOverview`
- `deleteAdminUser`
- `getAdminUserPredictionHistory`

### Frontend techniques used

- protected routes for authenticated users
- public-only routes for login/register
- token refresh before expiry
- retry on `502/503/504`
- Socket.IO room join by user ID
- periodic polling for some chat notification use cases
- Web Serial API for direct device provisioning and secure delete

---

## 9. Backend: What It Is and What It Does

The backend is the main control plane of the system.

### Core backend responsibilities

- authenticate users
- issue access and refresh tokens
- provision devices
- issue device JWTs
- validate MQTT broker requests
- process incoming telemetry
- store application data in MySQL
- emit live updates to dashboard clients
- call the ML service
- manage alerts, audit logs, retention jobs, community, chat, and admin flows

### Backend startup sequence

From `backend/src/server.js`, startup is intentionally ordered:

1. connect database
2. create HTTP server
3. initialize Socket.IO
4. start listening
5. connect MQTT client
6. start jobs

This ordering matters because:

- the MQTT broker auth callback depends on the backend being reachable
- the MQTT subscriber should start after the API server is ready
- jobs should start only after storage and messaging are available

### Main backend route groups

All API routes are mounted under:

- `/api/v1`

#### Auth routes

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Used for:

- user registration
- access token issuance
- refresh token rotation
- logout/revocation

#### User routes

- `GET /users/me`
- `PUT /users/me`
- `POST /users/me/upload`
- `DELETE /users/me`

Used for:

- profile read/update
- image upload
- account deletion

#### Device routes

- `POST /devices/auth`
- `GET /devices`
- `GET /devices/:id`
- `GET /devices/:id/status`
- `POST /devices`
- `POST /devices/provision`
- `PUT /devices/:id`
- `DELETE /devices/:id/pre-delete`
- `POST /devices/:id/finalize-delete`
- `DELETE /devices/:id`
- `GET /devices/:id/live`
- `PATCH /devices/sync/:id`

Used for:

- device authentication for firmware
- device CRUD
- device provisioning
- secure delete
- device status lookup
- manual/live sync operations

#### Soil routes

- `POST /soil`
- `GET /soil/history`
- `GET /soil/latest/:deviceId`

Used for:

- create telemetry record
- read historical chart data
- read latest soil record

#### Predictor routes

- `POST /predictors/run`
- `POST /predictors/fertilizer`
- `POST /predictors/water`
- `POST /predictors/yield`
- `POST /predictors/upload`
- `POST /predictors/mail`

Used for:

- combined prediction pipeline
- recommendation endpoints
- disease image upload
- prediction email

#### Admin routes

- `GET /admin/overview`
- `GET /admin/users`
- `GET /admin/users/:userId/predictions`
- `DELETE /admin/users/:userId`

Used for:

- admin metrics
- admin user listing
- admin access to prediction history
- admin delete actions

#### Chat routes

- `GET /chat/contacts`
- `GET /chat/messages`
- `POST /chat/messages`
- `DELETE /chat/threads/:withUserId`

Used for:

- contact discovery
- fetching messages
- sending messages
- deleting a chat thread

#### Community routes

- `GET /community/posts`
- `POST /community/posts`
- `DELETE /community/posts/:postId`

Used for:

- feed listing
- post creation with image upload
- post deletion

#### MQTT validation routes

- `POST /mqtt/validate`
- `POST /mqtt/validate.`

Used for:

- broker CONNECT validation
- ACL validation
- compatibility with broker callback variants

### Backend domain model

Major tables/entities include:

- `User`
- `Device`
- `SoilRecord`
- `RefreshToken`
- `PredictionHistory`
- `ChatMessage`
- `CommunityPost`
- `Crop`
- `Alert`
- `AuditLog`

### Backend security model

#### User auth

- access tokens for API calls
- refresh token rotation
- refresh token hashing and revocation

#### Device auth

- devices authenticate with device ID + one-time device secret
- device secret is stored as bcrypt hash
- backend signs a short-lived device JWT
- device JWT uses a separate secret from user JWTs

#### Authorization

- auth middleware
- role-based checks
- ownership checks in service layer

#### MQTT authorization

- topic regex validation
- no wildcard abuse
- topic-device binding
- device status/user binding revalidation
- broker callback decision from backend

#### Audit and logging

- audit events for sensitive actions
- structured logging
- correlation IDs per request

### Backend service methods

#### Auth service

- `register`
- `login`
- `refresh`
- `logout`

#### Device auth service

- `generateDeviceSecret`
- `hashDeviceSecret`
- `verifyDeviceSecret`
- `authenticateDevice`

#### Device service

- `getMyDevices`
- `getMyDeviceById`
- `getDeviceStatus`
- `createDevice`
- `provisionDevice`
- `updateMyDevice`
- `preDeleteDevice`
- `finalizeDeleteDevice`
- `getLiveDeviceData`
- `syncDeviceData`

#### Soil service

- `createSoilRecord`
- `getSoilHistory`
- `getLatestSoilRecord`

#### Predictor service

- `runPrediction`
- `fertilizerRecommendation`
- `waterRecommendation`
- `yieldEstimation`
- `diseasePrediction`
- `sendPredictionMail`
- `recordPredictionHistory`

#### MQTT broker validation service

- `handleConnectAuth`
- `handleAclCheck`
- `handleSuperuserCheck`
- `evaluateMqttValidation`

#### Alert service

- `processMoistureAlerts`
- `createDeviceOfflineAlert`
- `resolveDeviceOfflineAlert`

### Backend realtime layer

Socket.IO is used for live user updates.

Events emitted include:

- `device:update`
- `alert:new`
- `alert:resolved`

Frontend clients join a room named with the user ID, and the backend emits updates to that room.

### Backend background jobs

#### Offline monitor

Used for:

- finding devices that stopped reporting
- setting them offline
- creating offline alerts

#### Prediction history retention

Used for:

- cleaning old prediction history entries

#### Community post retention

Used for:

- cleaning expired community posts
- deleting post images from disk

---

## 10. ML Service: What It Is and What It Does

The ML service is a separate Python application built with FastAPI.

### Main ML responsibilities

- serve prediction endpoints
- load production model artifacts
- train models
- retrain models
- register candidate models
- promote better models
- monitor drift and performance

### ML API endpoints

- `GET /health`
- `POST /predict/yield`
- `POST /predict/price`
- `POST /predict/disease`

Important note:

- the ML service supports yield, price, and disease
- the main backend currently uses yield and disease in user-facing flows
- price forecasting support exists in ML but is not fully surfaced in the current backend/frontend user flow

### ML models used

#### 1. Yield model

Algorithm:

- LightGBM regression

Used for:

- predicting `yield_per_hectare`

Input style:

- tabular agricultural data

#### 2. Price model

Algorithm:

- LightGBM regression

Used for:

- predicting future price per quintal

Input style:

- time-ordered tabular market/weather data

#### 3. Disease model

Algorithm:

- MobileNetV3Large image classification model

Used for:

- detecting plant disease from uploaded images

Input style:

- image bytes

### ML algorithms explained simply

#### LightGBM

LightGBM is a gradient boosting tree algorithm.

It builds many decision trees in sequence.
Each new tree tries to fix the errors made by previous trees.

Why it is used here:

- strong performance on tabular data
- handles mixed numeric and categorical engineered features well
- fast training and inference

#### MobileNetV3Large

MobileNetV3Large is a convolutional neural network for image classification.

It is a pretrained vision backbone.
FarmCast uses transfer learning:

- reuse ImageNet-trained weights
- keep many layers frozen
- fine-tune only part of the network
- add a small classification head for disease classes

Why it is used here:

- efficient for image tasks
- good balance of speed and accuracy
- practical for production and retraining

### ML feature engineering

#### Yield feature engineering

Features include:

- state
- district
- crop type
- soil type
- season
- rainfall total
- average temperature
- average humidity
- area
- year
- crop duration days

Techniques used:

- text normalization
- leakage column rejection
- season-to-duration mapping
- numeric coercion
- one-hot encoding for categorical features

#### Price feature engineering

Features include:

- state
- district
- crop type
- season
- mandi ID
- rainfall
- demand index
- seasonal sine/cosine
- rainfall x demand interaction
- lag features
- rolling mean

Techniques used:

- sequential ordering by time
- lag features: previous weeks influence current prediction
- rolling mean: short-term trend smoothing
- cyclical encoding using sine/cosine for week seasonality
- interaction feature between rainfall and demand

#### Disease feature pipeline

Techniques used:

- image verification and corruption checks
- minimum images per class enforcement
- stratified train/validation split
- image resizing
- one-hot label encoding
- augmentation layer
- MobileNetV3 preprocessing

### ML training techniques

#### Split techniques

- yield: time-aware split
- price: sequential split
- disease: stratified split

These avoid unrealistic evaluation.

For example:

- a time-aware split prevents training on future data and validating on past data

#### Hyperparameter tuning

Tool used:

- Optuna

Technique:

- TPE sampler
- multiple trials over model parameter space
- choose best trial by validation metric

#### Early stopping

Used in:

- yield LightGBM
- price LightGBM
- disease callbacks

Purpose:

- stop training when model stops improving
- reduce overfitting

#### Deterministic training

Configured using:

- fixed random seeds
- deterministic runtime setup

Purpose:

- reproducibility

#### Model promotion

The registry only promotes a candidate if its metrics are better than current production according to configured objectives.

Examples:

- disease: maximize accuracy and recall
- yield: maximize `r2`, minimize `mae`
- price: minimize `mape`, minimize `mae`

### ML monitoring techniques

#### PSI drift detection

PSI means Population Stability Index.

It compares the distribution of current data against reference data.

Used for:

- checking whether production inputs drift away from training/reference distribution

#### Rolling MAE monitor

It tracks the recent absolute errors in a fixed-size window.

Used for:

- detecting degradation in recent prediction performance

---

## 11. Firmware: What It Is and What It Does

The firmware is the code running on the ESP32 field device.

### Firmware responsibilities

- boot and initialize hardware/runtime
- read soil and GPS data
- connect to Wi-Fi
- authenticate with backend
- connect to MQTT
- publish telemetry and heartbeat
- receive OTA commands
- receive Wi-Fi update commands
- support provisioning through USB serial
- support secure factory reset

### Firmware runtime state machine

The device moves through states such as:

- provisioning
- connecting Wi-Fi
- authenticating
- online

### Important firmware services

#### `WifiService`

Used for:

- Wi-Fi connection
- reconnect logic

#### `AuthService`

Used for:

- device auth against backend
- storing device JWT in memory
- JWT refresh logic
- detecting repeated permanent auth failure

If auth repeatedly fails with backend rejection, the firmware can trigger a factory reset recovery path.

#### `MqttService`

Used for:

- broker connection
- publish telemetry
- publish heartbeat
- publish system reset events
- subscribe to OTA topic
- subscribe to Wi-Fi update topic

#### `SoilSensorService`

Used for:

- reading moisture
- reading temperature
- validating sensor values

#### `GpsService`

Used for:

- reading GPS NMEA data
- deciding if GPS fix is trustworthy

#### `OtaService`

Used for:

- receiving OTA metadata
- downloading firmware over HTTPS
- verifying SHA-256 checksum
- writing update
- rebooting after success

#### `DeviceIdentityService`

Used for:

- storing device identity data in NVS
- reading saved provisioning materials
- clearing data during reset

### USB provisioning flow

The browser talks to the ESP32 using Web Serial.

Supported commands include:

- `GET_FIRMWARE_INFO`
- provisioning JSON payload
- `FACTORY_RESET`

The provisioning payload contains items such as:

- device ID
- Wi-Fi SSID/password
- device secret
- backend API base URL
- MQTT host/port

### Telemetry packet contents

The firmware publishes data including:

- moisture
- temperature
- latitude
- longitude
- battery
- firmware version
- timestamp
- `gpsValid`
- `soilValid`

### Firmware safety/quality techniques

- reconnect backoff
- token expiry awareness
- invalid sensor rejection
- GPS warmup and quality filtering
- OTA checksum verification
- factory reset cleanup
- optional deep sleep support

---

## 12. Main Algorithms and Techniques Explained

## 12.1 Yield Prediction Algorithm

### What it does

Predicts expected crop yield per hectare.

### Model

- LightGBM regressor

### Feature technique

- categorical features are one-hot encoded
- numeric features are passed through
- time-aware split preserves chronological order
- Optuna tunes parameters
- early stopping prevents waste and overfitting

### Why this approach fits

Yield prediction is a tabular supervised regression problem.
Gradient boosting trees are a strong fit for that kind of data.

## 12.2 Price Forecasting Algorithm

### What it does

Predicts market price per quintal.

### Model

- LightGBM regressor

### Feature technique

- lag features capture previous market behavior
- rolling mean captures local trend
- seasonal sine/cosine captures cyclical calendar effects
- interaction feature captures rainfall-demand combined effect
- sequential validation avoids future leakage

### Why this approach fits

Price prediction is still treated as tabular regression, but with explicit time-series-inspired engineered features.

## 12.3 Disease Detection Algorithm

### What it does

Predicts crop disease from an uploaded plant image.

### Model

- MobileNetV3Large with transfer learning

### Techniques used

- pretrained ImageNet weights
- partial backbone freezing
- augmentation
- weighted categorical cross-entropy
- dropout
- top-k output ranking

### Why this approach fits

Image classification needs a convolutional network or similar vision model. MobileNetV3 gives a practical balance between efficiency and accuracy.

## 12.4 Alerting Logic

### Moisture alerts

Backend compares reported moisture against threshold values.

If:

- below minimum threshold -> create `MOISTURE_LOW`
- above maximum threshold -> create `MOISTURE_HIGH`
- back to normal -> resolve active alert

### Offline alerts

If a device has not been seen recently enough, the offline monitor marks it offline and creates `DEVICE_OFFLINE`.

## 12.5 MQTT Security Logic

### Checks performed

- topic matches expected format
- JWT is valid
- topic device ID matches session device ID
- client is not using wildcard abuse
- device still exists and still belongs to the expected user

This is one of the most important security techniques in the codebase.

## 12.6 Firmware Sensor Validation Logic

### Soil sensor validation

- multiple ADC samples
- range checks
- noisy/floating signal rejection
- temperature fallback when reading is invalid
- manual raw ADC to moisture percentage mapping

### GPS validation

- warmup period
- minimum satellite count
- HDOP threshold
- stable cycles before accepting a fix
- timeout detection

---

## 13. End-to-End Flows

## 13.1 Device Provisioning Flow

1. User opens provisioning wizard in frontend.
2. Browser connects to ESP32 using Web Serial.
3. Frontend asks backend for a provisioned device identity and secret.
4. Backend creates device code and one-time secret.
5. Frontend writes payload to ESP32.
6. ESP32 stores it in NVS and reboots or proceeds to runtime.
7. ESP32 connects Wi-Fi and authenticates with backend.
8. Backend issues device JWT.
9. ESP32 connects to MQTT.
10. Backend sees heartbeat/telemetry and the frontend confirms device is online.

## 13.2 Telemetry Flow

1. ESP32 reads soil and GPS.
2. Firmware validates sensor quality.
3. Firmware publishes telemetry via MQTT.
4. Broker accepts or rejects based on backend auth callback.
5. Backend subscriber processes message.
6. Backend stores `SoilRecord`.
7. Backend updates device status and location.
8. Backend runs alert checks.
9. Backend emits realtime updates to frontend.

## 13.3 Prediction Flow

1. User submits predictor form.
2. Frontend calls backend predictor route.
3. Backend validates input.
4. Backend calls ML service.
5. ML service loads production model and runs inference.
6. Backend enriches results with recommendations or summaries.
7. Backend stores prediction history.
8. Frontend renders result.

## 13.4 Secure Delete Flow

1. Frontend starts delete flow.
2. Backend `pre-delete` marks the device pending deletion.
3. Frontend connects to ESP32 over USB serial.
4. Frontend sends `FACTORY_RESET`.
5. Firmware clears identity data.
6. Backend `finalize-delete` unbinds the device and clears retained MQTT topics.

## 13.5 OTA Flow

1. Device receives OTA command on MQTT.
2. Firmware validates target version.
3. Firmware downloads new image through HTTPS.
4. Firmware computes SHA-256 checksum.
5. Firmware compares checksum to expected checksum.
6. If valid, firmware applies update and reboots.

---

## 14. What Each Major Part Is Used For

### Frontend

Used for:

- all user interaction
- dashboard and visual views
- prediction forms
- admin access
- serial provisioning and secure delete

### Backend

Used for:

- system orchestration
- security enforcement
- persistence
- device lifecycle
- MQTT ingestion
- alerting
- realtime push
- ML service integration

### ML service

Used for:

- prediction inference
- model training
- model retraining
- artifact registry and promotion
- monitoring and quality enforcement

### Firmware

Used for:

- field-side hardware behavior
- secure connection to platform
- telemetry publishing
- OTA
- reset/provisioning workflows

### MQTT broker

Used for:

- reliable device message transport
- publish/subscribe routing
- device-to-platform messaging

### Docker

Used for:

- local broker deployment
- broker config isolation
- consistent MQTT environment

---

## 15. Important Design Decisions

### 1. Separate user auth and device auth

Why:

- user sessions and device sessions have very different trust models

### 2. MQTT broker asks backend for auth decisions

Why:

- lets the backend enforce current device status and ownership in real time

### 3. Secure delete is two-stage

Why:

- prevents a remote delete from orphaning a still-running physical device

### 4. ML service is separate from backend

Why:

- keeps model runtime separate from API/business logic
- allows different dependencies and scaling path

### 5. Production model registry and promotion logic

Why:

- avoids blindly replacing models
- keeps model lifecycle auditable

---

## 16. Current Strengths of the Codebase

- strong separation of concerns
- real device lifecycle support
- explicit MQTT security model
- dedicated ML pipeline and registry
- end-to-end architecture is coherent
- good operational flows for IoT provisioning and deletion
- real-time updates through Socket.IO

---

## 17. Current Gaps or Observations

- frontend does not appear to have a dedicated automated test suite
- price prediction exists in ML but is not as fully wired into the main user flow as yield and disease
- local development defaults are non-TLS in some paths, which is acceptable for local development but not for production
- the repository includes both `docker/` and `mqtt/` config/runtime locations, so deployment discipline matters

---

## 18. Final Summary

FarmCast is a multi-layer precision agriculture platform with:

- a React dashboard for users and admins
- a Node.js backend for orchestration and security
- an ESP32 firmware runtime for field devices
- a FastAPI ML service for prediction and training
- Mosquitto MQTT messaging secured by backend callback auth
- Docker-based local broker deployment

The most important technical patterns in the project are:

- secure device provisioning
- MQTT topic-level authorization
- realtime telemetry processing
- threshold-based alerting
- LightGBM regression for tabular prediction
- MobileNetV3 transfer learning for image disease detection
- model registry and promotion gating
- USB-assisted physical device lifecycle workflows

This makes FarmCast not just a dashboard or not just an IoT project, but a complete connected system spanning hardware, messaging, backend services, ML, and user interfaces.
