# Frontend Integration Guide

## 🎯 Overview

This guide provides comprehensive examples for integrating the Trava API with various frontend frameworks and libraries.

## 📱 React Integration

### 1. Project Setup

```bash
# Create React app with TypeScript
npx create-react-app trava-frontend --template typescript

# Install dependencies
npm install axios @tanstack/react-query react-router-dom @mui/material @emotion/react @emotion/styled
```

### 2. API Client Configuration

```typescript
// src/lib/api.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios';

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async login(email: string, password: string) {
    const response = await this.client.post<ApiResponse>('/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async register(userData: any) {
    const response = await this.client.post<ApiResponse>('/auth/register', userData);
    return response.data;
  }

  // Trips
  async createTrip(tripData: any) {
    const response = await this.client.post<ApiResponse>('/trips', tripData);
    return response.data;
  }

  async getTrips() {
    const response = await this.client.get<ApiResponse>('/trips');
    return response.data;
  }

  async getTrip(id: string) {
    const response = await this.client.get<ApiResponse>(`/trips/${id}`);
    return response.data;
  }

  // Photos
  async uploadPhoto(formData: FormData) {
    const response = await this.client.post<ApiResponse>('/photos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async likePhoto(photoId: string) {
    const response = await this.client.post<ApiResponse>(`/photos/${photoId}/like`);
    return response.data;
  }

  async commentPhoto(photoId: string, content: string) {
    const response = await this.client.post<ApiResponse>(`/photos/${photoId}/comment`, {
      content,
    });
    return response.data;
  }

  // Journal Entries
  async createJournalEntry(entryData: any) {
    const response = await this.client.post<ApiResponse>('/journal-entries', entryData);
    return response.data;
  }

  async searchJournalEntries(query: string) {
    const response = await this.client.get<ApiResponse>(`/journal-entries?search=${query}`);
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

### 3. React Query Hooks

```typescript
// src/hooks/useTrips.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export const useTrips = () => {
  return useQuery({
    queryKey: ['trips'],
    queryFn: () => apiClient.getTrips(),
  });
};

export const useCreateTrip = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (tripData: any) => apiClient.createTrip(tripData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
};

export const useTrip = (id: string) => {
  return useQuery({
    queryKey: ['trip', id],
    queryFn: () => apiClient.getTrip(id),
    enabled: !!id,
  });
};
```

```typescript
// src/hooks/usePhotos.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export const useUploadPhoto = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (formData: FormData) => apiClient.uploadPhoto(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });
};

export const useLikePhoto = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (photoId: string) => apiClient.likePhoto(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });
};
```

### 4. Components

```typescript
// src/components/TripCard.tsx
import React from 'react';
import { Card, CardContent, Typography, Button, Chip } from '@mui/material';
import { useTrip } from '../hooks/useTrips';

interface TripCardProps {
  tripId: string;
  onViewDetails: (tripId: string) => void;
}

export const TripCard: React.FC<TripCardProps> = ({ tripId, onViewDetails }) => {
  const { data: trip, isLoading, error } = useTrip(tripId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading trip</div>;

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2">
          {trip.data.tripName}
        </Typography>
        <Typography color="textSecondary">
          {trip.data.description}
        </Typography>
        <Chip 
          label={trip.data.tripStatus} 
          color={trip.data.tripStatus === 'ACTIVE' ? 'success' : 'default'}
        />
        <Button 
          variant="contained" 
          onClick={() => onViewDetails(tripId)}
          sx={{ mt: 2 }}
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
};
```

```typescript
// src/components/PhotoUpload.tsx
import React, { useState } from 'react';
import { Button, LinearProgress, Alert } from '@mui/material';
import { useUploadPhoto } from '../hooks/usePhotos';

interface PhotoUploadProps {
  journalEntryId: string;
  onUploadComplete: (photo: any) => void;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ 
  journalEntryId, 
  onUploadComplete 
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const uploadMutation = useUploadPhoto();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const handleUpload = async () => {
    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });
    formData.append('journalEntryId', journalEntryId);
    formData.append('isPublic', 'true');
    formData.append('provider', 's3');

    try {
      const result = await uploadMutation.mutateAsync(formData);
      onUploadComplete(result.data);
      setSelectedFiles([]);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        id="photo-upload"
      />
      <label htmlFor="photo-upload">
        <Button variant="contained" component="span">
          Select Photos
        </Button>
      </label>
      
      {selectedFiles.length > 0 && (
        <div>
          <Typography variant="body2">
            {selectedFiles.length} file(s) selected
          </Typography>
          <Button 
            variant="contained" 
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
          >
            Upload Photos
          </Button>
        </div>
      )}

      {uploadMutation.isPending && (
        <LinearProgress />
      )}

      {uploadMutation.isError && (
        <Alert severity="error">
          Upload failed. Please try again.
        </Alert>
      )}
    </div>
  );
};
```

## 🖼️ Vue.js Integration

### 1. Project Setup

```bash
# Create Vue app
npm create vue@latest trava-vue-frontend

# Install dependencies
npm install axios pinia vue-router @vueuse/core
```

### 2. API Service

```typescript
// src/services/api.ts
import axios from 'axios';
import type { AxiosInstance } from 'axios';

export class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async login(credentials: { email: string; password: string }) {
    const response = await this.client.post('/auth/login', credentials);
    return response.data;
  }

  // Trips
  async getTrips() {
    const response = await this.client.get('/trips');
    return response.data;
  }

  async createTrip(tripData: any) {
    const response = await this.client.post('/trips', tripData);
    return response.data;
  }

  // Photos
  async uploadPhoto(formData: FormData) {
    const response = await this.client.post('/photos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
}

export const apiService = new ApiService();
```

### 3. Pinia Store

```typescript
// src/stores/trips.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiService } from '../services/api';

export const useTripsStore = defineStore('trips', () => {
  const trips = ref([]);
  const loading = ref(false);
  const error = ref(null);

  const activeTrips = computed(() => 
    trips.value.filter(trip => trip.tripStatus === 'ACTIVE')
  );

  const fetchTrips = async () => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiService.getTrips();
      trips.value = response.data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  const createTrip = async (tripData: any) => {
    try {
      const response = await apiService.createTrip(tripData);
      trips.value.push(response.data);
      return response.data;
    } catch (err) {
      error.value = err.message;
      throw err;
    }
  };

  return {
    trips,
    loading,
    error,
    activeTrips,
    fetchTrips,
    createTrip,
  };
});
```

### 4. Vue Components

```vue
<!-- src/components/TripList.vue -->
<template>
  <div class="trip-list">
    <div v-if="loading" class="loading">
      Loading trips...
    </div>
    
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    
    <div v-else class="trips">
      <TripCard
        v-for="trip in trips"
        :key="trip.id"
        :trip="trip"
        @click="viewTrip(trip.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useTripsStore } from '../stores/trips';
import TripCard from './TripCard.vue';

const tripsStore = useTripsStore();

onMounted(() => {
  tripsStore.fetchTrips();
});

const viewTrip = (tripId: string) => {
  // Navigate to trip details
};
</script>
```

## 📱 Mobile Integration (React Native)

### 1. Setup

```bash
# Create React Native app
npx react-native init TravaMobile --template react-native-template-typescript

# Install dependencies
npm install @react-navigation/native @react-navigation/stack axios react-native-image-picker
```

### 2. API Client

```typescript
// src/services/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: 'http://localhost:3000',
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### 3. Photo Upload

```typescript
// src/components/PhotoUpload.tsx
import React, { useState } from 'react';
import { View, Button, Image, Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../services/api';

export const PhotoUpload = ({ journalEntryId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);

  const selectImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.assets && result.assets[0]) {
      await uploadImage(result.assets[0]);
    }
  };

  const uploadImage = async (image) => {
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', {
      uri: image.uri,
      type: image.type,
      name: image.fileName,
    });
    formData.append('journalEntryId', journalEntryId);
    formData.append('isPublic', 'true');

    try {
      const response = await api.post('/photos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      onUploadComplete(response.data.data);
    } catch (error) {
      Alert.alert('Upload Failed', 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View>
      <Button 
        title="Select Photo" 
        onPress={selectImage}
        disabled={uploading}
      />
      {uploading && <Text>Uploading...</Text>}
    </View>
  );
};
```

## 🌐 Real-time Features

### WebSocket Integration

```typescript
// src/services/websocket.ts
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string) {
    this.ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect();
    };
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        const token = localStorage.getItem('token');
        if (token) {
          this.connect(token);
        }
      }, 1000 * this.reconnectAttempts);
    }
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case 'NEW_COMMENT':
        // Handle new comment notification
        break;
      case 'TRIP_UPDATE':
        // Handle trip update
        break;
      case 'BADGE_EARNED':
        // Handle badge earned
        break;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

## 🎨 UI Component Libraries

### Material-UI (React)

```typescript
// src/components/TripForm.tsx
import React from 'react';
import {
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  Box,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';

export const TripForm = ({ onSubmit, loading }) => {
  const [formData, setFormData] = React.useState({
    tripName: '',
    description: '',
    destinationQuery: '',
    startDate: null,
    endDate: null,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Create New Trip
        </Typography>
        
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Trip Name"
            value={formData.tripName}
            onChange={(e) => setFormData({ ...formData, tripName: e.target.value })}
            margin="normal"
            required
          />
          
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          
          <TextField
            fullWidth
            label="Destination"
            value={formData.destinationQuery}
            onChange={(e) => setFormData({ ...formData, destinationQuery: e.target.value })}
            margin="normal"
            required
          />
          
          <DatePicker
            label="Start Date"
            value={formData.startDate}
            onChange={(date) => setFormData({ ...formData, startDate: date })}
            renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
          />
          
          <DatePicker
            label="End Date"
            value={formData.endDate}
            onChange={(date) => setFormData({ ...formData, endDate: date })}
            renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
          />
          
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
            sx={{ mt: 3 }}
          >
            {loading ? 'Creating...' : 'Create Trip'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};
```

## 🔧 Error Handling

### Global Error Handler

```typescript
// src/utils/errorHandler.ts
export class ErrorHandler {
  static handle(error: any) {
    if (error.response) {
      switch (error.response.status) {
        case 400:
          return 'Invalid request. Please check your input.';
        case 401:
          return 'Please log in to continue.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 429:
          return 'Too many requests. Please wait before trying again.';
        case 500:
          return 'Server error. Please try again later.';
        default:
          return 'An unexpected error occurred.';
      }
    }
    
    if (error.request) {
      return 'Network error. Please check your connection.';
    }
    
    return 'An unexpected error occurred.';
  }
}
```

### React Error Boundary

```typescript
// src/components/ErrorBoundary.tsx
import React from 'react';

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>Something went wrong.</h1>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## 📊 Performance Optimization

### React Query Configuration

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### Image Optimization

```typescript
// src/components/OptimizedImage.tsx
import React from 'react';
import { Image, ImageProps } from '@mui/material';

interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width = 300,
  height = 200,
  ...props
}) => {
  // Add image optimization parameters
  const optimizedSrc = `${src}?w=${width}&h=${height}&fit=crop&auto=format`;

  return (
    <Image
      src={optimizedSrc}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      {...props}
    />
  );
};
```

This comprehensive frontend integration guide provides practical examples for integrating with the Trava API across different frameworks and platforms. 