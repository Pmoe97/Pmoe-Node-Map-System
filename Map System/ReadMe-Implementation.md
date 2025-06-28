# Twine Map System - Complete Implementation Guide

A comprehensive grid-based navigation system for Twine 2 / SugarCube 2 projects with visual minimap, keyboard controls, fog of war, conditional transitions, and advanced features like entry points, tags, and dynamic styling. This Node-Network style system was inspired by Fenoxo's map system in games like Trials in Tainted Space.

## Table of Contents

1. [System Overview](#system-overview)
2. [File Structure](#file-structure)
3. [Installation Guide](#installation-guide)
4. [Map Data Format](#map-data-format)
5. [Core Features](#core-features)
6. [Enhanced Features](#enhanced-features)
7. [Implementation Steps](#implementation-steps)
8. [HTML Integration](#html-integration)
9. [CSS Styling](#css-styling)
10. [JavaScript API](#javascript-api)
11. [Advanced Features](#advanced-features)
12. [Troubleshooting](#troubleshooting)
13. [Examples](#examples)
14. [Migration Guide](#migration-guide)

---

## System Overview

The Enhanced Twine Map System provides a complete grid-based navigation solution that integrates seamlessly with SugarCube 2. It features:

- **Visual Grid Navigation**: Interactive maps with clickable tiles
- **Keyboard Controls**: WASD and arrow key movement
- **Minimap Display**: Real-time player position in sidebar
- **Full Map View**: Expandable journal map interface
- **Fog of War**: Progressive map revelation system
- **Conditional Transitions**: Item, quest, and variable-based movement restrictions
- **Entry Point System**: Context-aware spawn locations
- **Tag System**: Region and location-based gameplay logic
- **Style Customization**: Visual patterns and colors for nodes
- **Dynamic Content**: Node conditions for changing map behavior
- **Passage Text Support**: Integrated Twine passage content
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

### Step 4: Include Lucide Icons

Add to your **Story JavaScript** or HTML header:
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
```

---

## Map Data Format

Maps are stored as JSON files with the following enhanced structure:

```json
{
  "mapId": "example-map",
  "name": "Example Map",
  "region": "bastion",
  "gridSize": {
    "width": 10,
    "height": 10
  },
  "defaultStart": { "x": 1, "y": 1 },
  "fogOfWar": false,
  "nodes": [
    {
      "column": 0,
      "row": 0,
      "name": "Node Name",
      "passage": "PassageName",
      "icon": "lucide-icon-name",
      "fogOfWar": false,
      "tags": ["interior", "safe", "entry-default"],
      "style": {
        "primaryColor": "#FFCC00",
        "secondaryColor": "#6c757d",
        "pattern": "diagonal-stripes"
      },
      "conditions": [
        {
          "type": "variable",
          "name": "player.level",
          "operator": ">=",
          "value": 5,
          "passage": "HighLevelPassage",
          "icon": "crown"
        }
      ],
      "transitions": {
        "north": {
          "type": "bidirectional",
          "conditions": []
        },
        "east": {
          "type": "locked",
          "conditions": [
            {
              "action": "changeIf",
              "type": "variable",
              "name": "VisitedTop",
              "operator": "==",
              "value": "true",
              "changeTarget": "bidirectional"
            }
          ]
        }
      }
    }
  ],
  "passageTexts": {
    "1,1": {
      "main": "Main passage text",
      "conditions": {
        "ConditionalPassage": "Conditional text"
      }
    }
  },
  "projectTagLibrary": ["interior", "exterior", "bastion", "public", "private"],
  "entryPointRegistry": {
    "entry-default": "1,1",
    "entry-east": "5,3",
    "entry-teleport": "7,7"
  }
}
```

### Node Properties

- **column/row**: Grid coordinates (also supports x/y for backward compatibility)
- **name**: Display name for the location
- **passage**: Name of the Twine passage to navigate to
- **icon**: Lucide icon name for visual representation
- **fogOfWar**: Individual fog of war override
- **tags**: Array of tags for gameplay logic (e.g., "interior", "dangerous", "entry-default")
- **style**: Visual customization with colors and patterns
- **conditions**: Array of conditions that affect node behavior
- **transitions**: Object defining movement to adjacent nodes

### Transition Types

- **bidirectional**: Movement allowed in both directions
- **one-way**: Movement restricted to specified direction
- **locked**: Blocked until conditions are met
- **secret**: Hidden from view
- **none**: No transition possible

### Condition Types

1. **Variable Conditions**:
   ```json
   {
     "type": "variable",
     "name": "player.stats.strength",
     "operator": ">=",
     "value": 10
   }
   ```

2. **Item Conditions**:
   ```json
   {
     "type": "item",
     "name": "silver_key",
     "operator": ">=",
     "value": 1
   }
   ```

3. **Quest Conditions**:
   ```json
   {
     "type": "quest",
     "name": "main_quest_completed",
     "operator": "==",
     "value": true
   }
   ```

4. **Time Conditions**:
   ```json
   {
     "type": "time",
     "name": "currentHour",
     "operator": "between",
     "value": [6, 18]
   }
   ```

---

## Core Features

### 1. Grid-Based Navigation

The system uses a coordinate-based grid where:
- **X-axis**: Horizontal movement (west/east)
- **Y-axis**: Vertical movement (north/south)  
- **Origin**: Top-left corner (0,0) or (1,1) depending on configuration

### 2. Movement Controls

**Keyboard Navigation**:
- `W` or `↑`: Move North
- `S` or `↓`: Move South
- `A` or `←`: Move West
- `D` or `→`: Move East

**Mouse Navigation**:
- Click adjacent tiles in full map view
- Click minimap for quick navigation

### 3. Visual Feedback

**Minimap Features**:
- 3x3 grid centered on player
- Real-time position updates
- Icon-based location identification
- Transition indicators
- Tag-based border styling

**Full Map Features**:
- Complete map overview
- Clickable navigation
- Fog of war visualization
- Player position highlighting
- Entry point indicators
- Style pattern visualization

### 4. Fog of War System

**Progressive Revelation**:
- Tiles revealed as player explores
- Adjacent tiles auto-revealed
- Persistent across game sessions
- Per-map revelation tracking

---

## Enhanced Features

### 1. Entry Point System

Define multiple entry points for context-aware spawning:

```javascript
// Enter from different locations
await MapSystem.setCurrentMap('city-map', null, 'entry-east');
await MapSystem.setCurrentMap('city-map', null, 'entry-teleport');

// Get available entry points
const entryPoints = MapSystem.getAvailableEntryPoints();

// Teleport to specific entry
MapSystem.teleportToEntryPoint('entry-default');
```

### 2. Tag System

Use tags for region-based logic and visual styling:

```javascript
// Check current location tags
if (MapSystem.currentLocationHasTag('dangerous')) {
    // Spawn enemies
}

// Find all taverns
const taverns = MapSystem.getNodesByTag('tavern');

// Check region access
if (MapSystem.canAccessRegion('restricted')) {
    // Allow entry
}
```

### 3. Style Customization

Nodes support visual customization:

**Available Patterns**:
- `diagonal-stripes`
- `vertical-stripes`
- `horizontal-stripes`
- `dots`
- `grid`
- `checkerboard`

**Tag-Based Styling**:
- `tag-interior`: Brown border
- `tag-exterior`: Green border
- `tag-dangerous`: Orange glow
- `tag-restricted`: Red glow
- `tag-safe`: Green border

### 4. Advanced Conditions

Priority-based condition evaluation:

```json
{
  "conditions": [
    {
      "priority": 1,
      "type": "variable",
      "name": "player.level",
      "operator": ">=",
      "value": 10,
      "passage": "HighLevelContent"
    },
    {
      "priority": 2,
      "type": "variable",
      "name": "player.level",
      "operator": ">=",
      "value": 5,
      "passage": "MidLevelContent"
    }
  ]
}
```

---

## Implementation Steps

### Step 1: Create Your Map Data

1. **Use the Map Builder Tool** to design your map visually
2. **Export JSON** file to `dev/js/data/maps/your-map.json`
3. **Export .tw file** for passage stubs
4. **Import both files** if using the dual-file import feature

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
    <div class="map-legend">
      <h4>Legend</h4>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-color" style="background: #007bff;"></span>
          <span>Current Location</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #ffc107;"></span>
          <span>Entry Point</span>
        </div>
      </div>
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
    // Load your first map with optional entry point
    MapSystem.setCurrentMap('your-map-id', null, 'entry-default');
});
<</script>>
```

### Step 4: Create Passage Integration

In each location passage:

```html
:: LocationPassage
You are in the village square. The bustling marketplace surrounds you.

<<if MapSystem.currentMap>>
    <!-- Display current location info -->
    <div class="location-info">
        <strong>Location:</strong> <<print $world.locationName>><br>
        <strong>Region:</strong> <<print MapSystem.currentMap.region>><br>
        <strong>Tags:</strong> <<print MapSystem.getCurrentNodeTags().join(", ")>>
    </div>
<</if>>

<!-- Check for special conditions -->
<<if MapSystem.currentLocationHasTag('shop')>>
    [[Browse Wares|ShopInterface]]
<</if>>

<<if MapSystem.currentLocationHasTag('dangerous')>>
    <span class="warning">This area is dangerous!</span>
<</if>>
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

#### `MapSystem.setCurrentMap(mapId, position, entryPoint)`
```javascript
// Set active map with entry point
await MapSystem.setCurrentMap('village-map', null, 'entry-east');

// Or with specific position
await MapSystem.setCurrentMap('village-map', { x: 5, y: 3 });
```

#### `MapSystem.movePlayer(direction)`
```javascript
// Move player programmatically
const success = await MapSystem.movePlayer('north');
```

### Enhanced Methods

#### `MapSystem.getNodesByTag(tag)`
```javascript
// Find all nodes with specific tag
const shops = MapSystem.getNodesByTag('shop');
```

#### `MapSystem.currentLocationHasTag(tag)`
```javascript
// Check if current location has tag
if (MapSystem.currentLocationHasTag('safe')) {
    // Heal player
}
```

#### `MapSystem.teleportToEntryPoint(entryType)`
```javascript
// Teleport to specific entry point
MapSystem.teleportToEntryPoint('entry-teleport');
```

#### `MapSystem.getMapMetadata()`
```javascript
// Get comprehensive map information
const metadata = MapSystem.getMapMetadata();
console.log(metadata.region, metadata.tagCounts);
```

#### `MapSystem.getEffectiveNodeData(x, y)`
```javascript
// Get node data with conditions applied
const nodeData = MapSystem.getEffectiveNodeData(5, 3);
```

### Utility Methods

#### `MapSystem.canAccessRegion(region)`
```javascript
// Check region access
if (MapSystem.canAccessRegion('restricted')) {
    // Allow access
}
```

#### `MapSystem.getPassageText(nodeKey)`
```javascript
// Get stored passage text
const text = MapSystem.getPassageText('5,3');
```

#### `MapSystem.getCurrentNodeTags()`
```javascript
// Get tags for current location
const tags = MapSystem.getCurrentNodeTags();
```

---

## Advanced Features

### 1. Dynamic Entry Points

Use entry points for context-aware map transitions:

```javascript
// From eastern road
<<link "Enter City">>
    <<script>>
    MapSystem.setCurrentMap('city-map', null, 'entry-east');
    <</script>>
<</link>>

// From teleportation
<<link "Teleport to City">>
    <<script>>
    MapSystem.setCurrentMap('city-map', null, 'entry-teleport');
    <</script>>
<</link>>
```

### 2. Tag-Based Events

Trigger events based on location tags:

```javascript
// In StoryCaption or header passage
<<if MapSystem.currentLocationHasTag('shop')>>
    <<set $canShop = true>>
<<else>>
    <<set $canShop = false>>
<</if>>

<<if MapSystem.currentLocationHasTag('dangerous')>>
    <<if random(1, 10) <= 3>>
        <<goto "RandomEncounter">>
    <</if>>
<</if>>
```

### 3. Conditional Node States

Nodes can change based on game state:

```json
{
  "conditions": [
    {
      "type": "variable",
      "name": "timeOfDay",
      "operator": "==",
      "value": "night",
      "name": "Shop (Closed)",
      "icon": "lock",
      "passage": "ShopClosed"
    }
  ]
}
```

### 4. Complex Transition Logic

Transitions with dynamic conditions:

```json
{
  "transitions": {
    "north": {
      "type": "locked",
      "conditions": [
        {
          "action": "changeIf",
          "type": "variable",
          "name": "bridgeRepaired",
          "operator": "==",
          "value": true,
          "changeTarget": "bidirectional"
        }
      ]
    }
  }
}
```

### 5. Visual Feedback Integration

Use CSS classes for dynamic styling:

```css
/* Highlight safe zones */
.tile-node.tag-safe {
    box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
}

/* Warning for dangerous areas */
.tile-node.tag-dangerous {
    animation: pulse-danger 2s infinite;
}

@keyframes pulse-danger {
    0%, 100% { box-shadow: 0 0 5px rgba(255, 0, 0, 0.5); }
    50% { box-shadow: 0 0 20px rgba(255, 0, 0, 0.8); }
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
- Verify map data includes all required fields

#### 2. Transitions Not Showing
**Problem**: Transition arrows/indicators missing
**Solutions**:
- Check transition format in JSON matches new structure
- Verify CSS includes transition indicator styles
- Ensure `updateTransitionConnectors()` is called after import
- Check that transition types are valid

#### 3. Entry Points Not Working
**Problem**: Player spawns at wrong location
**Solutions**:
- Verify entry point tags are correctly set
- Check `entryPointRegistry` in map data
- Ensure node has `entry-` prefixed tag
- Verify `setCurrentMap()` includes entry point parameter

#### 4. Tags Not Applying
**Problem**: Tag-based logic not working
**Solutions**:
- Check tags array in node data
- Verify tag names are consistent
- Ensure `projectTagLibrary` is populated
- Check CSS classes match tag format

#### 5. Styles Not Rendering
**Problem**: Node colors/patterns not showing
**Solutions**:
- Verify style object format in node data
- Check CSS includes pattern classes
- Ensure `applyAllNodeStyling()` is called
- Verify color values are valid hex codes

### Debug Commands

```javascript
// Check current map state
console.log(MapSystem.currentMap);
console.log(MapSystem.getCurrentNodeTags());
console.log(MapSystem.getMapMetadata());

// Test entry points
console.log(MapSystem.getAvailableEntryPoints());
MapSystem.teleportToEntryPoint('entry-default');

// Validate transitions
const node = MapSystem.getNodeAt(5, 3);
console.log(node.transitions);

// Check tag library
console.log(Array.from(MapSystem.currentMap.projectTagLibrary));
```

---

## Examples

### Example 1: City Map with Entry Points

```json
{
  "mapId": "city",
  "name": "Grand City",
  "region": "urban",
  "gridSize": { "width": 10, "height": 10 },
  "nodes": [
    {
      "column": 1,
      "row": 5,
      "name": "East Gate",
      "passage": "CityEastGate",
      "icon": "door-open",
      "tags": ["exterior", "entry-east", "guarded"],
      "transitions": {
        "west": { "type": "bidirectional" }
      }
    },
    {
      "column": 5,
      "row": 5,
      "name": "Market Square",
      "passage": "MarketSquare",
      "icon": "shopping-bag",
      "tags": ["public", "shop", "crowded"],
      "style": {
        "primaryColor": "#FFD700",
        "pattern": "dots"
      }
    }
  ],
  "entryPointRegistry": {
    "entry-east": "1,5",
    "entry-west": "9,5",
    "entry-teleport": "5,5"
  }
}
```

### Example 2: Dungeon with Conditional Transitions

```json
{
  "mapId": "dungeon",
  "name": "Ancient Crypt",
  "region": "underground",
  "fogOfWar": true,
  "nodes": [
    {
      "column": 3,
      "row": 3,
      "name": "Sealed Chamber",
      "passage": "SealedChamber",
      "icon": "lock",
      "tags": ["interior", "dangerous", "treasure"],
      "conditions": [
        {
          "type": "item",
          "name": "ancient_key",
          "operator": ">=",
          "value": 1,
          "name": "Ancient Treasury",
          "icon": "coins",
          "passage": "Treasury"
        }
      ],
      "transitions": {
        "north": {
          "type": "locked",
          "conditions": [
            {
              "action": "changeIf",
              "type": "variable",
              "name": "leverPulled",
              "operator": "==",
              "value": true,
              "changeTarget": "bidirectional"
            }
          ]
        }
      }
    }
  ]
}
```

### Example 3: Dynamic Day/Night Map

```javascript
// In passage
:: TownSquare
<<set _currentHour = $gameTime.hour>>
<<set _isDaytime = _currentHour >= 6 && _currentHour <= 18>>

<<if _isDaytime>>
    The town square bustles with activity. Merchants hawk their wares.
    <<if MapSystem.currentLocationHasTag('shop')>>
        [[Visit Shops|ShoppingInterface]]
    <</if>>
<<else>>
    The square is quiet and dark. Most shops are closed.
    <<if MapSystem.currentLocationHasTag('tavern')>>
        The tavern remains open, light spilling from its windows.
        [[Enter Tavern|TavernInterior]]
    <</if>>
<</if>>

<!-- Apply time-based styling -->
<<script>>
const hour = State.variables.gameTime.hour;
const isDark = hour < 6 || hour > 18;
$('.current-node').toggleClass('nighttime', isDark);
<</script>>
```

---

## Migration Guide

### From Basic to Enhanced System

1. **Update Map Data Format**:
   - Change `x/y` to `column/row` (optional, both supported)
   - Add `tags` arrays to nodes
   - Add `style` objects for visual customization
   - Include `entryPointRegistry` at map level
   - Add `passageTexts` for content storage

2. **Update Transitions**:
   - Convert old transition format to direction-based object
   - Add condition arrays to transitions
   - Support new transition types (locked, secret)

3. **Enhance Passages**:
   - Add tag-based logic checks
   - Implement entry point spawning
   - Use new utility functions

4. **Update Styling**:
   - Include new CSS pattern classes
   - Add tag-based styling rules
   - Support dynamic color application

### Backward Compatibility

The enhanced system maintains full backward compatibility:
- Old coordinate formats (`x/y`) still work
- Simple transitions auto-convert to new format
- Missing features default gracefully
- Legacy condition formats are supported

---

## Conclusion

The Enhanced Twine Map System provides a robust, feature-rich foundation for creating complex, interactive maps in Twine games. With support for entry points, tags, visual styling, and advanced conditions, it enables sophisticated gameplay mechanics while maintaining ease of use.

The system integrates seamlessly with the Map Builder Tool, allowing visual creation and editing of maps with full feature support. The combination of visual feedback, flexible navigation, and rich metadata creates engaging exploration experiences.

For additional support or advanced customization, refer to the source code comments and the Map Builder Tool documentation.

---

**Version**: 1.0  
**Compatible with**: Twine 2.3+, SugarCube 2.30+  
**Dependencies**: Lucide Icons (CDN), jQuery (included with SugarCube)  
**License**: Free for any use
**Map Builder Tool**: Included for visual map creation and editing