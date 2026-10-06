export type DomainId =
  | 'aviation'
  | 'maritime'
  | 'mobility'
  | 'energy'
  | 'weather'
  | 'markets'
  | 'logistics'
  | 'manufacturing'
  | 'telecom'
  | 'cyber'
  | 'healthcare'
  | 'retail'
  | 'real-estate'
  | 'agriculture'
  | 'business-operations'
  | 'public-safety'
  | 'environmental'
  | 'space';

export interface DomainDefinition {
  id: DomainId;
  label: string;
  spatial: boolean;
  realTimeCapable: boolean;
  animationLanguage: string;
  status: 'active' | 'foundation';
}

export const DOMAIN_DEFINITIONS: readonly DomainDefinition[] = [
  {
    id: 'aviation',
    label: 'AIR TRAFFIC',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'aircraft / altitude / trails / airport flows',
    status: 'active'
  },
  {
    id: 'maritime',
    label: 'MARITIME',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'vessels / wakes / lanes / port flows',
    status: 'foundation'
  },
  {
    id: 'mobility',
    label: 'MOBILITY',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'verified vehicles / routes / stations / congestion',
    status: 'foundation'
  },
  {
    id: 'energy',
    label: 'ENERGY & UTILITIES',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'network flow / generation / storage / load',
    status: 'active'
  },
  {
    id: 'weather',
    label: 'WEATHER & CLIMATE',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'atmosphere / precipitation / wind / hazards',
    status: 'active'
  },
  {
    id: 'markets',
    label: 'FINANCIAL MARKETS',
    spatial: false,
    realTimeCapable: true,
    animationLanguage: 'market pulses / verified economic relationships / stress',
    status: 'foundation'
  },
  {
    id: 'logistics',
    label: 'LOGISTICS & SUPPLY CHAIN',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'shipments / hubs / inventory / route risk',
    status: 'foundation'
  },
  {
    id: 'manufacturing',
    label: 'MANUFACTURING',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'facility telemetry / production flow / maintenance',
    status: 'foundation'
  },
  {
    id: 'telecom',
    label: 'TELECOM',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'network traffic / towers / propagation / outages',
    status: 'foundation'
  },
  {
    id: 'cyber',
    label: 'CYBER & IT',
    spatial: false,
    realTimeCapable: true,
    animationLanguage: 'topology / event propagation / containment',
    status: 'foundation'
  },
  {
    id: 'healthcare',
    label: 'HEALTHCARE OPERATIONS',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'capacity / flow / resource pressure',
    status: 'foundation'
  },
  {
    id: 'retail',
    label: 'RETAIL & COMMERCE',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'demand / inventory / fulfillment / regional performance',
    status: 'foundation'
  },
  {
    id: 'real-estate',
    label: 'REAL ESTATE & SMART CITIES',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'buildings / occupancy / utilities / facilities',
    status: 'foundation'
  },
  {
    id: 'agriculture',
    label: 'AGRICULTURE & WATER',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'crop stress / water / equipment / yield context',
    status: 'foundation'
  },
  {
    id: 'business-operations',
    label: 'BUSINESS OPERATIONS',
    spatial: false,
    realTimeCapable: true,
    animationLanguage: 'KPI / pipeline / resource / workflow relationships',
    status: 'foundation'
  },
  {
    id: 'public-safety',
    label: 'PUBLIC SAFETY',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'incidents / response / hazards / resources',
    status: 'foundation'
  },
  {
    id: 'environmental',
    label: 'ENVIRONMENTAL',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'air / water / hydrology / seismic conditions',
    status: 'active'
  },
  {
    id: 'space',
    label: 'SPACE & SATELLITE',
    spatial: true,
    realTimeCapable: true,
    animationLanguage: 'orbits / observations / geospatial relationships',
    status: 'foundation'
  }
];

export function domainDefinition(id: DomainId): DomainDefinition {
  const definition = DOMAIN_DEFINITIONS.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Unknown ÆTHERGRID domain: ${id}`);
  return definition;
}
