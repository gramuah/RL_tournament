// Rendering restored from main:docs/js/app.js (course teaching staff / Rafael Flor).
// Taxi uses the original bundled Gymnasium sprites; LunarLander is a canvas recreation.
export function drawGymnasiumLander(
  ctx,
  x,
  y,
  angle,
  thrust,
  leftThrust,
  rightThrust,
  landed,
  crashed,
  colorTheme,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Gymnasium official colors
  let bodyColor = "rgb(128, 102, 230)"; // Legacy Gymnasium periwinkle/purple
  let borderColor = "rgb(77, 77, 128)";

  if (colorTheme === "orange") {
    bodyColor = "rgb(249, 115, 22)";
    borderColor = "rgb(194, 65, 12)";
  } else if (colorTheme === "blue") {
    bodyColor = "rgb(14, 165, 233)";
    borderColor = "rgb(3, 105, 161)";
  }

  // 1. Articulated Legs (Gymnasium Box2D rectangular struts)
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;

  // Left Leg: angled down and left
  ctx.save();
  ctx.translate(-14, 2);
  ctx.rotate(-0.4);
  ctx.fillRect(-2, 0, 4, 18);
  ctx.strokeRect(-2, 0, 4, 18);
  ctx.restore();

  // Right Leg: angled down and right
  ctx.save();
  ctx.translate(14, 2);
  ctx.rotate(0.4);
  ctx.fillRect(-2, 0, 4, 18);
  ctx.strokeRect(-2, 0, 4, 18);
  ctx.restore();

  // 2. Main Lander Polygonal Body (Gymnasium LANDER_POLY)
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, -17);
  ctx.lineTo(-17, 0);
  ctx.lineTo(-17, 10);
  ctx.lineTo(17, 10);
  ctx.lineTo(17, 0);
  ctx.lineTo(14, -17);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// Draw Legacy Gymnasium Moon Terrain: Solid Jet Black Sky & Solid Pure White Ground
export function drawGymnasiumTerrain(ctx, x1, x2, padX, padY, padWidth = 110) {
  const padHalf = padWidth / 2;
  const leftX = padX - padHalf;
  const rightX = padX + padHalf;

  // 1. Pure White Ground Polygon (Gymnasium-inspired visual style)
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(x1, 450);
  ctx.lineTo(x1, padY + 28);
  ctx.lineTo(x1 + (leftX - x1) * 0.45, padY + 36);
  ctx.lineTo(leftX - 35, padY + 16);
  ctx.lineTo(leftX, padY);
  ctx.lineTo(rightX, padY); // Perfectly Flat Helipad
  ctx.lineTo(rightX + 35, padY + 18);
  ctx.lineTo(rightX + (x2 - rightX) * 0.55, padY + 38);
  ctx.lineTo(x2, padY + 24);
  ctx.lineTo(x2, 450);
  ctx.lineTo(x1, 450);
  ctx.closePath();
  ctx.fill();

  // 2. Official Helipad Yellow Pennant Flags on White Flagpoles
  drawGymnasiumFlag(ctx, leftX, padY);
  drawGymnasiumFlag(ctx, rightX, padY);
}

// Gymnasium-inspired flag rendering:
// flagy1 = helipad_y, flagy2 = flagy1 + 50
// [(x, flagy2), (x, flagy2 - 10), (x + 25, flagy2 - 5)]
function drawGymnasiumFlag(ctx, x, y) {
  const poleHeight = 42;
  const flagTop = y - poleHeight;

  // White Flagpole
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, flagTop);
  ctx.stroke();

  // Official Gymnasium Yellow Triangle Flag (pointing right)
  ctx.fillStyle = "#cccc00";
  ctx.beginPath();
  ctx.moveTo(x, flagTop);
  ctx.lineTo(x, flagTop + 10);
  ctx.lineTo(x + 22, flagTop + 5);
  ctx.closePath();
  ctx.fill();
}

const TAXI_ASSETS = {
  bg: new Image(),
  cab_front: new Image(),
  cab_rear: new Image(),
  cab_left: new Image(),
  cab_right: new Image(),
  passenger: new Image(),
  hotel: new Image(),
  median_top: new Image(),
  median_bottom: new Image(),
  median_vert: new Image(),
  median_horiz: new Image(),
  loaded: false,
};

function initTaxiSprites() {
  let loadedCount = 0;
  const total = 11;
  const onAssetLoad = () => {
    loadedCount++;
    if (loadedCount >= total) TAXI_ASSETS.loaded = true;
  };

  TAXI_ASSETS.bg.onload = onAssetLoad;
  TAXI_ASSETS.bg.src = "assets/taxi/taxi_background.png";

  TAXI_ASSETS.cab_front.onload = onAssetLoad;
  TAXI_ASSETS.cab_front.src = "assets/taxi/cab_front.png";

  TAXI_ASSETS.cab_rear.onload = onAssetLoad;
  TAXI_ASSETS.cab_rear.src = "assets/taxi/cab_rear.png";

  TAXI_ASSETS.cab_left.onload = onAssetLoad;
  TAXI_ASSETS.cab_left.src = "assets/taxi/cab_left.png";

  TAXI_ASSETS.cab_right.onload = onAssetLoad;
  TAXI_ASSETS.cab_right.src = "assets/taxi/cab_right.png";

  TAXI_ASSETS.passenger.onload = onAssetLoad;
  TAXI_ASSETS.passenger.src = "assets/taxi/passenger.png";

  TAXI_ASSETS.hotel.onload = onAssetLoad;
  TAXI_ASSETS.hotel.src = "assets/taxi/hotel.png";

  TAXI_ASSETS.median_top.onload = onAssetLoad;
  TAXI_ASSETS.median_top.src = "assets/taxi/gridworld_median_top.png";

  TAXI_ASSETS.median_bottom.onload = onAssetLoad;
  TAXI_ASSETS.median_bottom.src = "assets/taxi/gridworld_median_bottom.png";

  TAXI_ASSETS.median_vert.onload = onAssetLoad;
  TAXI_ASSETS.median_vert.src = "assets/taxi/gridworld_median_vert.png";

  TAXI_ASSETS.median_horiz.onload = onAssetLoad;
  TAXI_ASSETS.median_horiz.src = "assets/taxi/gridworld_median_horiz.png";
}

export function renderSingleTaxiGrid(ctx, t, startX, startY, size, agentName) {
  const cellSize = size / 5;
  const stations = [
    { row: 0, col: 0, name: "R", color: "#cc292b" },
    { row: 0, col: 4, name: "G", color: "#2e9e44" },
    { row: 4, col: 0, name: "Y", color: "#eab308" },
    { row: 4, col: 3, name: "B", color: "#3a5bd8" },
  ];

  const stNames = ["R", "G", "Y", "B"];
  const pName = stNames[t.passengerIdx] || "?";
  const dName = stNames[t.destinationIdx] || "?";
  const statusStr = t.delivered
    ? "SUCCESS!"
    : t.passengerInTaxi
      ? `➔ Dest: ${dName}`
      : `➔ Pick Up: ${pName}`;

  ctx.font = "600 12px Plex, sans-serif";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(agentName.substring(0, 16), startX, startY - 14);
  ctx.font = "11px PlexMono, monospace";
  ctx.fillStyle = t.passengerInTaxi ? "#38bdf8" : "#94a3b8";
  ctx.fillText(statusStr, startX, startY + size + 22);

  // 1. Gymnasium Road Background Tiles
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cx = startX + c * cellSize;
      const cy = startY + r * cellSize;
      if (TAXI_ASSETS.loaded && TAXI_ASSETS.bg.complete) {
        ctx.drawImage(TAXI_ASSETS.bg, cx, cy, cellSize, cellSize);
      } else {
        ctx.fillStyle = "#787b84";
        ctx.fillRect(cx, cy, cellSize, cellSize);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.strokeRect(cx, cy, cellSize, cellSize);
      }
    }
  }

  // 2. Official Colored Stations
  stations.forEach((st) => {
    const sx = startX + st.col * cellSize;
    const sy = startY + st.row * cellSize;
    ctx.save();
    ctx.fillStyle = st.color;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(sx, sy, cellSize, cellSize);
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px PlexMono, monospace";
    ctx.fillText(st.name, sx + 6, sy + 18);
  });

  // 3. Destination Hotel (Transparent building over destination station)
  const destStation = stations[t.destinationIdx];
  if (destStation) {
    const dx = startX + destStation.col * cellSize;
    const dy = startY + destStation.row * cellSize;
    if (TAXI_ASSETS.loaded && TAXI_ASSETS.hotel.complete) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.drawImage(
        TAXI_ASSETS.hotel,
        dx + cellSize * 0.1,
        dy + cellSize * 0.05,
        cellSize * 0.8,
        cellSize * 0.85,
      );
      ctx.restore();
    } else {
      ctx.fillStyle = "#f8fafc";
      ctx.font = "18px Plex, sans-serif";
      ctx.fillText("🏨", dx + cellSize / 2 - 9, dy + cellSize / 2 + 7);
    }
  }

  // 4. Passenger at station (if not in taxi)
  if (!t.passengerInTaxi) {
    const pStation = stations[t.passengerIdx];
    if (pStation) {
      const px = startX + pStation.col * cellSize;
      const py = startY + pStation.row * cellSize;
      if (TAXI_ASSETS.loaded && TAXI_ASSETS.passenger.complete) {
        ctx.drawImage(
          TAXI_ASSETS.passenger,
          px + cellSize * 0.2,
          py + cellSize * 0.15,
          cellSize * 0.6,
          cellSize * 0.7,
        );
      } else {
        ctx.font = "20px Plex, sans-serif";
        ctx.fillText("🧍", px + cellSize / 2 - 10, py + cellSize / 2 + 8);
      }
    }
  }

  // 5. Official Gymnasium Vertical Medians (Hedge Walls)
  const drawMedianSegment = (colBoundary, startRow, isTop) => {
    const mx = startX + colBoundary * cellSize - cellSize * 0.14;
    const my = startY + startRow * cellSize;
    const img = isTop ? TAXI_ASSETS.median_top : TAXI_ASSETS.median_bottom;
    if (TAXI_ASSETS.loaded && img.complete) {
      ctx.drawImage(img, mx, my, cellSize * 0.28, cellSize);
    } else {
      ctx.strokeStyle = "#4d8c28";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(startX + colBoundary * cellSize, my);
      ctx.lineTo(startX + colBoundary * cellSize, my + cellSize);
      ctx.stroke();
    }
  };

  // Wall between col 1 and 2 (row 0 to 1)
  drawMedianSegment(2, 0, true);
  drawMedianSegment(2, 1, false);

  // Wall between col 0 and 1 (row 3 to 4)
  drawMedianSegment(1, 3, true);
  drawMedianSegment(1, 4, false);

  // Wall between col 2 and 3 (row 3 to 4)
  drawMedianSegment(3, 3, true);
  drawMedianSegment(3, 4, false);

  // Outer Perimeter Stone Curb
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(startX, startY, size, size);

  // 6. Taxi Cab Sprite
  const tx = startX + t.col * cellSize;
  const ty = startY + t.row * cellSize;
  let cabImg = TAXI_ASSETS.cab_front;
  if (t.orientation === "up") cabImg = TAXI_ASSETS.cab_rear;
  else if (t.orientation === "left") cabImg = TAXI_ASSETS.cab_left;
  else if (t.orientation === "right") cabImg = TAXI_ASSETS.cab_right;

  if (TAXI_ASSETS.loaded && cabImg.complete) {
    ctx.drawImage(
      cabImg,
      tx + cellSize * 0.12,
      ty + cellSize * 0.12,
      cellSize * 0.76,
      cellSize * 0.76,
    );
  } else {
    ctx.fillStyle = "#eab308";
    ctx.fillRect(
      tx + cellSize * 0.15,
      ty + cellSize * 0.2,
      cellSize * 0.7,
      cellSize * 0.6,
    );
  }

  // Indicator if passenger is in taxi
  if (t.passengerInTaxi) {
    if (TAXI_ASSETS.loaded && TAXI_ASSETS.passenger.complete) {
      ctx.drawImage(
        TAXI_ASSETS.passenger,
        tx + cellSize * 0.48,
        ty + cellSize * 0.04,
        cellSize * 0.45,
        cellSize * 0.52,
      );
    }
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(tx + cellSize * 0.82, ty + cellSize * 0.22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Quick action feedback toast (PICKED UP! / NOT HERE! / DELIVERED!)
  if (t.flashMsg && Date.now() < t.flashTimer) {
    ctx.save();
    ctx.font = "bold 12px Plex, sans-serif";
    ctx.fillStyle = t.flashMsg.includes("NO") ? "#ef4444" : "#10b981";
    ctx.fillText(t.flashMsg, tx + 6, ty - 6);
    ctx.restore();
  }

  // Success Banner
  if (t.delivered) {
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 16px Plex, sans-serif";
    ctx.fillText("MISSION COMPLETE! (+20 PTS)", startX + 40, startY + size / 2);
  }
}

initTaxiSprites();
export const spritesReady = Promise.all(
  Object.values(TAXI_ASSETS)
    .filter((value) => value instanceof Image)
    .map((img) => img.decode().catch(() => {})),
);
