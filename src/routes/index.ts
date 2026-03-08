import { Router } from 'express';
import availabilityRoutes from './availability';

const router = Router();

router.use('/availability', availabilityRoutes);

export default router;
