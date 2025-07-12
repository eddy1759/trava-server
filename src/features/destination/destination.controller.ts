import { Request, Response } from 'express';
import httpStatus from 'http-status-codes';
import ApiError from '../../utils/ApiError';
import { asyncWrapper } from '../../utils/asyncWrapper';
import * as destinationService from './destination.service';


export const createDestinationHandler = asyncWrapper(async (req: Request, res: Response) => {
    const newDestination = await destinationService.createDestination(req.body);
    res.status(httpStatus.CREATED).json({ success: true, data: newDestination });
});

export const updateDestinationHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { destinationId } = req.params;
    const updatedDestination = await destinationService.updateDestination(destinationId, req.body);
    res.status(httpStatus.OK).json({ success: true, data: updatedDestination });
});

export const getAllDestinationsHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { destinations, total } = await destinationService.getAllDestinations({ page, limit });
    res.status(httpStatus.OK).json({
        success: true,
        data: destinations,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        }
    });
});

export const searchDestinationsHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { q, limit } = req.query as unknown as { q: string; limit: number };
    const destinations = await destinationService.searchDestinations(q, limit);
    res.status(httpStatus.OK).json({ success: true, data: destinations });
});