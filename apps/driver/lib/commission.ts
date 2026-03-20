import { supabase } from '@/lib/supabase';

interface CommissionSettings {
  default_rate?: number | string | null;
  by_vehicle_type?: Record<string, number | string | null> | null;
}

export interface CommissionResult {
  rate: number;
  platformFee: number;
  driverShare: number;
  source: 'vehicle_specific' | 'default';
}

const BACKEND_DEFAULT_COMMISSION_RATE = 15.0;

let commissionSettingsPromise: Promise<CommissionSettings> | null = null;

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function getCommissionSettings(): Promise<CommissionSettings> {
  if (!commissionSettingsPromise) {
    commissionSettingsPromise = (async () => {
      const { data, error } = await supabase.rpc('get_platform_setting', {
        p_key: 'commission',
      });

      if (error) {
        throw error;
      }

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {};
      }

      return data as CommissionSettings;
    })();
  }

  try {
    return await commissionSettingsPromise;
  } finally {
    commissionSettingsPromise = null;
  }
}

/**
 * Mirrors the backend commission logic from credit_driver_earning:
 * default_rate -> by_vehicle_type override -> ROUND(..., 2)
 */
export async function getEffectiveCommission(
  totalFare: number,
  vehicleType: string
): Promise<CommissionResult> {
  const startTime = Date.now();

  try {
    const settings = await getCommissionSettings();
    const defaultRate =
      toNumber(settings.default_rate) ?? BACKEND_DEFAULT_COMMISSION_RATE;
    const vehicleRate =
      settings.by_vehicle_type && typeof settings.by_vehicle_type === 'object'
        ? toNumber(settings.by_vehicle_type[vehicleType])
        : null;
    const effectiveRate = vehicleRate ?? defaultRate;
    const platformFee = roundCurrency(totalFare * (effectiveRate / 100));
    const driverShare = roundCurrency(totalFare - platformFee);
    const duration = Date.now() - startTime;

    if (duration > 2000) {
      console.warn('[COMMISSION] Slow commission fetch', {
        duration,
        totalFare,
        vehicleType,
      });
    }

    console.log('[COMMISSION] Commission calculated', {
      totalFare,
      vehicleType,
      rate: effectiveRate,
      platformFee,
      driverShare,
      source: vehicleRate !== null ? 'vehicle_specific' : 'default',
      duration,
    });

    return {
      rate: effectiveRate,
      platformFee,
      driverShare,
      source: vehicleRate !== null ? 'vehicle_specific' : 'default',
    };
  } catch (error) {
    console.error('Failed to fetch commission settings:', error);

    const platformFee = roundCurrency(
      totalFare * (BACKEND_DEFAULT_COMMISSION_RATE / 100)
    );
    const driverShare = roundCurrency(totalFare - platformFee);

    console.error('[COMMISSION] Commission fetch failed; using fallback', {
      error,
      totalFare,
      vehicleType,
      rate: BACKEND_DEFAULT_COMMISSION_RATE,
      platformFee,
      driverShare,
      fallbackUsed: true,
      duration: Date.now() - startTime,
    });

    return {
      rate: BACKEND_DEFAULT_COMMISSION_RATE,
      platformFee,
      driverShare,
      source: 'default',
    };
  }
}
