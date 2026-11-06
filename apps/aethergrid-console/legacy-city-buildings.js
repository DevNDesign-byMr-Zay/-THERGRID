(() => {
  const { clamp } = globalThis.AETHERGRID_SPATIAL_MATH;
  const vertex = (out, x, y, z, w) => out.push(x, y, z, w);
  const line = (out, a, b, phase = 0) => {
    vertex(out, ...a, phase);
    vertex(out, ...b, phase + 0.3);
  };
  const triangle = (out, a, b, c, phase = 0) => {
    vertex(out, ...a, phase);
    vertex(out, ...b, phase + 0.12);
    vertex(out, ...c, phase + 0.24);
  };

  // CPU geometry only: the caller owns terrain sampling, camera, selection and GPU lifetime.
  function buildCityBuildings(mesh, { scale, terrainSurfaceYAtSource }) {
    const buildings = [];
    const buildingFaces = [];
    const roofFaces = [];
    const roofLines = [];
    const cityCenters = [];
    const nodes = [];
    const materialGlassFaces = [];
    const materialMasonryFaces = [];
    const materialMetalFaces = [];
    const materialNaturalFaces = [];
    const cityLights = [];
    const landmarkSpines = [];
    const landmarkNodes = [];
    const graphNodes = [];
    const landmarkCandidates = [];
    const materialTargetFor = (building) => {
      const descriptor =
        `${building.buildingMaterial || ''} ${building.buildingColor || ''}`.toLowerCase();
      if (/glass|mirror|glazed|blue|cyan/u.test(descriptor)) return materialGlassFaces;
      if (/brick|stone|sandstone|terracotta|brown|red|beige/u.test(descriptor))
        return materialMasonryFaces;
      if (/metal|steel|aluminium|aluminum|silver|zinc/u.test(descriptor)) return materialMetalFaces;
      if (/wood|timber|green|earth|clay/u.test(descriptor)) return materialNaturalFaces;
      return null;
    };
    mesh.buildings.forEach((building, buildingIndex) => {
      const sourceFootprint = (building.footprint || []).map(([x, z]) => [Number(x), Number(z)]);
      if (sourceFootprint.length < 3) return;
      const sourceOpenFootprint =
        sourceFootprint.length > 3 &&
        Math.hypot(
          sourceFootprint[0][0] - sourceFootprint.at(-1)[0],
          sourceFootprint[0][1] - sourceFootprint.at(-1)[1],
        ) < 0.01
          ? sourceFootprint.slice(0, -1)
          : sourceFootprint;
      if (sourceOpenFootprint.length < 3) return;
      const openFootprint = sourceOpenFootprint.map(([x, z]) => [x * scale, z * scale]);
      const center = openFootprint
        .reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0])
        .map((value) => value / openFootprint.length);
      const sourceCenter = sourceOpenFootprint
        .reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0])
        .map((value) => value / sourceOpenFootprint.length);
      cityCenters.push(center);
      const foundationY = terrainSurfaceYAtSource(sourceCenter[0], sourceCenter[1]);
      const minHeightScene = Math.max(0, Number(building.minHeightM || 0) * scale);
      const baseHeight = foundationY + minHeightScene;
      const height =
        foundationY + Math.max(minHeightScene + 0.035, Number(building.heightM || 12) * scale);
      const roofHeight = clamp(
        Number(building.roofHeightM || 0) * scale,
        0,
        Math.max(0, height - baseHeight),
      );
      const supportedApexRoof = /^(pyramidal|hipped|conical|dome|onion)$/u.test(
        String(building.roofShape || ''),
      );
      const wallTop =
        supportedApexRoof && roofHeight > 0
          ? Math.max(baseHeight + 0.02, height - roofHeight)
          : height;
      const phase = buildingIndex * 0.13;
      const materialTarget = materialTargetFor(building);
      for (let index = 0; index < openFootprint.length; index += 1) {
        const [ax, az] = openFootprint[index];
        const [bx, bz] = openFootprint[(index + 1) % openFootprint.length];
        const aBase = [ax, baseHeight, az];
        const bBase = [bx, baseHeight, bz];
        const aTop = [ax, wallTop, az];
        const bTop = [bx, wallTop, bz];
        line(buildings, aBase, bBase, phase);
        line(buildings, aTop, bTop, phase + 0.2);
        line(buildings, aBase, aTop, phase + 0.4);
        triangle(buildingFaces, aBase, bBase, bTop, phase + 0.08);
        triangle(buildingFaces, aBase, bTop, aTop, phase + 0.16);
        if (materialTarget) {
          triangle(materialTarget, aBase, bBase, bTop, phase + 0.11);
          triangle(materialTarget, aBase, bTop, aTop, phase + 0.19);
        }

        if (supportedApexRoof && roofHeight > 0) {
          const apex = [center[0], height, center[1]];
          triangle(roofFaces, aTop, bTop, apex, phase + 0.24);
          line(roofLines, aTop, apex, phase + 0.28);
        } else {
          const roofCenter = [center[0], height, center[1]];
          const aRoof = [ax, height, az];
          const bRoof = [bx, height, bz];
          triangle(roofFaces, aRoof, bRoof, roofCenter, phase + 0.24);
        }
      }

      const sourceHeightM = Math.max(3, Number(building.heightM || 12));
      const lightBands = Math.min(4, Math.max(1, Math.round(sourceHeightM / 55)));
      const edgePoint = openFootprint[buildingIndex % openFootprint.length] || center;
      for (let band = 1; band <= lightBands; band += 1) {
        const fraction = band / (lightBands + 1);
        const lightX = center[0] * 0.42 + edgePoint[0] * 0.58;
        const lightZ = center[1] * 0.42 + edgePoint[1] * 0.58;
        const lightY = baseHeight + Math.max(0.03, (wallTop - baseHeight) * fraction);
        vertex(cityLights, lightX, lightY, lightZ, phase + band * 0.67);
      }

      const skylineThresholdM = Math.max(80, Number(mesh.skylineProfile?.p95HeightM || 0));
      const hasSourceName = Boolean(String(building.name || '').trim());
      const sourceBackedHeight = !['inferred', 'synthetic-fallback'].includes(
        String(building.heightSource || ''),
      );
      if (
        hasSourceName ||
        (sourceBackedHeight && Number(building.heightM || 0) >= skylineThresholdM)
      ) {
        landmarkCandidates.push({
          id: building.id,
          label: String(building.name || `Tall structure ${buildingIndex + 1}`),
          type: 'landmark-building',
          heightM: Number(building.heightM || 0),
          heightSource: building.heightSource || null,
          roofShape: building.roofShape || null,
          startDate: building.startDate || null,
          osmId: building.osmId || null,
          osmType: building.osmType || null,
          named: hasSourceName,
          position: [center[0], height + 0.14, center[1]],
          basePosition: [center[0], Math.max(0.03, baseHeight), center[1]],
          score:
            (hasSourceName ? 10000 : 0) +
            (building.heightSource && building.heightSource !== 'inferred' ? 2500 : 0) +
            Number(building.heightM || 0),
        });
      }

      if (buildingIndex < 120 && (building.name || buildingIndex % 10 === 0)) {
        const node = {
          id: building.id,
          label: building.name || `Building ${buildingIndex + 1}`,
          type: 'building',
          heightM: building.heightM,
          heightSource: building.heightSource || null,
          roofShape: building.roofShape || null,
          buildingMaterial: building.buildingMaterial || null,
          osmId: building.osmId || null,
          osmType: building.osmType || null,
          position: [center[0], height + 0.08, center[1]],
        };
        graphNodes.push(node);
        vertex(nodes, ...node.position, phase);
      }
    });

    const landmarkSelection = landmarkCandidates
      .sort((left, right) => right.score - left.score)
      .slice(0, 18);
    const existingNodeIds = new Set(graphNodes.map((node) => node.id));
    landmarkSelection.forEach((landmark, landmarkIndex) => {
      line(landmarkSpines, landmark.basePosition, landmark.position, landmarkIndex * 0.73);
      vertex(landmarkNodes, ...landmark.position, landmarkIndex * 0.91 + landmark.heightM * 0.01);
      if (!existingNodeIds.has(landmark.id)) {
        graphNodes.push(landmark);
        existingNodeIds.add(landmark.id);
      }
    });

    return {
      buildings,
      buildingFaces,
      roofFaces,
      roofLines,
      cityCenters,
      nodes,
      materialGlassFaces,
      materialMasonryFaces,
      materialMetalFaces,
      materialNaturalFaces,
      cityLights,
      landmarkSpines,
      landmarkNodes,
      graphNodes,
      landmarks: landmarkSelection,
    };
  }

  globalThis.AETHERGRID_CITY_BUILDINGS = Object.freeze({ buildCityBuildings });
})();
