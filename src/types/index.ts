export type VisaType = 'A' | 'B';

export type BookingStatus = 'held' | 'confirmed' | 'expired' | 'cancelled';

export type WaitlistStatus = 'waiting' | 'offered' | 'booked';

export const VISA_DURATIONS: Record<VisaType, number> = {
  A: 30,
  B: 60,
};

export const VISA_LABELS: Record<VisaType, string> = {
  A: 'Skilled Worker',
  B: 'Family / Dependent',
};

export const BREAK_BUFFERS: Record<VisaType, number> = {
  A: 5,
  B: 10,
};

export const HOLD_DURATION_MINUTES = 10;

export interface Advisor {
  id: string;
  name: string;
}

export interface AvailabilityWindow {
  id: number;
  advisorId: string;
  startTime: string;
  endTime: string;
}

export interface Booking {
  id: string;
  advisorId: string;
  candidateName: string;
  visaType: VisaType;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  holdExpiresAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  version: number;
}

export interface WaitlistEntry {
  id: string;
  candidateName: string;
  visaType: VisaType;
  status: WaitlistStatus;
  offeredSlotId: string | null;
  offerExpiresAt: string | null;
  position: number;
  createdAt: string;
}

export interface BookableSlot {
  advisorId: string;
  advisorName: string;
  start: string;
  end: string;
  visaType: VisaType;
}
