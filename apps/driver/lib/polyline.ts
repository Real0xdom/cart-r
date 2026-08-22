export interface LatLng {
    latitude: number;
    longitude: number;
}

/**
 * Calculates the perpendicular distance from a point to a line segment.
 */
function perpendicularDistance(point: LatLng, lineStart: LatLng, lineEnd: LatLng): number {
    const dx = lineEnd.longitude - lineStart.longitude;
    const dy = lineEnd.latitude - lineStart.latitude;

    // If the line is just a single point
    if (dx === 0 && dy === 0) {
        const pdx = point.longitude - lineStart.longitude;
        const pdy = point.latitude - lineStart.latitude;
        return Math.sqrt(pdx * pdx + pdy * pdy);
    }

    // Calculate the t that minimizes the distance.
    const t = ((point.longitude - lineStart.longitude) * dx + (point.latitude - lineStart.latitude) * dy) / (dx * dx + dy * dy);

    // See if this represents one of the segment's end points or a point in the middle.
    if (t < 0) {
        const pdx = point.longitude - lineStart.longitude;
        const pdy = point.latitude - lineStart.latitude;
        return Math.sqrt(pdx * pdx + pdy * pdy);
    } else if (t > 1) {
        const pdx = point.longitude - lineEnd.longitude;
        const pdy = point.latitude - lineEnd.latitude;
        return Math.sqrt(pdx * pdx + pdy * pdy);
    }

    const nearestPoint = {
        latitude: lineStart.latitude + t * dy,
        longitude: lineStart.longitude + t * dx
    };

    const pdx = point.longitude - nearestPoint.longitude;
    const pdy = point.latitude - nearestPoint.latitude;

    return Math.sqrt(pdx * pdx + pdy * pdy);
}

/**
 * Simplifies a polyline using the Douglas-Peucker algorithm.
 * 
 * @param points The array of coordinates to simplify.
 * @param tolerance The distance tolerance (e.g., 0.0001 for ~11 meters).
 * @returns A new simplified array of coordinates.
 */
export function simplifyPath(points: LatLng[], tolerance: number = 0.0001): LatLng[] {
    if (points.length <= 2) {
        return points;
    }

    let maxDistance = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const distance = perpendicularDistance(points[i], points[0], points[end]);
        if (distance > maxDistance) {
            index = i;
            maxDistance = distance;
        }
    }

    if (maxDistance > tolerance) {
        const leftRecursiveResults = simplifyPath(points.slice(0, index + 1), tolerance);
        const rightRecursiveResults = simplifyPath(points.slice(index), tolerance);
        
        // Remove the duplicated point at the split
        return leftRecursiveResults.slice(0, -1).concat(rightRecursiveResults);
    } else {
        return [points[0], points[end]];
    }
}
