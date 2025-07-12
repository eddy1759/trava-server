export interface CreateUserSettingsData {
    userId: string;
    receivesNotifications?: boolean;
    darkMode?: boolean;
    language?: string;
    timezone?: string;
  }
  
  export interface UpdateUserSettingsData {
    receivesNotifications?: boolean;
    darkMode?: boolean;
    language?: string;
    timezone?: string;
  }