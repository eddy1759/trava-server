import { Request, Response } from 'express';
import { journalEntryService } from './journalEntry.service';
import { createJournalEntrySchema, updateJournalEntrySchema, journalEntryIdParam, queryJournalEntriesSchema, CreateJournalEntryInput } from './journalEntry.validation';
import { asyncWrapper} from '../../utils/asyncWrapper';
import { StatusCodes } from 'http-status-codes';

export const createJournalEntry = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const data = req.body;
  const entry = await journalEntryService.createJournalEntry(data, userId);
  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Journal entry created successfully',
    data: entry
  });
});


export const getJournalEntry = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { id } = journalEntryIdParam.parse(req.params);
  const entry = await journalEntryService.getJournalEntryById(id, userId);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Journal entry retrieved successfully',
    data: entry
  });
});


export const updateJournalEntry = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { id } = journalEntryIdParam.parse(req.params);
  const data = updateJournalEntrySchema.parse(req.body);
  const entry = await journalEntryService.updateJournalEntry(id, userId, data);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Journal entry updated successfully',
    data: entry
  });
});


export const deleteJournalEntry = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { id } = journalEntryIdParam.parse(req.params);
  await journalEntryService.deleteJournalEntry(id, userId);
  res.status(StatusCodes.NO_CONTENT).send();
});


export const listJournalEntries = asyncWrapper(async (req: Request, res: Response) => {
  const viewerId = req.user?.id;
  const query = queryJournalEntriesSchema.parse(req.query);
  const entries = await journalEntryService.listJournalEntries({ ...query, viewerId });
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Journal entries retrieved successfully',
    data: entries,
    total: entries.length,
  });
});