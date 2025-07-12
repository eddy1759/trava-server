import { ItineraryItemCategory, ExpenseCategory } from '@prisma/client';
import logger from '../utils/logger';

interface StaticRecommendation {
  title: string;
  description: string;
  category: ItineraryItemCategory;
  estimatedCost: number;
  duration: number; // in hours
  bestTime: string;
  tips: string[];
}

interface ExpenseRecommendation {
  category: ExpenseCategory;
  description: string;
  estimatedAmount: number;
  currency: string;
  frequency: 'daily' | 'once' | 'per_activity';
}

interface DestinationType {
  type: 'city' | 'beach' | 'mountain' | 'cultural' | 'adventure' | 'relaxation' | 'island';
  activities: StaticRecommendation[];
  expenses: ExpenseRecommendation[];
}

// Static data for different destination types
const destinationRecommendations: Record<string, DestinationType> = {
  'paris': {
    type: 'cultural',
    activities: [
      {
        title: 'Visit the Eiffel Tower',
        description: 'Iconic symbol of Paris with stunning city views',
        category: ItineraryItemCategory.ACTIVITY,
        estimatedCost: 30,
        duration: 3,
        bestTime: 'Early morning or sunset',
        tips: ['Book tickets online to avoid queues', 'Visit at sunset for best photos', 'Consider dining at the restaurant']
      },
      {
        title: 'Explore the Louvre Museum',
        description: 'World\'s largest art museum with famous masterpieces',
        category: ItineraryItemCategory.ACTIVITY,
        estimatedCost: 17,
        duration: 4,
        bestTime: 'Wednesday and Friday evenings (less crowded)',
        tips: ['Free entry on first Sunday of month', 'Start with the Mona Lisa', 'Use the underground entrance']
      },
      {
        title: 'Walk along the Seine River',
        description: 'Scenic river walk with beautiful bridges and architecture',
        category: ItineraryItemCategory.ACTIVITY,
        estimatedCost: 0,
        duration: 2,
        bestTime: 'Late afternoon',
        tips: ['Start from Notre-Dame', 'Cross Pont des Arts', 'Visit Île Saint-Louis']
      },
      {
        title: 'Visit Notre-Dame Cathedral',
        description: 'Gothic masterpiece with stunning architecture',
        category: ItineraryItemCategory.ACTIVITY,
        estimatedCost: 0,
        duration: 2,
        bestTime: 'Early morning',
        tips: ['Currently under restoration', 'Visit the crypt', 'Climb the towers for views']
      },
      {
        title: 'Explore Montmartre',
        description: 'Artistic neighborhood with Sacré-Cœur Basilica',
        category: ItineraryItemCategory.ACTIVITY,
        estimatedCost: 0,
        duration: 3,
        bestTime: 'Morning or late afternoon',
        tips: ['Take the funicular up', 'Visit Place du Tertre', 'See the Moulin Rouge']
      }
    ],
    expenses: [
      {
        category: ExpenseCategory.LODGING,
        description: 'Hotel in central Paris',
        estimatedAmount: 150,
        currency: 'EUR',
        frequency: 'daily'
      },
      {
        category: ExpenseCategory.FOOD,
        description: 'Meals and dining',
        estimatedAmount: 60,
        currency: 'EUR',
        frequency: 'daily'
      },
      {
        category: ExpenseCategory.TRANSPORT,
        description: 'Metro and public transport',
        estimatedAmount: 15,
        currency: 'EUR',
        frequency: 'daily'
      },
      {
        category: ExpenseCategory.TICKETS,
        description: 'Museum and attraction tickets',
        estimatedAmount: 50,
        currency: 'EUR',
        frequency: 'once'
      }
    ]
  },
  'tokyo': {
    type: 'city',
    activities: [
      {
        title: 'Visit Senso-ji Temple',
        description: 'Tokyo\'s oldest temple in Asakusa',
        category: ItineraryItemCategory.ACTIVITY,
        estimatedCost: 0,
        duration: 2,
        bestTime: 'Early morning',
        tips: ['Visit the Nakamise shopping street', 'Try traditional snacks', 'See the giant lantern']
      },
      {
        title: 'Explore Shibuya Crossing',
        description: 'World\'s busiest pedestrian crossing',
        category: ItineraryItemCategory.ACTIVITY,
        estimatedCost: 0,
        duration: 1,
        bestTime: 'Evening rush hour',
        tips: ['Watch from Starbucks', 'Visit Hachiko statue', 'Experience the energy']
      },
      {
        title: 'Visit Tokyo Skytree',
        description: 'Tallest tower in Japan with panoramic views',
        category: ItineraryItemCategory.ACTIVITY,
        estimatedCost: 25,
        duration: 3,
        bestTime: 'Sunset',
        tips: ['Book tickets online', 'Visit the observation deck', 'Shop at the mall below']
      }
    ],
    expenses: [
      {
        category: ExpenseCategory.LODGING,
        description: 'Hotel in central Tokyo',
        estimatedAmount: 120,
        currency: 'JPY',
        frequency: 'daily'
      },
      {
        category: ExpenseCategory.FOOD,
        description: 'Meals and dining',
        estimatedAmount: 3000,
        currency: 'JPY',
        frequency: 'daily'
      },
      {
        category: ExpenseCategory.TRANSPORT,
        description: 'JR Pass or metro',
        estimatedAmount: 1000,
        currency: 'JPY',
        frequency: 'daily'
      }
    ]
  },
  'bali': {
    type: 'beach',
    activities: [
      {
        title: 'Visit Tanah Lot Temple',
        description: 'Iconic sea temple on a rock formation',
        category: ItineraryItemCategory.ACTIVITY,
        estimatedCost: 15,
        duration: 3,
        bestTime: 'Sunset',
        tips: ['Check tide times', 'Dress respectfully', 'Visit the nearby beach']
      },
      {
        title: 'Explore Ubud Monkey Forest',
        description: 'Sacred forest with playful macaques',
        category: ItineraryItemCategory.ACTIVITY,
        estimatedCost: 8,
        duration: 2,
        bestTime: 'Early morning',
        tips: ['Don\'t feed the monkeys', 'Secure your belongings', 'Visit the temples inside']
      },
      {
        title: 'Relax at Nusa Penida Beach',
        description: 'Pristine beaches with crystal clear water',
        category: ItineraryItemCategory.ACTIVITY,
        estimatedCost: 25,
        duration: 6,
        bestTime: 'Morning',
        tips: ['Book a day trip', 'Bring snorkeling gear', 'Visit Kelingking Beach']
      }
    ],
    expenses: [
      {
        category: ExpenseCategory.LODGING,
        description: 'Hotel or villa in Bali',
        estimatedAmount: 80,
        currency: 'USD',
        frequency: 'daily'
      },
      {
        category: ExpenseCategory.FOOD,
        description: 'Local and international cuisine',
        estimatedAmount: 25,
        currency: 'USD',
        frequency: 'daily'
      },
      {
        category: ExpenseCategory.TRANSPORT,
        description: 'Scooter rental or driver',
        estimatedAmount: 15,
        currency: 'USD',
        frequency: 'daily'
      }
    ]
  },
  'dubai': {
  type: 'city',
  activities: [
    {
      title: 'Burj Khalifa Observation Deck',
      description: 'World\'s tallest building with panoramic city views',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 40,
      duration: 2,
      bestTime: 'Sunset',
      tips: ['Book in advance', 'Visit around sunset for lighting effects']
    },
    {
      title: 'Dubai Mall & Dubai Fountain',
      description: 'Shopping, dining and fountain shows',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 3,
      bestTime: 'Evening',
      tips: ['Catch the fountain show on the hour', 'Try traditional Emirati cuisine nearby']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Downtown Dubai', estimatedAmount: 200, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Meals and dining', estimatedAmount: 70, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Metro/tram/taxi', estimatedAmount: 20, currency: 'USD', frequency: 'daily' }
  ]
  },
'rome': {
  type: 'cultural',
  activities: [
    {
      title: 'Colosseum & Arena Floor Access',
      description: 'Explore the ruins and stand on gladiator arena',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 18,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Book skip‑the‑line tickets', 'Combine with Forum and Palatine']
    },
    {
      title: 'Vatican Museums & Sistine Chapel',
      description: 'World‑class art collection and Michelangelo\'s frescoes',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 25,
      duration: 3,
      bestTime: 'Afternoon',
      tips: ['Go late afternoon on Fri/Sat', 'Use the Pinacoteca entrance']
    },
    {
      title: 'Pantheon and Trevi Fountain',
      description: 'Iconic ancient temple and baroque fountain',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 1.5,
      bestTime: 'Early evening',
      tips: ['Throw a coin in Trevi', 'Visit Pantheon early to avoid crowds']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel near historic center', estimatedAmount: 150, currency: 'EUR', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Local trattorias & gelato', estimatedAmount: 50, currency: 'EUR', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Metro/bus', estimatedAmount: 6, currency: 'EUR', frequency: 'daily' }
  ]
 },
'osaka': {
  type: 'city',
  activities: [
    {
      title: 'Dotonbori & Street Food Crawl',
      description: 'Neon-lit canal district with takoyaki, okonomiyaki',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 15,
      duration: 2,
      bestTime: 'Evening',
      tips: ['Try takoyaki from multiple vendors', 'Walk along the river']
    },
    {
      title: 'Osaka Castle & Park',
      description: 'Historic castle with panoramic grounds',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 8,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Visit the museum inside', 'Stroll through Nishinomaru Garden']
    },
    {
      title: 'Umeda Sky Building Floating Garden',
      description: 'Rooftop observatory with 360° views',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 12,
      duration: 1.5,
      bestTime: 'Sunset',
      tips: ['Book elevator tickets', 'Combine with dinner in Umeda district']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Namba or Umeda', estimatedAmount: 120, currency: 'JPY', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Street food and izakayas', estimatedAmount: 2000, currency: 'JPY', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'ICOCA card / subway', estimatedAmount: 800, currency: 'JPY', frequency: 'daily' }
  ]
 },
'sarajevo': {
  type: 'cultural',
  activities: [
    {
      title: 'Baščaršija & Ottoman Bazaar',
      description: 'Historic market and coffee culture',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Try Bosnian coffee', 'Explore artisan shops']
    },
    {
      title: 'Tunnel of Hope Museum',
      description: 'WWII‑era tunnel and wartime history',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 5,
      duration: 1.5,
      bestTime: 'Anytime except midday',
      tips: ['Guided tours available', 'Wear comfortable shoes']
    },
    {
      title: 'Rafting the Neretva or local hiking',
      description: 'Outdoor adventure near Sarajevo',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 30,
      duration: 4,
      bestTime: 'Afternoon',
      tips: ['Book with local operator', 'Bring swimwear']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Old Town area', estimatedAmount: 70, currency: 'BAM', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Local Bosnian dishes', estimatedAmount: 30, currency: 'BAM', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Tram / taxi', estimatedAmount: 10, currency: 'BAM', frequency: 'daily' }
  ]
 },
'santorini': {
  type: 'island',
  activities: [
    {
      title: 'Hike Fira → Oia',
      description: 'Iconic coastal cliff hike (~10 km) with panoramic caldera vistas',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 3.2,
      bestTime: 'Morning',
      tips: ['Bring water & sun protection', 'Wear sturdy shoes', 'Catch shuttle/bus back'] 
    },
    {
      title: 'Visit Akrotiri Archaeological Site',
      description: 'Prehistoric Minoan city preserved by volcanic ash',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 12,
      duration: 2,
      bestTime: 'Morning or late afternoon',
      tips: ['Wear comfortable shoes', 'Hire a guide', 'Arrive early to avoid crowds']
    },
    {
      title: 'Explore Red & Black Beaches',
      description: 'Volcanic beaches at Red Beach (cliffs) and Perissa (black sand)',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Afternoon',
      tips: ['Check for landslide notices', 'Bring snorkel gear', 'Sun loungers cost extra']
    },
    {
      title: 'Cable car from Old Port to Fira',
      description: 'Scenic 3-5 mins ride 220m up the caldera',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 10,
      duration: 0.2,
      bestTime: 'Avoid cruise-ship rush (before 10 AM or after 4 PM)',
      tips: ['One-way tickets only', 'Supports local mule drivers', 'Buy tickets on-site']
    },
    {
      title: 'Visit Santo Wines or Domaine Sigalas',
      description: 'Volcanic-soil vineyards with Assyrtiko tastings',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 15,
      duration: 1.5,
      bestTime: 'Late afternoon',
      tips: ['Book tasting in advance', 'Combine with sunset views', 'Try food pairings']
    },
    {
      title: 'Sunset at Oia & Amoudi Bay',
      description: 'Picture-perfect sunset in Oia, seafood dinner at cliff-edge bay',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 20,
      duration: 2,
      bestTime: 'Sunset',
      tips: ['Arrive early for sunset spot', 'Descend 300 steps to Amoudi', 'Reserve table ahead']
    },
    {
      title: 'Catamaran cruise + hot springs swim',
      description: 'Caldera cruise with volcano hike, hot springs & snorkeling',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 60,
      duration: 5,
      bestTime: 'Afternoon/evening',
      tips: ['Book small-group tour', 'Bring swimwear and towel', 'Sunblock essential']
    },
    {
      title: 'Discover Pyrgos & Profitis Ilias Monastery',
      description: 'Historic village & island\'s highest viewpoint at 567 m',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Hike or drive', 'Enjoy 360° island views', 'Stop in Pyrgos for coffee']
    }
  ],
  expenses: [
    {
      category: ExpenseCategory.LODGING,
      description: 'Hotel or cave house in Fira/Oia inland villages',
      estimatedAmount: 100,
      currency: 'EUR',
      frequency: 'daily'
    },
    {
      category: ExpenseCategory.FOOD,
      description: 'Seafood dinners, gyros, local tavernas',
      estimatedAmount: 40,
      currency: 'EUR',
      frequency: 'daily'
    },
    {
      category: ExpenseCategory.TRANSPORT,
      description: 'Bus, cable car, ATV/quad rental',
      estimatedAmount: 25,
      currency: 'EUR',
      frequency: 'daily'
    },
    {
      category: ExpenseCategory.TICKETS,
      description: 'Excursions (boat cruises, museums)',
      estimatedAmount: 50,
      currency: 'EUR',
      frequency: 'once'
    }
  ]
},
'bangkok': {
  type: 'city',
  activities: [
    {
      title: 'Grand Palace & Wat Phra Kaew',
      description: 'Majestic royal complex with Emerald Buddha',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 15,
      duration: 3,
      bestTime: 'Early morning',
      tips: ['Dress modestly', 'Go early to avoid crowds']
    },
    {
      title: 'Boat tour on Chao Phraya River',
      description: 'Scenic cruise passing temples and markets',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 10,
      duration: 2,
      bestTime: 'Late afternoon',
      tips: ['Choose long‑tail boat', 'Bring water']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Sukhumvit or Riverside', estimatedAmount: 50, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Street food & dining', estimatedAmount: 20, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'BTS/motorbike taxi/boat', estimatedAmount: 5, currency: 'USD', frequency: 'daily' }
  ]
},
'newyorkcity': {
  type: 'city',
  activities: [
    {
      title: 'Statue of Liberty & Ellis Island',
      description: 'Iconic symbols of US freedom and immigration',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 25,
      duration: 4,
      bestTime: 'Morning',
      tips: ['Book ferry combo ticket', 'Reserve crown access early']
    },
    {
      title: 'Walk through Central Park',
      description: 'Urban oasis with gardens and lakes',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Morning or golden hour',
      tips: ['Start at Bethesda Terrace', 'Rent a rowboat']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Manhattan or Brooklyn', estimatedAmount: 200, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Diverse eateries & deli favourites', estimatedAmount: 60, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Metro & ferries', estimatedAmount: 13, currency: 'USD', frequency: 'daily' }
  ]
},
'london': {
  type: 'cultural',
  activities: [
    {
      title: 'Visit British Museum',
      description: 'World-renowned collection of human history',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 3,
      bestTime: 'Morning',
      tips: ['Free entry', 'Highlight the Rosetta Stone']
    },
    {
      title: 'Tower of London & Crown Jewels',
      description: 'Historic fortress with royal treasures',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 30,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Join Yeoman Warder tour', 'Pre-book tickets']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Central London', estimatedAmount: 180, currency: 'GBP', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Pub meals, street food markets', estimatedAmount: 50, currency: 'GBP', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Oyster card travel', estimatedAmount: 15, currency: 'GBP', frequency: 'daily' }
  ]
},
'sicily': {
  type: 'island',
  activities: [
    {
      title: 'Explore Mount Etna',
      description: 'Active volcano with guided hikes',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 40,
      duration: 5,
      bestTime: 'Morning',
      tips: ['Dress warm', 'Use a guide']
    },
    {
      title: 'Visit Valley of the Temples',
      description: 'Ancient Greek ruins in Agrigento',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 14,
      duration: 2,
      bestTime: 'Afternoon',
      tips: ['Avoid midday heat', 'Bring water']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Agriturismo or B&B', estimatedAmount: 80, currency: 'EUR', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Italian cuisine & street markets', estimatedAmount: 35, currency: 'EUR', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Rental car or bus', estimatedAmount: 25, currency: 'EUR', frequency: 'daily' }
  ]
},
'barcelona': {
  type: 'cultural',
  activities: [
    {
      title: 'La Sagrada Família',
      description: 'Gaudí\'s unfinished masterpiece basilica',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 26,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Book tickets with tower access', 'Arrive early']
    },
    {
      title: 'Stroll through Park Güell',
      description: 'Colorful mosaic park with city views',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 10,
      duration: 1.5,
      bestTime: 'Sunset',
      tips: ['Reserve entry', 'Combine with Gràcia stroll']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Gothic Quarter or Eixample', estimatedAmount: 120, currency: 'EUR', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Tapas, seafood paella', estimatedAmount: 40, currency: 'EUR', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Metro/T10 ticket', estimatedAmount: 10, currency: 'EUR', frequency: 'daily' }
  ]
},
'kualaLumpur': {
  type: 'city',
  activities: [
    {
      title: 'Petronas Twin Towers',
      description: 'Iconic skybridge and observation deck',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 20,
      duration: 2,
      bestTime: 'Late afternoon',
      tips: ['Book in advance', 'Combine with KLCC Park visit']
    },
    {
      title: 'Batu Caves Temple',
      description: 'Hindu shrine in dramatic limestone cave',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Climb early to avoid monkeys', 'Wear modest clothes']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Bukit Bintang', estimatedAmount: 70, currency: 'MYR', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Street food & hawker centres', estimatedAmount: 30, currency: 'MYR', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'MRT, Grab rides', estimatedAmount: 15, currency: 'MYR', frequency: 'daily' }
  ]
},
'buenosaires': {
  type: 'city',
  activities: [
    {
      title: 'La Boca & Caminito',
      description: 'Colorful street museum & tango performances',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 1.5,
      bestTime: 'Afternoon',
      tips: ['Watch street tango', 'Visit nearby stadium']
    },
    {
      title: 'Recoleta Cemetery & Basilica',
      description: 'Historic mausoleums & ornate churches',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Guided tour to learn stories', 'Arrive early']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Palermo or Recoleta', estimatedAmount: 90, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Steak dinners & empanadas', estimatedAmount: 35, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Subte & taxis', estimatedAmount: 10, currency: 'USD', frequency: 'daily' }
  ]
},
'lima': {
  type: 'city',
  activities: [
    {
      title: 'Historic Centre & Plaza Mayor',
      description: 'Colonial architecture & cathedral',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 1.5,
      bestTime: 'Morning',
      tips: ['Guided walk', 'Visit Government Palace']
    },
    {
      title: 'Miraflores boardwalk & surf beaches',
      description: 'Pacific coastal parks and viewpoints',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Afternoon',
      tips: ['Wear sun protection', 'Try ceviche nearby']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Miraflores', estimatedAmount: 80, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Peruvian cuisine', estimatedAmount: 30, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Uber/local buses', estimatedAmount: 8, currency: 'USD', frequency: 'daily' }
  ]
},
'medellin': {
  type: 'city',
  activities: [
    {
      title: 'Ride the Metrocable to Parque Arví',
      description: 'Scenic cable car into nature',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 3,
      duration: 4,
      bestTime: 'Morning',
      tips: ['Buy return ticket', 'Wear layers for cooler weather']
    },
    {
      title: 'Plaza Botero & Museu de Antioquia',
      description: 'Fernando Botero sculptures and art museum',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 6,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Combine with café stop nearby']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in El Poblado', estimatedAmount: 60, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Local Colombian meals', estimatedAmount: 20, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Metro & cable cars', estimatedAmount: 5, currency: 'USD', frequency: 'daily' }
  ]
},
'edinburgh': {
  type: 'cultural',
  activities: [
    {
      title: 'Edinburgh Castle & Royal Mile',
      description: 'Historic fortress with city views',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 20,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Book entry online', 'Walk down Royal Mile afterward']
    },
    {
      title: "Arthur's Seat hike & Holyrood Park",
      description: 'Scenic hill with panoramic city views',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 3,
      bestTime: 'Morning or late afternoon',
      tips: ['Wear sturdy shoes', 'Check weather']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel near Old Town', estimatedAmount: 120, currency: 'GBP', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Scottish fare', estimatedAmount: 40, currency: 'GBP', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Bus/local taxi', estimatedAmount: 10, currency: 'GBP', frequency: 'daily' }
  ]
},
'antalya': {
  type: 'beach',
  activities: [
    {
      title: 'Explore Kekova Sunken City',
      description: 'Glass-bottom boat tour over submerged Lycian ruins',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 30,
      duration: 3,
      bestTime: 'Morning',
      tips: ['Bring snorkeling gear', 'Go when waters are calm']
    },
    {
      title: 'Ride Olympos Cable Car to Mt. Tahtalı',
      description: 'Cable car ascent to panoramic summit (2,365 m)',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 25,
      duration: 2,
      bestTime: 'Afternoon',
      tips: ['Check weather', 'Bring jacket at top']
    },
    {
      title: 'Visit Düden Waterfalls',
      description: 'Stroll and view Upper & dramatic cliff-drop Lower falls',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 1.5,
      bestTime: 'Late morning',
      tips: ['Take camera', 'Pack a light snack']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Resort or hotel near Lara or Kaleiçi', estimatedAmount: 100, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Local and seafood meals', estimatedAmount: 30, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Car rental or dolmuş', estimatedAmount: 20, currency: 'USD', frequency: 'daily' }
  ]
},

'istanbul': {
  type: 'cultural',
  activities: [
    {
      title: 'Ride the Bosphorus Ferry',
      description: 'Scenic ferry connecting Europe and Asia, part of daily life',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 5,
      duration: 2,
      bestTime: 'Late afternoon',
      tips: ['Sit on upper deck', 'Combine with fish sandwich']
    },
    {
      title: 'Visit Hagia Sophia & Sultanahmet',
      description: 'Historic basilica/mosque/museum in Sultanahmet square',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 20,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Buy skip the line ticket', 'Walk to Blue Mosque nearby']
    },
    {
      title: 'Explore Karaköy & Kadiköy districts',
      description: 'Trendy neighborhoods with street art, cafés, nightlife',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 3,
      bestTime: 'Evening',
      tips: ['Check metro and ferry routes', 'Try local sweets and meze']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Sultanahmet or Beyoğlu', estimatedAmount: 120, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Turkish cuisine & snacks', estimatedAmount: 25, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Metro, ferry, tram', estimatedAmount: 10, currency: 'USD', frequency: 'daily' }
  ]
},

'crete': {
  type: 'island',
  activities: [
    {
      title: 'Relax at Elafonisi & Vai beaches',
      description: 'Famous pink-sand (Elafonisi) and palm-lined Vai beaches',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 4,
      bestTime: 'Afternoon',
      tips: ['Visit Elafonisi early', 'Pack food and water']
    },
    {
      title: 'Hike Samaria Gorge',
      description: '40 km national park with scenic gorge trail',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 10,
      duration: 6,
      bestTime: 'Morning',
      tips: ['Bring hiking shoes', 'Bus is one-way return']
    },
    {
      title: 'Explore Knossos Palace near Heraklion',
      description: 'Ancient Minoan palace and archaeological site',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 12,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Book guided tour', 'Wear sunhat and sunscreen']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel or guesthouse inland or coast', estimatedAmount: 80, currency: 'EUR', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Greek tavernas & street eats', estimatedAmount: 30, currency: 'EUR', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Rental car or bus', estimatedAmount: 20, currency: 'EUR', frequency: 'daily' }
  ]
},

'marrakech': {
  type: 'cultural',
  activities: [
    {
      title: 'Wander Jemaa el-Fnaa & Medina souks',
      description: 'UNESCO cultural square with performers, markets',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Evening',
      tips: ['Agree a price before buying', 'Try street food'] 
    },
    {
      title: 'Visit Bahia Palace & Koutoubia Mosque',
      description: '19th‑century palace and iconic mosque minaret',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 7,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Hire guide for Bahia Palace history', 'View Koutoubia exterior at sunset']
    },
    {
      title: 'Discover Majorelle Garden',
      description: 'Botanical garden and Berber Museum',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 12,
      duration: 1.5,
      bestTime: 'Afternoon',
      tips: ['Visit early to beat crowds', 'Combine with YSL Museum']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Riad in Medina or Gueliz district', estimatedAmount: 90, currency: 'EUR', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Moroccan tagine, street snacks', estimatedAmount: 30, currency: 'EUR', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Petit taxi or walking', estimatedAmount: 5, currency: 'EUR', frequency: 'daily' }
  ]
},

'cusco': {
  type: 'adventure',
  activities: [
    {
      title: 'Tour Sacsayhuamán',
      description: 'Incan fortress with massive masonry walls',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 10,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Acclimatize first', 'Hire local guide']
    },
    {
      title: 'Visit Maras Salt Mines & Ollantaytambo',
      description: 'Terraced salt pans and Inca town on way to Machu Picchu',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 15,
      duration: 4,
      bestTime: 'Morning',
      tips: ['Bring water and sunscreen', 'Combine as full‑day tour']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in central Cusco', estimatedAmount: 70, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Peruvian cuisine and markets', estimatedAmount: 25, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Taxi/bus tours', estimatedAmount: 10, currency: 'USD', frequency: 'daily' }
  ]
},

'kathmandu': {
  type: 'cultural',
  activities: [
    {
      title: 'Explore Kathmandu Durbar Square',
      description: 'UNESCO heritage palaces & temples cluster',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 8.8,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Use guide for history', 'Wear good shoes']
    },
    {
      title: 'Circumambulate Boudhanath Stupa',
      description: 'Largest Tibetan Buddhist stupa, pilgrims & prayer wheels',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 3.8,
      duration: 2,
      bestTime: 'Evening',
      tips: ['Walk clockwise', 'Light butter lamps']
    },
    {
      title: 'Climb Dharahara Tower',
      description: 'Rebuilt 72 m historic tower with valley views',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 5,
      duration: 1,
      bestTime: 'Late afternoon',
      tips: ['213-step spiral stairs', 'Watch sunset from top']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel or guesthouse in Thamel or near Durbar Square', estimatedAmount: 50, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Nepali dishes, momos, street food', estimatedAmount: 15, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Taxi, rickshaw, occasional cable car', estimatedAmount: 10, currency: 'USD', frequency: 'daily' }
  ]
},
'riodejaneiro': {
  type: 'beach',
  activities: [
    {
      title: 'Christ the Redeemer (Corcovado)',
      description: 'Iconic statue atop Corcovado with panoramic city views',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 25,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Book train access early', 'Combine with Tijuca Forest hike']
    },
    {
      title: 'Relax at Copacabana & Ipanema',
      description: 'World-famous beaches for sunbathing and people-watching',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 3,
      bestTime: 'Late afternoon',
      tips: ['Use beach kiosks', 'Stay alert to surroundings']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel near Copacabana/Ipanema', estimatedAmount: 120, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Brazilian cuisine & street food', estimatedAmount: 35, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Metro, buses, taxis', estimatedAmount: 10, currency: 'USD', frequency: 'daily' }
  ]
},
'iguazufalls': {
  type: 'adventure',
  activities: [
    {
      title: '',
      description: 'Walkways and boat safaris around the massive falls',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 40,
      duration: 4,
      bestTime: 'Morning',
      tips: ['Pack change of clothes', 'Wear waterproofs']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Puerto Iguazú or Foz do Iguaçu', estimatedAmount: 100, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Local meals & park cafes', estimatedAmount: 25, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Park shuttle/bus', estimatedAmount: 15, currency: 'USD', frequency: 'daily' }
  ]
},
'cartagena': {
  type: 'cultural',
  activities: [
    {
      title: 'Stroll Historic Walled City',
      description: 'Colorful colonial plazas, churches, street performers',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Late afternoon',
      tips: ['Sun protection', 'Watch for souvenir hawkers']
    },
    {
      title: 'Relax at Bocagrande Beach',
      description: 'Coastal leisure near city center',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Use beach loungers', 'Try fresh seafood']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in Getsemaní or Old Town', estimatedAmount: 80, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Colombian cuisine & seafood', estimatedAmount: 30, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Taxi & buses', estimatedAmount: 8, currency: 'USD', frequency: 'daily' }
  ]
},
'capetown': {
  type: 'city',
  activities: [
    {
      title: 'Table Mountain Cableway',
      description: 'Iconic mountain with sweeping views over the city',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 20,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Book return ticket', 'Bring windbreaker']
    },
    {
      title: 'Visit V&A Waterfront & Robben Island',
      description: 'Shopping, culture, and ferry to Mandela\'s former prison',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 30,
      duration: 4,
      bestTime: 'Morning',
      tips: ['Book Robben Island in advance']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Hotel in City Bowl or Waterfront', estimatedAmount: 120, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'South African cuisine & seafood', estimatedAmount: 35, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Uber, buses, cableway', estimatedAmount: 15, currency: 'USD', frequency: 'daily' }
  ]
},
'zanzibar': {
  type: 'beach',
  activities: [
    {
      title: 'Explore Stone Town',
      description: 'Historic UNESCO town with bazaars, architecture',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 5,
      duration: 2,
      bestTime: 'Morning',
      tips: ['Hire local guide', 'Watch sunset at Forodhani Gardens']
    },
    {
      title: 'Relax at Nungwi & Kendwa Beaches',
      description: 'White sands and tropical waters',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 3,
      bestTime: 'Afternoon',
      tips: ['Book beach lounger', 'Try dhow sunset cruise']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Resort near Nungwi or Stone Town', estimatedAmount: 100, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Swahili cuisine & seafood', estimatedAmount: 30, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Dala‑dala & taxis', estimatedAmount: 10, currency: 'USD', frequency: 'daily' }
  ]
},
'victoriafalls': {
  type: 'adventure',
  activities: [
    {
      title: 'View Mosi-oa-Tunya (The Smoke That Thunders)',
      description: 'Spectacular waterfalls with rainbows and spray',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 1.5,
      bestTime: 'Morning',
      tips: ['Wear waterproof clothing', 'Use camera protection']
    },
    {
      title: "White-Water Rafting or Devil's Pool",
      description: 'Thrilling adventure on Zambezi River',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 80,
      duration: 4,
      bestTime: 'Afternoon',
      tips: ['Book certified operator', 'Bring secure shoes']
    }
  ],
  expenses: [
    { category: ExpenseCategory.LODGING, description: 'Lodge or hotel near the Falls', estimatedAmount: 150, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.FOOD, description: 'Local & lodge meals', estimatedAmount: 40, currency: 'USD', frequency: 'daily' },
    { category: ExpenseCategory.TRANSPORT, description: 'Park transfers & tours', estimatedAmount: 20, currency: 'USD', frequency: 'daily' }
  ]
},
'ibiza': {
  type: 'beach',
  activities: [
    {
      title: 'Explore Hidden Coves by Kayak',
      description: 'Guided kayak trips to secluded beaches and snorkeling spots',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 50,
      duration: 3,
      bestTime: 'Morning',
      tips: ['Bring swimwear & sun protection', 'Choose a small-group tour'] 
    },
    {
      title: 'Visit Dalt Vila & Puig des Molins',
      description: 'UNESCO Old Town with fortress, cathedral & Phoenician necropolis',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Morning or late afternoon',
      tips: ['Wear good shoes for cobblestones', 'Combine with Archeological Museum visit'] 
    },
    {
      title: 'Sa Talaia Hike',
      description: 'Climb Ibiza\'s highest point for panoramic island views',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 3,
      bestTime: 'Morning',
      tips: ['Start early, bring water', 'Wear sturdy shoes']  
    },
    {
      title: 'Sunset at Benirras Beach',
      description: 'Sunset drum circles and relaxed boho vibes',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Sunset',
      tips: ['Arrive early for a spot', 'Bring light layers for evening'] 
    },
    {
      title: 'Boat excursion to Es Vedrá & snorkeling',
      description: 'Coastal boat trip with swims and scenic views of mystical islet',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 60,
      duration: 4,
      bestTime: 'Afternoon',
      tips: ['Bring towel & waterproof camera', 'Book ahead'] 
    },
    {
      title: 'Day club at Ushuaïa or Hï Ibiza',
      description: 'World-class DJ performances and poolside party',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 60,
      duration: 5,
      bestTime: 'Daytime (1 PM - 6 PM)',
      tips: ['Buy early bird tickets online', 'Arrive early to get loungers'] 
    }
  ],
  expenses: [
    {
      category: ExpenseCategory.LODGING,
      description: 'Mid-range hotel or villa near Playa d\'en Bossa or Santa Eulalia',
      estimatedAmount: 150,
      currency: 'EUR',
      frequency: 'daily'
    },
    {
      category: ExpenseCategory.FOOD,
      description: 'Cafés, beachside eats, tapas & mid-range restaurants',
      estimatedAmount: 40,
      currency: 'EUR',
      frequency: 'daily'
    },
    {
      category: ExpenseCategory.TRANSPORT,
      description: 'Bus, scooter rental, occasional taxi',
      estimatedAmount: 20,
      currency: 'EUR',
      frequency: 'daily'
    },
    {
      category: ExpenseCategory.TICKETS,
      description: 'Boat trip, club entry, museum fees',
      estimatedAmount: 70,
      currency: 'EUR',
      frequency: 'per_activity'
    }
  ]
}
};

// Generic recommendations for unknown destinations
const genericRecommendations: DestinationType = {
  type: 'cultural',
  activities: [
    {
      title: 'Explore the City Center',
      description: 'Walk around the main square and historic district',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 0,
      duration: 2,
      bestTime: 'Morning or late afternoon',
      tips: ['Visit local markets', 'Try local cuisine', 'Take photos of landmarks']
    },
    {
      title: 'Visit Local Museums',
      description: 'Learn about the local history and culture',
      category: ItineraryItemCategory.ACTIVITY,
      estimatedCost: 15,
      duration: 3,
      bestTime: 'Morning',
      tips: ['Check opening hours', 'Look for free days', 'Take guided tours']
    },
    {
      title: 'Try Local Restaurants',
      description: 'Experience authentic local cuisine',
      category: ItineraryItemCategory.RESTAURANT,
      estimatedCost: 25,
      duration: 2,
      bestTime: 'Lunch or dinner',
      tips: ['Ask locals for recommendations', 'Try street food', 'Learn basic phrases']
    }
  ],
  expenses: [
    {
      category: ExpenseCategory.LODGING,
      description: 'Hotel accommodation',
      estimatedAmount: 100,
      currency: 'USD',
      frequency: 'daily'
    },
    {
      category: ExpenseCategory.FOOD,
      description: 'Meals and dining',
      estimatedAmount: 40,
      currency: 'USD',
      frequency: 'daily'
    },
    {
      category: ExpenseCategory.TRANSPORT,
      description: 'Local transportation',
      estimatedAmount: 20,
      currency: 'USD',
      frequency: 'daily'
    }
  ]
};

export function getDestinationRecommendations(
  destinationName: string,
  tripDuration: number,
  budget: number
): { activities: StaticRecommendation[], expenses: ExpenseRecommendation[] } {
  const normalizedName = destinationName.toLowerCase().replace(/[^a-z]/g, '');
  const destination = destinationRecommendations[normalizedName];
  const dailyBudget = budget / Math.max(tripDuration, 1);

  let activities: StaticRecommendation[] = [];
  let expenses: ExpenseRecommendation[] = [];

  if (destination) {
    logger.info(`Found specific recommendations for ${destinationName}`);
    // Filter activities to fit within 30% of daily budget per activity
    activities = destination.activities.filter(activity => activity.estimatedCost <= dailyBudget * 0.3);
    // Limit activities to 2 per day
    const maxActivities = Math.min(tripDuration * 2, activities.length);
    activities = activities.slice(0, maxActivities);

    // Scale and filter expenses
    expenses = destination.expenses.map(expense => {
      if (expense.frequency === 'daily') {
        return { ...expense, estimatedAmount: expense.estimatedAmount * tripDuration };
      }
      return { ...expense };
    }).filter(expense => expense.estimatedAmount <= budget * 0.5); // Only include expenses <= 50% of total budget

    // If no activities or expenses fit, fall back to generic
    if (activities.length === 0 || expenses.length === 0) {
      logger.info(`No tailored recommendations fit budget/duration for ${destinationName}, using generic.`);
      return {
        activities: genericRecommendations.activities,
        expenses: genericRecommendations.expenses
      };
    }
    return { activities, expenses };
  }

  // Fallback to generic recommendations
  logger.info(`Using generic recommendations for ${destinationName}`);
  return {
    activities: genericRecommendations.activities,
    expenses: genericRecommendations.expenses
  };
}

export function generateItinerarySuggestions(
  destinationName: string,
  startDate: Date,
  endDate: Date,
  budget: number
): StaticRecommendation[] {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const recommendations = getDestinationRecommendations(destinationName, days, budget);
  
  // Filter and adjust recommendations based on budget and duration
  const budgetPerDay = budget / days;
  const filteredActivities = recommendations.activities.filter(activity => 
    activity.estimatedCost <= budgetPerDay * 0.3 // Max 30% of daily budget per activity
  );
  
  // Limit activities based on trip duration
  const maxActivities = Math.min(days * 2, filteredActivities.length);
  
  return filteredActivities.slice(0, maxActivities);
}

export function generateBudgetBreakdown(
  destinationName: string,
  tripDuration: number,
  totalBudget: number
): { category: ExpenseCategory, amount: number, percentage: number }[] {
  const recommendations = getDestinationRecommendations(destinationName, tripDuration, totalBudget);
  
  const breakdown = recommendations.expenses.map(expense => {
    const amount = expense.frequency === 'daily' 
      ? expense.estimatedAmount * tripDuration
      : expense.estimatedAmount;
    
    return {
      category: expense.category,
      amount,
      percentage: (amount / totalBudget) * 100
    };
  });
  
  return breakdown;
} 