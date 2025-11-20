import { io } from 'socket.io-client';
import { authService } from './services';

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventHandlers = new Map();
  }

  connect() {
    if (this.socket && this.connected) {
      return this.socket;
    }

    const token = authService.getToken();
    // Token is optional - WebSocket features work without authentication
    // but some features may be limited

    // Socket.IO connects to root path, not /api
    const baseUrl = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') 
      : 'http://localhost:5001';
    
    const config = {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      transports: ['websocket', 'polling']
    };
    
    // Add auth token if available
    if (token) {
      config.auth = { token };
    }
    
    this.socket = io(baseUrl, config);

    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket.id);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.triggerEvent('connection', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.connected = false;
      this.triggerEvent('connection', { connected: false, reason });
    });

    this.socket.on('connect_error', () => {
      // Silently handle connection errors on first few attempts
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts === 1) {
        console.log('WebSocket connection failed, will retry...');
      }
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        // Stop trying to reconnect after max attempts
        console.log('WebSocket unavailable - real-time features disabled');
        if (this.socket) {
          this.socket.disconnect();
        }
        this.triggerEvent('error', {
          type: 'connection_failed',
          message: 'Real-time features unavailable'
        });
      }
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.triggerEvent('error', {
        type: 'socket_error',
        message: error.message || 'WebSocket error occurred'
      });
    });

    this.socket.on('new_hazard', (data) => {
      console.log('Received new hazard:', data);
      this.triggerEvent('new_hazard', data);
    });

    this.socket.on('hazard_update', (data) => {
      console.log('Received hazard update:', data);
      this.triggerEvent('hazard_update', data);
    });

    this.socket.on('nearby_hazards', (data) => {
      console.log('Received nearby hazards:', data);
      this.triggerEvent('nearby_hazards', data);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.eventHandlers.clear();
      console.log('WebSocket disconnected manually');
    }
  }

  subscribeToHazards(latitude, longitude, radius = 5000) {
    if (!this.socket || !this.connected) {
      // WebSocket not ready yet - silently return
      return false;
    }

    this.socket.emit('subscribe_hazards', {
      latitude,
      longitude,
      radius
    });

    console.log(`Subscribed to hazards at [${latitude}, ${longitude}] with radius ${radius}m`);
    return true;
  }

  unsubscribeFromHazards() {
    if (!this.socket || !this.connected) {
      return false;
    }

    this.socket.emit('unsubscribe_hazards');
    console.log('Unsubscribed from hazard updates');
    return true;
  }

  /**
   * Send current user position for nearby hazard detection
   * @param {number} latitude - User latitude
   * @param {number} longitude - User longitude
   * @param {number} radius - Search radius in meters (default 1500)
   */
  sendUserPosition(latitude, longitude, radius = 1500) {
    if (!this.socket || !this.connected) {
      // WebSocket not ready yet - silently return
      return false;
    }

    this.socket.emit('user_position', {
      latitude,
      longitude,
      radius
    });

    console.log(`Sent user position: [${latitude}, ${longitude}] with radius ${radius}m`);
    return true;
  }

  /**
   * Start watching user position and automatically send updates
   * @param {Function} onPosition - Callback when position updates
   * @param {Function} onError - Callback on geolocation error
   * @param {number} radius - Search radius in meters
   * @returns {number} - Watch ID for stopping position tracking
   */
  startPositionTracking(onPosition, onError, radius = 1500) {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      if (onError) {
        onError('Geolocation not supported');
      }
      return null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Send position to server
        this.sendUserPosition(latitude, longitude, radius);
        
        // Trigger callback
        if (onPosition) {
          onPosition({ latitude, longitude, accuracy: position.coords.accuracy });
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        if (onError) {
          onError(error.message);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000, // Accept cached position up to 10 seconds old
        timeout: 5000
      }
    );

    return watchId;
  }

  /**
   * Stop watching user position
   * @param {number} watchId - Watch ID from startPositionTracking
   */
  stopPositionTracking(watchId) {
    if (watchId && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
      console.log('Stopped position tracking');
    }
  }

  on(eventName, callback) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(callback);
  }

  off(eventName, callback) {
    if (!this.eventHandlers.has(eventName)) {
      return;
    }

    if (callback) {
      const handlers = this.eventHandlers.get(eventName);
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      this.eventHandlers.delete(eventName);
    }
  }

  triggerEvent(eventName, data) {
    if (!this.eventHandlers.has(eventName)) {
      return;
    }

    const handlers = this.eventHandlers.get(eventName);
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${eventName}:`, error);
      }
    });
  }

  isConnected() {
    return this.connected && this.socket !== null;
  }

  getConnectionId() {
    return this.socket?.id || null;
  }
}

const websocketClient = new WebSocketClient();

export default websocketClient;
