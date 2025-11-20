import { io } from "socket.io-client";
import { authService } from "./services";

/**
 * Centralised Socket.IO client for SafePath.
 * - Uses REST API base URL (NEXT_PUBLIC_API_URL) and strips `/api` for WebSocket root.
 * - Handles auth token (optional).
 * - Provides simple pub/sub API for app components.
 */
class WebSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventHandlers = new Map(); // eventName -> [handlers]
  }

  /**
   * Compute backend base URL for Socket.IO from NEXT_PUBLIC_API_URL.
   * Fallback: localhost in dev.
   */
  getBaseUrl() {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

    // Remove trailing `/api` or `/api/` safely
    return apiBase.replace(/\/api\/?$/, "");
  }

  /**
   * Establish (or return existing) WebSocket connection.
   * Safe to call multiple times.
   */
  connect() {
    // Avoid running on server (Next.js SSR)
    if (typeof window === "undefined") {
      console.warn("WebSocketClient.connect() called on server – ignored.");
      return null;
    }

    if (this.socket && this.connected) {
      return this.socket;
    }

    const token = authService?.getToken?.();
    const baseUrl = this.getBaseUrl();

    const config = {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      transports: ["websocket", "polling"],
    };

    // Add auth token if available (optional)
    if (token) {
      config.auth = { token };
    }

    console.log("🔌 Connecting WebSocket to:", baseUrl);
    this.socket = io(baseUrl, config);

    // ---- Core connection lifecycle handlers ----

    this.socket.on("connect", () => {
      console.log("✅ WebSocket connected:", this.socket.id);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.triggerEvent("connection", { connected: true, id: this.socket.id });
    });

    this.socket.on("disconnect", (reason) => {
      console.log("⚠️ WebSocket disconnected:", reason);
      this.connected = false;
      this.triggerEvent("connection", { connected: false, reason });
    });

    this.socket.on("connect_error", () => {
      this.reconnectAttempts += 1;

      if (this.reconnectAttempts === 1) {
        console.log("⚠️ WebSocket connection failed, will retry...");
      }

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log("❌ WebSocket unavailable – real-time features disabled");
        if (this.socket) {
          this.socket.disconnect();
        }
        this.triggerEvent("error", {
          type: "connection_failed",
          message: "Real-time features unavailable",
        });
      }
    });

    this.socket.on("error", (error) => {
      console.error("WebSocket error:", error);
      this.triggerEvent("error", {
        type: "socket_error",
        message: error?.message || "WebSocket error occurred",
      });
    });

    // ---- Domain-specific events ----

    this.socket.on("new_hazard", (data) => {
      console.log("📥 Received new hazard:", data);
      this.triggerEvent("new_hazard", data);
    });

    this.socket.on("hazard_update", (data) => {
      console.log("📥 Received hazard update:", data);
      this.triggerEvent("hazard_update", data);
    });

    this.socket.on("nearby_hazards", (data) => {
      console.log("📥 Received nearby hazards:", data);
      this.triggerEvent("nearby_hazards", data);
    });

    return this.socket;
  }

  /**
   * Manually close connection and clear handlers.
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.eventHandlers.clear();
      console.log("🔌 WebSocket disconnected manually");
    }
  }

  /**
   * Subscribe to hazards in a given area.
   */
  subscribeToHazards(latitude, longitude, radius = 5000) {
    if (!this.socket || !this.connected) {
      // WebSocket not ready yet - silently ignore
      return false;
    }

    this.socket.emit("subscribe_hazards", { latitude, longitude, radius });
    console.log(
      `📡 Subscribed to hazards at [${latitude}, ${longitude}] with radius ${radius}m`
    );
    return true;
  }

  /**
   * Unsubscribe from hazard updates.
   */
  unsubscribeFromHazards() {
    if (!this.socket || !this.connected) {
      return false;
    }

    this.socket.emit("unsubscribe_hazards");
    console.log("📡 Unsubscribed from hazard updates");
    return true;
  }

  /**
   * Send current user position for nearby hazard detection.
   * @param {number} latitude
   * @param {number} longitude
   * @param {number} radius - meters (default 1500)
   */
  sendUserPosition(latitude, longitude, radius = 1500) {
    if (!this.socket || !this.connected) {
      // WebSocket not ready yet - silently ignore
      return false;
    }

    this.socket.emit("user_position", { latitude, longitude, radius });
    console.log(
      `📍 Sent user position: [${latitude}, ${longitude}] with radius ${radius}m`
    );
    return true;
  }

  /**
   * Start watching user position and automatically send updates.
   * @param {Function} onPosition - callback on each new position
   * @param {Function} onError - callback on geolocation error
   * @param {number} radius - meters
   * @returns {number|null} watchId
   */
  startPositionTracking(onPosition, onError, radius = 1500) {
    if (typeof window === "undefined" || !navigator?.geolocation) {
      console.error("Geolocation not supported");
      if (onError) onError("Geolocation not supported");
      return null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        // Send position to server
        this.sendUserPosition(latitude, longitude, radius);

        // Trigger callback
        if (onPosition) {
          onPosition({ latitude, longitude, accuracy });
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        if (onError) {
          onError(error.message);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000, // accept cached position up to 10s old
        timeout: 5000,
      }
    );

    return watchId;
  }

  /**
   * Stop watching user position.
   * @param {number} watchId
   */
  stopPositionTracking(watchId) {
    if (typeof window !== "undefined" && watchId && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
      console.log("🛑 Stopped position tracking");
    }
  }

  /**
   * Subscribe to a WebSocketClient-level event.
   * @param {string} eventName
   * @param {Function} callback
   */
  on(eventName, callback) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(callback);
  }

  /**
   * Unsubscribe from events.
   * - If callback provided: remove only that handler.
   * - If no callback: remove all handlers for that event.
   */
  off(eventName, callback) {
    if (!this.eventHandlers.has(eventName)) return;

    if (callback) {
      const handlers = this.eventHandlers.get(eventName);
      const index = handlers.indexOf(callback);
      if (index > -1) handlers.splice(index, 1);
    } else {
      this.eventHandlers.delete(eventName);
    }
  }

  /**
   * Internal: fire event handlers.
   */
  triggerEvent(eventName, data) {
    if (!this.eventHandlers.has(eventName)) return;

    const handlers = this.eventHandlers.get(eventName);
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for "${eventName}":`, error);
      }
    });
  }

  /**
   * Connection helpers.
   */
  isConnected() {
    return this.connected && this.socket !== null;
  }

  getConnectionId() {
    return this.socket?.id || null;
  }
}

const websocketClient = new WebSocketClient();
export default websocketClient;
