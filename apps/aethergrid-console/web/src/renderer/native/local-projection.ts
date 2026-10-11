function angles(headingDegrees: number, pitchDegrees: number) {
  return { heading: headingDegrees * Math.PI / 180, pitch: Math.min(90, Math.max(15, Math.abs(pitchDegrees))) * Math.PI / 180 };
}

/** Local oblique wireframe coordinates in meters; not a terrain ray cast. */
export function projectLocal(east: number, north: number, height: number, headingDegrees: number, pitchDegrees: number): readonly [number, number] {
  const { heading, pitch } = angles(headingDegrees, pitchDegrees);
  return [east * Math.cos(heading) - north * Math.sin(heading),
    (east * Math.sin(heading) + north * Math.cos(heading)) * Math.sin(pitch) + height * Math.cos(pitch)];
}

export function unprojectGround(right: number, vertical: number, headingDegrees: number, pitchDegrees: number): readonly [number, number] {
  const { heading, pitch } = angles(headingDegrees, pitchDegrees);
  const forward = vertical / Math.sin(pitch);
  return [right * Math.cos(heading) + forward * Math.sin(heading), -right * Math.sin(heading) + forward * Math.cos(heading)];
}
