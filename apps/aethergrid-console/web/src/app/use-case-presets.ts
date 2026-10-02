import type { VisualMode } from '../renderer/spatial-renderer';

export type UseCaseId =
  | 'city-operations'
  | 'grid-resilience'
  | 'environmental'
  | 'seismic-response'
  | 'skyline-analysis';

export interface UseCasePreset {
  id: UseCaseId;
  label: string;
  description: string;
  visualMode: VisualMode;
  layers: readonly string[];
}

export const USE_CASE_PRESETS: readonly UseCasePreset[] = [
  {
    id: 'city-operations',
    label: 'CITY OPS',
    description: 'Built environment, mapped mobility surfaces, live atmosphere, hazards and infrastructure.',
    visualMode: 'operations',
    layers: [
      'terrain',
      'buildings',
      'roads',
      'water',
      'green',
      'weather',
      'air',
      'seismic',
      'hazards',
      'transit',
      'energy'
    ]
  },
  {
    id: 'grid-resilience',
    label: 'GRID RESILIENCE',
    description: 'Mapped power topology against terrain, roads, weather and current seismic context.',
    visualMode: 'holographic',
    layers: [
      'terrain',
      'buildings',
      'roads',
      'grid',
      'weather',
      'seismic',
      'hazards',
      'energy'
    ]
  },
  {
    id: 'environmental',
    label: 'ENVIRONMENT',
    description: 'Terrain, water, green space, live weather and source-backed air-quality context.',
    visualMode: 'solid',
    layers: ['terrain', 'buildings', 'water', 'green', 'weather', 'air', 'hazards']
  },
  {
    id: 'seismic-response',
    label: 'SEISMIC',
    description: 'Recent seismic events against terrain, structures, roads and mapped power assets.',
    visualMode: 'operations',
    layers: ['terrain', 'buildings', 'roads', 'seismic', 'energy']
  },
  {
    id: 'skyline-analysis',
    label: 'SKYLINE',
    description: 'Source-backed buildings, terrain, water and skyline identity with minimal overlays.',
    visualMode: 'solid',
    layers: ['terrain', 'buildings', 'water', 'green']
  }
] as const;
