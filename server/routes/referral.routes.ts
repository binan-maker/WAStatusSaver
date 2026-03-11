import { Router, Request, Response } from 'express';
import { ReferralService } from '../services/referral.service';

const router = Router();

// POST /api/referrals/init - Initialize referral code for new user
router.post('/init', (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'Device ID required' });
    }

    const { code, isNew } = ReferralService.getOrCreateReferral(deviceId);
    return res.json({
      success: true,
      referralCode: code,
      isNew,
    });
  } catch (e) {
    console.error('Init referral error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/referrals/verify - Verify referral from install referrer
router.post('/verify', (req: Request, res: Response) => {
  try {
    const { inviterCode, deviceId } = req.body;
    if (!inviterCode || !deviceId) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    const success = ReferralService.verifyReferral(deviceId, inviterCode);
    if (!success) {
      return res.status(400).json({ success: false, message: 'Invalid referral code' });
    }

    return res.json({
      success: true,
      message: 'Referral verified',
      adFreeUntil: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
  } catch (e) {
    console.error('Verify referral error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/referrals/rewards/:code - Get referral rewards for user
router.get('/rewards/:code', (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const rewards = ReferralService.getUserRewards(code);
    return res.json({
      success: true,
      ...rewards,
    });
  } catch (e) {
    console.error('Get rewards error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/referrals/debug - Debug endpoint to see all referrals
router.get('/debug', (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const referrals = ReferralService.getAllReferrals();
  return res.json({
    success: true,
    count: referrals.length,
    referrals,
  });
});

export default router;
