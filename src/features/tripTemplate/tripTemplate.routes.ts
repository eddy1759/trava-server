import { Router } from 'express';
import * as controller from './tripTemplate.controller';
import { validateBody, validateQuery, validateParams } from '../../middlewares/validation.middleware';
import { createTripTemplateSchema, updateTripTemplateSchema, tripTemplateIdParam, queryTripTemplatesSchema } from './tripTemplate.validation';

const router = Router();

router.post('/', validateBody(createTripTemplateSchema), controller.createTripTemplate);
router.get('/', validateQuery(queryTripTemplatesSchema), controller.listTripTemplates);
router.get('/:id', validateParams(tripTemplateIdParam), controller.getTripTemplate);
router.patch('/:id', validateBody(updateTripTemplateSchema), controller.updateTripTemplate);
router.delete('/:id', validateParams(tripTemplateIdParam), controller.deleteTripTemplate);

export default router; 