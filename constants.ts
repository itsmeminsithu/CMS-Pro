
import { ServiceCategory, VisaSubService, ServiceConfig } from './types';

export const SERVICES: ServiceConfig[] = [
  {
    id: 'walk-in-gc',
    title: 'Walk In Extension (GC)',
    category: ServiceCategory.VISA_EXTENSION,
    subService: VisaSubService.WALK_IN,
    offices: ['GC']
  },
  {
    id: 'walk-in-it',
    title: 'Walk In Extension (IT)',
    category: ServiceCategory.VISA_EXTENSION,
    subService: VisaSubService.WALK_IN,
    offices: ['IT']
  },
  {
    id: 'e-ext-gc',
    title: 'E Extension (GC)',
    category: ServiceCategory.VISA_EXTENSION,
    subService: VisaSubService.E_EXTENSION,
    offices: ['GC']
  },
  {
    id: 'vip-gc',
    title: 'VIP Extension (GC)',
    category: ServiceCategory.VISA_EXTENSION,
    subService: VisaSubService.VIP,
    offices: ['GC']
  },
  {
    id: 'vip-it',
    title: 'VIP Extension (IT)',
    category: ServiceCategory.VISA_EXTENSION,
    subService: VisaSubService.VIP,
    offices: ['IT']
  },
  {
    id: 'letter',
    title: 'Letter Service',
    category: ServiceCategory.LETTER,
    offices: ['ALL']
  },
  {
    id: 'tm30',
    title: 'TM30 Service',
    category: ServiceCategory.TM30,
    offices: ['ALL']
  },
  {
    id: 'easypass',
    title: 'Easy Pass Service',
    category: ServiceCategory.EASY_PASS,
    offices: ['ALL']
  },
  {
    id: 'ticketing',
    title: 'Ticketing Service',
    category: ServiceCategory.TICKETING,
    offices: ['ALL']
  }
];
