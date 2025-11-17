// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// Import our luck function
import luck from "./_luck.ts";

// ======= basic UI Container  =======
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// ======= core constants  =======
// // Our classroom location
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// // Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 3;
// const CACHE_SPAWN_PROBABILITY = 0.1;
const WIN_VALUE = 8;

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
    statusPanelDiv.textContent = "Hand: (empty)";
  } else {
    statusPanelDiv.textContent = `Hand: ${handTokenValue}`;
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
  const playerCell = latLngToCell(CLASSROOM_LATLNG.lat, CLASSROOM_LATLNG.lng);
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
    // Not close enough to interact
      console.log("not close enough to interact ");
    return;
  }

  console.log("close enough ");
  if (handTokenValue === null) {
    // Try to pick up a token from the cell
      // console.log("there is a token ");
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

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      ensureCellExists({ row, col });
    }
  }
}

// Initial draw + update on pan/zoom (even though zoom is fixed)
updateVisibleCells();
map.on("moveend", updateVisibleCells);



// // @deno-types="npm:@types/leaflet"
// import leaflet from "leaflet";

// // Style sheets
// import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
// import "./style.css"; // student-controlled page style

// // Fix missing marker images
// import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// // Import our luck function
// import luck from "./_luck.ts";

////// Create basic UI elements/////////
// const controlPanelDiv = document.createElement("div");
// controlPanelDiv.id = "controlPanel";
// document.body.append(controlPanelDiv);

// const mapDiv = document.createElement("div");
// mapDiv.id = "map";
// document.body.append(mapDiv);

// const statusPanelDiv = document.createElement("div");
// statusPanelDiv.id = "statusPanel";
// document.body.append(statusPanelDiv);

// // Our classroom location
// const CLASSROOM_LATLNG = leaflet.latLng(
//   36.997936938057016,
//   -122.05703507501151,
// );

// // Tunable gameplay parameters
// const GAMEPLAY_ZOOM_LEVEL = 19;
// const TILE_DEGREES = 1e-4;
// const NEIGHBORHOOD_SIZE = 8;
// const CACHE_SPAWN_PROBABILITY = 0.1;

// // Create the map (element with id "map" is defined in index.html)
// const map = leaflet.map(mapDiv, {
//   center: CLASSROOM_LATLNG,
//   zoom: GAMEPLAY_ZOOM_LEVEL,
//   minZoom: GAMEPLAY_ZOOM_LEVEL,
//   maxZoom: GAMEPLAY_ZOOM_LEVEL,
//   zoomControl: false,
//   scrollWheelZoom: false,
// });

// // Populate the map with a background tile layer
// leaflet
//   .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
//     maxZoom: 19,
//     attribution:
//       '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
//   })
//   .addTo(map);

// // Add a marker to represent the player
// const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
// playerMarker.bindTooltip("That's you!");
// playerMarker.addTo(map);

// // Display the player's points
// let playerPoints = 0;
// statusPanelDiv.innerHTML = "No points yet...";

// // Add caches to the map by cell numbers
// function spawnCache(i: number, j: number) {
//   // Convert cell numbers into lat/lng bounds
//   const origin = CLASSROOM_LATLNG;
//   const bounds = leaflet.latLngBounds([
//     [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
//     [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
//   ]);

//   // Add a rectangle to the map to represent the cache
//   const rect = leaflet.rectangle(bounds);
//   rect.addTo(map);

//   // Handle interactions with the cache
//   rect.bindPopup(() => {
//     // Each cache has a random point value, mutable by the player
//     let pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);

//     // The popup offers a description and button
//     const popupDiv = document.createElement("div");
//     popupDiv.innerHTML = `
//                 <div>There is a cache here at "${i},${j}". It has value <span id="value">${pointValue}</span>.</div>
//                 <button id="poke">poke</button>`;

//     // Clicking the button decrements the cache's value and increments the player's points
//     popupDiv
//       .querySelector<HTMLButtonElement>("#poke")!
//       .addEventListener("click", () => {
//         pointValue--;
//         popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
//           pointValue.toString();
//         playerPoints++;
//         statusPanelDiv.innerHTML = `${playerPoints} points accumulated`;
//       });

//     return popupDiv;
//   });
// }

// // Look around the player's neighborhood for caches to spawn
// for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
//   for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
//     // If location i,j is lucky enough, spawn a cache!
//     if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
//       spawnCache(i, j);
//     }
//   }
// }
