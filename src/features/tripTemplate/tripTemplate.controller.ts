import { Request, Response } from 'express';
import { TripTemplateService } from './tripTemplate.service';
import { createTripTemplateSchema, updateTripTemplateSchema, tripTemplateIdParam, queryTripTemplatesSchema } from './tripTemplate.validation';
import { asyncWrapper } from '../../utils/asyncWrapper';
import { tripTemplateData } from './tripTemplate.service';

export const createTripTemplate = asyncWrapper(async (req: Request, res: Response) => {
  const data: tripTemplateData = req.body;
  const template = await TripTemplateService.createTripTemplate(data);
  res.status(201).json(template);
});

export const getTripTemplate = asyncWrapper(async (req: Request, res: Response) => {
  const { id } = tripTemplateIdParam.parse(req.params);
  const template = await TripTemplateService.getTripTemplateById(id);
  res.json(template);
});

export const updateTripTemplate = asyncWrapper(async (req: Request, res: Response) => {
  const { id } = tripTemplateIdParam.parse(req.params);
  const data = updateTripTemplateSchema.parse(req.body);
  const template = await TripTemplateService.updateTripTemplate(id, data);
  res.json(template);
});

export const deleteTripTemplate = asyncWrapper(async (req: Request, res: Response) => {
  const { id } = tripTemplateIdParam.parse(req.params);
  await TripTemplateService.deleteTripTemplate(id);
  res.status(204).send();
});

export const listTripTemplates = asyncWrapper(async (req: Request, res: Response) => {
  const templates = await TripTemplateService.listTripTemplates(req.query);
  res.json(templates);
}); 