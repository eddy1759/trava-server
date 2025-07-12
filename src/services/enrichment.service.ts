import axios, { AxiosInstance } from 'axios';
import { prisma } from './prisma';
import logger from '../utils/logger';
import { ragQueue } from '../features/jobs/queue';
import CONFIG from '../config/env';
import { cache } from './cache.service';

interface FetchedPoi {
    placeId: string;
    name: string;
    category: string;
    address?: string;
    rating?: number;
    description?: string;
    imageUrl?: string;
    source: string; // Track which provider provided this POI
}

interface Location {
    lat: number;
    lng: number;
}

interface MapboxSuggestion {
    name: string;
    mapbox_id: string;
    feature_type: 'poi' | string;
}

interface MapboxFeature {
    type: 'Feature';
    properties: {
        mapbox_id: string;
        name: string;
        full_address: string;
        poi_category?: string[];
        metadata?: {
            rating?: number;
            description?: string;
            image_url?: string;
        };
    };
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
}

interface GooglePlace {
    place_id: string;
    name: string;
    formatted_address: string;
    types: string[];
    rating?: number;
    photos?: Array<{ photo_reference: string }>;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
}

interface FoursquareVenue {
    fsq_id: string;
    name: string;
    location: {
        address: string;
        locality: string;
        region: string;
        country: string;
    };
    categories: Array<{
        name: string;
        icon: {
            prefix: string;
            suffix: string;
        };
    }>;
    rating?: number;
    description?: string;
}

// Enhanced HTTP client with retry logic and rate limiting
class POIClient {
    private client: AxiosInstance;
    private provider: string;
    private timeout: number;
    private retries: number;
    private requestCount = 0;
    private lastResetTime = Date.now();

    constructor(provider: string, timeout: number, retries: number) {
        this.provider = provider;
        this.timeout = timeout;
        this.retries = retries;
        this.client = axios.create({ timeout });
    }

    private async checkRateLimit(rateLimit: number): Promise<void> {
        const now = Date.now();
        const windowMs = 60000; // 1 minute

        if (now - this.lastResetTime > windowMs) {
            this.requestCount = 0;
            this.lastResetTime = now;
        }

        if (this.requestCount >= rateLimit) {
            const waitTime = windowMs - (now - this.lastResetTime);
            logger.warn(`Rate limit exceeded for ${this.provider}. Waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.requestCount = 0;
            this.lastResetTime = Date.now();
        }
    }

    async get(url: string, params?: any, rateLimit: number = 100, headers?: any): Promise<any> {
        await this.checkRateLimit(rateLimit);
        this.requestCount++;

        for (let attempt = 0; attempt <= this.retries; attempt++) {
            try {
                const config: any = { params };
                if (headers) {
                    config.headers = headers;
                }
                const response = await this.client.get(url, config);
                return response.data;
            } catch (error: any) {
                if (attempt === this.retries) {
                    throw error;
                }
                
                const delay = Math.pow(2, attempt) * 1000;
                logger.warn(`Attempt ${attempt + 1} failed for ${this.provider}, retrying in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}

// OpenTripMap POI Provider (Free alternative)
async function getOpenTripMapPOIs(location: Location): Promise<FetchedPoi[]> {
    const pois: FetchedPoi[] = [];
    const client = new POIClient('OpenTripMap', CONFIG.OPENTRIPMAP_API_TIMEOUT || 10000, CONFIG.OPENTRIPMAP_API_RETRIES || 2);
    
    try {
        const endpoint = 'https://api.opentripmap.com/0.1/en/places/radius';
        const response = await client.get(endpoint, {
            radius: 5000,
            lon: location.lng,
            lat: location.lat,
            kinds: 'cultural,historic,interesting_places,museums,architecture,amusements',
            limit: 10,
            format: 'json'
        });

        const places = response?.features || [];
        for (const place of places.slice(0, 5)) {
            pois.push({
                placeId: place.properties.xid,
                name: place.properties.name,
                category: place.properties.kinds?.split(',')[0] || 'place',
                address: place.properties.address?.road || '',
                rating: place.properties.rate,
                description: place.properties.wikipedia_extracts?.text || '',
                imageUrl: place.properties.preview?.source,
                source: 'opentripmap'
            });
        }
    } catch (error) {
        logger.warn('Failed to get OpenTripMap POIs:', error);
    }

    return pois;
}

// Here Places POI Provider (Alternative)
async function getHerePlacesPOIs(location: Location): Promise<FetchedPoi[]> {
    const pois: FetchedPoi[] = [];
    const apiKey = CONFIG.HERE_API_KEY;
    
    if (!apiKey) {
        logger.warn('Here API key not configured, skipping Here Places POIs');
        return pois;
    }

    const client = new POIClient('Here', CONFIG.HERE_API_TIMEOUT || 10000, CONFIG.HERE_API_RETRIES || 2);
    
    try {
        const endpoint = 'https://places.ls.hereapi.com/places/v1/discover/explore';
        const response = await client.get(endpoint, {
            at: `${location.lat},${location.lng}`,
            cat: 'tourism,leisure-entertainment,cultural',
            size: 10,
            apiKey: apiKey
        });

        const places = response?.results?.items || [];
        for (const place of places.slice(0, 5)) {
            pois.push({
                placeId: place.id,
                name: place.title,
                category: place.category?.title || 'place',
                address: place.vicinity,
                rating: place.averageRating,
                description: place.href,
                imageUrl: place.icon,
                source: 'here'
            });
        }
    } catch (error) {
        logger.warn('Failed to get Here Places POIs:', error);
    }

    return pois;
}

// Enhanced country info fetching with fallbacks
async function getCountryInfo(countryCode: string) {
    const cacheKey = `country:${countryCode}`;
    
    // Check cache first
    const cachedInfo = await cache.get<any>(cacheKey, 'country');
    if (cachedInfo) {
        logger.info(`Country info cache hit for: ${countryCode}`);
        return cachedInfo;
    }

    let countryInfo = null;

    // Try RestCountries API first
    try {
        const client = new POIClient('RestCountries', CONFIG.REST_COUNTRIES_API_TIMEOUT, CONFIG.REST_COUNTRIES_API_RETRIES);
        const response = await client.get(`${CONFIG.REST_COUNTRIES_API_URL}/alpha/${countryCode}`);
        
        if (response && response.length > 0) {
            const country = response[0];
            countryInfo = {
                currencyCode: Object.keys(country.currencies || {})[0] || null,
                currencySymbol: country.currencies ? (Object.values(country.currencies)[0] as any)?.symbol : null,
                language: Object.keys(country.languages || {})[0] || null,
                timezone: country.timezones?.[0] || null,
                population: country.population,
                region: country.region,
                subregion: country.subregion,
                capital: country.capital?.[0],
                flag: country.flags?.png,
                area: country.area
            };
            logger.info(`Successfully fetched country info from RestCountries for ${countryCode}`);
        }
    } catch (error) {
        logger.warn(`RestCountries API failed for ${countryCode}:`, error);
    }

    // Fallback to CountryLayer API if RestCountries failed
    if (!countryInfo && CONFIG.COUNTRY_LAYER_API_KEY) {
        try {
            const client = new POIClient('CountryLayer', CONFIG.COUNTRY_LAYER_API_TIMEOUT, CONFIG.COUNTRY_LAYER_API_RETRIES);
            const response = await client.get(`${CONFIG.COUNTRY_LAYER_API_URL}/capital/${countryCode}`, {
                access_key: CONFIG.COUNTRY_LAYER_API_KEY
            });
            
            if (response && response.success !== false) {
                countryInfo = {
                    currencyCode: response.currencies?.[0]?.code || null,
                    currencySymbol: response.currencies?.[0]?.symbol || null,
                    language: response.languages?.[0]?.name || null,
                    timezone: response.timezones?.[0]?.zoneName || null,
                    population: response.population,
                    region: response.region,
                    capital: response.capital
                };
                logger.info(`Successfully fetched country info from CountryLayer for ${countryCode}`);
            }
        } catch (error) {
            logger.warn(`CountryLayer API failed for ${countryCode}:`, error);
        }
    }

    // Cache the result
    if (countryInfo) {
        await cache.set(cacheKey, countryInfo, {
            ttl: CONFIG.CACHE_TTL * 24, // Cache for 24 hours
            prefix: 'country',
            tags: [`country:${countryCode}`]
        });
    }

    return countryInfo;
}

// Enhanced Mapbox POI fetching
async function getMapboxPOIs(location: Location): Promise<FetchedPoi[]> {
    const client = new POIClient('Mapbox', CONFIG.MAPBOX_API_TIMEOUT, CONFIG.MAPBOX_API_RETRIES);
    const pois: FetchedPoi[] = [];

    // Enhanced search terms for better coverage
    const searchTerms = [
        'tourist attraction', 'museum', 'landmark', 'monument',
        'restaurant', 'cafe', 'hotel', 'lodging',
        'park', 'garden', 'shopping', 'market',
        'theater', 'cinema', 'bar', 'nightclub',
        'temple', 'church', 'mosque', 'synagogue',
        'castle', 'palace', 'tower', 'bridge'
    ];

    for (const term of searchTerms) {
        try {
            const endpoint = `https://api.mapbox.com/search/searchbox/v1/suggest`;
            const response = await client.get(endpoint, {
                q: term,
                proximity: `${location.lng},${location.lat}`,
                access_token: CONFIG.MAPBOX_API_KEY,
                limit: 5,
                types: 'poi',
            }, CONFIG.MAPBOX_RATE_LIMIT_PER_MINUTE);

            const suggestions = response?.suggestions?.filter(
                (s: MapboxSuggestion) => s.feature_type === 'poi' && s.mapbox_id
            ) || [];

            // Get detailed info for each suggestion
            for (const suggestion of suggestions.slice(0, 3)) {
                try {
                    const detailResponse = await client.get(
                        `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}`,
                        { access_token: CONFIG.MAPBOX_API_KEY }
                    );

                    const feature = detailResponse?.features?.[0];
                    if (feature) {
                        pois.push({
                            placeId: feature.properties.mapbox_id,
                            name: feature.properties.name,
                            category: feature.properties.poi_category?.[0] || 'poi',
                            address: feature.properties.full_address,
                            rating: feature.properties.metadata?.rating,
                            description: feature.properties.metadata?.description,
                            imageUrl: feature.properties.metadata?.image_url,
                            source: 'mapbox'
                        });
                    }
                } catch (detailError) {
                    logger.warn(`Failed to get details for POI ${suggestion.mapbox_id}:`, detailError);
                }
            }
        } catch (error) {
            logger.warn(`Failed to search for term "${term}":`, error);
        }
    }

    return pois;
}

// Google Places POI fetching (fallback)
async function getGooglePlacesPOIs(location: Location): Promise<FetchedPoi[]> {
    if (!CONFIG.GOOGLE_PLACES_API_KEY) {
        return [];
    }

    const client = new POIClient('Google Places', CONFIG.GOOGLE_PLACES_API_TIMEOUT, 3);
    const pois: FetchedPoi[] = [];

    const placeTypes = [
        'tourist_attraction', 'museum', 'point_of_interest',
        'restaurant', 'cafe', 'lodging',
        'park', 'shopping_mall', 'store'
    ];

    for (const type of placeTypes) {
        try {
            const endpoint = `${CONFIG.GOOGLE_PLACES_API_URL}/nearbysearch/json`;
            const response = await client.get(endpoint, {
                location: `${location.lat},${location.lng}`,
                radius: 5000,
                type: type,
                key: CONFIG.GOOGLE_PLACES_API_KEY
            });

            const places = response?.results || [];
            for (const place of places.slice(0, 3)) {
                pois.push({
                    placeId: place.place_id,
                    name: place.name,
                    category: place.types?.[0] || 'point_of_interest',
                    address: place.vicinity,
                    rating: place.rating,
                    description: '',
                    imageUrl: place.photos?.[0] ? 
                        `${CONFIG.GOOGLE_PLACES_API_URL}/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${CONFIG.GOOGLE_PLACES_API_KEY}` : 
                        undefined,
                    source: 'google_places'
                });
            }
        } catch (error) {
            logger.warn(`Failed to get Google Places for type "${type}":`, error);
        }
    }

    return pois;
}

// Foursquare POI fetching (additional fallback)
async function getFoursquarePOIs(location: Location): Promise<FetchedPoi[]> {
    if (!CONFIG.FOURSQUARE_API_KEY || !CONFIG.FOURSQUARE_API_SECRET) {
        return [];
    }

    const client = new POIClient('Foursquare', CONFIG.FOURSQUARE_API_TIMEOUT, 2);
    const pois: FetchedPoi[] = [];

    const categories = [
        '4d4b7104d754a06370d81259', // Arts & Entertainment
        '4d4b7105d754a06374d81259', // Food
        '4d4b7105d754a06376d81259', // Nightlife
        '4d4b7105d754a06377d81259', // Outdoors & Recreation
        '4d4b7105d754a06378d81259', // Professional & Other Places
        '4d4b7105d754a06379d81259'  // Shops & Services
    ];

    for (const categoryId of categories) {
        try {
            const endpoint = `${CONFIG.FOURSQUARE_API_URL}/places/search`;
            const response = await client.get(endpoint, {
                query: 'tourist',
                near: `${location.lat},${location.lng}`,
                categories: categoryId,
                limit: 5
            });

            const venues = response?.results || [];
            for (const venue of venues.slice(0, 2)) {
                pois.push({
                    placeId: venue.fsq_id,
                    name: venue.name,
                    category: venue.categories?.[0]?.name || 'venue',
                    address: venue.location?.address || '',
                    rating: venue.rating,
                    description: venue.description || '',
                    imageUrl: venue.categories?.[0]?.icon ? 
                        `${venue.categories[0].icon.prefix}64${venue.categories[0].icon.suffix}` : 
                        undefined,
                    source: 'foursquare'
                });
            }
        } catch (error) {
            logger.warn(`Failed to get Foursquare venues for category "${categoryId}":`, error);
        }
    }

    return pois;
}

// Main POI fetching function with multiple providers and fallbacks
async function getPointsOfInterest(location: Location): Promise<FetchedPoi[]> {
    const cacheKey = `pois:${location.lat.toFixed(4)}:${location.lng.toFixed(4)}`;
    
    // Check cache first
    const cachedPOIs = await cache.get<FetchedPoi[]>(cacheKey, 'pois');
    if (cachedPOIs && cachedPOIs.length > 0) {
        logger.info(`POI cache hit for location: ${location.lat}, ${location.lng}`);
        return cachedPOIs;
    }

    const allPOIs: FetchedPoi[] = [];
    const seenPlaceIds = new Set<string>();

    // Try OpenTripMap first (free, reliable)
    try {
        const openTripMapPOIs = await getOpenTripMapPOIs(location);
        logger.info(`OpenTripMap returned ${openTripMapPOIs.length} POIs`);
        
        for (const poi of openTripMapPOIs) {
            if (!seenPlaceIds.has(poi.placeId)) {
                allPOIs.push(poi);
                seenPlaceIds.add(poi.placeId);
            }
        }
    } catch (error) {
        logger.error('OpenTripMap POI fetching failed:', error);
    }

    // Try Here Places if available
    if (allPOIs.length < 5 && CONFIG.HERE_API_KEY) {
        try {
            const herePOIs = await getHerePlacesPOIs(location);
            logger.info(`Here Places returned ${herePOIs.length} POIs`);
            
            for (const poi of herePOIs) {
                if (!seenPlaceIds.has(poi.placeId)) {
                    allPOIs.push(poi);
                    seenPlaceIds.add(poi.placeId);
                }
            }
        } catch (error) {
            logger.error('Here Places POI fetching failed:', error);
        }
    }

    // Try Foursquare as additional fallback
    if (allPOIs.length < 10 && CONFIG.FOURSQUARE_API_KEY) {
        try {
            const foursquarePOIs = await getFoursquarePOIs(location);
            logger.info(`Foursquare returned ${foursquarePOIs.length} POIs`);
            
            for (const poi of foursquarePOIs) {
                if (!seenPlaceIds.has(poi.placeId)) {
                    allPOIs.push(poi);
                    seenPlaceIds.add(poi.placeId);
                }
            }
        } catch (error) {
            logger.error('Foursquare POI fetching failed:', error);
        }
    }

    // Cache the results
    if (allPOIs.length > 0) {
        await cache.set(cacheKey, allPOIs, {
            ttl: CONFIG.POI_CACHE_TTL,
            prefix: 'pois',
            tags: [`lat:${location.lat.toFixed(2)}`, `lng:${location.lng.toFixed(2)}`]
        });
    }

    logger.info(`Total POIs found: ${allPOIs.length} from ${new Set(allPOIs.map(p => p.source)).size} providers`);
    return allPOIs;
}

// Main enrichment function
export async function enrichLocationData(locationId: string) {
    logger.info(`[Enrichment] Starting for location ID: ${locationId}`);
    
    const location = await prisma.location.findUnique({
        where: { id: locationId },
    });

    if (!location) {
        logger.error(`Location with ID ${locationId} not found for enrichment. Job aborted.`);
        return;
    }

    logger.info(`[Enrichment] Found location: ${location.name}. Country Code: [${location.countryCode}]`);

    // Fetch country info
    let countryInfo = null;
    if (location.countryCode) {
        countryInfo = await getCountryInfo(location.countryCode);
        if (countryInfo) {
            logger.info(`[Enrichment] Successfully fetched country info for ${location.countryCode}.`);
        } else {
            logger.warn(`[Enrichment] Could not fetch country info for ${location.countryCode}.`);
        }
    }

    // Fetch POIs - COMMENTED OUT FOR MVP
    // logger.info(`Querying POI providers with lat: ${location.lat}, lng: ${location.lng}`);
    // const fetchedPois = await getPointsOfInterest(location);

    // if (fetchedPois.length > 0) {
    //     logger.info(`[Enrichment] Fetched ${fetchedPois.length} Points of Interest from multiple providers.`);
    // } else {
    //     logger.warn(`[Enrichment] No Points of Interest found for location ${location.name}.`);
    // }

    // MVP: Use static recommendations instead of POIs
    logger.info(`[Enrichment] Using static recommendations for ${location.name} (MVP mode)`);

    // Update database with transaction
    try {
        await prisma.$transaction(async (tx) => {
            // Update location with country info
            if (countryInfo) {
                await tx.location.update({
                    where: { id: locationId },
                    data: {
                        currencyCode: countryInfo.currencyCode,
                        currencySymbol: countryInfo.currencySymbol,
                        language: countryInfo.language,
                        timezone: countryInfo.timezone,
                    },
                });
                logger.info(`[Enrichment] DB updated with currency/language for ${location.name}.`);
            }

            // MVP: Skip POI upserts for now
            // if (fetchedPois.length > 0) {
            //     const poiUpserts = fetchedPois.map(poi => 
            //         tx.pointOfInterest.upsert({
            //             where: { placeId: poi.placeId },
            //             update: { 
            //                 ...poi,
            //                 source: poi.source
            //             },
            //             create: {
            //                 locationId: locationId,
            //                 ...poi,
            //                 source: poi.source
            //             },
            //         })
            //     );
            //     await Promise.all(poiUpserts);
            //     logger.info(`[Enrichment] DB upserted ${poiUpserts.length} POIs for ${location.name}.`);
            // }
        });

        logger.info(`Enrichment complete for location: ${location.name} [${locationId}]`);

    } catch (error) {
        logger.error(`Failed to execute enrichment transaction for location ${locationId}:`, error);
        throw error;
    }

    // MVP: Skip RAG embedding for POIs
    // if (fetchedPois.length > 0) {
    //     try {
    //         logger.info(`Queuing location [${locationId}] for RAG embedding.`);
    //         await ragQueue.add('embed-new-pois', { locationId: locationId });
    //         logger.info(`Queued location [${locationId}] for RAG embedding.`);
    //     } catch (error) {
    //         logger.error(`Failed to queue location [${locationId}] for RAG embedding:`, error);
    //     }
    // }
}