import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { createBooking, confirmBooking, getBookings } from '../services/bookings';

const createBookingSchema = z.object({
  candidateName: z.string().min(1, 'candidateName is required'),
  visaType: z.enum(['A', 'B']),
  advisorId: z.string().min(1, 'advisorId is required'),
  startTime: z.string().datetime({ message: 'startTime must be a valid ISO datetime' }),
});

const bookingsQuerySchema = z.object({
  status: z.enum(['held', 'confirmed', 'expired', 'cancelled']).optional(),
  advisorId: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
});

const router = Router();

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const body = createBookingSchema.parse(req.body);
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    const booking = createBooking({
      candidateName: body.candidateName,
      visaType: body.visaType,
      advisorId: body.advisorId,
      startTime: body.startTime,
      idempotencyKey,
    });

    res.status(201).json(booking);
  }),
);

router.post(
  '/:id/confirm',
  asyncHandler(async (req: Request, res: Response) => {
    const booking = confirmBooking(req.params.id as string);
    res.json(booking);
  }),
);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = bookingsQuerySchema.parse(req.query);
    const rows = getBookings({
      status: query.status,
      advisorId: query.advisorId,
      date: query.date,
    });
    res.json(rows);
  }),
);

export default router;
