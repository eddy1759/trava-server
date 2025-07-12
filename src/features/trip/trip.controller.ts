import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { tripService } from './trip.service';
import { asyncWrapper } from '../../utils/asyncWrapper';
import { TripResponseDto } from './trip.dto';
import { TripStatus } from '@prisma/client';

export const createTripHandler = asyncWrapper(async(req: Request, res: Response) => {
    console.log(req.body)
    const ownerId = req.user.id;

    const trip = await tripService.createTrip(req.body, ownerId);

    res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Trip created successfully',
        data: trip
    });
})

export const getTripsByUserHandler = asyncWrapper(async(req: Request, res: Response) => {
    const userId = req.user.id;
    const { page, limit, sortBy, sortOrder, filterByStatus } = req.query;

    const trips = await tripService.getTripsByUser(
        userId,
        Number(page) || 1,
        Number(limit) || 10,
        (sortBy as string) || 'createdAt', // Provide fallback here
        sortOrder === 'asc' ? 'asc' : 'desc',
        filterByStatus ? (filterByStatus as TripStatus) : undefined
    );

    res.status(StatusCodes.OK).json({
        success: true,
        message: 'Trips retrieved successfully',
        data: trips
    });
});

export const getTripByIdHandler = asyncWrapper(async(req: Request, res: Response) => {
    const tripId = req.params.tripId;
    const userId = req.user.id;

    const trip: TripResponseDto = await tripService.getTripById(tripId, userId);

    res.status(StatusCodes.OK).json({
        success: true,
        message: 'Trip retrieved successfully',
        data: trip
    });
});

export const updateTripStatusHandler = asyncWrapper(async(req: Request, res: Response) => {
    const tripId = req.params.tripId;
    const userId = req.user.id;
    let { status } = req.body;

    const statusOptions = status.toUpperCase();

    const updatedTrip = await tripService.updateTripStatus(tripId, userId, statusOptions);

    res.status(StatusCodes.OK).json({
        success: true,
        message: 'Trip status updated successfully',
        data: updatedTrip
    });
})

export const updateTripPrivacyHandler = asyncWrapper(async(req: Request, res: Response) => {
    const tripId = req.params.tripId;
    const userId = req.user.id;
    const { privacy } = req.body

    const tripPrivacyUpdated = await tripService.updateTripPrivacy(tripId, userId, privacy);

    res.status(StatusCodes.OK).json({
        success: true,
        message: `Trip privacy updated to ${privacy}`,
        data: tripPrivacyUpdated
    })
})