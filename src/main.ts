// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// Import our luck function
import luck from "./_luck.ts";

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

//  basic UI Container
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// ======= core constants  =======

const CLASSROOM_LATLNG = leaflet.latLng(
  // classroom location
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 3;
// const CACHE_SPAWN_PROBABILITY = 0.1;
const WIN_VALUE = 16;

// ======= player setup =======
let playerLatLng = CLASSROOM_LATLNG.clone();

// ======= map setup  =======

// // Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// // Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// // Add a marker to represent the player
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// // Display the player's points
// let playerPoints = 0;
// statusPanelDiv.innerHTML = "No points yet...";

// ======= Grid + cell model =======

type CellCoord = {
  row: number;
  col: number;
};

type Cell = {
  coord: CellCoord;
  rect: leaflet.Rectangle;
  tokenValue: number | null;
  label?: leaflet.Marker;
};

const cells = new Map<string, Cell>();

function cellKey(coord: CellCoord): string {
  return `${coord.row},${coord.col}`;
}

// Convert lat/lng to global grid cell coordinates
function latLngToCell(lat: number, lng: number): CellCoord {
  const row = Math.floor(lat / TILE_DEGREES);
  const col = Math.floor(lng / TILE_DEGREES);
  return { row, col };
}

// Convert a cell coordinate to lat/lng bounds for drawing
function cellToBounds(row: number, col: number): leaflet.LatLngBoundsLiteral {
  const south = row * TILE_DEGREES;
  const north = south + TILE_DEGREES;
  const west = col * TILE_DEGREES;
  const east = west + TILE_DEGREES;
  return [
    [south, west],
    [north, east],
  ];
}

// ======= Deterministic token spawning =======

// Decide initial token for a cell, using only (row, col)
// so that the initial state is consistent across page loads.
function initialTokenValue(coord: CellCoord): number | null {
  const r = luck(`cell:${coord.row},${coord.col}`);
  // 60% chance of no token, need to add 40% chance of a 1-value token
  if (r < 0.6) return null;
  return 1;
}

// ======= Inventory (one token in hand) =======

let handTokenValue: number | null = null;

function updateStatusPanel() {
  if (handTokenValue === null) {
    statusPanelDiv.textContent = `Hand: (empty) | Player at: (${
      playerLatLng.lat.toFixed(
        5,
      )
    }, ${playerLatLng.lng.toFixed(5)})`;
  } else {
    statusPanelDiv.textContent = `Hand: ${handTokenValue} | Player at: (${
      playerLatLng.lat.toFixed(
        5,
      )
    }, ${playerLatLng.lng.toFixed(5)})`;
  }
}

updateStatusPanel();

// ======= Cell rendering helpers =======

function setCellToken(cell: Cell, value: number | null) {
  cell.tokenValue = value;

  // Remove any old label
  if (cell.label) {
    map.removeLayer(cell.label);
    cell.label == undefined;
  }

  if (value !== null) {
    const center = cell.rect.getBounds().getCenter();
    const divIcon = leaflet.divIcon({
      className: "token-label",
      html: `${value}`,
      // iconSize: [30, 30],
      iconAnchor: [TILE_DEGREES, TILE_DEGREES],
    });

    cell.label = leaflet.marker(center, { icon: divIcon }).addTo(map);
  }
}

// Return true if the given cell is within NEIGHBORHOOD_SIZE cells of the player
function isCellNearPlayer(cell: Cell): boolean {
  const playerCell = latLngToCell(playerLatLng.lat, playerLatLng.lng);
  const dr = Math.abs(cell.coord.row - playerCell.row);
  const dc = Math.abs(cell.coord.col - playerCell.col);
  return dr <= NEIGHBORHOOD_SIZE && dc <= NEIGHBORHOOD_SIZE;
}

// ======= Cell interaction logic =======

function checkWinIfNeeded(newValue: number) {
  if (newValue >= WIN_VALUE) {
    alert(`You crafted a token of value ${newValue}! You win!`);
  }
}

function onCellClicked(cell: Cell) {
  console.log(" in here!! ");
  if (!isCellNearPlayer(cell)) {
    console.log("not close enough to interact ");
    return;
  }

  console.log("close enough ");
  if (handTokenValue === null) {
    if (cell.tokenValue !== null) {
      handTokenValue = cell.tokenValue;
      setCellToken(cell, null);
      updateStatusPanel();
      console.log("did something (picked up from cell)");
    }
    return;
  }

  // Hand is holding a token
  if (cell.tokenValue === null) {
    // Just place the token into an empty cell
    setCellToken(cell, handTokenValue);
    handTokenValue = null;
    updateStatusPanel();
    return;
  }

  // ======= crafting =======
  // Cell has a token, hand has a token
  if (cell.tokenValue === handTokenValue) {
    // Crafting: equal values → double, result stays in the cell
    const newValue = cell.tokenValue * 2;
    setCellToken(cell, newValue);
    handTokenValue = null;
    updateStatusPanel();
    checkWinIfNeeded(newValue);
  } else {
    // Different values; do nothing or show feedback if you want
    console.log("cannot craft: different token values");
  }
}

// ======= Visible-grid management =======

// Create a cell if not already created, including initial token
function ensureCellExists(coord: CellCoord): Cell {
  const key = cellKey(coord);
  const existing = cells.get(key);
  if (existing) return existing;

  const bounds = cellToBounds(coord.row, coord.col);
  const rect = leaflet
    .rectangle(bounds, {
      color: "black",
      weight: 1,
      fillOpacity: 0.05,
    })
    .addTo(map);

  const cell: Cell = {
    coord,
    rect,
    tokenValue: null,
  };
  cells.set(key, cell);

  // Initial token (deterministic)
  const initial = initialTokenValue(coord);
  if (initial !== null) {
    setCellToken(cell, initial);
  }

  rect.on("click", () => onCellClicked(cell));

  return cell;
}

// Draw cells for the whole visible map area
function updateVisibleCells() {
  const bounds = map.getBounds();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  const minRow = Math.floor(south / TILE_DEGREES);
  const maxRow = Math.floor(north / TILE_DEGREES);
  const minCol = Math.floor(west / TILE_DEGREES);
  const maxCol = Math.floor(east / TILE_DEGREES);

  // Despawn cells that are *no longer visible*
  for (const [key, cell] of cells) {
    const { row, col } = cell.coord;
    const outOfView = row < minRow || row > maxRow || col < minCol ||
      col > maxCol;

    if (outOfView) {
      map.removeLayer(cell.rect);
      if (cell.label) {
        map.removeLayer(cell.label);
      }
      cells.delete(key);
    }
  }

  //  Ensure that all visible cells exist (spawn if needed)
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      ensureCellExists({ row, col });
    }
  }
}

// ======= Player movement controls =======

// Move the player by deltaRow / deltaCol grid steps
function movePlayer(deltaRow: number, deltaCol: number) {
  // One grid step = TILE_DEGREES
  // "Row" corresponds to latitude, "Col" to longitude
  const newLat = playerLatLng.lat + deltaRow * TILE_DEGREES;
  const newLng = playerLatLng.lng + deltaCol * TILE_DEGREES;

  playerLatLng = leaflet.latLng(newLat, newLng);

  // Move the marker
  playerMarker.setLatLng(playerLatLng);

  // Keep camera following player
  map.panTo(playerLatLng);

  // Update HUD
  updateStatusPanel();

  // Update visible cells (in case bounds changed slightly)
  updateVisibleCells();
}

// arrow buttoms for player movement
document.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowUp") movePlayer(+1, 0);
  if (ev.key === "ArrowDown") movePlayer(-1, 0);
  if (ev.key === "ArrowRight") movePlayer(0, +1);
  if (ev.key === "ArrowLeft") movePlayer(0, -1);
});

function makeMoveButton(
  label: string,
  id: string,
  dRow: number,
  dCol: number,
) {
  const button = document.createElement("button");
  button.textContent = label;
  button.id = id;
  button.addEventListener("click", () => movePlayer(dRow, dCol));
  controlPanelDiv.append(button);
}

makeMoveButton("North", "northBtn", +1, 0);
makeMoveButton("South", "southBtn", -1, 0);
makeMoveButton("East", "eastBtn", 0, +1);
makeMoveButton("West", "westBtn", 0, -1);

// Initial draw + update on pan/zoom (even though zoom is fixed)
updateVisibleCells();
map.on("moveend", updateVisibleCells);
