"use client";

import { useSearchParams, useRouter } from "next/navigation";

/* 
==============================================
ALL NAVIGATION CODE COMMENTED OUT FOR FUTURE USE
==============================================

Original functionality included:
- Real-time GPS tracking
- Route snapping and progress
- Turn-by-turn navigation
- Voice announcements
- Hazard detection via WebSocket
- Map display with user location
- Off-route warnings
- Arrival detection

To restore: uncomment the sections below
==============================================
*/

// Commented out imports
// import { useState, useEffect, useRef } from "react";
// import dynamic from "next/dynamic";
// import { LOCATION_CONFIG } from "../../lib/locationConfig";
// import websocketClient from "../../lib/websocketClient";
// const Map = dynamic(() => import("../../components/Map"), { ssr: false });

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

  /* 
  ==============================================
  COMMENTED OUT: State Management
  ==============================================
  
  const [currentPosition, setCurrentPosition] = useState(null);
  const [snappedPosition, setSnappedPosition] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState(0);
  const [heading, setHeading] = useState(0);
  const [hasArrived, setHasArrived] = useState(false);
  const [totalDistanceRemaining, setTotalDistanceRemaining] = useState(parseFloat(routeDistance) || 0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(parseInt(routeTime) || 0);
  const [routeProgress, setRouteProgress] = useState(0);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [nearbyHazards, setNearbyHazards] = useState([]);
  const [hazardAlerts, setHazardAlerts] = useState([]);
  
  const watchIdRef = useRef(null);
  const synthesisRef = useRef(null);
  const lastPositionRef = useRef(null);
  const lastAnnouncementRef = useRef(0);
  const hazardCheckRef = useRef(0);
  
  ==============================================
  */

  /* 
  ==============================================
  COMMENTED OUT: All useEffect hooks and functions
  - GPS tracking
  - Route data loading
  - Speech synthesis
  - WebSocket connection
  - Navigation calculations
  - Distance calculations
  - Bearing calculations
  - Route snapping
  - Progress updates
  ==============================================
  */

  // Simple back navigation
  const exitNavigation = () => {
    router.push("/suggested-routes");
  };

  // Format distance helper
  const formatDistance = (km) => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
  };

  // Display simple route card
  return (
    <main className="flex items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-xl shadow-2xl p-6 text-slate-800">
          <h1 className="text-2xl font-bold mb-4 text-center">
            Navigation Page
          </h1>
          
          <div className="space-y-4">
            {/* Route Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-3 text-blue-800">
                {routeName || "Your Route"}
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Type</div>
                  <div className="font-semibold capitalize">{routeType || "N/A"}</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600">Distance</div>
                  <div className="font-semibold">
                    {routeDistance ? formatDistance(parseFloat(routeDistance)) : "N/A"}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600">Est. Time</div>
                  <div className="font-semibold">{routeTime ? `${routeTime} min` : "N/A"}</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600">Safety Rating</div>
                  <div className="font-semibold">
                    <span className={`${
                      routeSafety >= 7 ? "text-green-600" : 
                      routeSafety >= 5 ? "text-yellow-600" : 
                      "text-red-600"
                    }`}>
                      {routeSafety ? `${parseFloat(routeSafety).toFixed(1)}/10` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-2">Route ID</div>
              <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                {routeId || "No route ID"}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={exitNavigation}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold transition-colors"
              >
                Back to Suggested Routes
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* 
==============================================
COMMENTED OUT: Full Navigation UI Code
==============================================

Original UI included:
- Full-screen map with route display
- Hazard alert banners
- Top bar with current instruction
- Route progress bar
- GPS status indicator
- Off-route warnings
- Bottom panel with upcoming instructions
- Safety badge
- Real-time position tracking

All original code preserved above for future restoration
==============================================
*/
