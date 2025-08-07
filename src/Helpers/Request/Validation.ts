import { query } from 'express-validator';

export const paginationValidation = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().trim().escape(),
    query('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
    query('fromDate').optional().isISO8601().withMessage('fromDate must be a valid ISO date'),
    query('toDate').optional().isISO8601().withMessage('toDate must be a valid ISO date')
];