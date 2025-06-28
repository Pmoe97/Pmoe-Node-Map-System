# Twine Map Builder Tool

A visual editor for creating and managing grid-based maps for Twine 2 / SugarCube 2 projects. This tool provides a comprehensive interface for designing interactive game maps with nodes, transitions, conditions, and rich passage content.

![Map Builder Interface](screenshot-placeholder.png)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
- [Interface Guide](#interface-guide)
- [Core Functionality](#core-functionality)
- [Advanced Features](#advanced-features)
- [Import/Export](#importexport)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tips & Best Practices](#tips--best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The Twine Map Builder Tool is a standalone web application that allows game developers to visually create and edit node-based maps for their Twine games. It generates JSON map data and Twine passage files that integrate seamlessly with the Enhanced Twine Map System.

### Key Benefits

- **Visual Editing**: Design maps using a intuitive grid interface
- **Real-time Preview**: See your map as players will experience it
- **Rich Content Editing**: Built-in passage editor with WYSIWYG support
- **Conditional Logic**: Create dynamic maps that respond to game state
- **Export Ready**: Generate files that work directly with your Twine project

## Features

### Core Features
- ✅ Grid-based map creation (up to 20x20)
- ✅ Visual node editing with icons and colors
- ✅ Directional transitions with multiple types
- ✅ Fog of war support
- ✅ Undo/redo functionality
- ✅ Dark/light theme toggle

### Enhanced Features
- ✅ **Tag System**: Categorize locations with dynamic tags
- ✅ **Entry Points**: Define multiple spawn locations
- ✅ **Conditional Nodes**: Nodes that change based on game state
- ✅ **Style Patterns**: Visual patterns and custom colors
- ✅ **Passage Editor**: Professional text editor with visual/code modes
- ✅ **Bulk Operations**: Select and edit multiple nodes at once
- ✅ **Advanced Navigation**: Pan, zoom, and keyboard controls

### Import/Export
- ✅ JSON map export with full data preservation
- ✅ Twine passage (.tw) file generation
- ✅ Dual-file import system
- ✅ Map merging capabilities
- ✅ Placement mode for importing map sections

## Getting Started

### Installation

1. **Download the Map Builder Tool**
   ```
   Map Builder Tool/
   ├── index.html
   ├── main.js
   ├── styles.css
   └── README.md
   ```

2. **Open in Browser**
   - Open `index.html` in a modern web browser (Chrome, Firefox, Edge recommended)
   - No server required - runs entirely in the browser

### Creating Your First Map

1. **Start a New Map**
   - Enter a map name (e.g., "Village Map")
   - Set dimensions (width × height)
   - Click "Create Map"

2. **Add Nodes**
   - Click any grid cell to open the node editor
   - Fill in:
     - **Node Name**: Display name (e.g., "Town Square")
     - **Passage Name**: Twine passage link (e.g., "TownSquare")
     - **Icon**: Choose from 100+ Lucide icons
     - **Tags**: Add descriptive tags

3. **Create Transitions**
   - In the node editor, set transition types for each direction
   - Options: None, Bidirectional, One-Way, Locked, Secret
   - Add conditions to transitions for dynamic gameplay

4. **Export Your Map**
   - Click "Export JSON" for the map structure
   - Click "Export .tw" for Twine passages

## Interface Guide

### Main Toolbar

| Button | Function | Shortcut |
|--------|----------|----------|
| ↶ Undo | Undo last action | Ctrl+Z |
| ↷ Redo | Redo action | Ctrl+Y |
| New Map | Start fresh map | - |
| Import Map | Load existing map | - |
| Export JSON | Save map data | - |
| Export .tw | Generate passages | - |
| 🌙/☀️ | Toggle theme | - |
| ❔ | Navigation help | - |

### Map Grid

The central grid is where you design your map:
- **Click** a cell to edit its node
- **Ctrl+Click** to select multiple nodes
- **Middle Mouse** to pan the view
- **Ctrl+Scroll** to zoom in/out
- **Arrow Keys** to navigate

### Node Editor Sidebar

When editing a node, you can set:

#### Basic Properties
- **Node Name**: Displayed on the map
- **Passage Name**: Links to Twine passage
- **Icon**: Visual representation
- **Fog of War**: Hidden until discovered

#### Tags
- Type to see suggestions
- Tags enable gameplay logic
- Common tags: `interior`, `shop`, `dangerous`, `safe`

#### Entry Points
- Mark nodes as spawn locations
- Types: Default, North, South, East, West, Teleport, etc.
- Only one node per entry type

#### Style
- **Primary Color**: Main node color
- **Secondary Color**: Accent color
- **Pattern**: Visual patterns (stripes, dots, grid, etc.)

#### Transitions
- Set movement rules for each direction
- Add conditions for locked paths
- Create one-way passages

#### Node Conditions
- Define alternate states based on game variables
- Change appearance dynamically
- Support for items, quests, variables, and time

## Core Functionality

### Node Management

#### Creating Nodes
1. Click empty grid cell
2. Fill in node details
3. Choose icon and colors
4. Click "Save Node"

#### Editing Nodes
1. Click existing node
2. Modify properties
3. Changes auto-save to memory
4. Click "Save Node" to commit

#### Clearing Nodes
- Click "Clear Node" to remove all data
- Transitions to this node are preserved

### Transition System

#### Transition Types

| Type | Description | Visual |
|------|-------------|--------|
| None | No connection | No line |
| Bidirectional | Two-way travel | Solid line |
| One-Way | Directional travel | Arrow |
| Locked | Requires conditions | Dashed line |
| Secret | Hidden passage | Invisible |

#### Adding Conditions
1. Select transition direction
2. Click "Edit Conditions"
3. Choose condition type:
   - **Item**: Requires specific items
   - **Quest**: Based on quest progress
   - **Variable**: Check game variables
4. Set operators and values

### Tag System

Tags categorize locations and enable gameplay mechanics:

#### Using Tags
- Start typing to see suggestions
- Tags auto-complete from project library
- Create new tags by typing and pressing Enter
- Remove tags by clicking the × on tag chips

#### Special Tags
- `entry-default`: Default spawn point
- `shop`: Commerce locations
- `dangerous`: Combat zones
- `safe`: No-combat areas
- `interior`/`exterior`: Environment types

### Style Customization

#### Color Picker
- Click color swatches to choose
- Recent colors are saved
- Hex input for precise colors

#### Patterns
- **Diagonal Stripes**: Classic pattern
- **Dots**: Polka dot pattern
- **Grid**: Crosshatch pattern
- **Checkerboard**: Alternating squares
- **Vertical/Horizontal Stripes**: Line patterns

## Advanced Features

### Professional Passage Editor

Access the passage editor by clicking "Edit Passage Text" in any node.

#### Three View Modes

1. **Visual Mode** (WYSIWYG)
   - Format text visually
   - Add interactive elements
   - See formatted preview

2. **Code Mode**
   - Direct Twine/SugarCube syntax
   - Syntax highlighting
   - Format code button

3. **Preview Mode**
   - See how players experience it
   - Test interactive elements
   - Check conditional logic

#### Editor Features

##### Text Formatting
- **Bold**: Ctrl+B or **text**
- **Italic**: Ctrl+I or *text*
- **Links**: [[Passage Name]]

##### Interactive Macros
- **Replace**: Click to replace content
- **Append**: Click to add content
- **Clear**: Click to remove content

##### Advanced Tools
- **Conditional Logic**: If/else branches
- **Variables**: Set game state
- **Audio**: Sound effects and music
- **Span Wrapping**: Target specific text

### Bulk Operations

1. **Select Multiple Nodes**
   - Hold Ctrl and click nodes
   - Or right-click and drag

2. **Bulk Actions**
   - Delete selected nodes
   - Copy/paste groups
   - Apply common properties

### Navigation Controls

| Action | Control |
|--------|---------|
| Pan | Middle mouse drag |
| Zoom | Ctrl + scroll wheel |
| Navigate | Arrow keys |
| Select Multiple | Ctrl + click |
| Box Select | Right-click + drag |
| Clear Selection | Esc |

### Map Loading Animation

When importing large maps, enjoy a visual loading animation:
- Gradient border effect
- Progress updates
- Non-blocking processing

## Import/Export

### Exporting Maps

#### JSON Export (Complete Data)
```json
{
  "mapId": "village_map",
  "name": "Village Map",
  "gridSize": { "width": 10, "height": 10 },
  "nodes": [...],
  "passageTexts": {...},
  "projectTagLibrary": [...],
  "entryPointRegistry": {...}
}
```

#### Twine Export (.tw file)
```
:: Start
<<set $player.mapState.currentMapId = "village_map">>
<<set $player.mapState.position = {x: 1, y: 1}>>

:: TownSquare
You stand in the bustling town square...

:: Inn
The cozy inn welcomes weary travelers...
```

### Importing Maps

#### Single File Import
1. Click "Import Map"
2. Select your .json file
3. Choose import method:
   - **Fresh Workspace**: Replace current
   - **Add to Workspace**: Merge maps

#### Dual File Import
1. Import .json structure
2. Optionally upload .tw for passages
3. System merges both files

#### Placement Mode
When adding to existing map:
1. Preview shows import overlay
2. Click to position
3. Confirm placement

## Keyboard Shortcuts

### Global Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Arrow Keys | Navigate map |
| Esc | Close modals/Clear selection |

### Passage Editor Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+S | Save passage |

## Tips & Best Practices

### Map Design
1. **Plan Your Layout**: Sketch on paper first
2. **Use Consistent Naming**: PassageName matches node names
3. **Tag Everything**: Makes filtering easier later
4. **Color Code**: Use colors to indicate area types

### Performance
1. **Reasonable Size**: 10×10 works well, 20×20 maximum
2. **Save Often**: Export regularly
3. **Test Imports**: Verify your exports work

### Organization
1. **Entry Points**: Always set at least one
2. **Transitions**: Think about player flow
3. **Conditions**: Don't over-complicate

## Troubleshooting

### Common Issues

#### Map Won't Load
- Check JSON syntax
- Verify file isn't corrupted
- Ensure all required fields present

#### Transitions Not Showing
- Verify both nodes exist
- Check transition type isn't "none"
- Ensure grid bounds are correct

#### Icons Not Displaying
- Internet connection required (Lucide CDN)
- Try refreshing the page

#### Passage Text Lost
- Always export .tw files
- Use dual import for complete restore
- Check browser console for errors

### Browser Compatibility
- **Recommended**: Chrome, Firefox, Edge (latest)
- **Minimum**: ES6 support required
- **Not Supported**: Internet Explorer

### Data Recovery
The tool saves to browser memory:
1. Unsaved changes persist during session
2. Export regularly to preserve work
3. Use version control for map files

## Version History

### v2.0
- Conditional nodes
- Style patterns
- Improved import/export
- Professional passage editor
- Enhanced tag system
- Entry point management
- Bulk operations
- Loading animations

### v1.0
- Initial release
- Basic map creation
- Simple transitions

---

**Created for**: Twine 2 / SugarCube 2  
**License**: Free for any use  
**Support**: See implementation guide for integration help