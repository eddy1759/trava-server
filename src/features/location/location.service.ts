import axios, { AxiosInstance } from 'axios';
import { prisma } from '../../services/prisma';
import ApiError from "../../utils/ApiError"
import { StatusCodes } from 'http-status-codes';
import logger from "../../utils/logger"
import CONFIG from '../../config/env';
import { cache } from '../../services/cache.service';

interface MappedLocation {
    placeId: string;
    name: string;
    formattedAddress: string;
    lat: number;
    lng: number;
    city?: string;
    country?: string;
    countryCode?: string;
    state?: string;
    timezone?: string;
}

interface GeocodingProvider {
    name: string;
    enabled: boolean;
    apiKey?: string;
    timeout: number;
    retries: number;
    rateLimit: number;
}

// Enhanced HTTP client with retry logic and rate limiting
class GeocodingClient {
    private client: AxiosInstance;
    private provider: GeocodingProvider;
    private requestCount = 0;
    private lastResetTime = Date.now();

    constructor(provider: GeocodingProvider) {
        this.provider = provider;
        this.client = axios.create({
            timeout: provider.timeout,
        });
    }

    private async checkRateLimit(): Promise<void> {
        const now = Date.now();
        const windowMs = 60000; // 1 minute

        if (now - this.lastResetTime > windowMs) {
            this.requestCount = 0;
            this.lastResetTime = now;
        }

        if (this.requestCount >= this.provider.rateLimit) {
            const waitTime = windowMs - (now - this.lastResetTime);
            logger.warn(`Rate limit exceeded for ${this.provider.name}. Waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.requestCount = 0;
            this.lastResetTime = Date.now();
        }
    }

    async get(url: string, params?: any): Promise<any> {
        await this.checkRateLimit();
        this.requestCount++;

        for (let attempt = 0; attempt <= this.provider.retries; attempt++) {
            try {
                const response = await this.client.get(url, { params });
                return response.data;
            } catch (error: any) {
                if (attempt === this.provider.retries) {
                    throw error;
                }
                
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                logger.warn(`Attempt ${attempt + 1} failed for ${this.provider.name}, retrying in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}

// Mapbox Geocoding Provider
// async function fetchLocationFromMapbox(query: string): Promise<MappedLocation> {
//     const provider: GeocodingProvider = {
//         name: 'Mapbox',
//         enabled: !!CONFIG.MAPBOX_API_KEY,
//         apiKey: CONFIG.MAPBOX_API_KEY,
//         timeout: CONFIG.MAPBOX_API_TIMEOUT,
//         retries: CONFIG.MAPBOX_API_RETRIES,
//         rateLimit: CONFIG.MAPBOX_RATE_LIMIT_PER_MINUTE,
//     };

//     if (!provider.enabled) {
//         throw new Error('Mapbox API key is not configured');
//     }

//     const client = new GeocodingClient(provider);
//     const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;

//     try {
//         const response = await client.get(endpoint, {
//             access_token: provider.apiKey,
//             limit: 1,
//             types: 'place,region,country,locality'
//         });

//         if (!response || !response.features || response.features.length === 0) {
//             throw new Error(`No location found for query: "${query}"`);
//         }

//         const feature = response.features[0];
//         const countryContext = feature.context?.find((c: any) => c.id.startsWith('country'));
//         const regionContext = feature.context?.find((c: any) => c.id.startsWith('region'));
//         const city = feature.place_type.includes('place') ? feature.text : feature.context?.find((c: any) => c.id.startsWith('place'))?.text;

//         return {
//             placeId: feature.id,
//             name: feature.text,
//             formattedAddress: feature.place_name,
//             lng: feature.center[0],
//             lat: feature.center[1],
//             city: city,
//             country: countryContext?.text,
//             countryCode: countryContext?.short_code?.toUpperCase(),
//             state: regionContext?.text,
//             timezone: feature.properties?.timezone || "",
//         };
//     } catch (error: any) {
//         logger.error(`Mapbox geocoding failed for query "${query}":`, error);
//         throw error;
//     }
// }

// // Google Maps Geocoding Provider (Fallback)
// async function fetchLocationFromGoogle(query: string): Promise<MappedLocation> {
//     const provider: GeocodingProvider = {
//         name: 'Google Maps',
//         enabled: !!CONFIG.GOOGLE_MAPS_API_KEY,
//         apiKey: CONFIG.GOOGLE_MAPS_API_KEY,
//         timeout: CONFIG.GOOGLE_MAPS_API_TIMEOUT,
//         retries: CONFIG.GOOGLE_MAPS_API_RETRIES,
//         rateLimit: 100, // Google's default rate limit
//     };

//     if (!provider.enabled) {
//         throw new Error('Google Maps API key is not configured');
//     }

//     const client = new GeocodingClient(provider);
//     const endpoint = 'https://maps.googleapis.com/maps/api/geocode/json';

//     try {
//         const response = await client.get(endpoint, {
//             address: query,
//             key: provider.apiKey,
//         });

//         if (!response || response.status !== 'OK' || !response.results || response.results.length === 0) {
//             throw new Error(`No location found for query: "${query}"`);
//         }

//         const result = response.results[0];
//         const addressComponents = result.address_components;

//         const countryComponent = addressComponents.find((c: any) => c.types.includes('country'));
//         const stateComponent = addressComponents.find((c: any) => c.types.includes('administrative_area_level_1'));
//         const cityComponent = addressComponents.find((c: any) => c.types.includes('locality'));

//         return {
//             placeId: result.place_id,
//             name: result.formatted_address.split(',')[0],
//             formattedAddress: result.formatted_address,
//             lng: result.geometry.location.lng,
//             lat: result.geometry.location.lat,
//             city: cityComponent?.long_name,
//             country: countryComponent?.long_name,
//             countryCode: countryComponent?.short_name?.toUpperCase(),
//             state: stateComponent?.long_name,
//             timezone: '', // Google doesn't provide timezone in geocoding
//         };
//     } catch (error: any) {
//         logger.error(`Google Maps geocoding failed for query "${query}":`, error);
//         throw error;
//     }
// }

// LocationIQ Geocoding Provider
async function fetchLocationFromLocationIQ(query: string): Promise<MappedLocation> {
    const apiKey = CONFIG.LOCATIONIQ_API_KEY;
    if (!apiKey) {
        throw new Error('LocationIQ API key is not configured');
    }
    const endpoint = `https://us1.locationiq.com/v1/search.php`;
    try {
        const response = await axios.get(endpoint, {
            params: {
                key: apiKey,
                q: query,
                format: 'json',
                addressdetails: 1,
                limit: 1
            }
        });
        const data = response.data[0];
        if (!data) throw new Error(`No location found for query: "${query}"`);
        return {
            placeId: data.place_id?.toString() || '',
            name: data.display_name?.split(',')[0] || '',
            formattedAddress: data.display_name,
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lon),
            city: data.address?.city || data.address?.town || data.address?.village,
            country: data.address?.country,
            countryCode: data.address?.country_code?.toUpperCase(),
            state: data.address?.state,
            timezone: '', // Not provided by LocationIQ
        };
    } catch (error: any) {
        logger.error(`LocationIQ geocoding failed for query "${query}":`, error);
        throw error;
    }
}

// OpenCage Geocoding Provider (Fallback)
async function fetchLocationFromOpenCage(query: string): Promise<MappedLocation> {
    const apiKey = CONFIG.OPENCAGE_API_KEY;
    if (!apiKey) {
        throw new Error('OpenCage API key is not configured');
    }
    const endpoint = `https://api.opencagedata.com/geocode/v1/json`;
    try {
        const response = await axios.get(endpoint, {
            params: {
                key: apiKey,
                q: query,
                limit: 1,
                no_annotations: 0
            }
        });
        const result = response.data.results[0];
        if (!result) throw new Error(`No location found for query: "${query}"`);
        const components = result.components || {};
        return {
            placeId: result.annotations?.geohash || '',
            name: components.city || components.town || components.village || components.hamlet || components.county || components.state || components.country || '',
            formattedAddress: result.formatted,
            lat: result.geometry.lat,
            lng: result.geometry.lng,
            city: components.city || components.town || components.village,
            country: components.country,
            countryCode: components.country_code?.toUpperCase(),
            state: components.state,
            timezone: result.annotations?.timezone?.name || '',
        };
    } catch (error: any) {
        logger.error(`OpenCage geocoding failed for query "${query}":`, error);
        throw error;
    }
}

// Enhanced location fetching with fallbacks (LocationIQ -> OpenCage)
async function fetchLocationFromAPI(query: string): Promise<MappedLocation> {
    const cacheKey = `location:${Buffer.from(query).toString('base64')}`;
    // Check cache first
    const cachedLocation = await cache.get<MappedLocation>(cacheKey, 'location');
    if (cachedLocation) {
        logger.info(`Location cache hit for query: "${query}"`);
        return cachedLocation;
    }
    let location: MappedLocation;
    let error: Error | null = null;
    // Try LocationIQ first
    try {
        location = await fetchLocationFromLocationIQ(query);
        logger.info(`Successfully fetched location from LocationIQ for query: "${query}"`);
    } catch (locationIQError) {
        error = locationIQError as Error;
        logger.warn(`LocationIQ geocoding failed for query "${query}":`, locationIQError);
        // Try OpenCage as fallback
        try {
            location = await fetchLocationFromOpenCage(query);
            logger.info(`Successfully fetched location from OpenCage (fallback) for query: "${query}"`);
        } catch (openCageError) {
            logger.error(`All geocoding providers failed for query "${query}":`, { locationIQError, openCageError });
            throw new ApiError(`Failed to geocode location: "${query}". All providers are unavailable.`, StatusCodes.BAD_GATEWAY);
        }
    }
    // Cache the result
    await cache.set(cacheKey, location, {
        ttl: CONFIG.LOCATION_CACHE_TTL,
        prefix: 'location',
        tags: [`query:${query}`, `country:${location.countryCode}`]
    });
    return location;
}

export async function findOrCreateLocation(query: string, tx?: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) {
    const db = tx || prisma;
    logger.info(`Resolving destinationQuery: "${query}"`);

    // Input validation and sanitization
    const sanitizedQuery = query.trim().replace(/[<>]/g, '');
    if (!sanitizedQuery || sanitizedQuery.length < 2) {
        throw new ApiError('Invalid location query. Query must be at least 2 characters long.', StatusCodes.BAD_REQUEST);
    }

    if (sanitizedQuery.length > 200) {
        throw new ApiError('Location query too long. Maximum 200 characters allowed.', StatusCodes.BAD_REQUEST);
    }

    try {
        const externalLocation = await fetchLocationFromAPI(sanitizedQuery);

        // Check for existing location
        const existingLocation = await db.location.findUnique({
            where: { placeId: externalLocation.placeId }
        });

        if (existingLocation) {
            logger.info(`Found existing location for query: "${query}"`);
            return existingLocation;
        }

        // Create new location with transaction safety
        try {
            const newLocation = await db.location.create({
                data: {
                    placeId: externalLocation.placeId,
                    name: externalLocation.name,
                    formattedAddress: externalLocation.formattedAddress,
                    lat: externalLocation.lat,
                    lng: externalLocation.lng,
                    city: externalLocation.city,
                    country: externalLocation.country,
                    timezone: externalLocation.timezone,
                    state: externalLocation.state,
                    countryCode: externalLocation.countryCode?.toUpperCase()
                }
            });

            logger.info(`Created new location for query: "${query}" with ID: ${newLocation.id}`);
            
            // Queue enrichment as background job to populate missing fields
            if (newLocation.countryCode && (!newLocation.currencyCode || !newLocation.language)) {
                try {
                    const { enrichmentQueue } = await import('../jobs/queue');
                    await enrichmentQueue.add('enrich-location', { locationId: newLocation.id });
                    logger.info(`Queued location enrichment for: ${newLocation.name}`);
                } catch (error) {
                    logger.warn('Failed to queue location enrichment:', error);
                }
            }
            
            return newLocation;

        } catch (createError: any) {
            if (createError.code === 'P2002') {
                // Race condition: location was created by another request
                logger.warn(`Race condition detected for location with placeId ${externalLocation.placeId}. Fetching existing location.`);
                
                const location = await db.location.findUnique({ 
                    where: { placeId: externalLocation.placeId }
                });
                
                if (!location) {
                    throw new ApiError('Failed to retrieve location after race condition. Please try again.', StatusCodes.INTERNAL_SERVER_ERROR);
                }
                
                return location;
            }
            throw createError;
        }

    } catch (error: any) {
        logger.error(`Location resolution failed for query "${query}":`, error);
        
        if (error instanceof ApiError) {
            throw error;
        }
        
        throw new ApiError('Failed to resolve location. Please try again later.', StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

// Additional utility functions
export async function getLocationById(locationId: string) {
    return await prisma.location.findUnique({
        where: { id: locationId }
    });
}

export async function searchLocations(query: string, limit: number = 10) {
    const sanitizedQuery = query.trim().replace(/[<>]/g, '');
    
    if (!sanitizedQuery || sanitizedQuery.length < 2) {
        throw new ApiError('Search query must be at least 2 characters long.', StatusCodes.BAD_REQUEST);
    }

    return await prisma.location.findMany({
        where: {
            OR: [
                { name: { contains: sanitizedQuery, mode: 'insensitive' } },
                { city: { contains: sanitizedQuery, mode: 'insensitive' } },
                { country: { contains: sanitizedQuery, mode: 'insensitive' } },
                { formattedAddress: { contains: sanitizedQuery, mode: 'insensitive' } }
            ]
        },
        take: limit,
        orderBy: { name: 'asc' }
    });
}