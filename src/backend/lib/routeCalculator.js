const csvDataLoader = require('./csvDataLoader');

class RouteCalculator {
  constructor() {
    this.walkingSpeed = 5; // km/h
    this.cyclingSpeed = 15; // km/h
    this.drivingSpeed = 30; // km/h (urban)
  }

  async calculateRoutes(fromLat, fromLon, toLat, toLon, mode = 'walking', userPreferences = null) {
    // Ensure crime data is loaded
    if (!csvDataLoader.isLoaded()) {
      await csvDataLoader.loadCrimeData();
    }

    // Extract user preferences or use defaults
    const safetyPriority = userPreferences?.safety_priority ?? 0.5;
    const crimeWeights = userPreferences?.crime_severity_weights ?? null;
    const factorWeights = userPreferences?.safety_factor_weights ?? {
      crime: 0.4,
      collision: 0.25,
      lighting: 0.2,
      hazard: 0.15
    };

    // Rebuild safety grid with user-specific weights if provided
    if (crimeWeights || factorWeights) {
      csvDataLoader.buildSafetyGrid(crimeWeights, factorWeights);
    }

    // Get OSRM route for real road network
    const osrmRoute = await this.getOSRMRoute(fromLat, fromLon, toLat, toLon, mode);
    
    if (!osrmRoute.success) {
      // Fallback to straight line
      return this.calculateStraightLineRoutes(fromLat, fromLon, toLat, toLon, mode, safetyPriority);
    }

    // Calculate fastest route (minimal safety consideration)
    const fastestRoute = this.calculateFastestRoute(osrmRoute, mode, safetyPriority, factorWeights);
    
    // Calculate safest route (maximum safety consideration)
    const safestRoute = await this.calculateSafestRoute(
      fromLat, fromLon, toLat, toLon, mode, osrmRoute, safetyPriority, factorWeights
    );

    return {
      success: true,
      fastest: fastestRoute,
      safest: safestRoute,
      provider: 'osrm+safety',
      userPreferences: {
        safetyPriority,
        factorWeights
      }
    };
  }

  calculateFastestRoute(osrmRoute, mode, safetyPriority = 0.5, factorWeights = null) {
    const coordinates = osrmRoute.coordinates;
    const distance = osrmRoute.distance / 1000; // Convert to km
    const duration = osrmRoute.duration / 60; // Convert to minutes
    
    // Calculate average safety score along the route
    const safetyScores = coordinates.map(coord => 
      csvDataLoader.getSafetyScoreForLocation(coord[0], coord[1])
    );
    const avgSafetyScore = safetyScores.reduce((a, b) => a + b, 0) / safetyScores.length;

    // Calculate weighted route cost using user's safety priority
    // Lower safetyPriority (closer to 0) = prioritize speed
    // Higher safetyPriority (closer to 1) = consider safety more
    const normalizedTime = duration / 60; // Normalize to hours
    const routeCost = (safetyPriority * avgSafetyScore) + ((1 - safetyPriority) * normalizedTime);

    return {
      coordinates,
      distance: parseFloat(distance.toFixed(2)),
      time: parseFloat(duration.toFixed(1)),
      safetyScore: parseFloat(avgSafetyScore.toFixed(2)),
      routeCost: parseFloat(routeCost.toFixed(3)),
      instructions: osrmRoute.instructions || [],
      type: 'fastest',
      factorWeights: factorWeights || { crime: 0.4, collision: 0.25, lighting: 0.2, hazard: 0.15 },
      safetyPriority: safetyPriority
    };
  }

  async calculateSafestRoute(fromLat, fromLon, toLat, toLon, mode, originalRoute) {
    // Get alternative routes or modify the original route to avoid high-crime areas
    try {
      // Try to get alternative route from OSRM
      const alternativeRoute = await this.getOSRMRoute(
        fromLat, fromLon, toLat, toLon, mode, true
      );

      if (alternativeRoute.success && alternativeRoute.coordinates) {
        const safetyScores = alternativeRoute.coordinates.map(coord =>
          csvDataLoader.getSafetyScoreForLocation(coord[0], coord[1])
        );
        const avgSafetyScore = safetyScores.reduce((a, b) => a + b, 0) / safetyScores.length;

        // Compare with original route
        const originalSafetyScores = originalRoute.coordinates.map(coord =>
          csvDataLoader.getSafetyScoreForLocation(coord[0], coord[1])
        );
        const originalAvgSafety = originalSafetyScores.reduce((a, b) => a + b, 0) / originalSafetyScores.length;

        // Use the safer route
        if (avgSafetyScore < originalAvgSafety) {
          const distance = alternativeRoute.distance / 1000;
          const duration = alternativeRoute.duration / 60;
          
          return {
            coordinates: alternativeRoute.coordinates,
            distance: parseFloat(distance.toFixed(2)),
            time: parseFloat(duration.toFixed(1)),
            safetyScore: parseFloat(avgSafetyScore.toFixed(2)),
            instructions: alternativeRoute.instructions || [],
            type: 'safest'
          };
        }
      }
    } catch (error) {
      console.warn('Could not get alternative route:', error.message);
    }

    // If no better alternative, create a modified route
    // For simplicity, use a route that goes around high-crime areas
    const modifiedRoute = this.createSafestPath(fromLat, fromLon, toLat, toLon, mode);
    return modifiedRoute;
  }

  createSafestPath(fromLat, fromLon, toLat, toLon, mode, safetyPriority = 0.5, factorWeights = null) {
    // Create a path that avoids high-crime areas
    // This is a simplified approach using safety grid
    
    const path = [];
    const gridSize = csvDataLoader.gridSize;
    
    // Create waypoints that navigate around dangerous areas
    const midLat = (fromLat + toLat) / 2;
    const midLon = (fromLon + toLon) / 2;
    
    // Check if middle point is safe
    const midSafety = csvDataLoader.getSafetyScoreForLocation(midLat, midLon);
    
    // High safety priority means more aggressive avoidance of dangerous areas
    const safetyThreshold = 0.7 - (safetyPriority * 0.4); // Ranges from 0.3 to 0.7
    
    if (midSafety > safetyThreshold) {
      // Too dangerous, try to route around
      // Offset perpendicular to direct line
      const deltaLat = toLat - fromLat;
      const deltaLon = toLon - fromLon;
      
      // Perpendicular offset (scaled by safety priority)
      const offsetScale = 0.2 + (safetyPriority * 0.3); // 0.2 to 0.5
      const offsetLat = -deltaLon * offsetScale;
      const offsetLon = deltaLat * offsetScale;
      
      const waypoint1Lat = fromLat + deltaLat * 0.3 + offsetLat;
      const waypoint1Lon = fromLon + deltaLon * 0.3 + offsetLon;
      const waypoint2Lat = fromLat + deltaLat * 0.7 + offsetLat;
      const waypoint2Lon = fromLon + deltaLon * 0.7 + offsetLon;
      
      path.push(
        [fromLat, fromLon],
        [waypoint1Lat, waypoint1Lon],
        [midLat + offsetLat, midLon + offsetLon],
        [waypoint2Lat, waypoint2Lon],
        [toLat, toLon]
      );
    } else {
      // Direct path is reasonably safe
      path.push(
        [fromLat, fromLon],
        [midLat, midLon],
        [toLat, toLon]
      );
    }
    
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      totalDistance += csvDataLoader.calculateDistance(
        path[i][0], path[i][1],
        path[i + 1][0], path[i + 1][1]
      );
    }
    
    // Calculate safety score
    const safetyScores = path.map(coord =>
      csvDataLoader.getSafetyScoreForLocation(coord[0], coord[1])
    );
    const avgSafetyScore = safetyScores.reduce((a, b) => a + b, 0) / safetyScores.length;
    
    const speed = this.getSpeedForMode(mode);
    const duration = (totalDistance / speed) * 60; // minutes
    const normalizedTime = duration / 60;
    
    const routeCost = (safetyPriority * avgSafetyScore) + ((1 - safetyPriority) * normalizedTime);

    return {
      coordinates: path,
      distance: parseFloat(totalDistance.toFixed(2)),
      time: parseFloat(duration.toFixed(1)),
      safetyScore: parseFloat(avgSafetyScore.toFixed(2)),
      routeCost: parseFloat(routeCost.toFixed(3)),
      instructions: [{
        instruction: `Follow the safest route to destination (${totalDistance.toFixed(1)}km)`,
        distance: totalDistance * 1000,
        duration: duration * 60
      }],
      type: 'safest',
      modified: true,
      factorWeights: factorWeights || { crime: 0.4, collision: 0.25, lighting: 0.2, hazard: 0.15 },
      safetyPriority: safetyPriority
    };
  }

  async getOSRMRoute(fromLat, fromLon, toLat, toLon, mode, alternative = false) {
    const profileMap = {
      'walking': 'foot',
      'cycling': 'bike',
      'driving': 'driving'
    };
    
    const profile = profileMap[mode] || 'foot';
    const alternativeParam = alternative ? '&alternatives=true' : '';
    const url = `https://router.project-osrm.org/route/v1/${profile}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true${alternativeParam}`;
    
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        // If alternative requested and available, use it
        const route = alternative && data.routes.length > 1 ? data.routes[1] : data.routes[0];
        
        return {
          success: true,
          coordinates: route.geometry.coordinates.map(coord => [coord[1], coord[0]]),
          distance: route.distance,
          duration: route.duration,
          instructions: route.legs[0]?.steps?.map(step => ({
            instruction: step.maneuver?.instruction || 'Continue',
            distance: step.distance,
            duration: step.duration
          })) || []
        };
      }
      
      throw new Error('No route found');
    } catch (error) {
      console.error('OSRM routing error:', error.message);
      return { success: false };
    }
  }

  calculateStraightLineRoutes(fromLat, fromLon, toLat, toLon, mode, safetyPriority = 0.5) {
    const distance = csvDataLoader.calculateDistance(fromLat, fromLon, toLat, toLon);
    const speed = this.getSpeedForMode(mode);
    const duration = (distance / speed) * 60; // minutes
    
    // Get safety scores for start, middle, and end
    const midLat = (fromLat + toLat) / 2;
    const midLon = (fromLon + toLon) / 2;
    
    const startSafety = csvDataLoader.getSafetyScoreForLocation(fromLat, fromLon);
    const midSafety = csvDataLoader.getSafetyScoreForLocation(midLat, midLon);
    const endSafety = csvDataLoader.getSafetyScoreForLocation(toLat, toLon);
    const avgSafety = (startSafety + midSafety + endSafety) / 3;
    
    const coordinates = [[fromLat, fromLon], [toLat, toLon]];
    const normalizedTime = duration / 60;
    const routeCost = (safetyPriority * avgSafety) + ((1 - safetyPriority) * normalizedTime);
    
    return {
      success: true,
      fastest: {
        coordinates,
        distance: parseFloat(distance.toFixed(2)),
        time: parseFloat(duration.toFixed(1)),
        safetyScore: parseFloat(avgSafety.toFixed(2)),
        routeCost: parseFloat(routeCost.toFixed(3)),
        instructions: [{
          instruction: `Head straight to destination (${distance.toFixed(1)}km)`,
          distance: distance * 1000,
          duration: duration * 60
        }],
        type: 'fastest',
        fallback: true,
        safetyPriority: safetyPriority
      },
      safest: {
        coordinates,
        distance: parseFloat(distance.toFixed(2)),
        time: parseFloat(duration.toFixed(1)),
        safetyScore: parseFloat(avgSafety.toFixed(2)),
        routeCost: parseFloat(routeCost.toFixed(3)),
        instructions: [{
          instruction: `Head straight to destination (${distance.toFixed(1)}km)`,
          distance: distance * 1000,
          duration: duration * 60
        }],
        type: 'safest',
        fallback: true,
        safetyPriority: safetyPriority
      },
      provider: 'straight-line'
    };
  }

  getSpeedForMode(mode) {
    const speeds = {
      'walking': this.walkingSpeed,
      'cycling': this.cyclingSpeed,
      'driving': this.drivingSpeed
    };
    return speeds[mode] || this.walkingSpeed;
  }
}

const routeCalculator = new RouteCalculator();

module.exports = routeCalculator;
