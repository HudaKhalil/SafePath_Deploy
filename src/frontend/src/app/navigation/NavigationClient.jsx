"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { LOCATION_CONFIG } from "../../lib/locationConfig";
import websocketClient from "../../lib/websocketClient";

const Map = dynamic(() => import("../../components/Map"), { ssr: false });

export default function NavigationClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Route info from URL params
  const routeId = searchParams.get("routeId");
  const routeName = searchParams.get("name");
  const routeType = searchParams.get("type");
  const routeDistance = searchParams.get("distance");
  const routeTime = searchParams.get("time");
  const routeSafety = searchParams.get("safety");

  // Navigation state
  const [currentPosition, setCurrentPosition] = useState(null);
  const [snappedPosition, setSnappedPosition] = useState(null); // Position snapped to route
  const [isTracking, setIsTracking] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState(0);
  const [heading, setHeading] = useState(0);
  const [hasArrived, setHasArrived] = useState(false);
  const [totalDistanceRemaining, setTotalDistanceRemaining] = useState(
    parseFloat(routeDistance) || 0
  );
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(
    parseInt(routeTime) || 0
  );
  const [routeProgress, setRouteProgress] = useState(0); // Percentage completed
  const [isOffRoute, setIsOffRoute] = useState(false); // User too far from route
  const [nearbyHazards, setNearbyHazards] = useState([]); // Hazards along route
  const [hazardAlerts, setHazardAlerts] = useState([]); // Active hazard warnings

  const watchIdRef = useRef(null);
  const synthesisRef = useRef(null);
  const lastPositionRef = useRef(null);
  const lastAnnouncementRef = useRef(0); // Prevent announcement spam
  const hazardCheckRef = useRef(0); // Last hazard check timestamp

  // Get route data from sessionStorage (stored when route was selected)
  useEffect(() => {
    try {
      const storedRoute = sessionStorage.getItem(`route_${routeId}`);
      if (storedRoute) {
        const route = JSON.parse(storedRoute);
        setRouteCoordinates(route.coordinates || []);
        setInstructions(route.instructions || []);
      }
    } catch (error) {
      console.error("Error loading route data:", error);
    }
  }, [routeId]);

  // Start GPS tracking
  useEffect(() => {
    if ("geolocation" in navigator) {
      const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      };

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const {
            latitude,
            longitude,
            heading: deviceHeading,
          } = position.coords;
          const rawPosition = [latitude, longitude];
          setCurrentPosition(rawPosition);

          // Snap position to route
          if (routeCoordinates.length > 0) {
            const snapped = snapToRoute(latitude, longitude);

            // More lenient threshold: 500m initially, 200m after first snap
            const threshold = lastPositionRef.current ? 0.2 : 0.5;

            if (snapped && snapped.distance < threshold) {
              setSnappedPosition(snapped.position);
              setIsOffRoute(false);
              lastPositionRef.current = snapped.position;

              // Calculate heading based on route direction
              if (snapped.segmentIndex < routeCoordinates.length - 1) {
                const nextPoint = routeCoordinates[snapped.segmentIndex + 1];
                const calculatedHeading = calculateBearing(
                  snapped.position[0],
                  snapped.position[1],
                  nextPoint[0],
                  nextPoint[1]
                );
                setHeading(calculatedHeading);
              } else if (deviceHeading !== null) {
                setHeading(deviceHeading);
              }

              // Update navigation progress
              updateNavigationProgress(
                snapped.position[0],
                snapped.position[1],
                snapped.segmentIndex
              );
            } else {
              // Only show off-route if we've successfully snapped before
              if (lastPositionRef.current) {
                setIsOffRoute(true);

                // Announce off-route warning (but not too frequently)
                const now = Date.now();
                if (now - lastAnnouncementRef.current > 10000) {
                  speak("You are off the planned route.");
                  lastAnnouncementRef.current = now;
                }
              }

              setSnappedPosition(rawPosition);

              if (deviceHeading !== null) {
                setHeading(deviceHeading);
              }
            }
          } else {
            // Route not loaded yet - don't show off-route warning
            setSnappedPosition(rawPosition);
            setIsOffRoute(false);
            if (deviceHeading !== null) {
              setHeading(deviceHeading);
            }
          }

          setIsTracking(true);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setIsTracking(false);
        },
        options
      );
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [routeCoordinates, instructions, currentInstructionIndex]);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthesisRef.current = window.speechSynthesis;
    }
  }, []);

  // Connect to WebSocket for hazard detection (optional feature)
  useEffect(() => {
    try {
      websocketClient.connect();

      websocketClient.on("nearby_hazards", (data) => {
        if (data.hazards && Array.isArray(data.hazards)) {
          setNearbyHazards(data.hazards);

          // Alert on high-risk hazards within 300m
          const criticalHazards = data.hazards.filter(
            (h) =>
              (h.severity === "high" || h.severity === "critical") &&
              h.distance_meters < 300
          );

          criticalHazards.forEach((hazard) => {
            const alertMessage = `Warning: ${hazard.hazard_type.replace(
              "_",
              " "
            )} ahead, ${Math.round(hazard.distance_meters)} meters away`;
            addHazardAlert(alertMessage, hazard.severity);
            speak(alertMessage);
          });
        }
      });
    } catch (error) {
      // WebSocket is optional - navigation works without it
      console.log(
        "WebSocket not available, continuing without real-time hazard updates"
      );
    }

    return () => {
      try {
        websocketClient.disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }
    };
  }, []);

  // Check for hazards along route periodically
  useEffect(() => {
    if (currentPosition && isTracking) {
      const now = Date.now();

      // Check for hazards every 15 seconds (if WebSocket is available)
      if (now - hazardCheckRef.current > 15000) {
        try {
          if (websocketClient.isConnected()) {
            websocketClient.sendUserPosition(
              currentPosition[0],
              currentPosition[1],
              500 // 500m radius for navigation
            );
          }
        } catch (error) {
          // Ignore errors if WebSocket is unavailable
        }
        hazardCheckRef.current = now;
      }
    }
  }, [currentPosition, isTracking]);

  const addHazardAlert = (message, severity) => {
    const alert = {
      id: Date.now(),
      message,
      severity,
      timestamp: new Date(),
    };

    setHazardAlerts((prev) => [alert, ...prev.slice(0, 2)]); // Keep last 3 alerts

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      setHazardAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    }, 15000);
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Calculate bearing between two points
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.cos(dLon);
    const bearing = Math.atan2(y, x);
    return ((bearing * 180) / Math.PI + 360) % 360; // Convert to degrees
  };

  // Find closest point on route and snap to it
  const snapToRoute = (currentLat, currentLon) => {
    if (routeCoordinates.length === 0) return null;

    let minDistance = Infinity;
    let closestPoint = null;
    let closestSegmentIndex = 0;

    // Find closest point on any route segment
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const segmentStart = routeCoordinates[i];
      const segmentEnd = routeCoordinates[i + 1];

      // Calculate closest point on this segment
      const snapped = closestPointOnSegment(
        currentLat,
        currentLon,
        segmentStart[0],
        segmentStart[1],
        segmentEnd[0],
        segmentEnd[1]
      );

      const dist = calculateDistance(
        currentLat,
        currentLon,
        snapped[0],
        snapped[1]
      );

      if (dist < minDistance) {
        minDistance = dist;
        closestPoint = snapped;
        closestSegmentIndex = i;
      }
    }

    return {
      position: closestPoint,
      segmentIndex: closestSegmentIndex,
      distance: minDistance,
    };
  };

  // Find closest point on a line segment
  const closestPointOnSegment = (px, py, ax, ay, bx, by) => {
    const atob = { x: bx - ax, y: by - ay };
    const atop = { x: px - ax, y: py - ay };
    const len = atob.x * atob.x + atob.y * atob.y;
    let dot = atop.x * atob.x + atop.y * atob.y;
    const t = Math.min(1, Math.max(0, dot / len));

    return [ax + atob.x * t, ay + atob.y * t];
  };

  // Update navigation progress
  const updateNavigationProgress = (currentLat, currentLon, segmentIndex) => {
    if (instructions.length === 0 || routeCoordinates.length === 0) return;

    // Check if arrived at destination
    const destination = routeCoordinates[routeCoordinates.length - 1];
    const distanceToDestination = calculateDistance(
      currentLat,
      currentLon,
      destination[0],
      destination[1]
    );

    if (distanceToDestination < 0.05) {
      // Within 50 meters
      setHasArrived(true);
      speak("You have arrived at your destination");
      return;
    }

    // Calculate route progress percentage
    const totalSegments = routeCoordinates.length - 1;
    const progress = ((segmentIndex / totalSegments) * 100).toFixed(0);
    setRouteProgress(progress);

    // Calculate remaining distance from current position
    let remaining = 0;

    // Distance from current position to next waypoint
    if (segmentIndex < routeCoordinates.length - 1) {
      remaining += calculateDistance(
        currentLat,
        currentLon,
        routeCoordinates[segmentIndex + 1][0],
        routeCoordinates[segmentIndex + 1][1]
      );
    }

    // Add distances of all remaining segments
    for (let i = segmentIndex + 1; i < routeCoordinates.length - 1; i++) {
      remaining += calculateDistance(
        routeCoordinates[i][0],
        routeCoordinates[i][1],
        routeCoordinates[i + 1][0],
        routeCoordinates[i + 1][1]
      );
    }
    setTotalDistanceRemaining(remaining);

    // Update estimated time (assuming average speed)
    const avgSpeed = routeType === "cycling" ? 15 : 5; // km/h
    const timeRemaining = (remaining / avgSpeed) * 60; // minutes
    setEstimatedTimeRemaining(Math.round(timeRemaining));

    // Find next turn instruction
    if (currentInstructionIndex < instructions.length - 1) {
      const instructionInterval = Math.floor(
        routeCoordinates.length / Math.max(instructions.length, 1)
      );
      const nextInstructionIndex =
        (currentInstructionIndex + 1) * instructionInterval;
      const nextInstructionPoint =
        routeCoordinates[
          Math.min(nextInstructionIndex, routeCoordinates.length - 1)
        ];

      if (nextInstructionPoint) {
        const distanceToNext = calculateDistance(
          currentLat,
          currentLon,
          nextInstructionPoint[0],
          nextInstructionPoint[1]
        );
        setDistanceToNextTurn(distanceToNext);

        if (distanceToNext < 0.1 && distanceToNext > 0.05) {
          // 50–100m
          const nextInstruction =
            instructions[currentInstructionIndex + 1]?.instruction ||
            "continue";
          const now = Date.now();
          if (now - lastAnnouncementRef.current > 5000) {
            speak(
              `In ${Math.round(
                distanceToNext * 1000
              )} meters, ${nextInstruction}`
            );
            lastAnnouncementRef.current = now;
          }
        } else if (distanceToNext < 0.05) {
          // Less than 50m
          const nextInstruction =
            instructions[currentInstructionIndex + 1]?.instruction ||
            "Continue straight";
          setCurrentInstructionIndex((prev) =>
            Math.min(prev + 1, instructions.length - 1)
          );
          speak(nextInstruction);
          lastAnnouncementRef.current = Date.now();
        }
      }
    }
  };

  const speak = (text) => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      synthesisRef.current.speak(utterance);
    }
  };

  const formatDistance = (km) => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
  };

  const getInstructionIcon = (instruction) => {
    const text = instruction?.toLowerCase() || "";
    if (text.includes("left")) return "↰";
    if (text.includes("right")) return "↱";
    if (text.includes("straight") || text.includes("continue")) return "↑";
    if (text.includes("arrive")) return "🏁";
    return "➤";
  };

  const exitNavigation = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
    }

    try {
      const routeData = {
        id: routeId,
        name: routeName,
        type: routeType,
        coordinates: routeCoordinates,
        distance: routeDistance,
        estimatedTime: routeTime,
        safetyRating: routeSafety,
        instructions: instructions,
        color: routeType === "fastest" ? "#3b82f6" : "#10b981",
      };

      sessionStorage.setItem("last_navigated_route", JSON.stringify(routeData));
      sessionStorage.setItem(
        `route_${routeId}`,
        JSON.stringify({
          coordinates: routeCoordinates,
          instructions: instructions,
          type: routeType,
          distance: routeDistance,
          time: routeTime,
          safety: routeSafety,
        })
      );
    } catch (error) {
      console.error("Error saving route data:", error);
    }

    router.push("/suggested-routes");
  };

  if (!routeCoordinates.length) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading navigation...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-900">
      {/* Hazard Alert Banners */}
      {hazardAlerts.length > 0 && (
        <div className="absolute top-0 left-0 right-0 z-50 p-4 space-y-2">
          {hazardAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg shadow-lg animate-pulse ${
                alert.severity === "critical" || alert.severity === "high"
                  ? "bg-red-500 text-white"
                  : "bg-yellow-500 text-gray-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg">{alert.message}</span>
                <button
                  onClick={() =>
                    setHazardAlerts((prev) =>
                      prev.filter((a) => a.id !== alert.id)
                    )
                  }
                  className="ml-4 text-2xl hover:opacity-70"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Map */}
      <div className="absolute inset-0">
        <Map
          center={routeCoordinates[0] || LOCATION_CONFIG.DEFAULT_CENTER}
          zoom={isTracking ? 18 : 14}
          routes={[
            {
              id: routeId,
              color: routeType === "fastest" ? "#3b82f6" : "#10b981",
              coordinates: routeCoordinates,
            },
          ]}
          height="100vh"
          showUserLocation={true}
          userLocation={snappedPosition}
          userHeading={heading}
          followUser={isTracking}
          autoFitBounds={!isTracking}
          hazards={nearbyHazards}
          markers={[
            routeCoordinates.length > 0 && {
              position: routeCoordinates[0],
              color: "#10b981",
              type: "from",
              popup: (
                <div className="text-sm">
                  <strong>Start</strong>
                </div>
              ),
            },
            routeCoordinates.length > 0 && {
              position: routeCoordinates[routeCoordinates.length - 1],
              color: "#ef4444",
              type: "to",
              popup: (
                <div className="text-sm">
                  <strong>Destination</strong>
                </div>
              ),
            },
          ].filter(Boolean)}
        />
      </div>

      {/* Top Bar - Current Instruction */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/90 to-transparent px-2 py-2 sm:p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-2xl p-3 sm:p-4">
            {hasArrived ? (
              <div className="text-center">
                <div className="text-4xl sm:text-6xl mb-2">🏁</div>
                <h2 className="text-xl sm:text-2xl font-bold text-green-600 mb-2">
                  You have arrived!
                </h2>
                <button
                  onClick={exitNavigation}
                  className="mt-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  Exit Navigation
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 sm:gap-4 mb-2">
                  <div className="text-3xl sm:text-4xl">
                    {getInstructionIcon(
                      instructions[currentInstructionIndex]?.instruction
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base sm:text-xl md:text-2xl font-bold text-slate-800 leading-tight">
                      {instructions[currentInstructionIndex]?.instruction ||
                        "Follow the route"}
                    </div>
                    {distanceToNextTurn > 0 && (
                      <div className="text-sm sm:text-lg text-blue-600 font-semibold mt-0.5">
                        In {formatDistance(distanceToNextTurn)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Route Info Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 gap-2">
                  <div className="flex items-center gap-2 sm:gap-4 flex-1">
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Remaining</div>
                      <div className="text-sm sm:text-base font-bold text-slate-800">
                        {formatDistance(totalDistanceRemaining)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">ETA</div>
                      <div className="text-sm sm:text-base font-bold text-slate-800">
                        {estimatedTimeRemaining} min
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Progress</div>
                      <div className="text-sm sm:text-base font-bold text-blue-600">
                        {routeProgress}%
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={exitNavigation}
                    className="bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-red-700 text-xs sm:text-sm font-medium whitespace-nowrap"
                  >
                    Exit
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${routeProgress}%` }}
                  ></div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* GPS Status Indicator */}
      {!isTracking && (
        <div className="absolute top-20 sm:top-24 left-2 sm:left-4 bg-yellow-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow-lg z-10 max-w-[calc(100%-1rem)] sm:max-w-md">
          <div className="flex items-center gap-2">
            <div className="animate-pulse text-lg">📡</div>
            <span className="text-xs sm:text-sm">Searching for GPS...</span>
          </div>
        </div>
      )}

      {/* Off-Route Warning */}
      {isOffRoute && isTracking && (
        <div className="absolute top-20 sm:top-24 left-2 sm:left-4 bg-orange-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow-lg z-10 animate-pulse max-w-[calc(100%-1rem)] sm:max-w-md">
          <div className="flex items-center gap-2">
            <div className="text-lg">⚠️</div>
            <span className="text-xs sm:text-sm">Off Route</span>
          </div>
        </div>
      )}

      {/* Bottom Panel - Upcoming Instructions */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 to-transparent px-2 py-2 sm:p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl p-2 sm:p-3 max-h-36 sm:max-h-48 overflow-y-auto">
          <h3 className="font-bold text-slate-800 mb-1.5 sm:mb-2 text-xs sm:text-sm">
            Next Steps
          </h3>
          <div className="space-y-1 sm:space-y-1.5">
            {instructions
              .slice(currentInstructionIndex, currentInstructionIndex + 3)
              .map((instruction, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-1.5 sm:p-2 rounded-lg ${
                    idx === 0
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="text-lg sm:text-xl flex-shrink-0">
                    {getInstructionIcon(instruction.instruction)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium text-slate-700 truncate">
                      {instruction.instruction}
                    </div>
                    {instruction.distance && (
                      <div className="text-[10px] sm:text-xs text-gray-500">
                        {formatDistance(instruction.distance / 1000)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Safety Badge */}
      <div className="absolute top-20 sm:top-24 right-2 sm:right-4 z-10">
        <div
          className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-lg font-bold text-white text-xs sm:text-sm ${
            routeSafety >= 7
              ? "bg-green-600"
              : routeSafety >= 5
              ? "bg-yellow-600"
              : "bg-red-600"
          }`}
        >
          {routeSafety}/10
        </div>
      </div>
    </main>
  );
}