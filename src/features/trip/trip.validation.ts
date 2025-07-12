import { z } from 'zod';
import { TripStatus } from '@prisma/client'

const dateOrDateTime = z.string().refine(
  (val) =>
    /^\d{4}-\d{2}-\d{2}$/.test(val) || // YYYY-MM-DD
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(val), // ISO 8601
  {
    message: 'Invalid date format for start or end date. Use YYYY-MM-DD or ISO 8601 string.'
  }
);

export const createTripSchema = z.object({
  tripName: z.string({ required_error: 'Trip name is required' }).min(3, 'Trip name must be at least 3 characters'),
  destinationQuery: z.string({ required_error: 'Destination is required' }).min(2, 'Destination must be at least 2 characters'),
  startDate: dateOrDateTime,
  endDate: dateOrDateTime.optional(),
  description: z.string().optional(),
});

export const updateTripSchemaStatus = z.object({
  status: z.nativeEnum(TripStatus, {
    required_error: 'Status is required',
    invalid_type_error: 'Status must be one of DRAFT, ACTIVE, CANCELLED or COMPLETED'
  })
})

export const updateTripPrivacySchema = z.object({
  privacy: z.string().min(4).max(5)
})


// export const updateTripStatusSchema = z.object({
//   status: z.enum(['PLANNING', 'ONGOING', 'COMPLETED'], {
//     required_error: 'Status is required',
//     invalid_type_error: 'Status must be one of PLANNING, ONGOING, or COMPLETED'
//   })
// })