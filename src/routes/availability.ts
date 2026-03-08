import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { getAvailableSlots } from '../services/availability';

const availabilityQuerySchema = z.object({
  visaType: z.enum(['A', 'B']).optional(),
  advisorId: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
});

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = availabilityQuerySchema.parse(req.query);

    const slots = getAvailableSlots({
      visaType: query.visaType,
      advisorId: query.advisorId,
      date: query.date,
    });

    res.json(slots);
  }),
);

export default router;
