import { Router } from 'express';
import { createBeneficiary, processWithdrawal } from '../controllers/payout.controller';

const router = Router();

router.post('/beneficiary', createBeneficiary);
router.post('/withdraw', processWithdrawal);

export default router;
