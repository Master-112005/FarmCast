import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import L from "leaflet";

import { getLatestSoilRecord } from "../../services/deviceService";

const LATEST_POSITION_REFRESH_MS = 10000;
const LATEST_POSITION_NO_DATA_BACKOFF_MS = 60000;

const ICONS = {
  default: "/leaflet/icons/device.png",
  compromised: "/leaflet/icons/alert.png",
  crop: "/leaflet/icons/crop.png",
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidLatitude = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= -90 &&
  value <= 90;

const isValidLongitude = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= -180 &&
  value <= 180;

const isZeroCoordinate = (lat, lng) =>
  Math.abs(lat) < 0.000001 &&
  Math.abs(lng) < 0.000001;

const isValidLatLng = (lat, lng) =>
  isValidLatitude(lat) &&
  isValidLongitude(lng) &&
  !isZeroCoordinate(lat, lng);

const escapeText = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const DeviceMap = ({ devices, weatherData = [] }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const deviceLayerRef = useRef(L.layerGroup());
  const weatherLayerRef = useRef(L.layerGroup());
  const boundaryLayerRef = useRef(null);
  const noDataBackoffUntilRef = useRef({});

  const [latestPositions, setLatestPositions] = useState({});

  const deviceIdsKey = useMemo(
    () =>
      devices
        .map((device) => device?.id)
        .filter(Boolean)
        .sort()
        .join("|"),
    [devices]
  );

  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "OpenStreetMap contributors" }
    ).addTo(mapRef.current);
    mapRef.current.fitWorld();

    deviceLayerRef.current.addTo(mapRef.current);
    weatherLayerRef.current.addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let refreshTimer = null;

    const loadLatestPositions = async () => {
      const deviceIds = deviceIdsKey
        ? deviceIdsKey.split("|")
        : [];

      if (deviceIds.length === 0) {
        if (active) {
          setLatestPositions({});
        }
        return;
      }

      const responses = await Promise.all(
        deviceIds.map(async (deviceId) => {
          const nextAllowedAt =
            noDataBackoffUntilRef.current[deviceId] || 0;
          if (Date.now() < nextAllowedAt) {
            return null;
          }

          const response = await getLatestSoilRecord(deviceId);

          if (!response?.success) {
            if (response?.status === 404) {
              noDataBackoffUntilRef.current[deviceId] =
                Date.now() + LATEST_POSITION_NO_DATA_BACKOFF_MS;
            }
            return null;
          }

          if (!response?.data) {
            return null;
          }

          noDataBackoffUntilRef.current[deviceId] = 0;

          const lat = toNumber(
            response.data?.latitude ?? response.data?.lat
          );
          const lng = toNumber(
            response.data?.longitude ?? response.data?.lng
          );

          if (!isValidLatLng(lat, lng)) {
            return null;
          }

          return {
            deviceId,
            latitude: lat,
            longitude: lng,
            measuredAt:
              response.data?.createdAt ||
              response.data?.recordedAt ||
              null,
          };
        })
      );

      if (!active) return;

      const next = {};
      responses.forEach((record) => {
        if (!record) return;
        next[record.deviceId] = {
          latitude: record.latitude,
          longitude: record.longitude,
          measuredAt: record.measuredAt,
        };
      });

      setLatestPositions(next);
    };

    const runLoadCycle = async () => {
      await loadLatestPositions();
      if (!active) {
        return;
      }
      refreshTimer = setTimeout(
        runLoadCycle,
        LATEST_POSITION_REFRESH_MS
      );
    };

    runLoadCycle();

    return () => {
      active = false;
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [deviceIdsKey]);

  useEffect(() => {
    if (!mapRef.current) return;

    deviceLayerRef.current.clearLayers();

    const markerPositions = [];

    devices.forEach((device) => {
      const fromDeviceLat = toNumber(
        device.latitude ?? device.lat
      );
      const fromDeviceLng = toNumber(
        device.longitude ?? device.lng
      );

      const latest = latestPositions[device.id] || null;

      const lat = isValidLatLng(fromDeviceLat, fromDeviceLng)
        ? fromDeviceLat
        : latest?.latitude;
      const lng = isValidLatLng(fromDeviceLat, fromDeviceLng)
        ? fromDeviceLng
        : latest?.longitude;

      if (!isValidLatLng(lat, lng)) {
        return;
      }

      markerPositions.push([lat, lng]);

      let iconUrl = ICONS.default;
      if (device.trust_level === "compromised") {
        iconUrl = ICONS.compromised;
      }
      if (
        device.device_type === "crop-sensor" ||
        device.type === "crop-sensor"
      ) {
        iconUrl = ICONS.crop;
      }

      const icon = L.icon({
        iconUrl,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const popupHtml = `
        <div class="fc-map-popup">
          <strong>${escapeText(device.deviceName || device.name || "Device")}</strong><br/>
          ID: ${escapeText(device.deviceId || device.deviceCode || device.id)}<br/>
          Type: ${escapeText(device.device_type || device.type || "unknown")}<br/>
          Status: ${escapeText(device.device_status || device.status || "unknown")}<br/>
          Trust: ${escapeText(device.trust_level || "unknown")}<br/>
          Last Seen: ${escapeText(device.lastSeenAt || latest?.measuredAt || "Unknown")}
        </div>
      `;

      L.marker([lat, lng], { icon })
        .bindPopup(popupHtml)
        .addTo(deviceLayerRef.current);
    });

    if (markerPositions.length > 0) {
      mapRef.current.fitBounds(
        L.latLngBounds(markerPositions),
        { padding: [24, 24], maxZoom: 17 }
      );
    }
  }, [devices, latestPositions]);

  useEffect(() => {
    if (!mapRef.current) return;

    weatherLayerRef.current.clearLayers();

    weatherData.forEach((weather) => {
      const latitude = toNumber(weather.latitude);
      const longitude = toNumber(weather.longitude);

      if (!isValidLatLng(latitude, longitude)) {
        return;
      }

      const popupHtml = `
        <div class="fc-map-popup">
          Weather: ${escapeText(weather.description || "-")}<br/>
          Temp: ${weather.temperature ?? "-"} C<br/>
          Humidity: ${weather.humidity ?? "-"} %
        </div>
      `;

      L.circleMarker([latitude, longitude], {
        radius: 6,
        color: "#ffffff",
        weight: 1,
        fillColor: "#2563eb",
        fillOpacity: 0.6,
      })
        .bindPopup(popupHtml)
        .addTo(weatherLayerRef.current);
    });
  }, [weatherData]);

  useEffect(() => {
    if (!mapRef.current) return;

    fetch("/leaflet/overlays/farm-boundary.geojson")
      .then((res) => res.json())
      .then((geojson) => {
        boundaryLayerRef.current = L.geoJSON(geojson, {
          style: {
            color: "#16a34a",
            weight: 2,
            fillOpacity: 0.15,
          },
          onEachFeature: (_, layer) => {
            layer.bindPopup("Farm Boundary");
          },
        }).addTo(mapRef.current);
      })
      .catch(() => {
        console.warn("Farm boundary overlay unavailable.");
      });
  }, []);

  return (
    <section
      ref={containerRef}
      className="fc-map"
      aria-label="Device geospatial map"
    />
  );
};

DeviceMap.propTypes = {
  devices: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      deviceId: PropTypes.string,
      deviceName: PropTypes.string,
      device_type: PropTypes.string,
      device_status: PropTypes.string,
      trust_level: PropTypes.string,
      lastSeenAt: PropTypes.string,
      latitude: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string,
      ]),
      longitude: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.string,
      ]),
    })
  ).isRequired,

  weatherData: PropTypes.arrayOf(
    PropTypes.shape({
      latitude: PropTypes.number.isRequired,
      longitude: PropTypes.number.isRequired,
      description: PropTypes.string,
      temperature: PropTypes.number,
      humidity: PropTypes.number,
    })
  ),
};

export default DeviceMap;
