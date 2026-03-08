import { Router } from 'express';
import availabilityRoutes from './availability';
import bookingsRoutes from './bookings';

const router = Router();

router.use('/availability', availabilityRoutes);
router.use('/bookings', bookingsRoutes);

export default router;
