
export type OfficeType = 'GC' | 'IT' | 'ALL';

export enum ServiceCategory {
  VISA_EXTENSION = 'Visa Extension',
  LETTER = 'Letter',
  TM30 = 'TM30 Services',
  EASY_PASS = 'Easy Pass Services',
  TICKETING = 'Ticketing Services'
}

export enum VisaSubService {
  WALK_IN = 'Walk In Extension',
  E_EXTENSION = 'E Extension',
  VIP = 'VIP Extension'
}

export interface VisaApplication {
  id: string;
  clientName: string;
  passportNumber: string;
  nationality: string;
  serviceCategory: ServiceCategory;
  subService?: VisaSubService;
  office?: OfficeType;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  createdAt: string;
  completedAt?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  notes: string;
  price: string;
  costPrice: string;
  flightNo?: string;
  embarkation?: string;
  agentName?: string;
  visaType?: string;
  letterType?: string;
  address?: string;
  origin?: string;
  destination?: string;
  paxCount?: number; // New: Number of people (Pax)
}

export interface ServiceConfig {
  id: string;
  title: string;
  category: ServiceCategory;
  subService?: VisaSubService;
  offices: OfficeType[];
}
