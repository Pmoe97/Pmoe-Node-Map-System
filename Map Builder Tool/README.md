# Twine Map Editor

A local web-based map editor for creating structured map data for Twine 2 / SugarCube 2 projects.

## Features

### Core Functionality
- **100% Static**: No server backend required - runs entirely in your browser
- **Visual Grid Editor**: Create maps on a customizable grid layout (3x3 to 20x20)
- **Enhanced Node Editing**: Add names, passage references, icons, fog-of-war, and dynamic conditions
- **Advanced Transition System**: Create bidirectional or one-way transitions with complex conditions
- **Dual Export System**: Generate both JSON map files and Twine .tw passage files
- **Import/Export**: Load existing maps for editing and export in multiple formats

### User Experience Enhancements
- **Node Memory**: Unsaved changes persist when switching between nodes
- **Auto-save**: Automatic backup to localStorage every 30 seconds
- **Larger Transition Connectors**: More clickable and user-friendly interface
- **Dark/Light Theme**: Toggle between themes with persistent preference
- **Responsive Design**: Works on desktop and mobile devices

### Advanced Features
- **Node Conditions**: Add dynamic content conditions for changing map behavior
- **Transition Conditions**: Complex unlock requirements (items, quests, variables)
- **Passage Generation**: Auto-generate Twine passage stubs for all map content
- **Memory Persistence**: Form data preserved when navigating between nodes
- **Visual Feedback**: Enhanced connectors show transition types and conditions
- **Professional Passage Editor**: WYSIWYG editor with Visual, Code, and Preview modes for writing SugarCube passages

## Getting Started

1. Open `index.html` in your web browser
2. Set your map name, width, and height in the initial setup dialog
3. Click on grid cells to edit nodes
4. Click on connectors between cells to edit transitions
5. Export your completed map as JSON

## Usage Guide

### Creating a New Map

When you first open the editor or click "New Map":
1. Enter a **Map Name** (used for the exported filename)
2. Set **Map Width** (3-20 columns)
3. Set **Map Height** (3-20 rows)
4. Click "Create Map"

### Editing Nodes

Click on any grid cell to open the node editor:

- **Node Name**: Display name for the location
- **Passage Name**: Reference to your Twine passage
- **Icon**: Select from predefined Lucide icons
- **Fog of War**: Toggle to hide/reveal the node initially

### Creating Transitions

Click on the blue connectors between cells to create transitions:

- **Bidirectional**: Players can move in both directions (default)
- **One-way**: Movement restricted to one direction
- **Conditions**: Add requirements to unlock the transition
  - **Item**: Player must have a specific item
  - **Quest**: Player must have completed a quest
  - **Variable**: Check a game variable's value

### Editing Passage Text

Each node can open the **Professional Passage Editor**. Use this tool to craft passages with a friendly Visual view, a Preview, and a raw **Code** view that now displays SugarCube macros without HTML escaping.

### Exporting Maps

Click "Export JSON" to download your map data. The exported file includes:

```json
{
  "mapId": "example_map",
  "name": "Example Map",
  "defaultStart": { "x": 5, "y": 3 },
  "nodes": [
    {
      "column": 5,
      "row": 3,
      "name": "Merchant Thoroughfare",
      "passage": "Merchant_Thoroughfare",
      "icon": "store",
      "fogOfWar": false,
      "transitions": {
        "north": {
          "type": "bi",
          "conditions": []
        },
        "east": {
          "type": "oneway",
          "conditions": [
            {
              "type": "item",
              "item": "silver_key"
            }
          ]
        }
      }
    }
  ]
}
```

## Keyboard Shortcuts

- **Escape**: Close sidebar/modal
- **Theme Toggle**: Click the moon/sun icon in the toolbar

## Browser Compatibility

This editor works in all modern browsers:
- Chrome/Chromium
- Firefox
- Safari
- Edge

## File Structure

```
twine-map-editor/
├── index.html      # Main application file
├── styles.css      # Styling and themes
├── main.js         # Application logic
└── README.md       # This file
```

## Technical Details

### Dependencies

- **Lucide Icons**: Loaded via CDN for node icons
- **No Frameworks**: Built with vanilla HTML, CSS, and JavaScript

### Data Storage

- **Theme Preference**: Saved to localStorage
- **Map Data**: Stored in memory (export to save permanently)

### Export Format

The exported JSON is designed to integrate seamlessly with SugarCube 2 map systems. Each node contains:

- Position coordinates (column, row)
- Display information (name, icon, fog-of-war)
- Passage reference for Twine integration
- Transition data with conditions

## Tips for Use

1. **Plan Your Layout**: Sketch your map before starting to determine optimal grid size
2. **Consistent Naming**: Use clear, consistent names for nodes and passages
3. **Test Transitions**: Verify all connections work as expected before exporting
4. **Save Frequently**: Export your work regularly as there's no auto-save
5. **Icon Selection**: Choose icons that clearly represent each location type

## Integration with Twine/SugarCube

The exported JSON can be loaded into your SugarCube project using:

```javascript
// Load the map data
const mapData = /* your exported JSON */;

// Initialize your map system
MapSystem.loadMap(mapData);
```

## Troubleshooting

### Icons Not Displaying
- Ensure you have an internet connection (Lucide icons load from CDN)
- Try refreshing the page

### Export Not Working
- Check that you have at least one node with data
- Ensure your browser allows file downloads

### Grid Too Small/Large
- Create a new map with different dimensions
- Recommended sizes: 5x5 to 15x15 for most projects

## Contributing

This is a standalone tool designed for the Twine community. Feel free to modify and distribute as needed.

## License

Free to use and modify for any purpose.
