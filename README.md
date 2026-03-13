# CMPM 121 D3 Project

This is the starting point for your CMPM 121 D3 project. Students should make sure to remove _this_ content from their README.md file and replace it with their own project documentation.

## Part d.A
Get a core map, cell inventory, and crafting loop working around the classroom
1.Create a leaflet map, centered on the fixed classroom location
2.add a tile later
3. define contransts for classroom latitiure and longitude, cell size, interaction radius and craft win system. 
-Deterministic spawning -> each cell needs a consistent starting state accorss page reload.
-runtime state track changes to cells during play in a map 
-Only nearby cells should be playable 
  -compute the player's classroom cell 
  -measure grid distance from each visible cell to the player cell
  -allow clicks only within the interaction radius
  -visually mark active cells differently from non-active cells. 
-implement inventory system 
  - the player can hold at most one token
  - Add a text ui at the bottom showing empty hand by showing the current token value in hand
    Constraints 
    - if the player clicks a nearby cell containing a token while empty-handed, pick it up
    - remove token form the cell
    - if player clicks an empty cell while holding a token, place it there
-crafting system
  -crafting happends when the player holds a token and clicks a nearby cell containing a token of equal value.
    -equal values combine into a double token
    -clicked cell token becomes double the original value
    -player hand becomes empty
-win system
  -check after every interactio if player has reached the crafting win variable.
      - check held token value

## Part d.B
expand game so it works acores the globe using a Null Island anchered grid and simulated player movement

##D3.b plan
Extending d3.A system so gameplay works on other maps. Gril uses Null isaland anchored earth-spanning coordinate system, the player should be able to simulate movements, and cells appear memeoryless when they leave the visible area. 
-Core mechanics from part a is the same (same core player movement, inventory system and craft logic)
changes in part b 
  - refactor the local class room cented grid into a global grid anchored at null island
    -(keep position state)
    -map viewport state
    -logical cell identifiers
    -visible rendered cell objects
    -temporary runtime state for visible cells only
    -add UI buttons WASD, with each button only moving one cell
    -pan the map without moving character
    -cells spawning and despawning
    - raise  the win state to 32
    





