# Twine Map System - Complete Implementation Guide

A comprehensive grid-based navigation system for Twine 2 / SugarCube 2 projects with visual minimap, keyboard controls, fog of war, and conditional transitions. This Node-Network style system was inspired by Fenoxo's map system in games like Trials in Tainted Space. 

## Table of Contents

1. [System Overview](#system-overview)
2. [File Structure](#file-structure)
3. [Installation Guide](#installation-guide)
4. [Map Data Format](#map-data-format)
5. [Core Features](#core-features)
6. [Implementation Steps](#implementation-steps)
7. [HTML Integration](#html-integration)
8. [CSS Styling](#css-styling)
9. [JavaScript API](#javascript-api)
10. [Advanced Features](#advanced-features)
11. [Troubleshooting](#troubleshooting)
12. [Examples](#examples)

---

## System Overview

The Twine Map System provides a complete grid-based navigation solution that integrates seamlessly with SugarCube 2. It features:

- **Visual Grid Navigation**: Interactive maps with clickable tiles
- **Keyboard Controls**: WASD and arrow key movement
- **Minimap Display**: Real-time player position in sidebar
- **Full Map View**: Expandable journal map interface
- **Fog of War**: Progressive map revelation system
- **Conditional Transitions**: Item, quest, and variable-based movement restrictions
- **Dynamic Content**: Node conditions for changing map behavior
- **Auto-save Integration**: Persistent player progress

---

## File Structure

```
your-twine-project/
├── dev/js/data/maps/
│   ├── example-map.json          # Map data files
│   └── your-map.json
├── dev/js/
│   ├── NodeMapLogic.js           # Core map system
│   └── NodeMapStyles.css         # Map styling
├── passages/
│   ├── example-map-passages.tw   # Generated passages
│   └── your-passages.tw
└── html-templates/
    └── MapContainerStructure.html # UI components
```

---

## Installation Guide

### Step 1: Add Core Files

1. **Copy `NodeMapLogic.js`** to your project's JavaScript folder
2. **Copy `NodeMapStyles.css`** to your project's CSS folder
3. **Create maps folder** at `dev/js/data/maps/`

### Step 2: Include in Twine Project

Add to your **Story JavaScript**:
```javascript
// Include the map system
// (Paste the entire contents of NodeMapLogic.js here)
```

Add to your **Story Stylesheet**:
```css
/* Include the map styles */
/* (Paste the entire contents of NodeMapStyles.css here) */
```

### Step 3: Initialize Player State

Add to your **StoryInit** passage:
```javascript
<<set $player = {
    mapState: {
        currentMapId: null,
        position: { x: 0, y: 0 },
        revealedTiles: {}
    }
}>>

<<set $inventory_player = {}>>
<<set $world = { locationName: "Unknown" }>>
```

---

## Map Data Format

Maps are stored as JSON files with the following structure:

```json
{
  "mapId": "unique-map-identifier",
  "name": "Display Name",
  "description": "Optional description",
  "gridSize": {
    "width": 9,
    "height": 7
  },
  "fogOfWar": false,
  "playerStartPosition": {
    "x": 5,
    "y": 3
  },
  "nodes": [
    {
      "id": "unique-node-id",
      "x": 5,
      "y": 3,
      "passage": "TwinePassageName",
      "name": "Location Display Name",
      "icon": "lucide-icon-name",
      "conditions": [
        {
          "type": "variable",
          "variable": "player.day",
          "operator": "==",
          "value": 1
        }
      ],
      "transitions": {
        "north": {
          "type": "bidirectional",
          "conditions": []
        },
        "east": {
          "type": "one-way",
          "direction": "east",
          "conditions": [
            {
              "type": "item",
              "item": "silver_key",
              "operator": ">=",
              "value": 1
            }
          ]
        }
      }
    }
  ]
}
```

### Node Properties

- **id**: Unique identifier for the node
- **x, y**: Grid coordinates (1-based)
- **passage**: Name of the Twine passage to navigate to
- **name**: Display name shown in UI
- **icon**: Lucide icon name for visual representation
- **conditions**: Array of conditions that affect node behavior
- **transitions**: Object defining movement to adjacent nodes

### Transition Types

- **bidirectional**: Movement allowed in both directions
- **one-way**: Movement restricted to specified direction

### Condition Types

1. **Item Conditions**:
   ```json
   {
     "type": "item",
     "item": "key_name",
     "operator": ">=",
     "value": 1
   }
   ```

2. **Variable Conditions**:
   ```json
   {
     "type": "variable",
     "variable": "player.stats.strength",
     "operator": ">=",
     "value": 10
   }
   ```

3. **Quest Conditions**:
   ```json
   {
     "type": "quest",
     "quest": "main_quest_completed",
     "operator": "==",
     "value": true
   }
   ```

---

## Core Features

### 1. Grid-Based Navigation

The system uses a coordinate-based grid where:
- **X-axis**: Horizontal movement (west/east)
- **Y-axis**: Vertical movement (north/south)
- **Origin**: Top-left corner (1,1)

### 2. Movement Controls

**Keyboard Navigation**:
- `W` or `↑`: Move North
- `S` or `↓`: Move South
- `A` or `←`: Move West
- `D` or `→`: Move East

**Mouse Navigation**:
- Click adjacent tiles in full map view
- Click minimap fullscreen button

### 3. Visual Feedback

**Minimap Features**:
- 3x3 grid centered on player
- Real-time position updates
- Icon-based location identification
- Transition indicators

**Full Map Features**:
- Complete map overview
- Clickable navigation
- Fog of war visualization
- Player position highlighting

### 4. Fog of War System

**Progressive Revelation**:
- Tiles revealed as player explores
- Adjacent tiles auto-revealed
- Persistent across game sessions
- Per-map revelation tracking

---

## Implementation Steps

### Step 1: Create Your Map Data

1. **Use the Map Editor** to design your map visually
2. **Export JSON** file to `dev/js/data/maps/your-map.json`
3. **Export .tw file** for passage stubs

### Step 2: Add HTML Structure

Add to your **sidebar** or **UI bar**:

```html
<!-- Minimap Container -->
<div id="minimap-section">
  <div class="minimap-header">
    <h4>Current Location</h4>
    <button id="minimap-fullscreen-btn" title="Open Full Map">
      <i data-lucide="maximize-2"></i>
    </button>
  </div>
  <div id="tile-map-container">
    <!-- Minimap will be generated here -->
  </div>
  <div class="minimap-info">
    <div>Map: <span id="minimap-current-map">None</span></div>
    <div>Position: <span id="minimap-player-coords">(0,0)</span></div>
  </div>
</div>
```

Add to your **journal/overlay system**:

```html
<div class="journal-tab-content" id="journal-map">
  <div class="map-section">
    <div class="map-header">
      <h3 id="map-title">Current Area</h3>
      <div class="map-controls">
        <button class="map-control-btn" onclick="MapSystem.updateFullMapDisplay()">
          <i data-lucide="refresh-cw"></i>
        </button>
      </div>
    </div>
    <div class="map-container" id="full-map-container">
      <!-- Full map will be generated here -->
    </div>
  </div>
</div>
```

### Step 3: Initialize the System

In your **StoryReady** passage:

```javascript
<<script>>
// Initialize the map system
$(document).ready(function() {
    // Load your first map
    MapSystem.setCurrentMap('your-map-id');
});
<</script>>
```

### Step 4: Create Passage Integration

In each location passage:

```html
:: LocationPassage
You are in the village square. The bustling marketplace surrounds you.

<<if MapSystem.currentMap>>
    <!-- Optional: Display current location info -->
    <div class="location-info">
        <strong>Location:</strong> <<print $world.locationName>><br>
        <strong>Coordinates:</strong> (<<print MapSystem.currentPosition.x>>, <<print MapSystem.currentPosition.y>>)
    </div>
<</if>>

<!-- Your passage content here -->

<!-- Optional: Manual movement links -->
<<if MapSystem.canMoveTo('north')>>
    [[Go North|NextPassage]]
<</if>>
```

---

## HTML Integration

### Minimap Integration

The minimap should be integrated into your game's sidebar or UI bar:

```html
<div class="sidebar-section">
  <div class="minimap-container">
    <div class="minimap-header">
      <h4>Map</h4>
      <button id="minimap-fullscreen-btn">⛶</button>
    </div>
    <div id="tile-map-container"></div>
    <div class="minimap-info">
      <div id="minimap-current-map">No Map</div>
      <div id="minimap-player-coords">(0,0)</div>
    </div>
  </div>
</div>
```

### Journal/Overlay Integration

For full map viewing, integrate with your journal system:

```html
<div class="overlay" id="journal-overlay">
  <div class="journal-content">
    <div class="journal-tabs">
      <button data-tab="map">Map</button>
      <!-- Other tabs -->
    </div>
    <div class="journal-tab-content" id="journal-map">
      <!-- Map content from MapContainerStructure.html -->
    </div>
  </div>
</div>
```

---

## CSS Styling

The system includes comprehensive CSS for:

### Map Grid Styling
```css
.tile-grid {
    display: grid;
    gap: 2px;
    background: #333;
}

.tile {
    width: 40px;
    height: 40px;
    background: #666;
    border: 1px solid #999;
    position: relative;
}

.tile-node {
    background: #4a90e2;
}

.player-tile {
    background: #ff6b6b;
}
```

### Transition Indicators
```css
.has-north::before { /* North transition indicator */ }
.has-south::after { /* South transition indicator */ }
.has-east::before { /* East transition indicator */ }
.has-west::after { /* West transition indicator */ }

.oneway-north { /* One-way north styling */ }
/* etc. */
```

### Fog of War
```css
.tile-hidden {
    background: #222;
    opacity: 0.3;
}

.tile-revealed {
    opacity: 1;
    transition: opacity 0.3s ease;
}
```

---

## JavaScript API

### Core Methods

#### `MapSystem.init()`
Initializes the map system. Called automatically on DOM ready.

#### `MapSystem.loadMap(mapId)`
```javascript
// Load a map from JSON file
const mapData = await MapSystem.loadMap('village-map');
```

#### `MapSystem.setCurrentMap(mapId, position)`
```javascript
// Set active map and player position
await MapSystem.setCurrentMap('village-map', { x: 5, y: 3 });
```

#### `MapSystem.movePlayer(direction)`
```javascript
// Move player programmatically
const success = await MapSystem.movePlayer('north');
```

#### `MapSystem.canMoveTo(direction)`
```javascript
// Check if movement is allowed
if (MapSystem.canMoveTo('east')) {
    // Movement is possible
}
```

### Utility Methods

#### `MapSystem.getNodeAt(x, y)`
```javascript
// Get node data at coordinates
const node = MapSystem.getNodeAt(5, 3);
```

#### `MapSystem.setMovementBlocked(blocked)`
```javascript
// Block/unblock movement (useful for cutscenes)
MapSystem.setMovementBlocked(true);
```

#### `MapSystem.revealTile(mapId, x, y)`
```javascript
// Manually reveal fog of war tile
MapSystem.revealTile('village-map', 6, 4);
```

### Event Integration

#### Passage Navigation
```javascript
// In your passage
<<script>>
// Move to specific map location
MapSystem.setCurrentMap('dungeon-map', { x: 1, y: 1 });
<</script>>
```

#### Conditional Movement
```javascript
// Check conditions before allowing movement
if ($inventory_player.silver_key >= 1) {
    MapSystem.movePlayer('east');
} else {
    UI.alert("You need a silver key to proceed.");
}
```

---

## Advanced Features

### 1. Dynamic Node Conditions

Nodes can change behavior based on game state:

```json
{
  "id": "fair-entrance",
  "x": 5,
  "y": 3,
  "passage": "FairEntrance_Day1",
  "name": "Fair Entrance",
  "conditions": [
    {
      "type": "variable",
      "variable": "player.currentDay",
      "operator": "==",
      "value": 1
    }
  ]
}
```

Implementation in passage:
```javascript
<<if $player.currentDay == 1>>
    <<set _passageName = "FairEntrance_Day1">>
<<elseif $player.currentDay == 2>>
    <<set _passageName = "FairEntrance_Day2">>
<<else>>
    <<set _passageName = "FairEntrance_Day3">>
<</if>>

<<goto _passageName>>
```

### 2. Complex Transition Conditions

Multiple condition types can be combined:

```json
{
  "type": "one-way",
  "direction": "north",
  "conditions": [
    {
      "type": "item",
      "item": "torch",
      "operator": ">=",
      "value": 1
    },
    {
      "type": "variable",
      "variable": "player.stats.courage",
      "operator": ">=",
      "value": 5
    }
  ]
}
```

### 3. Custom Condition Evaluation

Extend the condition system:

```javascript
// Add custom condition type
MapSystem.evaluateCondition = function(condition) {
    switch (condition.type) {
        case "custom":
            return this.evaluateCustomCondition(condition);
        default:
            // Original evaluation logic
    }
};

MapSystem.evaluateCustomCondition = function(condition) {
    // Your custom logic here
    return true;
};
```

### 4. Map Transitions

Switch between different maps:

```javascript
// In a passage that connects maps
<<script>>
MapSystem.setCurrentMap('world-map', { x: 10, y: 5 });
<</script>>

You emerge from the dungeon into the bright sunlight of the world map.
```

### 5. Save/Load Integration

The system automatically saves to `State.variables.player.mapState`:

```javascript
// Manual save
State.variables.player.mapState = {
    currentMapId: MapSystem.currentMap.mapId,
    position: MapSystem.currentPosition,
    revealedTiles: Object.fromEntries(MapSystem.revealedTiles)
};

// Manual load
if (State.variables.player.mapState.currentMapId) {
    MapSystem.setCurrentMap(
        State.variables.player.mapState.currentMapId,
        State.variables.player.mapState.position
    );
}
```

---

## Troubleshooting

### Common Issues

#### 1. Map Not Loading
**Problem**: `MapSystem.loadMap()` returns null
**Solutions**:
- Check file path: `dev/js/data/maps/your-map.json`
- Verify JSON syntax with validator
- Ensure web server serves JSON files
- Check browser console for fetch errors

#### 2. Movement Not Working
**Problem**: Keyboard/mouse movement doesn't respond
**Solutions**:
- Verify `MapSystem.init()` was called
- Check if movement is blocked: `MapSystem.movementBlocked`
- Ensure current map is set: `MapSystem.currentMap`
- Verify node exists at current position

#### 3. Icons Not Displaying
**Problem**: Lucide icons don't show
**Solutions**:
- Include Lucide CDN: `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>`
- Call `lucide.createIcons()` after DOM updates
- Check icon names match Lucide library

#### 4. Fog of War Issues
**Problem**: Tiles not revealing properly
**Solutions**:
- Verify `fogOfWar: true` in map data
- Check `State.variables.player.mapState.revealedTiles`
- Ensure `revealTile()` is called on movement

#### 5. Condition Evaluation Errors
**Problem**: Transitions not respecting conditions
**Solutions**:
- Verify condition syntax in JSON
- Check variable paths exist: `State.variables.player.stats.strength`
- Ensure inventory structure: `State.variables.inventory_player`
- Test condition evaluation manually

### Debug Tools

#### Console Commands
```javascript
// Check current state
console.log(MapSystem.currentMap);
console.log(MapSystem.currentPosition);
console.log(State.variables.player.mapState);

// Test movement
MapSystem.movePlayer('north');

// Check conditions
MapSystem.canMoveTo('east');

// Reveal all tiles (debug)
for (let x = 1; x <= 10; x++) {
    for (let y = 1; y <= 10; y++) {
        MapSystem.revealTile(MapSystem.currentMap.mapId, x, y);
    }
}
```

#### Validation Script
```javascript
// Validate map data
function validateMap(mapData) {
    const errors = [];
    
    if (!mapData.mapId) errors.push("Missing mapId");
    if (!mapData.gridSize) errors.push("Missing gridSize");
    if (!Array.isArray(mapData.nodes)) errors.push("Invalid nodes array");
    
    mapData.nodes.forEach((node, index) => {
        if (!node.x || !node.y) errors.push(`Node ${index}: Missing coordinates`);
        if (!node.passage) errors.push(`Node ${index}: Missing passage`);
    });
    
    return errors;
}
```

---

## Examples

### Example 1: Simple Village Map

**Map Data** (`village.json`):
```json
{
  "mapId": "village",
  "name": "Village Center",
  "gridSize": { "width": 5, "height": 5 },
  "fogOfWar": false,
  "playerStartPosition": { "x": 3, "y": 3 },
  "nodes": [
    {
      "id": "village-center",
      "x": 3,
      "y": 3,
      "passage": "VillageCenter",
      "name": "Village Square",
      "icon": "home",
      "transitions": {
        "north": { "type": "bidirectional", "conditions": [] },
        "east": { "type": "bidirectional", "conditions": [] }
      }
    },
    {
      "id": "blacksmith",
      "x": 3,
      "y": 2,
      "passage": "Blacksmith",
      "name": "Blacksmith Shop",
      "icon": "hammer",
      "transitions": {
        "south": { "type": "bidirectional", "conditions": [] }
      }
    }
  ]
}
```

**Passage Implementation**:
```html
:: VillageCenter
You stand in the heart of the village. The blacksmith's hammer rings from the north.

<<script>>
MapSystem.setCurrentMap('village', { x: 3, y: 3 });
<</script>>

:: Blacksmith
The blacksmith greets you with a nod as sparks fly from his forge.

<<script>>
MapSystem.setCurrentMap('village', { x: 3, y: 2 });
<</script>>
```

### Example 2: Dungeon with Locked Doors

**Map Data** (`dungeon.json`):
```json
{
  "mapId": "dungeon",
  "name": "Ancient Dungeon",
  "gridSize": { "width": 7, "height": 5 },
  "fogOfWar": true,
  "playerStartPosition": { "x": 1, "y": 3 },
  "nodes": [
    {
      "id": "entrance",
      "x": 1,
      "y": 3,
      "passage": "DungeonEntrance",
      "name": "Entrance",
      "icon": "door-open",
      "transitions": {
        "east": { "type": "bidirectional", "conditions": [] }
      }
    },
    {
      "id": "locked-room",
      "x": 5,
      "y": 3,
      "passage": "LockedRoom",
      "name": "Locked Chamber",
      "icon": "lock",
      "transitions": {
        "west": {
          "type": "one-way",
          "direction": "west",
          "conditions": [
            {
              "type": "item",
              "item": "dungeon_key",
              "operator": ">=",
              "value": 1
            }
          ]
        }
      }
    }
  ]
}
```

### Example 3: Dynamic Fair Map

**Map Data** (`fair.json`):
```json
{
  "mapId": "fair",
  "name": "Three Day Fair",
  "gridSize": { "width": 6, "height": 4 },
  "fogOfWar": false,
  "playerStartPosition": { "x": 3, "y": 4 },
  "nodes": [
    {
      "id": "main-stage",
      "x": 3,
      "y": 2,
      "passage": "MainStage_Day1",
      "name": "Main Stage",
      "icon": "music",
      "conditions": [
        {
          "type": "variable",
          "variable": "world.currentDay",
          "operator": "==",
          "value": 1
        }
      ],
      "transitions": {
        "south": { "type": "bidirectional", "conditions": [] }
      }
    }
  ]
}
```

**Dynamic Passage Selection**:
```html
:: MainStage_Day1
<<if $world.currentDay == 1>>
    The opening ceremony is in full swing!
<<elseif $world.currentDay == 2>>
    Merchants hawk their wares loudly.
<<else>>
    The closing celebration has begun!
<</if>>
```

---

## Conclusion

This map system provides a robust foundation for grid-based navigation in Twine games. The combination of visual feedback, keyboard controls, and conditional logic creates an engaging exploration experience that integrates seamlessly with SugarCube 2's variable system.

For additional support or advanced customization, refer to the source code comments and the included map editor tool for visual map creation.

---

**Version**: 2.0  
**Compatible with**: Twine 2.3+, SugarCube 2.30+  
**Dependencies**: Lucide Icons (CDN), jQuery (included with SugarCube)  
**License**: Free for any use
