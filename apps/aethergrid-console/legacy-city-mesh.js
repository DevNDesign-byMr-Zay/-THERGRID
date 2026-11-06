(() => {
  'use strict';

  const { clamp, bilinearTerrainElevation } = globalThis.AETHERGRID_SPATIAL_MATH;

  function loadCityMesh(renderer, mesh, titleCase) {
    if (!renderer.gl || !mesh?.buildings?.length) return;
    for (const item of Object.values(renderer.geometry))
      if (item?.buffer) renderer.gl.deleteBuffer(item.buffer);
    const grid = [];
    const routes = [];
    const infrastructureLines = [];
    const infrastructureNodes = [];
    const terrainLines = [];
    const waterLines = [];
    const waterFaces = [];
    const greenLines = [];
    const greenFaces = [];
    const weatherLines = [];
    const cloudParticles = [];
    const snowParticles = [];
    const fogParticles = [];
    const stormLines = [];
    const precipitationLines = [];
    const airParticles = [];
    const seismicLines = [];
    const seismicNodes = [];
    const radius = Math.max(200, Number(mesh.city?.radiusM || 900));
    const scale = 8.5 / radius;
    const terrain = mesh.terrain;
    const terrainGridReady =
      Array.isArray(terrain?.points) &&
      Number(terrain?.gridSize) >= 2 &&
      terrain.points.length >= Number(terrain.gridSize) ** 2;
    const terrainVerticalScale = scale * 1.65;
    const terrainDatumY = terrainGridReady ? -0.06 : 0;
    const terrainSurfaceYAtSource = (xM, zM) =>
      terrainGridReady
        ? terrainDatumY +
          Math.min(
            3.2,
            bilinearTerrainElevation(terrain, Number(xM), Number(zM)) * terrainVerticalScale,
          )
        : 0;
    renderer.terrainConformance = {
      active: terrainGridReady,
      live: Boolean(terrain?.source?.live),
      interpolation: terrain?.interpolation?.method || 'bilinear',
      source: terrain?.source?.provider || 'none',
    };

    for (let n = -10; n <= 10; n += 1) {
      renderer.line(grid, [-10, 0, n], [10, 0, n], n * 0.13);
      renderer.line(grid, [n, 0, -10], [n, 0, 10], n * 0.17);
    }

    const {
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
      landmarks,
    } = globalThis.AETHERGRID_CITY_BUILDINGS.buildCityBuildings(mesh, {
      scale,
      terrainSurfaceYAtSource,
    });
    renderer.graphNodes = graphNodes;
    renderer.landmarkNodes = landmarks;

    const addAreaGeometry = (feature, lineTarget, faceTarget, mode, phaseBase) => {
      const sourceFootprint = (feature.footprint || []).map(([x, z]) => [Number(x), Number(z)]);
      if (sourceFootprint.length < 3) return;
      const sourceOpen =
        sourceFootprint.length > 3 &&
        Math.hypot(
          sourceFootprint[0][0] - sourceFootprint.at(-1)[0],
          sourceFootprint[0][1] - sourceFootprint.at(-1)[1],
        ) < 0.01
          ? sourceFootprint.slice(0, -1)
          : sourceFootprint;
      if (sourceOpen.length < 3) return;
      const sourceCenter = sourceOpen
        .reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0])
        .map((value) => value / sourceOpen.length);
      const waterPlaneY =
        mode === 'water'
          ? Math.min(...sourceOpen.map(([x, z]) => terrainSurfaceYAtSource(x, z))) + 0.012
          : 0;
      const point3 = ([x, z]) => [
        x * scale,
        mode === 'water' ? waterPlaneY : terrainSurfaceYAtSource(x, z) + 0.016,
        z * scale,
      ];
      const center3 = [
        sourceCenter[0] * scale,
        mode === 'water'
          ? waterPlaneY
          : terrainSurfaceYAtSource(sourceCenter[0], sourceCenter[1]) + 0.016,
        sourceCenter[1] * scale,
      ];
      for (let index = 0; index < sourceOpen.length; index += 1) {
        const a = point3(sourceOpen[index]);
        const b = point3(sourceOpen[(index + 1) % sourceOpen.length]);
        renderer.line(lineTarget, a, b, phaseBase + index * 0.03);
        renderer.triangle(faceTarget, a, b, center3, phaseBase + index * 0.02);
      }
    };

    (mesh.waterAreas || []).forEach((feature, index) =>
      addAreaGeometry(feature, waterLines, waterFaces, 'water', index * 0.19),
    );
    (mesh.greenAreas || []).forEach((feature, index) =>
      addAreaGeometry(feature, greenLines, greenFaces, 'terrain', index * 0.23),
    );

    (mesh.waterways || []).forEach((feature, lineIndex) => {
      const sourcePath = (feature.path || []).map(([x, z]) => [Number(x), Number(z)]);
      for (let index = 1; index < sourcePath.length; index += 1) {
        const [ax, az] = sourcePath[index - 1];
        const [bx, bz] = sourcePath[index];
        renderer.line(
          waterLines,
          [ax * scale, terrainSurfaceYAtSource(ax, az) + 0.022, az * scale],
          [bx * scale, terrainSurfaceYAtSource(bx, bz) + 0.022, bz * scale],
          lineIndex * 0.17 + index * 0.025,
        );
      }
    });

    (mesh.coastlines || []).forEach((feature, lineIndex) => {
      const sourcePath = (feature.path || []).map(([x, z]) => [Number(x), Number(z)]);
      const coastlineY = terrainDatumY + 0.022;
      for (let index = 1; index < sourcePath.length; index += 1) {
        const [ax, az] = sourcePath[index - 1];
        const [bx, bz] = sourcePath[index];
        renderer.line(
          waterLines,
          [ax * scale, coastlineY, az * scale],
          [bx * scale, coastlineY, bz * scale],
          (mesh.waterways || []).length * 0.17 + lineIndex * 0.17 + index * 0.025,
        );
      }
    });

    (mesh.roads || []).forEach((road, roadIndex) => {
      const sourcePath = (road.path || []).map(([x, z]) => [Number(x), Number(z)]);
      for (let index = 1; index < sourcePath.length; index += 1) {
        const [ax, az] = sourcePath[index - 1];
        const [bx, bz] = sourcePath[index];
        renderer.line(
          routes,
          [ax * scale, terrainSurfaceYAtSource(ax, az) + 0.025, az * scale],
          [bx * scale, terrainSurfaceYAtSource(bx, bz) + 0.025, bz * scale],
          roadIndex * 0.07,
        );
      }
    });

    (mesh.powerLines || []).forEach((line, lineIndex) => {
      const sourcePath = (line.path || []).map(([x, z]) => [Number(x), Number(z)]);
      const lineHeight =
        line.powerType === 'cable'
          ? 0.055
          : 0.12 + Math.min(0.22, Number(line.voltage || 0) / 1_000_000);
      for (let index = 1; index < sourcePath.length; index += 1) {
        const [ax, az] = sourcePath[index - 1];
        const [bx, bz] = sourcePath[index];
        renderer.line(
          infrastructureLines,
          [ax * scale, terrainSurfaceYAtSource(ax, az) + lineHeight, az * scale],
          [bx * scale, terrainSurfaceYAtSource(bx, bz) + lineHeight, bz * scale],
          lineIndex * 0.19,
        );
      }
    });

    (mesh.powerAssets || []).forEach((asset, assetIndex) => {
      const [x, z] = asset.position || [];
      if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(z))) return;
      const height =
        asset.powerType === 'plant' ? 0.34 : asset.powerType === 'substation' ? 0.24 : 0.16;
      const node = {
        id: asset.id,
        label: asset.name || titleCase(asset.powerType || 'power asset'),
        type: `power-${asset.powerType || 'asset'}`,
        voltage: asset.voltage || null,
        operator: asset.operator || '',
        osmId: asset.osmId || null,
        position: [
          Number(x) * scale,
          terrainSurfaceYAtSource(Number(x), Number(z)) + height,
          Number(z) * scale,
        ],
      };
      renderer.graphNodes.push(node);
      renderer.vertex(
        infrastructureNodes,
        ...node.position,
        assetIndex * 0.37 + Number(asset.voltage || 0) / 100000,
      );
    });

    if (terrain?.points?.length && Number(terrain.gridSize) >= 2) {
      const gridSize = Number(terrain.gridSize);
      const pointAt = (row, column) => terrain.points[row * gridSize + column];
      const vector = (point) => [
        Number(point.x) * scale,
        terrainSurfaceYAtSource(Number(point.x), Number(point.z)),
        Number(point.z) * scale,
      ];
      for (let row = 0; row < gridSize; row += 1) {
        for (let column = 0; column < gridSize; column += 1) {
          const current = pointAt(row, column);
          if (!current) continue;
          if (column + 1 < gridSize) {
            renderer.line(
              terrainLines,
              vector(current),
              vector(pointAt(row, column + 1)),
              row * 0.17 + column * 0.09,
            );
          }
          if (row + 1 < gridSize) {
            renderer.line(
              terrainLines,
              vector(current),
              vector(pointAt(row + 1, column)),
              row * 0.11 + column * 0.13,
            );
          }
        }
      }
    }

    const environment = mesh.environment?.current || {};
    const liveContext = mesh.liveContext || {};
    const deterministic = (index, salt = 0) => {
      const raw = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
      return raw - Math.floor(raw);
    };
    const cloudCover = clamp(Number(environment.cloudCoverPercent || 0), 0, 100);
    const cloudCount = Math.round(clamp(cloudCover * 0.9, 0, 90));
    for (let index = 0; index < cloudCount; index += 1) {
      renderer.vertex(
        cloudParticles,
        (deterministic(index, 10) - 0.5) * 17.5,
        4.7 + deterministic(index, 11) * 1.55,
        (deterministic(index, 12) - 0.5) * 17.5,
        index * 0.21,
      );
    }

    const windSpeed = Math.max(0, Number(environment.windSpeedKph || 0));
    const windDirection = (Number(environment.windDirectionDegrees || 0) * Math.PI) / 180;
    const windLength = clamp(0.25 + windSpeed / 32, 0.25, 1.8);
    const windCount = windSpeed > 0 ? Math.round(clamp(36 + windSpeed * 1.7, 36, 150)) : 0;
    for (let index = 0; index < windCount; index += 1) {
      const x = (deterministic(index, 1) - 0.5) * 17;
      const z = (deterministic(index, 2) - 0.5) * 17;
      const y = 0.18 + deterministic(index, 3) * 4.8;
      const dx = Math.sin(windDirection) * windLength;
      const dz = Math.cos(windDirection) * windLength;
      renderer.line(
        weatherLines,
        [x, y, z],
        [x + dx, y + Math.sin(index * 0.7) * 0.03, z + dz],
        index * 0.31,
      );
    }

    const precipitation = Math.max(0, Number(environment.precipitationMm || 0));
    const weatherCode = Number(environment.weatherCode || 0);
    const snowMode = [71, 73, 75, 77, 85, 86].includes(weatherCode);
    const fogMode =
      [45, 48].includes(weatherCode) ||
      (Number.isFinite(Number(environment.visibilityM)) && Number(environment.visibilityM) < 6000);
    const stormMode = weatherCode >= 95 && weatherCode <= 99;
    const rainCount =
      !snowMode && precipitation > 0.02 ? Math.round(clamp(24 + precipitation * 32, 24, 180)) : 0;
    for (let index = 0; index < rainCount; index += 1) {
      const x = (deterministic(index, 4) - 0.5) * 17;
      const z = (deterministic(index, 5) - 0.5) * 17;
      const y = 1.2 + deterministic(index, 6) * 5.8;
      const lean = Math.sin(windDirection) * clamp(windSpeed / 70, 0, 0.75);
      const drift = Math.cos(windDirection) * clamp(windSpeed / 70, 0, 0.75);
      renderer.line(precipitationLines, [x, y, z], [x + lean, y - 0.72, z + drift], index * 0.43);
    }

    const snowCount =
      snowMode && precipitation > 0 ? Math.round(clamp(34 + precipitation * 26, 34, 170)) : 0;
    for (let index = 0; index < snowCount; index += 1) {
      renderer.vertex(
        snowParticles,
        (deterministic(index, 13) - 0.5) * 17,
        1.1 + deterministic(index, 14) * 5.9,
        (deterministic(index, 15) - 0.5) * 17,
        index * 0.31,
      );
    }

    const visibilityM = Number(environment.visibilityM);
    const fogStrength = fogMode
      ? clamp(Number.isFinite(visibilityM) ? (8000 - visibilityM) / 8000 : 0.55, 0.18, 0.92)
      : 0;
    const fogCount = fogMode ? Math.round(50 + fogStrength * 110) : 0;
    for (let index = 0; index < fogCount; index += 1) {
      renderer.vertex(
        fogParticles,
        (deterministic(index, 16) - 0.5) * 17.5,
        0.12 + deterministic(index, 17) * 2.2,
        (deterministic(index, 18) - 0.5) * 17.5,
        index * 0.17,
      );
    }

    if (stormMode) {
      for (let bolt = 0; bolt < 3; bolt += 1) {
        const baseX = (deterministic(bolt, 19) - 0.5) * 10;
        const baseZ = (deterministic(bolt, 20) - 0.5) * 10;
        let previous = [baseX, 5.8, baseZ];
        for (let step = 1; step <= 7; step += 1) {
          const next = [
            baseX + (deterministic(bolt * 10 + step, 21) - 0.5) * 0.9,
            5.8 - step * 0.72,
            baseZ + (deterministic(bolt * 10 + step, 22) - 0.5) * 0.9,
          ];
          renderer.line(stormLines, previous, next, bolt * 1.7 + step * 0.23);
          previous = next;
        }
      }
    }

    const air = liveContext.airQuality?.current || {};
    const aqi = clamp(Number(air.usAqi || 0), 0, 500);
    const airCount = air.usAqi == null ? 0 : Math.round(clamp(18 + aqi * 0.34, 18, 150));
    for (let index = 0; index < airCount; index += 1) {
      renderer.vertex(
        airParticles,
        (deterministic(index, 7) - 0.5) * 16,
        0.22 + deterministic(index, 8) * 4.2,
        (deterministic(index, 9) - 0.5) * 16,
        index * 0.27,
      );
    }

    (liveContext.seismic?.events || []).slice(0, 18).forEach((event, eventIndex) => {
      const offset = event.offsetM || { x: 0, z: 0 };
      const rawX = Number(offset.x || 0) * scale;
      const rawZ = Number(offset.z || 0) * scale;
      const rawDistance = Math.hypot(rawX, rawZ);
      const sceneDistance = Math.min(7.7, rawDistance);
      const directionX = rawDistance > 0 ? rawX / rawDistance : 1;
      const directionZ = rawDistance > 0 ? rawZ / rawDistance : 0;
      const cx = directionX * sceneDistance;
      const cz = directionZ * sceneDistance;
      const magnitude = Math.max(0, Number(event.magnitude || 0));
      const ringBase = clamp(0.12 + magnitude * 0.065, 0.12, 0.62);
      for (let ring = 1; ring <= 3; ring += 1) {
        let previous = null;
        const ringRadius = ringBase * ring;
        for (let step = 0; step <= 28; step += 1) {
          const angle = (step / 28) * Math.PI * 2;
          const point = [
            cx + Math.cos(angle) * ringRadius,
            0.055 + ring * 0.012,
            cz + Math.sin(angle) * ringRadius,
          ];
          if (previous)
            renderer.line(seismicLines, previous, point, eventIndex * 0.83 + ring * 0.4);
          previous = point;
        }
      }
      renderer.vertex(seismicNodes, cx, 0.11, cz, eventIndex * 0.91 + magnitude);
    });

    renderer.geometry.grid = renderer.makeBuffer(grid);
    renderer.geometry.buildings = renderer.makeBuffer(buildings);
    renderer.geometry.buildingFaces = renderer.makeBuffer(buildingFaces);
    renderer.geometry.roofFaces = renderer.makeBuffer(roofFaces);
    renderer.geometry.roofLines = renderer.makeBuffer(roofLines);
    renderer.geometry.routes = renderer.makeBuffer(routes);
    renderer.geometry.infrastructureLines = renderer.makeBuffer(infrastructureLines);
    renderer.geometry.infrastructureNodes = renderer.makeBuffer(infrastructureNodes);
    renderer.geometry.terrain = renderer.makeBuffer(terrainLines);
    renderer.geometry.waterLines = renderer.makeBuffer(waterLines);
    renderer.geometry.waterFaces = renderer.makeBuffer(waterFaces);
    renderer.geometry.greenLines = renderer.makeBuffer(greenLines);
    renderer.geometry.greenFaces = renderer.makeBuffer(greenFaces);
    renderer.geometry.materialGlassFaces = renderer.makeBuffer(materialGlassFaces);
    renderer.geometry.materialMasonryFaces = renderer.makeBuffer(materialMasonryFaces);
    renderer.geometry.materialMetalFaces = renderer.makeBuffer(materialMetalFaces);
    renderer.geometry.materialNaturalFaces = renderer.makeBuffer(materialNaturalFaces);
    renderer.geometry.weather = renderer.makeBuffer(weatherLines);
    renderer.geometry.clouds = renderer.makeBuffer(cloudParticles);
    renderer.geometry.illumination = renderer.makeBuffer(cityLights);
    renderer.geometry.landmarkSpines = renderer.makeBuffer(landmarkSpines);
    renderer.geometry.landmarkNodes = renderer.makeBuffer(landmarkNodes);
    renderer.geometry.snow = renderer.makeBuffer(snowParticles);
    renderer.geometry.fog = renderer.makeBuffer(fogParticles);
    renderer.geometry.storm = renderer.makeBuffer(stormLines);
    renderer.geometry.precipitation = renderer.makeBuffer(precipitationLines);
    renderer.geometry.air = renderer.makeBuffer(airParticles);
    renderer.geometry.seismicLines = renderer.makeBuffer(seismicLines);
    renderer.geometry.seismicNodes = renderer.makeBuffer(seismicNodes);
    renderer.geometry.nodes = renderer.makeBuffer(nodes);
    renderer.selectedNode = null;
    if (renderer.selectionBuffer?.buffer) renderer.gl.deleteBuffer(renderer.selectionBuffer.buffer);
    renderer.selectionBuffer = null;
    renderer.environment = mesh.environment || null;
    renderer.liveContext = mesh.liveContext || null;
    renderer.operationProfile = null;
    renderer.skylineProfile = mesh.skylineProfile || null;

    let dominantYaw = 0.78;
    if (cityCenters.length >= 6) {
      const mean = cityCenters
        .reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0])
        .map((value) => value / cityCenters.length);
      let xx = 0;
      let zz = 0;
      let xz = 0;
      cityCenters.forEach(([x, z]) => {
        const dx = x - mean[0];
        const dz = z - mean[1];
        xx += dx * dx;
        zz += dz * dz;
        xz += dx * dz;
      });
      dominantYaw = 0.5 * Math.atan2(2 * xz, xx - zz) + 0.76;
    }
    const skylineUnits = Number(mesh.skylineProfile?.maxHeightM || 0) * scale;
    const densityBias = clamp((Number(mesh.skylineProfile?.buildingCount || 0) - 300) / 1400, 0, 1);
    renderer.cityCameraTarget = {
      yaw: dominantYaw,
      pitch: clamp(0.5 + skylineUnits * 0.025, 0.5, 0.72),
      distance: clamp(17 + skylineUnits * 0.72 + densityBias * 2.5, 17, 27),
    };
    Object.assign(renderer, renderer.cityCameraTarget);
    renderer.updateReadout();
  }

  globalThis.AETHERGRID_LEGACY_CITY_MESH = Object.freeze({ loadCityMesh });
})();
