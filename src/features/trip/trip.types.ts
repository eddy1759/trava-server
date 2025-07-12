export interface CreateTripData {
    tripName: string;
    startDate: string;
    endDate?: string;
    description?: string;
    destinationQuery: string;
}
