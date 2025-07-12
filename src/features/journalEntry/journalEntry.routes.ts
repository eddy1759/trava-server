import { Router } from 'express';
import * as controller from './journalEntry.controller';
import * as photoController from '../photo/photo.controller';
import { authMiddleware} from '../../middlewares/auth';
import { validateBody, validateParams, validateQuery} from '../../middlewares/validation.middleware';
import { createJournalEntrySchema, updateJournalEntrySchema, journalEntryIdParam, queryJournalEntriesSchema } from './journalEntry.validation';

const router = Router();

router.use(authMiddleware)

router.post('/', validateBody(createJournalEntrySchema), controller.createJournalEntry);
router.get('/', validateQuery(queryJournalEntriesSchema), controller.listJournalEntries);
router.get('/photos/:id', validateParams(journalEntryIdParam), photoController.handleGetPhotosForJournalEntry);
router.get('/:id', validateParams(journalEntryIdParam), controller.getJournalEntry);
router.patch('/:id', validateBody(updateJournalEntrySchema), controller.updateJournalEntry);
router.delete('/:id', validateParams(journalEntryIdParam), controller.deleteJournalEntry);

export default router; 