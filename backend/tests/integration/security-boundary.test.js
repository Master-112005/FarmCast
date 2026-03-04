"use strict";

const { Op } = require("sequelize");
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const mockDb = {
  Sequelize: { Op },
  User: {
    findByPk: jest.fn(),
  },
  Device: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  SoilRecord: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Crop: {},
  Alert: {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  AuditLog: {
    create: jest.fn(),
  },
};

jest.mock("../../src/models", () => mockDb);
jest.mock("../../src/realtime/socket", () => ({
  getIO: () => null,
}));
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  begin: jest.fn(),
}));

const env = require("../../src/config/env");
const deviceRoutes = require("../../src/modules/devices/device.routes");
const mqttRoutes = require("../../src/modules/mqtt/mqtt.routes");
const notFoundMiddleware = require("../../src/middlewares/notFound.middleware");
const errorMiddleware = require("../../src/middlewares/error.middleware");

const USER_A = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "user",
  email: "user-a@example.com",
  isActive: true,
};

const USER_B = {
  id: "22222222-2222-4222-8222-222222222222",
  role: "user",
  email: "user-b@example.com",
  isActive: true,
};

const DEVICE_A = "fc-AB12CD34";
const DEVICE_B = "fc-EF56GH78";
const DEVICE_PK = "33333333-3333-4333-8333-333333333333";

const signUserJwt = (user) =>
  jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    env.AUTH.JWT_SECRET,
    {
      expiresIn: "10m",
      issuer: env.AUTH.JWT_ISSUER,
      audience: env.AUTH.JWT_AUDIENCE,
      algorithm: env.AUTH.JWT_ALGORITHM,
    }
  );

const signDeviceJwt = ({
  deviceId,
  userId,
  expiresIn = "10m",
}) =>
  jwt.sign(
    {
      sub: "device",
      type: "device",
      deviceId,
      userId,
    },
    env.DEVICE_AUTH.JWT_SECRET,
    {
      expiresIn,
      issuer: env.DEVICE_AUTH.JWT_ISSUER,
      audience: env.DEVICE_AUTH.JWT_AUDIENCE,
      algorithm: env.DEVICE_AUTH.JWT_ALGORITHM,
    }
  );

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const correlationId = req.headers["x-correlation-id"] || "test-correlation-id";
    req.correlationId = correlationId;
    res.setHeader("x-correlation-id", correlationId);
    next();
  });

  app.use("/api/v1/devices", deviceRoutes);
  app.use("/api/v1/mqtt", mqttRoutes);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};

describe("Security boundary integration", () => {
  const app = createTestApp();
  const userAToken = signUserJwt(USER_A);
  const userBToken = signUserJwt(USER_B);

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb.User.findByPk.mockImplementation(async (id) => {
      if (id === USER_A.id) return { ...USER_A };
      if (id === USER_B.id) return { ...USER_B };
      return null;
    });

    mockDb.Device.count.mockResolvedValue(0);
    mockDb.Device.update.mockResolvedValue([1]);
    mockDb.AuditLog.create.mockResolvedValue({
      id: "audit-row-id",
    });
  });

  describe("POST /api/v1/devices/provision", () => {
    test("201 success and ownership binding to authenticated user", async () => {
      mockDb.Device.findOne.mockResolvedValueOnce(null);
      mockDb.Device.create.mockResolvedValueOnce({
        id: DEVICE_PK,
      });

      const response = await request(app)
        .post("/api/v1/devices/provision")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          deviceName: "Field Sensor 1",
          userId: USER_B.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.deviceId).toMatch(
        /^fc-[A-Z0-9]{8}$/
      );
      expect(response.body.data.deviceName).toBe("Field Sensor 1");
      expect(response.body.data.deviceSecret).toEqual(expect.any(String));
      expect(response.body.data.deviceSecret).toHaveLength(64);
      expect(mockDb.Device.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceCode: expect.stringMatching(
            /^fc-[A-Z0-9]{8}$/
          ),
          userId: USER_A.id,
        })
      );
    });

    test("401 when JWT is missing", async () => {
      const response = await request(app)
        .post("/api/v1/devices/provision")
        .send({
          deviceName: "Field Sensor 1",
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("AUTH_REQUIRED");
    });

    test("400 for missing deviceName", async () => {
      const response = await request(app)
        .post("/api/v1/devices/provision")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          deviceName: "",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(mockDb.Device.create).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/devices/auth", () => {
    test("valid secret issues device JWT", async () => {
      const secret = "device-secret-001";
      const hash = await bcrypt.hash(secret, 12);
      mockDb.Device.findOne.mockResolvedValueOnce({
        id: DEVICE_PK,
        deviceCode: DEVICE_A,
        userId: USER_A.id,
        status: "active",
        deviceSecretHash: hash,
      });

      const response = await request(app)
        .post("/api/v1/devices/auth")
        .send({
          deviceId: DEVICE_A,
          deviceSecret: secret,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toEqual(expect.any(String));

      const verified = jwt.verify(
        response.body.data.accessToken,
        env.DEVICE_AUTH.JWT_SECRET,
        {
          issuer: env.DEVICE_AUTH.JWT_ISSUER,
          audience: env.DEVICE_AUTH.JWT_AUDIENCE,
          algorithms: [env.DEVICE_AUTH.JWT_ALGORITHM],
        }
      );

      expect(verified.deviceId).toBe(DEVICE_A);
      expect(verified.userId).toBe(USER_A.id);
      expect(verified.sub).toBe("device");
    });

    test("invalid secret returns 401", async () => {
      const hash = await bcrypt.hash("valid-secret", 12);
      mockDb.Device.findOne.mockResolvedValueOnce({
        id: DEVICE_PK,
        deviceCode: DEVICE_A,
        userId: USER_A.id,
        status: "active",
        deviceSecretHash: hash,
      });

      const response = await request(app)
        .post("/api/v1/devices/auth")
        .send({
          deviceId: DEVICE_A,
          deviceSecret: "wrong-secret",
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("AUTH_REQUIRED");
    });

    test("rotated/expired secret scenario returns 401", async () => {
      const currentHash = await bcrypt.hash("new-active-secret", 12);
      mockDb.Device.findOne.mockResolvedValueOnce({
        id: DEVICE_PK,
        deviceCode: DEVICE_A,
        userId: USER_A.id,
        status: "active",
        deviceSecretHash: currentHash,
      });

      const response = await request(app)
        .post("/api/v1/devices/auth")
        .send({
          deviceId: DEVICE_A,
          deviceSecret: "old-stale-secret",
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("AUTH_REQUIRED");
    });

    test("device without owner binding is denied", async () => {
      const secret = "device-secret-002";
      const hash = await bcrypt.hash(secret, 12);
      mockDb.Device.findOne.mockResolvedValueOnce({
        id: DEVICE_PK,
        deviceCode: DEVICE_A,
        userId: null,
        status: "active",
        deviceSecretHash: hash,
      });

      const response = await request(app)
        .post("/api/v1/devices/auth")
        .send({
          deviceId: DEVICE_A,
          deviceSecret: secret,
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("GET /api/v1/devices/:id/status", () => {
    test("owner can read status (200)", async () => {
      mockDb.Device.findOne.mockResolvedValueOnce({
        id: DEVICE_PK,
        userId: USER_A.id,
        deviceCode: DEVICE_A,
        status: "active",
        isOnline: true,
        lastSeenAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/v1/devices/${DEVICE_A}/status`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.deviceId).toBe(DEVICE_A);
    });

    test("non-owner gets 403", async () => {
      mockDb.Device.findOne.mockResolvedValueOnce({
        id: DEVICE_PK,
        userId: USER_B.id,
        deviceCode: DEVICE_A,
        status: "active",
        isOnline: false,
        lastSeenAt: new Date(),
      });

      const response = await request(app)
        .get(`/api/v1/devices/${DEVICE_A}/status`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(response.status).toBe(403);
    });

    test("unknown identifier returns 404", async () => {
      mockDb.Device.findOne.mockResolvedValueOnce(null);

      const response = await request(app)
        .get(`/api/v1/devices/${DEVICE_B}/status`)
        .set("Authorization", `Bearer ${userBToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/v1/mqtt/validate", () => {
    test("expired JWT is rejected immediately", async () => {
      const expiredJwt = signDeviceJwt({
        deviceId: DEVICE_A,
        userId: USER_A.id,
        expiresIn: -10,
      });

      const response = await request(app)
        .post("/api/v1/mqtt/validate")
        .send({
          username: DEVICE_A,
          password: expiredJwt,
          clientid: "client-expired-jwt",
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("AUTH_REQUIRED");
    });

    test("topic ownership mismatch is rejected", async () => {
      const validJwt = signDeviceJwt({
        deviceId: DEVICE_A,
        userId: USER_A.id,
      });

      const connect = await request(app)
        .post("/api/v1/mqtt/validate")
        .send({
          username: DEVICE_A,
          password: validJwt,
          clientid: "client-topic-mismatch",
        });
      expect(connect.status).toBe(200);

      const aclCheck = await request(app)
        .post("/api/v1/mqtt/validate")
        .send({
          username: DEVICE_A,
          clientid: "client-topic-mismatch",
          topic: `devices/${DEVICE_B}/telemetry`,
          acc: 2,
        });

      expect(aclCheck.status).toBe(401);
      expect(aclCheck.body.code).toBe("AUTH_REQUIRED");
    });

    test("valid topic binding is accepted", async () => {
      const validJwt = signDeviceJwt({
        deviceId: DEVICE_A,
        userId: USER_A.id,
      });

      const connect = await request(app)
        .post("/api/v1/mqtt/validate")
        .send({
          username: DEVICE_A,
          password: validJwt,
          clientid: "client-valid-topic",
        });
      expect(connect.status).toBe(200);

      const aclCheck = await request(app)
        .post("/api/v1/mqtt/validate")
        .send({
          username: DEVICE_A,
          clientid: "client-valid-topic",
          topic: `devices/${DEVICE_A}/telemetry`,
          acc: 2,
        });

      expect(aclCheck.status).toBe(200);
      expect(aclCheck.body.data.allowed).toBe(true);
    });
  });
});
