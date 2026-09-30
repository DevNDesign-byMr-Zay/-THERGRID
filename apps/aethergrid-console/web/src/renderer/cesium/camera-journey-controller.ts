import {
  Camera,
  Cartesian3,
  Math as CesiumMath
} from 'cesium';

import type { SpatialTarget } from '../spatial-renderer';

export type CameraJourneyPhase = 'global' | 'regional' | 'city' | 'district';

export interface CameraJourneyStage {
  phase: CameraJourneyPhase;
  destinationHeightMeters: number;
  durationSeconds: number;
  pitchDegrees: number;
}

const DEFAULT_STAGES: readonly CameraJourneyStage[] = [
  { phase: 'global', destinationHeightMeters: 11_000_000, durationSeconds: 1.05, pitchDegrees: -88 },
  { phase: 'regional', destinationHeightMeters: 1_200_000, durationSeconds: 0.9, pitchDegrees: -72 },
  { phase: 'city', destinationHeightMeters: 120_000, durationSeconds: 0.85, pitchDegrees: -50 },
  { phase: 'district', destinationHeightMeters: 6_000, durationSeconds: 1.0, pitchDegrees: -34 }
];

export class CameraJourneyController {
  #camera: Camera;
  #activeJourney = 0;

  constructor(camera: Camera) {
    this.#camera = camera;
  }

  cancel(): void {
    this.#activeJourney += 1;
    this.#camera.cancelFlight();
  }

  async flyTo(target: SpatialTarget): Promise<void> {
    const journey = ++this.#activeJourney;
    const finalHeight = Math.max(
      target.heightMeters ?? 0,
      target.rangeMeters ?? DEFAULT_STAGES.at(-1)?.destinationHeightMeters ?? 5_000
    );
    const stages = DEFAULT_STAGES.map((stage, index) => ({
      ...stage,
      destinationHeightMeters:
        index === DEFAULT_STAGES.length - 1 ? finalHeight : stage.destinationHeightMeters,
      pitchDegrees:
        index === DEFAULT_STAGES.length - 1
          ? target.pitchDegrees ?? stage.pitchDegrees
          : stage.pitchDegrees
    }));

    for (const stage of stages) {
      if (journey !== this.#activeJourney) return;
      await this.#flyStage(target, stage, journey);
    }
  }

  async #flyStage(
    target: SpatialTarget,
    stage: CameraJourneyStage,
    journey: number
  ): Promise<void> {
    const destination = Cartesian3.fromDegrees(
      target.longitude,
      target.latitude,
      stage.destinationHeightMeters
    );

    await new Promise<void>((resolve) => {
      this.#camera.flyTo({
        destination,
        orientation: {
          heading: CesiumMath.toRadians(target.headingDegrees ?? 0),
          pitch: CesiumMath.toRadians(stage.pitchDegrees),
          roll: 0
        },
        duration: stage.durationSeconds,
        complete: resolve,
        cancel: resolve
      });
    });

    if (journey !== this.#activeJourney) this.#camera.cancelFlight();
  }
}
