// Global state
let mapData = {
    name: '',
    width: 0,
    height: 0,
    nodes: new Map(),
    transitions: new Map()
};

let currentEditingNode = null;
let currentEditingTransition = null;
let isDarkTheme = false;

// Node memory for unsaved changes
let nodeMemory = new Map();

// Undo/Redo system
let undoStack = [];
let redoStack = [];
const MAX_UNDO_HISTORY = 10;

// Passage text storage
let passageTexts = new Map(); // nodeKey -> {main: string, conditions: {conditionId: string}}
let currentEditingPassage = null;

// Auto-save functionality
let autoSaveInterval = null;
const AUTO_SAVE_DELAY = 2000; // 2 seconds

// Condition modal context
let conditionModalContext = null; // 'node' or 'transition'

// Import placement state
let placementMode = false;
let pendingImportData = null;
let placementPreviewData = null;

// Dual file import state
let pendingTwineImport = null;
let twineFileContent = null;

// NEW: Dynamic Tag Library System
let projectTagLibrary = new Set(); // Dynamic library that grows with usage
let selectedTags = new Set(); // Currently selected tags for the node being edited
let tagSuggestionIndex = -1; // For keyboard navigation in suggestions

// NEW: Entry Point Management
let entryPointRegistry = new Map(); // entryType -> nodeKey mapping

// NEW: Navigation and interaction state
let mapViewState = {
    panX: 0,
    panY: 0,
    zoom: 1,
    minZoom: 0.5,
    maxZoom: 2.0
};

let navigationState = {
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,
    isSelecting: false,
    selectionStart: { x: 0, y: 0 },
    selectionEnd: { x: 0, y: 0 },
    selectedNodes: new Set()
};

let selectionBox = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('twine-map-editor-theme');
    if (savedTheme === 'dark') {
        toggleTheme();
    }
    
    // Initialize color picker for condition modal
    updateConditionModalWithColorPicker();
    
    // Only show setup modal if no autosave was restored
    if (mapData.nodes.size === 0) {
        showSetupModal();
    }
}

function setupEventListeners() {
    // Setup form
    document.getElementById('setupForm').addEventListener('submit', handleSetupSubmit);
    
    // Toolbar buttons
    document.getElementById('newMapBtn').addEventListener('click', showSetupModal);
    document.getElementById('importBtn').addEventListener('click', importMap);
    document.getElementById('importMapFromStart').addEventListener('click', importMap);
    document.getElementById('exportBtn').addEventListener('click', exportMap);
    document.getElementById('exportTwBtn').addEventListener('click', exportTwineFile);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('undoBtn').addEventListener('click', performUndo);
    document.getElementById('redoBtn').addEventListener('click', performRedo);
    document.getElementById("navHelpToggle").addEventListener("click", () => {
    const panel = document.getElementById("navigationHints");
    panel.classList.toggle("hidden");
    });

    // Passage text editor
    document.getElementById('editPassageText').addEventListener('click', openPassageTextEditor);
    document.getElementById('closePassageEditor').addEventListener('click', closePassageTextEditor);
    document.getElementById('savePassageText').addEventListener('click', savePassageText);
    document.getElementById('cancelPassageText').addEventListener('click', closePassageTextEditor);
    
    // Style controls
    setupStyleControls();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // File input for importing
    document.getElementById('fileInput').addEventListener('change', handleFileImport);
    document.getElementById('twFileInput').addEventListener('change', handleTwineFileImport);
    
    // Twine file upload modal listeners
    setupTwineFileModalListeners();
    
    // Sidebar
    document.getElementById('closeSidebar').addEventListener('click', closeSidebar);
    document.getElementById('saveNode').addEventListener('click', saveNode);
    document.getElementById('clearNode').addEventListener('click', clearNode);
    document.getElementById('saveTransition').addEventListener('click', saveTransition);
    document.getElementById('removeTransition').addEventListener('click', removeTransition);

    // Transition type change
    document.getElementById('transitionType').addEventListener('change', handleTransitionTypeChange);

    // Directional transition controls
    ['north','west','east','south'].forEach(dir => {
        document.getElementById(`transition-${dir}`).addEventListener('change', () => handleTransitionSelect(dir));
    });
    document.querySelectorAll('.edit-direction-conditions').forEach(btn => {
        btn.addEventListener('click', () => openDirectionConditions(btn.dataset.direction));
    });
    
    // Transition condition management
    document.getElementById('addCondition').addEventListener('click', () => showConditionModal('transition'));
   
    document.getElementById('conditionForm').addEventListener('submit', handleConditionSubmit);


    document.getElementById('cancelCondition').addEventListener('click', hideConditionModal);
    document.getElementById('conditionAction').addEventListener('change', handleConditionActionChange);
    
    // Node condition management
    document.getElementById('addNodeCondition').addEventListener('click', () => showNodeConditionModal());
    document.getElementById('nodeConditionForm').addEventListener('submit', handleNodeConditionSubmit);
    document.getElementById('cancelNodeCondition').addEventListener('click', hideNodeConditionModal);
    
    // Node memory - save form data on input
    setupNodeMemoryListeners();
    
    // Auto-save setup
    setupAutoSave();
    
    // Import choice modal event listeners
    setupImportChoiceListeners();
    
    // Placement mode event listeners
    setupPlacementListeners();
    
    // NEW: Navigation and interaction event listeners
    setupNavigationListeners();
    
    // NEW: Tag system and entry point listeners
    setupTagSystemListeners();
    setupEntryPointListeners();
}

function showSetupModal() {
    document.getElementById('setupModal').classList.remove('hidden');
    document.getElementById('mainInterface').classList.add('hidden');
}

function hideSetupModal() {
    document.getElementById('setupModal').classList.add('hidden');
    document.getElementById('mainInterface').classList.remove('hidden');
}

function handleSetupSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('mapName').value.trim();
    const width = parseInt(document.getElementById('mapWidth').value);
    const height = parseInt(document.getElementById('mapHeight').value);
    
    if (!name || width < 3 || height < 3) {
        alert('Please provide valid map details (minimum 3x3 grid)');
        return;
    }
    
    createNewMap(name, width, height);
    hideSetupModal();
}

function createNewMap(name, width, height) {
    mapData = {
        name: name,
        width: width,
        height: height,
        nodes: new Map(),
        transitions: new Map()
    };
    
    document.getElementById('mapTitle').textContent = `Twine Map Editor - ${name}`;
    generateGrid();
    applyAllNodeStyling();
    closeSidebar();
}

function generateGrid() {
    const grid = document.getElementById('mapGrid');
    grid.innerHTML = '';
    
    // Set grid template
    grid.style.gridTemplateColumns = `repeat(${mapData.width}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${mapData.height}, 1fr)`;
    
    // Create cells
    for (let row = 0; row < mapData.height; row++) {
        for (let col = 0; col < mapData.width; col++) {
            const cell = createGridCell(col, row);
            grid.appendChild(cell);
        }
    }
    
    // Re-setup cell click handlers for Ctrl+Click selection
    setupCellClickHandlers();
}

function createGridCell(col, row) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.col = col;
    cell.dataset.row = row;
    
    // Add click handler for node editing - pass the event
    cell.addEventListener('click', (event) => editNode(col, row, event));
    
    // Create transition connectors
    createTransitionConnectors(cell, col, row);
    
    updateCellDisplay(cell, col, row);
    
    return cell;
}

function createTransitionConnectors(cell, col, row) {
    // Right connector
    if (col < mapData.width - 1) {
        const rightConnector = document.createElement('div');
        rightConnector.className = 'transition-connector horizontal right';
        cell.appendChild(rightConnector);
    }
    
    // Bottom connector
    if (row < mapData.height - 1) {
        const bottomConnector = document.createElement('div');
        bottomConnector.className = 'transition-connector vertical bottom';
        cell.appendChild(bottomConnector);
    }
}

function updateCellDisplay(cell, col, row) {
    const nodeKey = `${col},${row}`;
    const nodeData = mapData.nodes.get(nodeKey);

    // Clear old content
    cell.innerHTML = '';

    // Remove pattern classes and inline styling
    cell.classList.remove(
        'node-pattern-diagonal-stripes', 'node-pattern-vertical-stripes',
        'node-pattern-horizontal-stripes', 'node-pattern-dots',
        'node-pattern-grid', 'node-pattern-checkerboard'
    );
    cell.style.backgroundColor = '';
    cell.style.removeProperty('--node-primary-color');
    cell.style.removeProperty('--node-secondary-color');

    // Add transition connectors
    createTransitionConnectors(cell, col, row);

    if (nodeData) {
        cell.classList.add('filled');

        // Apply styling
        applyNodeStyling(cell, nodeData);

        // Apply fog of war
        if (nodeData.fogOfWar) {
            cell.classList.add('fog-of-war');
        } else {
            cell.classList.remove('fog-of-war');
        }

        // Create content
        const content = document.createElement('div');
        content.className = 'node-content';

        // Icon
        if (nodeData.icon) {
            const iconElement = document.createElement('i');
            iconElement.setAttribute('data-lucide', nodeData.icon);
            iconElement.className = 'node-icon';
            content.appendChild(iconElement);
        }

        // Name
        if (nodeData.name) {
            const nameElement = document.createElement('div');
            nameElement.className = 'node-name';
            nameElement.textContent = nodeData.name;
            content.appendChild(nameElement);
        }

        // Coordinates
        const coordsElement = document.createElement('div');
        coordsElement.className = 'node-coords';
        coordsElement.textContent = `(${col},${row})`;
        content.appendChild(coordsElement);

        // Tags - handle both old and new format
        if (nodeData.tags && nodeData.tags.length > 0) {
            const tagsElement = document.createElement('div');
            tagsElement.className = 'node-tags';
            // Ensure we're working with an array
            const tagsArray = Array.isArray(nodeData.tags) ? nodeData.tags : [nodeData.tags];
            tagsElement.textContent = tagsArray.filter(tag => tag).join(', ');
            content.appendChild(tagsElement);
        }

        cell.appendChild(content);

        // Apply entry point styling
        if (nodeData.entryPoint) {
            cell.classList.add('entry-point');
        }

        // Re-render Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    } else {
        cell.classList.remove('filled', 'fog-of-war', 'entry-point');
        const emptyText = document.createElement('div');
        emptyText.className = 'empty-node-text';
        emptyText.textContent = `(${col},${row})`;
        cell.appendChild(emptyText);
    }

    // Ensure transition visuals are refreshed
    updateTransitionConnectors(col, row);
}


function updateTransitionConnectors(col, row) {
    const cell = document.querySelector(`[data-col="${col}"][data-row="${row}"]`);
    if (!cell) return;
    
    const connectors = cell.querySelectorAll('.transition-connector');
    
    connectors.forEach(connector => {
        // Remove all transition type classes
        connector.classList.remove('active', 'none', 'bidirectional', 'one-way', 'locked', 'secret');
        
        let targetCol, targetRow, direction;
        
        if (connector.classList.contains('right')) {
            targetCol = col + 1;
            targetRow = row;
            direction = 'east';
        } else if (connector.classList.contains('bottom')) {
            targetCol = col;
            targetRow = row + 1;
            direction = 'south';
        }
        
        const transitionKey = `${col},${row}-${targetCol},${targetRow}`;
        const reverseKey = `${targetCol},${targetRow}-${col},${row}`;
        
        const transition = mapData.transitions.get(transitionKey) || mapData.transitions.get(reverseKey);
        
        if (transition && transition.type !== 'none') {
            connector.classList.add('active');
            connector.classList.add(transition.type);
            
            // Special handling for secret transitions - they should be completely hidden
            if (transition.type === 'secret') {
                connector.style.display = 'none';
            } else {
                connector.style.display = '';
            }
        } else {
            // Show connector but mark as inactive for 'none' type
            connector.style.display = '';
            if (transition && transition.type === 'none') {
                connector.classList.add('none');
            }
        }
    });
}

function editNode(col, row, event) {
    // If Ctrl (Windows/Linux) or Command (Mac) is held, don't trigger edit panel
    if (event && (event.ctrlKey || event.metaKey)) return;

    saveState(`Edit node (${col},${row})`);

    currentEditingNode = { col, row };
    currentEditingTransition = null;

    const nodeKey = `${col},${row}`;
    const nodeData = mapData.nodes.get(nodeKey) || {};

    // Memory support
    selectedTags.clear(); // Clear current tags
    const loadedFromMemory = typeof loadNodeMemory === 'function' ? loadNodeMemory(col, row) : false;

    if (!loadedFromMemory) {
        // Populate form fields
        document.getElementById('nodeName').value = nodeData.name || '';
        document.getElementById('passageName').value = nodeData.passage || '';
        document.getElementById('nodeIcon').value = nodeData.icon || '';
        document.getElementById('fogOfWar').checked = nodeData.fogOfWar || false;
        
        // Load tags - handle both old array format and new format
        if (nodeData.tags) {
            loadTagsFromNodeData(nodeData.tags);
        }
        
        // Update icon selection UI
        if (window.updateIconSelection) {
            window.updateIconSelection(nodeData.icon || '');
        }

        // Update node conditions
        updateNodeConditionsList(nodeData.conditions || []);

        // Load colors into picker
        if (window.nodeColorPicker && nodeData.style) {
            window.nodeColorPicker.setColors(
                nodeData.style.primaryColor || '#007bff',
                nodeData.style.secondaryColor || '#6c757d'
            );
            document.getElementById('nodePattern').value = nodeData.style.pattern || 'none';
        }

        // Load entry point data
        if (nodeData.entryPoint) {
            loadEntryPointFromNodeData(nodeData);
        }
    }

    // Transition controls
    if (typeof populateTransitionControls === 'function') {
        populateTransitionControls(col, row);
    }

    // Show sidebar UI
    document.getElementById('nodeEditor').classList.remove('hidden');
    document.getElementById('transitionEditor').classList.add('hidden');
    document.getElementById('sidebarTitle').textContent = `Edit Node (${col},${row})`;
    document.getElementById('sidebar').classList.remove('hidden');
}

function loadNodeMemory(col, row) {
    const nodeKey = `${col},${row}`;
    const memory = nodeMemory.get(nodeKey);

    if (memory) {
        document.getElementById('nodeName').value = memory.name;
        document.getElementById('passageName').value = memory.passage;
        document.getElementById('nodeIcon').value = memory.icon;
        document.getElementById('fogOfWar').checked = memory.fogOfWar;
        
        // Load tags from memory
        if (memory.tags) {
            selectedTags.clear();
            if (Array.isArray(memory.tags)) {
                memory.tags.forEach(tag => {
                    selectedTags.add(tag);
                    projectTagLibrary.add(tag);
                });
            } else if (memory.tags instanceof Set) {
                memory.tags.forEach(tag => {
                    selectedTags.add(tag);
                    projectTagLibrary.add(tag);
                });
            }
            updateTagChipsDisplay();
        }
        
        updateNodeConditionsList(memory.conditions || []);

        // Load transitions
        document.getElementById('transition-north').value = memory.transitions.north;
        document.getElementById('transition-west').value = memory.transitions.west;
        document.getElementById('transition-east').value = memory.transitions.east;
        document.getElementById('transition-south').value = memory.transitions.south;

        if (window.updateIconSelection) {
            window.updateIconSelection(memory.icon || '');
        }

        return true;
    }
    return false;
}

function editTransition(fromCol, fromRow, toCol, toRow, direction) {
    currentEditingTransition = { fromCol, fromRow, toCol, toRow, direction };
    currentEditingNode = null;
    
    const transitionKey = `${fromCol},${fromRow}-${toCol},${toRow}`;
    const reverseKey = `${toCol},${toRow}-${fromCol},${fromRow}`;
    
    const transition = mapData.transitions.get(transitionKey) || mapData.transitions.get(reverseKey) || {
        type: 'none',
        conditions: []
    };
    
    // Populate form
    document.getElementById('transitionType').value = transition.type;
    document.getElementById('transitionDirection').value = direction;
    
    handleTransitionTypeChange();
    updateConditionsList(transition.conditions);
    
    // Show transition editor
    document.getElementById('nodeEditor').classList.add('hidden');
    document.getElementById('transitionEditor').classList.remove('hidden');
    document.getElementById('sidebarTitle').textContent = `Edit Transition (${fromCol},${fromRow}) → (${toCol},${toRow})`;
    document.getElementById('sidebar').classList.remove('hidden');
}

function handleTransitionTypeChange() {
    const type = document.getElementById('transitionType').value;
    const directionGroup = document.getElementById('directionGroup');
    
    if (type === 'one-way') {
        directionGroup.classList.remove('hidden');
    } else {
        directionGroup.classList.add('hidden');
    }
}

const directionOffsets = {
    north: [0, -1],
    south: [0, 1],
    east: [1, 0],
    west: [-1, 0]
};

function getOppositeDirection(dir) {
    switch (dir) {
        case 'north': return 'south';
        case 'south': return 'north';
        case 'east': return 'west';
        case 'west': return 'east';
    }
}

function handleTransitionSelect(dir) {
    if (!currentEditingNode) return;

    const value = document.getElementById(`transition-${dir}`).value;
    const { col, row } = currentEditingNode;
    const [dx, dy] = directionOffsets[dir];
    const tCol = col + dx;
    const tRow = row + dy;
    if (tCol < 0 || tCol >= mapData.width || tRow < 0 || tRow >= mapData.height) return;

    const key = `${col},${row}-${tCol},${tRow}`;
    const revKey = `${tCol},${tRow}-${col},${row}`;
    const existing = mapData.transitions.get(key) || mapData.transitions.get(revKey) || {};
    const conditions = existing.conditions || [];

    mapData.transitions.delete(key);
    mapData.transitions.delete(revKey);

    if (value === 'none') {
        // nothing
    } else if (value === 'bidirectional' || value === 'locked' || value === 'secret') {
        mapData.transitions.set(key, { type: value, direction: null, conditions });
    } else if (value === 'one-way-forward') {
        mapData.transitions.set(key, { type: 'one-way', direction: dir, conditions });
    } else if (value === 'one-way-back') {
        const opp = getOppositeDirection(dir);
        mapData.transitions.set(revKey, { type: 'one-way', direction: opp, conditions });
    }

    updateTransitionConnectors(col, row);
    updateTransitionConnectors(tCol, tRow);
}

function populateTransitionControls(col, row) {
    ['north','west','east','south'].forEach(dir => {
        const select = document.getElementById(`transition-${dir}`);
        const [dx, dy] = directionOffsets[dir];
        const tCol = col + dx;
        const tRow = row + dy;
        const key = `${col},${row}-${tCol},${tRow}`;
        const revKey = `${tCol},${tRow}-${col},${row}`;
        let value = 'none';
        let data = mapData.transitions.get(key);
        if (data) {
            if (data.type === 'one-way') value = 'one-way-forward';
            else value = data.type;
        } else {
            data = mapData.transitions.get(revKey);
            if (data) {
                if (data.type === 'one-way') value = 'one-way-back';
                else value = data.type;
            }
        }
        select.value = value;
    });
}

function ensureExtension(filename, ext) {
    return filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
}


function openDirectionConditions(dir) {
    if (!currentEditingNode) return;
    const { col, row } = currentEditingNode;
    const [dx, dy] = directionOffsets[dir];
    const tCol = col + dx;
    const tRow = row + dy;
    const key = `${col},${row}-${tCol},${tRow}`;
    const revKey = `${tCol},${tRow}-${col},${row}`;
    let transition = mapData.transitions.get(key);
    if (transition) {
        currentEditingTransition = { fromCol: col, fromRow: row, toCol: tCol, toRow: tRow, direction: dir };
    } else {
        transition = mapData.transitions.get(revKey);
        if (transition) {
            currentEditingTransition = { fromCol: tCol, fromRow: tRow, toCol: col, toRow: row, direction: transition.direction };
        } else {
            transition = { type: 'none', direction: dir, conditions: [] };
            currentEditingTransition = { fromCol: col, fromRow: row, toCol: tCol, toRow: tRow, direction: dir };
        }
    }

    document.getElementById('transitionType').value = transition.type;
    document.getElementById('transitionDirection').value = transition.direction || dir;
    handleTransitionTypeChange();
    updateConditionsList(transition.conditions);

    // disable type editing
    document.getElementById('transitionType').disabled = true;
    document.getElementById('nodeEditor').classList.add('hidden');
    document.getElementById('transitionEditor').classList.remove('hidden');
    document.getElementById('sidebarTitle').textContent = `Edit Conditions (${dir})`;
    document.getElementById('sidebar').classList.remove('hidden');
}

function saveNode({ useSelectedTags = false, updateTransitions = false, updateEntryPoints = false } = {}) {
    if (!currentEditingNode) return;

    const { col, row } = currentEditingNode;
    const nodeKey = `${col},${row}`;

    const name = document.getElementById('nodeName').value.trim();
    const passage = document.getElementById('passageName').value.trim();
    const icon = document.getElementById('nodeIcon').value;
    const fogOfWar = document.getElementById('fogOfWar').checked;

    // Always get tags from selectedTags Set
    const tags = Array.from(selectedTags);

    // Get style from new color picker
    let style = { primaryColor: '#007bff', secondaryColor: '#6c757d', pattern: 'none' };
    if (window.nodeColorPicker) {
        const colors = window.nodeColorPicker.getColors();
        const pattern = document.querySelector('#nodeColorPicker .pattern-select')?.value || 'none';
        style = {
            primaryColor: colors.primary,
            secondaryColor: colors.secondary,
            pattern: pattern
        };

        // Add colors to recent only when saving
        if (window.colorPickerSystem) {
            colorPickerSystem.addRecentColor(colors.primary);
            if (colors.secondary !== '#6c757d') {
                colorPickerSystem.addRecentColor(colors.secondary);
            }
        }
    }

    const conditions = getCurrentNodeConditions();

    const transitions = {
        north: document.getElementById('transition-north')?.value || '',
        west:  document.getElementById('transition-west')?.value || '',
        east:  document.getElementById('transition-east')?.value || '',
        south: document.getElementById('transition-south')?.value || ''
    };

    if (name || passage || icon || tags.length > 0) {
        setNodeData(col, row, {
            name,
            passage,
            icon,
            fogOfWar,
            tags,
            style,
            conditions,
            transitions: updateTransitions ? transitions : undefined
        });

        if (updateTransitions) {
            ['north','west','east','south'].forEach(dir => handleTransitionSelect(dir));
        }

        if (updateEntryPoints) {
            const entryTag = tags.find(tag => tag.startsWith('entry-'));
            if (entryTag) {
                const entryType = entryTag.substring(6);
                entryPointRegistry.set(entryType, nodeKey);
            } else {
                for (const [type, key] of entryPointRegistry) {
                    if (key === nodeKey) {
                        entryPointRegistry.delete(type);
                        break;
                    }
                }
            }
        }
    } else {
        mapData.nodes.delete(nodeKey);

        if (updateTransitions) {
            ['north','west','east','south'].forEach(dir => {
                const [dx, dy] = directionOffsets[dir];
                const targetCol = col + dx;
                const targetRow = row + dy;
                const transitionKey = `${col},${row}-${targetCol},${targetRow}`;
                const reverseKey = `${targetCol},${targetRow}-${col},${row}`;
                mapData.transitions.delete(transitionKey);
                mapData.transitions.delete(reverseKey);
                updateTransitionConnectors(targetCol, targetRow);
            });
        }

        if (updateEntryPoints) {
            for (const [type, key] of entryPointRegistry) {
                if (key === nodeKey) {
                    entryPointRegistry.delete(type);
                    break;
                }
            }
        }
    }

    nodeMemory.delete(nodeKey);

    const cell = document.querySelector(`[data-col="${col}"][data-row="${row}"]`);
    if (cell) {
        updateCellDisplay(cell, col, row);
        const updatedNodeData = mapData.nodes.get(nodeKey);
        if (updatedNodeData) {
            applyNodeStyling(cell, updatedNodeData);
        }
    }

    if (updateEntryPoints) updateEntryPointVisuals();

    closeSidebar();
}



function clearNode() {
    if (!currentEditingNode) return;
    
    const { col, row } = currentEditingNode;
    const nodeKey = `${col},${row}`;
    
    mapData.nodes.delete(nodeKey);
    
    // Remove all transitions involving this node
    const transitionsToRemove = [];
    for (const [key, transition] of mapData.transitions) {
        const [from, to] = key.split('-');
        if (from === `${col},${row}` || to === `${col},${row}`) {
            transitionsToRemove.push(key);
        }
    }
    
    transitionsToRemove.forEach(key => mapData.transitions.delete(key));
    
    updateCellDisplay(document.querySelector(`[data-col="${col}"][data-row="${row}"]`), col, row);
    
    // Update surrounding cells to refresh transition connectors
    updateSurroundingCells(col, row);
    
    closeSidebar();
}

function saveTransition() {
    if (!currentEditingTransition) return;
    
    const { fromCol, fromRow, toCol, toRow } = currentEditingTransition;
    const type = document.getElementById('transitionType').value;
    const direction = document.getElementById('transitionDirection').value;
    
    // Check if both nodes exist (at least one should have data)
    const fromKey = `${fromCol},${fromRow}`;
    const toKey = `${toCol},${toRow}`;
    
    if (!mapData.nodes.has(fromKey) && !mapData.nodes.has(toKey)) {
        alert('At least one node must have data to create a transition.');
        return;
    }
    
    const transitionKey = `${fromCol},${fromRow}-${toCol},${toRow}`;
    const conditions = getCurrentConditions();
    
    mapData.transitions.set(transitionKey, {
        type: type,
        direction: type === 'one-way' ? direction : null,
        conditions: conditions
    });
    
    updateTransitionConnectors(fromCol, fromRow);
    updateTransitionConnectors(toCol, toRow);

    populateTransitionControls(currentEditingNode ? currentEditingNode.col : fromCol, currentEditingNode ? currentEditingNode.row : fromRow);

    closeSidebar();
}

function removeTransition() {
    if (!currentEditingTransition) return;
    
    const { fromCol, fromRow, toCol, toRow } = currentEditingTransition;
    const transitionKey = `${fromCol},${fromRow}-${toCol},${toRow}`;
    const reverseKey = `${toCol},${toRow}-${fromCol},${fromRow}`;
    
    mapData.transitions.delete(transitionKey);
    mapData.transitions.delete(reverseKey);
    
    updateTransitionConnectors(fromCol, fromRow);
    updateTransitionConnectors(toCol, toRow);
    
    closeSidebar();
}

function updateSurroundingCells(col, row) {
    const directions = [
        [-1, 0], [1, 0], [0, -1], [0, 1]
    ];
    
    directions.forEach(([dx, dy]) => {
        const newCol = col + dx;
        const newRow = row + dy;
        
        if (newCol >= 0 && newCol < mapData.width && newRow >= 0 && newRow < mapData.height) {
            updateTransitionConnectors(newCol, newRow);
        }
    });
}

function hideConditionModal() {
    document.getElementById('conditionModal').classList.add('hidden');
}

function handleConditionActionChange() {
    const action = document.getElementById('conditionAction').value;
    const changeTargetGroup = document.getElementById('changeTargetGroup');
    
    if (action === 'changeIf') {
        changeTargetGroup.classList.remove('hidden');
    } else {
        changeTargetGroup.classList.add('hidden');
    }
}

function handleConditionSubmit(e) {
    e.preventDefault();

    const type = document.getElementById('conditionType').value;
    const action = document.getElementById('conditionAction')?.value || null;
    const operator = document.getElementById('conditionOperator')?.value || null;
    const name = document.getElementById('conditionName')?.value.trim() || '';
    const value = document.getElementById('conditionValue')?.value.trim() || '';
    const variableValue = document.getElementById('variableValue')?.value.trim() || '';
    const changeTarget = document.getElementById('changeTarget')?.value || '';

    if (!value && !name) return;

    const condition = { type };

    if (type === 'item') {
        condition.item = value;
    } else if (type === 'quest') {
        condition.quest = value;
    } else if (type === 'variable') {
        condition.variable = value;
        condition.value = variableValue || value; // fallback if one is missing
        if (operator) condition.operator = operator;
    } else {
        // Fallback for older logic
        if (name) condition.name = name;
        if (operator) condition.operator = operator;
        if (value) condition.value = value;
    }

    if (action) condition.action = action;
    if (action === 'changeIf' && changeTarget) {
        condition.changeTarget = changeTarget;
    }

    if (conditionModalContext === 'node') {
        addNodeConditionToList(condition);
    } else {
        addConditionToList(condition);
    }

    hideConditionModal();
}


function addConditionToList(condition) {
    const conditionsList = document.getElementById('conditionsList');
    
    const conditionItem = document.createElement('div');
    conditionItem.className = 'condition-item';
    conditionItem.dataset.condition = JSON.stringify(condition);
    
    const conditionText = document.createElement('span');
    conditionText.className = 'condition-text';
    
    // Format the condition display text
    let displayText = `${condition.action}: ${condition.type} "${condition.name}" ${condition.operator} ${condition.value}`;
    if (condition.changeTarget) {
        displayText += ` → ${condition.changeTarget}`;
    }
    conditionText.textContent = displayText;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-condition';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
        conditionItem.remove();
    });
    
    conditionItem.appendChild(conditionText);
    conditionItem.appendChild(removeBtn);
    conditionsList.appendChild(conditionItem);
}

function updateConditionsList(conditions) {
    const conditionsList = document.getElementById('conditionsList');
    conditionsList.innerHTML = '';
    
    conditions.forEach(condition => {
        addConditionToList(condition);
    });
}

function getCurrentConditions() {
    const conditionItems = document.querySelectorAll('#conditionsList .condition-item');
    const conditions = [];
    
    conditionItems.forEach(item => {
        try {
            const conditionData = JSON.parse(item.dataset.condition);
            conditions.push(conditionData);
        } catch (error) {
            console.error('Error parsing condition data:', error);
        }
    });
    
    return conditions;
}

function closeSidebar() {
    document.getElementById('sidebar').classList.add('hidden');
    currentEditingNode = null;
    currentEditingTransition = null;
    document.getElementById('transitionType').disabled = false;
    document.getElementById('nodeEditor').classList.remove('hidden');
    document.getElementById('transitionEditor').classList.add('hidden');
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    
    if (isDarkTheme) {
        body.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
        localStorage.setItem('twine-map-editor-theme', 'dark');
    } else {
        body.removeAttribute('data-theme');
        themeToggle.textContent = '🌙';
        localStorage.setItem('twine-map-editor-theme', 'light');
    }
}

// Check for File System Access API support
function supportsFileSystemAccess() {
    return 'showSaveFilePicker' in window;
}

function prepareExportData(includeExtras = false) {
    // Determine a default starting node
    let defaultStart = null;
    for (const [key] of mapData.nodes) {
        const [col, row] = key.split(',').map(Number);
        defaultStart = { x: col, y: row };
        break;
    }

    const exportData = {
        mapId: mapData.name.toLowerCase().replace(/\s+/g, '_'),
        name: mapData.name,
        gridSize: {
            width: mapData.width,
            height: mapData.height
        },
        defaultStart,
        nodes: []
    };

    // Include optional extras
    if (includeExtras) {
        exportData.passageTexts = Object.fromEntries(passageTexts);
        exportData.projectTagLibrary = Array.from(projectTagLibrary);
        exportData.entryPointRegistry = Object.fromEntries(entryPointRegistry);
    }

    // Convert Map to array of full node objects
    for (const [key, nodeData] of mapData.nodes) {
        const [col, row] = key.split(',').map(Number);
        exportData.nodes.push({
            column: col,
            row: row,
            name: nodeData.name || '',
            passage: nodeData.passage || '',
            icon: nodeData.icon || '',
            fogOfWar: nodeData.fogOfWar || false,
            tags: nodeData.tags || [],
            style: nodeData.style || {},
            conditions: nodeData.conditions || [],
            transitions: nodeData.transitions || {}
        });
    }

    return exportData;
}


// Full exportMap function with modern file picker and fallback
async function exportMap({ usePrompt = true, includeExtras = false } = {}) {
    if (mapData.nodes.size === 0) {
        alert('No nodes to export. Please create some nodes first.');
        return;
    }

    const exportData = prepareExportData(includeExtras);
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const defaultFilename = mapData.name.toLowerCase().replace(/\s+/g, '_') + '.json';

    if (supportsFileSystemAccess()) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultFilename,
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();

            alert('Map exported successfully!');
            return;
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error using File System Access API:', err);
            }
        }
    }

    const filename = usePrompt
        ? promptForFilename(mapData.name.toLowerCase().replace(/\s+/g, '_'), 'json')
        : defaultFilename;
    if (filename === null) return;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ensureExtension(filename, 'json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    alert('Map exported successfully!');
}


// Import map functionality
async function importMap() {
    if (supportsFileSystemAccess()) {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] }
                }],
                multiple: false
            });
            
            const file = await handle.getFile();
            const content = await file.text();
            
            try {
                const importedData = JSON.parse(content);
                
                // Basic structure validation
                if (!importedData.name || !Array.isArray(importedData.nodes)) {
                    alert('Invalid map file format');
                    return;
                }
                
                pendingImportData = importedData;
                
                // If a map is already loaded, ask how to proceed
                if (mapData.nodes.size > 0) {
                    showImportChoiceModal();
                } else {
                    showTwineFileModal(importedData);
                }
            } catch (error) {
                alert('Error reading file: Invalid JSON format');
                console.error('Import error:', error);
            }
        } catch (err) {
            // User cancelled or error occurred
            if (err.name !== 'AbortError') {
                console.error('Error using File System Access API:', err);
                // Fall back to file input
                document.getElementById('fileInput').click();
            }
        }
    } else {
        // Fallback for browsers that don't support File System Access API
        document.getElementById('fileInput').click();
    }
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedData = JSON.parse(e.target.result);

            // Basic structure validation
            if (!importedData.name || !Array.isArray(importedData.nodes)) {
                alert('Invalid map file format');
                return;
            }

            pendingImportData = importedData;

            // If a map is already loaded, ask how to proceed
            if (mapData.nodes.size > 0) {
                showImportChoiceModal(); // e.g., merge or overwrite
            } else {
                showTwineFileModal(importedData); // ask if they want to upload a .tw file
            }
        } catch (error) {
            alert('Error reading file: Invalid JSON format');
            console.error('Import error:', error);
        }
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset file input
}


function loadImportedMap(importedData) {
    // Validate structure
    if (!importedData.name || !Array.isArray(importedData.nodes)) {
        alert('Invalid map format. Missing required fields.');
        return;
    }

    // Determine grid size
    let width = 5, height = 5;
    if (importedData.gridSize) {
        width = importedData.gridSize.width || 5;
        height = importedData.gridSize.height || 5;
    } else {
        // Calculate from node positions
        let maxCol = 0, maxRow = 0;
        importedData.nodes.forEach(node => {
            // Handle different coordinate formats
            const col = node.column !== undefined ? node.column : (node.col !== undefined ? node.col : node.x);
            const row = node.row !== undefined ? node.row : (node.y !== undefined ? node.y : node.row);
            maxCol = Math.max(maxCol, col);
            maxRow = Math.max(maxRow, row);
        });
        width = Math.max(5, maxCol + 1);
        height = Math.max(5, maxRow + 1);
    }

    // Initialize map
    mapData = {
        name: importedData.name,
        width,
        height,
        nodes: new Map(),
        transitions: new Map()
    };

    // Clear and rebuild tag library
    projectTagLibrary.clear();

    // Load nodes
    importedData.nodes.forEach(node => {
        // Handle different coordinate formats
        const col = node.column !== undefined ? node.column : (node.col !== undefined ? node.col : node.x);
        const row = node.row !== undefined ? node.row : (node.y !== undefined ? node.y : node.row);
        
        const nodeKey = `${col},${row}`;
        const nodeData = {
            name: node.name || '',
            passage: node.passage || '',
            icon: node.icon || '',
            fogOfWar: node.fogOfWar || false,
            tags: node.tags || [],  // Preserve original format
            conditions: node.conditions || [],
            style: node.style || null,
            entryPoint: node.entryPoint || null
        };

        mapData.nodes.set(nodeKey, nodeData);

        // Build tag library from imported tags
        if (nodeData.tags && Array.isArray(nodeData.tags)) {
            nodeData.tags.forEach(tag => {
                if (typeof tag === 'string' && tag.trim()) {
                    projectTagLibrary.add(tag.trim());
                }
            });
        }

        // Load transitions
        if (node.transitions) {
            Object.entries(node.transitions).forEach(([type, data]) => {
                if (data && data.target) {
                    const transitionKey = `${col},${row}-${data.target.col},${data.target.row}`;
                    mapData.transitions.set(transitionKey, {
                        type: type,
                        direction: data.direction || null,
                        conditions: data.conditions || []
                    });
                }
            });
        }
    });

    // Update UI
    document.getElementById('mapTitle').textContent = `Twine Map Editor - ${mapData.name}`;
    generateGrid();
    applyAllNodeStyling();

    for (let row = 0; row < mapData.height; row++) {
        for (let col = 0; col < mapData.width; col++) {
            updateTransitionConnectors(col, row);
        }
    }

    closeSidebar();
    hideSetupModal();
    alert('Map imported successfully!');
}



// Node memory functionality
function setupNodeMemoryListeners() {
    const nodeInputs = ['nodeName', 'passageName', 'nodeIcon', 'fogOfWar',
        'transition-north','transition-west','transition-east','transition-south'];
    
    nodeInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        element.addEventListener('input', saveNodeMemory);
        element.addEventListener('change', saveNodeMemory);
    });
}

function saveNodeMemory() {
    if (!currentEditingNode) return;
    
    const { col, row } = currentEditingNode;
    const nodeKey = `${col},${row}`;
    
    const memory = {
        name: document.getElementById('nodeName').value,
        passage: document.getElementById('passageName').value,
        icon: document.getElementById('nodeIcon').value,
        fogOfWar: document.getElementById('fogOfWar').checked,
        tags: Array.from(selectedTags), // Store as array for consistency
        conditions: getCurrentNodeConditions(),
        transitions: {
            north: document.getElementById('transition-north').value,
            west: document.getElementById('transition-west').value,
            east: document.getElementById('transition-east').value,
            south: document.getElementById('transition-south').value
        }
    };
    
    nodeMemory.set(nodeKey, memory);
}

function loadTagsFromNodeData(tags) {
    selectedTags.clear();
    
    // Handle both array format (old) and any other format
    if (tags) {
        if (Array.isArray(tags)) {
            // Old format: array of strings
            tags.forEach(tag => {
                if (typeof tag === 'string' && tag.trim()) {
                    selectedTags.add(tag.trim());
                    projectTagLibrary.add(tag.trim());
                }
            });
        } else if (typeof tags === 'string') {
            // Handle comma-separated string format
            tags.split(',').forEach(tag => {
                const trimmedTag = tag.trim();
                if (trimmedTag) {
                    selectedTags.add(trimmedTag);
                    projectTagLibrary.add(trimmedTag);
                }
            });
        }
    }
    
    updateTagChipsDisplay();
}


// Node conditions functionality
function showConditionModal(context) {
    conditionModalContext = context;
    document.getElementById('conditionModal').classList.remove('hidden');
    document.getElementById('conditionForm').reset();
    handleConditionActionChange();
}


function addNodeConditionToList(condition) {
    const conditionsList = document.getElementById('nodeConditionsList');
    
    const conditionItem = document.createElement('div');
    conditionItem.className = 'condition-item';
    
    const conditionText = document.createElement('span');
    conditionText.className = 'condition-text';
    
    if (condition.type === 'item') {
        conditionText.textContent = `Item: ${condition.item}`;
    } else if (condition.type === 'quest') {
        conditionText.textContent = `Quest: ${condition.quest}`;
    } else if (condition.type === 'variable') {
        conditionText.textContent = `Variable: ${condition.variable} = ${condition.value}`;
    }
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-condition';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
        conditionItem.remove();
        saveNodeMemory(); // Update memory when condition is removed
    });
    
    conditionItem.appendChild(conditionText);
    conditionItem.appendChild(removeBtn);
    conditionsList.appendChild(conditionItem);
    
    saveNodeMemory(); // Update memory when condition is added
}

function updateNodeConditionsList(conditions) {
    const conditionsList = document.getElementById('nodeConditionsList');
    conditionsList.innerHTML = '';
    
    conditions.forEach(condition => {
        addNodeConditionToList(condition);
    });
}

function getCurrentNodeConditions() {
    const conditionItems = document.querySelectorAll('#nodeConditionsList .condition-item');
    const conditions = [];
    
    conditionItems.forEach(item => {
        const text = item.querySelector('.condition-text').textContent;
        
        if (text.startsWith('Item: ')) {
            conditions.push({
                type: 'item',
                item: text.substring(6)
            });
        } else if (text.startsWith('Quest: ')) {
            conditions.push({
                type: 'quest',
                quest: text.substring(7)
            });
        } else if (text.startsWith('Variable: ')) {
            const variableText = text.substring(10);
            const [variable, value] = variableText.split(' = ');
            conditions.push({
                type: 'variable',
                variable: variable,
                value: value
            });
        }
    });
    
    return conditions;
}

// Add this function after your existing condition modal functions (around line 1315)
function initializeNodeConditionColorPicker() {
    // Add color picker to the node condition modal
    const modal = document.getElementById('nodeConditionModal');
    if (!modal) return;
    
    // Find the form groups container
    const formGroups = modal.querySelector('.form-groups');
    if (!formGroups) return;
    
    // Create style section
    const styleSection = document.createElement('div');
    styleSection.className = 'form-group condition-style-section';
    styleSection.innerHTML = `
        <label>Condition Style (Optional)</label>
        <div class="help-text">Apply custom colors when this condition is active</div>
        <div id="nodeConditionColorPicker"></div>
    `;
    
    // Insert before the description field
    const descriptionGroup = modal.querySelector('.form-group:last-child');
    formGroups.insertBefore(styleSection, descriptionGroup);
    
    // Create color picker instance
    window.nodeConditionColorPicker = colorPickerSystem.createInstance('nodeConditionColorPicker', {
        primaryColor: '#ffc107',
        secondaryColor: '#6c757d',
        showPattern: true,
        onColorChange: (colors) => {
            // Store colors temporarily
            window.currentNodeConditionColors = colors;
        }
    });
}

// Full exportTwineFile function using modern file picker with fallback
async function exportTwineFile() {
    const twineContent = generateTwineContent();
    if (!twineContent) return;

    const blob = new Blob([twineContent], { type: 'text/plain' });
    const defaultFilename = mapData.name.toLowerCase().replace(/\s+/g, '_') + '.tw';

    if (supportsFileSystemAccess()) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultFilename,
                types: [{
                    description: 'Twine Files',
                    accept: { 'text/plain': ['.tw'] }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();

            alert('Twine file exported successfully!');
            return;
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error using File System Access API:', err);
            }
        }
    }

    const filename = promptForFilename(mapData.name.toLowerCase().replace(/\s+/g, '_'), 'tw');
    if (filename === null) return;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ensureExtension(filename, 'tw');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    alert('Twine file exported successfully!');
}



// Auto-save functionality
function setupAutoSave() {
    // Save to localStorage every 30 seconds
    autoSaveInterval = setInterval(() => {
        if (mapData.nodes.size > 0) {
            saveToLocalStorage();
        }
    }, 30000);
    
    // Load from localStorage on startup
    loadFromLocalStorage();
}

function saveToLocalStorage() {
    const saveData = {
        mapData: {
            name: mapData.name,
            width: mapData.width,
            height: mapData.height,
            nodes: Array.from(mapData.nodes.entries()),
            transitions: Array.from(mapData.transitions.entries())
        },
        nodeMemory: Array.from(nodeMemory.entries()),
        timestamp: Date.now()
    };
    
    localStorage.setItem('twine-map-editor-autosave', JSON.stringify(saveData));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('twine-map-editor-autosave');
    if (!saved) return;
    
    try {
        const saveData = JSON.parse(saved);
        const timeDiff = Date.now() - saveData.timestamp;
        
        // Only load if saved within last 24 hours
        if (timeDiff < 24 * 60 * 60 * 1000) {
            const shouldLoad = confirm('Found auto-saved map data. Would you like to restore it?');
            if (shouldLoad) {
                mapData = {
                    name: saveData.mapData.name,
                    width: saveData.mapData.width,
                    height: saveData.mapData.height,
                    nodes: new Map(saveData.mapData.nodes),
                    transitions: new Map(saveData.mapData.transitions)
                };
                
                nodeMemory = new Map(saveData.nodeMemory);
                
                document.getElementById('mapTitle').textContent = `Twine Map Editor - ${mapData.name}`;
                hideSetupModal();
                generateGrid();
                applyAllNodeStyling();
                
                // IMPORTANT: Update all transition connectors after grid generation
                // This ensures that the visual styles match the loaded transition data
                for (let row = 0; row < mapData.height; row++) {
                    for (let col = 0; col < mapData.width; col++) {
                        updateTransitionConnectors(col, row);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading auto-save:', error);
    }
}

// Node Condition Modal Functions
function showNodeConditionModal() {
    document.getElementById('nodeConditionModal').classList.remove('hidden');
    document.getElementById('nodeConditionForm').reset();
    
    // Clear condition icon selection
    clearConditionIconSelection();
    
    // Initialize condition icon grid
    renderConditionIconGrid();
    
    // Initialize color picker if not already done
    if (!document.getElementById('nodeConditionColorPicker')) {
        initializeNodeConditionColorPicker();
    }
    
    // Reset color picker to defaults
    if (window.nodeConditionColorPicker) {
        window.nodeConditionColorPicker.setColors('#ffc107', '#6c757d');
        window.currentNodeConditionColors = null;
    }
}

function hideNodeConditionModal() {
    document.getElementById('nodeConditionModal').classList.add('hidden');
}

function handleNodeConditionSubmit(e) {
    e.preventDefault();
    
    const type = document.getElementById('nodeConditionType').value;
    const name = document.getElementById('nodeConditionName').value.trim();
    const operator = document.getElementById('nodeConditionOperator').value;
    const value = document.getElementById('nodeConditionValue').value.trim();
    const passage = document.getElementById('nodeConditionPassage').value.trim();
    const icon = document.getElementById('nodeConditionIcon').value;
    const description = document.getElementById('nodeConditionDescription').value.trim();
    
    if (!name || !value || !passage) {
        alert('Please fill in all required fields (Name, Value, and Passage Name)');
        return;
    }
    
    const nodeCondition = {
        type: type,
        name: name,
        operator: operator,
        value: value,
        passage: passage,
        icon: icon || null,
        description: description || null
    };
    
    // Add style if color picker was used
    if (window.currentNodeConditionColors) {
        nodeCondition.style = {
            primaryColor: window.currentNodeConditionColors.primary,
            secondaryColor: window.currentNodeConditionColors.secondary,
            pattern: window.currentNodeConditionColors.pattern || 'none'
        };
    }
    
    addNodeStateConditionToList(nodeCondition);
    hideNodeConditionModal();
    
    // Reset condition colors
    window.currentNodeConditionColors = null;
}

function addNodeStateConditionToList(condition) {
    const conditionsList = document.getElementById('nodeConditionsList');
    
    const conditionItem = document.createElement('div');
    conditionItem.className = 'node-state-condition-item';
    conditionItem.dataset.condition = JSON.stringify(condition);
    conditionItem.draggable = true;
    
    // Add drag and drop event listeners
    conditionItem.addEventListener('dragstart', handleDragStart);
    conditionItem.addEventListener('dragover', handleDragOver);
    conditionItem.addEventListener('drop', handleDrop);
    conditionItem.addEventListener('dragend', handleDragEnd);
    
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.title = 'Drag to reorder priority';
    
    const conditionContent = document.createElement('div');
    conditionContent.className = 'condition-content';
    
    const conditionText = document.createElement('div');
    conditionText.className = 'condition-text';
    
    // Format the condition display text
    let displayText = `${condition.type} "${condition.name}" ${condition.operator} ${condition.value}`;
    conditionText.innerHTML = `
        <strong>If:</strong> ${displayText}<br>
        <strong>Then:</strong> Use passage "${condition.passage}"${condition.icon ? ` with icon "${condition.icon}"` : ''}
        ${condition.style ? '<br><span class="style-indicator">🎨 Custom style</span>' : ''}
        ${condition.description ? `<br><em>${condition.description}</em>` : ''}
    `;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-condition';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove this condition';
    removeBtn.addEventListener('click', () => {
        conditionItem.remove();
        saveNodeMemory(); // Update memory when condition is removed
    });
    
    conditionContent.appendChild(conditionText);
    conditionItem.appendChild(dragHandle);
    conditionItem.appendChild(conditionContent);
    conditionItem.appendChild(removeBtn);
    conditionsList.appendChild(conditionItem);
    
    saveNodeMemory(); // Update memory when condition is added
}

function updateNodeStateConditionsList(conditions) {
    const conditionsList = document.getElementById('nodeConditionsList');
    conditionsList.innerHTML = '';
    
    conditions.forEach(condition => {
        addNodeStateConditionToList(condition);
    });
}

function getCurrentNodeStateConditions() {
    const conditionItems = document.querySelectorAll('#nodeConditionsList .node-state-condition-item');
    const conditions = [];
    
    conditionItems.forEach(item => {
        try {
            const conditionData = JSON.parse(item.dataset.condition);
            conditions.push(conditionData);
        } catch (error) {
            console.error('Error parsing node condition data:', error);
        }
    });
    
    return conditions;
}

// Drag and Drop Functions for Priority Ordering
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        const parent = this.parentNode;
        const draggedIndex = Array.from(parent.children).indexOf(draggedElement);
        const targetIndex = Array.from(parent.children).indexOf(this);
        
        if (draggedIndex < targetIndex) {
            parent.insertBefore(draggedElement, this.nextSibling);
        } else {
            parent.insertBefore(draggedElement, this);
        }
        
        saveNodeMemory(); // Update memory when order changes
    }
    
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '';
    draggedElement = null;
}

// Update the existing node condition functions to use the new system
function updateNodeConditionsList(conditions) {
    updateNodeStateConditionsList(conditions);
}

function getCurrentNodeConditions() {
    return getCurrentNodeStateConditions();
}

function addNodeConditionToList(condition) {
    // Convert old format to new format if needed
    if (condition.passage) {
        addNodeStateConditionToList(condition);
    } else {
        // This is an old-style condition, convert it
        const newCondition = {
            type: condition.type,
            name: condition.name || condition.item || condition.quest || condition.variable,
            operator: '==',
            value: condition.value || 'true',
            passage: 'DefaultPassage',
            icon: null,
            description: 'Converted from old condition format'
        };
        addNodeStateConditionToList(newCondition);
    }
}

// Icon selection functionality
let selectedIcon = '';
let allIcons = [];

// Initialize icon functionality after Lucide is loaded
function initializeIconSelection() {
    const iconSearchInput = document.getElementById('iconSearch');
    const iconGrid = document.getElementById('iconGrid');
    const selectedIconName = document.getElementById('selectedIconName');
    const selectedIconSVG = document.getElementById('selectedIconSVG');
    
    // Converts PascalCase / CamelCase to kebab-case (needed for Lucide data-lucide attribute)
    function toKebabCase(str) {
        return str
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2')    // lower/number -> upper boundary
            .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')  // upper -> upper-lower boundary
            .toLowerCase();
    }

    let allIcons = [];

    // Get all available Lucide icons, or fallback
    if (window.lucide && window.lucide.icons) {
        allIcons = Object.keys(window.lucide.icons)
            .map(toKebabCase)
            .sort(); // Alphabetical sort
    } else {
        allIcons = [
            'home', 'store', 'sword', 'shield', 'key', 'door-open', 'door-closed',
            'castle', 'tree-pine', 'mountain', 'waves', 'flame', 'zap', 'skull',
            'gem', 'scroll', 'clock', 'moon', 'sun', 'calendar', 'map', 'compass',
            'star', 'heart', 'circle', 'square', 'triangle', 'diamond'
        ];
    }

    function renderIconGrid(filter = '') {
        if (!iconGrid) return;

        iconGrid.innerHTML = '';

        const filteredIcons = allIcons.filter(icon => icon.toLowerCase().includes(filter.toLowerCase()));

        if (filteredIcons.length === 0) {
            iconGrid.innerHTML = '<div class="no-icons">No icons found.</div>';
            return;
        }

        filteredIcons.forEach(iconName => {
            const tile = document.createElement('div');
            tile.className = 'icon-tile';
            tile.setAttribute('data-icon', iconName);

            // Create icon element
            const iconDiv = document.createElement('div');
            iconDiv.className = 'icon-preview';
            const iconElement = document.createElement('i');
            iconElement.setAttribute('data-lucide', iconName);
            iconDiv.appendChild(iconElement);

            const nameDiv = document.createElement('div');
            nameDiv.className = 'icon-name';
            nameDiv.textContent = iconName;

            tile.appendChild(iconDiv);
            tile.appendChild(nameDiv);
            tile.addEventListener('click', () => selectIcon(iconName));
            iconGrid.appendChild(tile);
        });

        // Re-render Lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }
    }    function selectIcon(iconName) {
        const nodeIconInput = document.getElementById('nodeIcon');

        // If the clicked icon is already selected, toggle it off
        if (nodeIconInput?.value === iconName) {
            clearIconSelection();
            return;
        }

        selectIconWithoutToggle(iconName);
    }

    function selectIconWithoutToggle(iconName) {
        selectedIcon = iconName;

        const nodeIconInput = document.getElementById('nodeIcon');

        // Update hidden input field
        if (nodeIconInput) {
            nodeIconInput.value = iconName;
        }

        // Update visual name
        if (selectedIconName) {
            selectedIconName.textContent = iconName;
        }

        // Update SVG preview
        if (selectedIconSVG) {
            selectedIconSVG.innerHTML = '';
            const iconElement = document.createElement('i');
            iconElement.setAttribute('data-lucide', iconName);
            selectedIconSVG.appendChild(iconElement);

            // Re-render Lucide icons
            if (window.lucide) {
                lucide.createIcons();
            }
        }

        // Highlight the selected tile
        document.querySelectorAll('.icon-tile').forEach(tile => {
            tile.classList.remove('selected');
        });
        const selectedTile = document.querySelector(`.icon-tile[data-icon="${iconName}"]`);
        if (selectedTile) {
            selectedTile.classList.add('selected');
        }

        // Save to memory if editing a node
        if (typeof currentEditingNode !== 'undefined' && currentEditingNode) {
            saveNodeMemory();
        }
    }


    if (iconSearchInput) {
        iconSearchInput.addEventListener('input', (e) => {
            renderIconGrid(e.target.value);
        });
    }

    // Initialize the grid on load
    renderIconGrid();    // Expose functions globally
    window.updateIconSelection = function(iconName) {
        if (iconName && allIcons.includes(iconName)) {
            selectIconWithoutToggle(iconName);
        }
    };

    window.clearIconSelection = function() {
        selectedIcon = '';

        const nodeIconInput = document.getElementById('nodeIcon');
        if (nodeIconInput) {
            nodeIconInput.value = '';
        }

        if (selectedIconName) {
            selectedIconName.textContent = 'None Selected';
        }

        if (selectedIconSVG) {
            selectedIconSVG.innerHTML = '';
        }

        // Clear all selected tiles
        document.querySelectorAll('.icon-tile').forEach(tile => {
            tile.classList.remove('selected');
        });
    };

    window.renderIconGrid = renderIconGrid;
    window.selectIcon = selectIcon;
}


// Condition Icon Selection functionality
let selectedConditionIcon = '';

function initializeConditionIconSelection() {
    const conditionIconSearchInput = document.getElementById('conditionIconSearch');
    const conditionIconGrid = document.getElementById('conditionIconGrid');
    const selectedConditionIconName = document.getElementById('selectedConditionIconName');
    const selectedConditionIconSVG = document.getElementById('selectedConditionIconSVG');
    
    // Converts PascalCase / CamelCase to kebab-case (needed for Lucide data-lucide attribute)
    function toKebabCase(str) {
        return str
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2')    // lower/number -> upper boundary
            .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')  // upper -> upper-lower boundary
            .toLowerCase();
    }

    let allConditionIcons = [];

    // Get all available Lucide icons, or fallback
    if (window.lucide && window.lucide.icons) {
        allConditionIcons = Object.keys(window.lucide.icons)
            .map(toKebabCase)
            .sort(); // Alphabetical sort
    } else {
        allConditionIcons = [
            'home', 'store', 'sword', 'shield', 'key', 'door-open', 'door-closed',
            'castle', 'tree-pine', 'mountain', 'waves', 'flame', 'zap', 'skull',
            'gem', 'scroll', 'clock', 'moon', 'sun', 'calendar', 'map', 'compass',
            'star', 'heart', 'circle', 'square', 'triangle', 'diamond'
        ];
    }

    function renderConditionIconGrid(filter = '') {
        if (!conditionIconGrid) return;

        conditionIconGrid.innerHTML = '';

        const filteredIcons = allConditionIcons.filter(icon => icon.toLowerCase().includes(filter.toLowerCase()));

        if (filteredIcons.length === 0) {
            conditionIconGrid.innerHTML = '<div class="no-icons">No icons found.</div>';
            return;
        }

        filteredIcons.forEach(iconName => {
            const tile = document.createElement('div');
            tile.className = 'icon-tile';
            tile.setAttribute('data-icon', iconName);

            // Create icon element
            const iconDiv = document.createElement('div');
            iconDiv.className = 'icon-preview';
            const iconElement = document.createElement('i');
            iconElement.setAttribute('data-lucide', iconName);
            iconDiv.appendChild(iconElement);

            const nameDiv = document.createElement('div');
            nameDiv.className = 'icon-name';
            nameDiv.textContent = iconName;

            tile.appendChild(iconDiv);
            tile.appendChild(nameDiv);
            tile.addEventListener('click', () => selectConditionIcon(iconName));
            conditionIconGrid.appendChild(tile);
        });

        // Re-render Lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    function selectConditionIcon(iconName) {
        const nodeConditionIconInput = document.getElementById('nodeConditionIcon');

        // Toggle off if the clicked icon is already selected
        if (nodeConditionIconInput?.value === iconName) {
            clearConditionIconSelection();
            return;
        }

        selectedConditionIcon = iconName;

        // Update hidden input
        if (nodeConditionIconInput) {
            nodeConditionIconInput.value = iconName;
        }

        // Update text label
        if (selectedConditionIconName) {
            selectedConditionIconName.textContent = iconName;
        }

        // Update SVG preview
        if (selectedConditionIconSVG) {
            selectedConditionIconSVG.innerHTML = '';
            const iconElement = document.createElement('i');
            iconElement.setAttribute('data-lucide', iconName);
            selectedConditionIconSVG.appendChild(iconElement);

            if (window.lucide) {
                lucide.createIcons();
            }
        }

        // Highlight the selected tile
        document.querySelectorAll('#conditionIconGrid .icon-tile').forEach(tile => {
            tile.classList.remove('selected');
        });
        const selectedTile = document.querySelector(`#conditionIconGrid .icon-tile[data-icon="${iconName}"]`);
        if (selectedTile) {
            selectedTile.classList.add('selected');
        }
    }


    if (conditionIconSearchInput) {
        conditionIconSearchInput.addEventListener('input', (e) => {
            renderConditionIconGrid(e.target.value);
        });
    }

    // Expose functions globally
    window.renderConditionIconGrid = renderConditionIconGrid;
    window.selectConditionIcon = selectConditionIcon;
    window.clearConditionIconSelection = function() {
        selectedConditionIcon = '';

        const nodeConditionIconInput = document.getElementById('nodeConditionIcon');
        if (nodeConditionIconInput) {
            nodeConditionIconInput.value = '';
        }

        if (selectedConditionIconName) {
            selectedConditionIconName.textContent = 'No Icon Selected';
        }

        if (selectedConditionIconSVG) {
            selectedConditionIconSVG.innerHTML = '';
        }

        // Clear all selected tiles
        document.querySelectorAll('#conditionIconGrid .icon-tile').forEach(tile => {
            tile.classList.remove('selected');
        });
    };

    // Initialize the grid on load
    renderConditionIconGrid();
}

// Import Choice Modal Functions
function setupImportChoiceListeners() {
    document.getElementById('importFreshWorkspace').addEventListener('click', handleImportFreshWorkspace);
    document.getElementById('importAddToWorkspace').addEventListener('click', handleImportAddToWorkspace);
    document.getElementById('cancelImportChoice').addEventListener('click', hideImportChoiceModal);
}

function showImportChoiceModal() {
    document.getElementById('importChoiceModal').classList.remove('hidden');
}

function hideImportChoiceModal() {
    document.getElementById('importChoiceModal').classList.add('hidden');
    pendingImportData = null;
}

function handleImportFreshWorkspace() {
    if (pendingImportData) {
        loadImportedMap(pendingImportData);
        hideImportChoiceModal();
    }
}

function handleImportAddToWorkspace() {
    if (pendingImportData) {
        startPlacementMode(pendingImportData);
        hideImportChoiceModal();
    }
}

// Placement Mode Functions
function setupPlacementListeners() {
    document.getElementById('confirmPlacement').addEventListener('click', confirmPlacement);
    document.getElementById('cancelPlacement').addEventListener('click', cancelPlacement);
}

function startPlacementMode(importData) {
    placementMode = true;
    placementFinalized = false;
    pendingImportData = importData;
    
    // Calculate import data dimensions
    let minCol = Infinity, maxCol = -Infinity;
    let minRow = Infinity, maxRow = -Infinity;
    
    importData.nodes.forEach(node => {
        const col = node.x !== undefined ? node.x : node.column;
        const row = node.y !== undefined ? node.y : node.row;
        
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
    });
    
    placementPreviewData = {
        width: maxCol - minCol + 1,
        height: maxRow - minRow + 1,
        minCol: minCol,
        minRow: minRow,
        nodes: importData.nodes
    };
    
    // Update UI
    document.getElementById('placementMapSize').textContent = `${placementPreviewData.width} × ${placementPreviewData.height}`;
    document.getElementById('placementControls').classList.remove('hidden');
    document.getElementById('mapGrid').classList.add('placement-mode');
    
    // Add hover listeners to grid cells
    setupPlacementHoverListeners();
}

function setupPlacementHoverListeners() {
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        cell.addEventListener('mouseenter', handlePlacementHover);
        cell.addEventListener('mouseleave', clearPlacementPreview);
        cell.addEventListener('click', handlePlacementClick);
    });
}

function handlePlacementHover(event) {
    if (!placementMode || !placementPreviewData || placementFinalized) return;

    const targetCol = parseInt(event.target.dataset.col);
    const targetRow = parseInt(event.target.dataset.row);

    clearPlacementPreview();

    // Calculate placement offset
    const offsetCol = targetCol - placementPreviewData.minCol;
    const offsetRow = targetRow - placementPreviewData.minRow;

    let canPlace = true;
    let hasConflicts = false;
    let requiresExpansion = false;
    const previewCells = [];

    // Check each node in the import data
    placementPreviewData.nodes.forEach(node => {
        const nodeCol = node.x !== undefined ? node.x : node.column;
        const nodeRow = node.y !== undefined ? node.y : node.row;

        const newCol = nodeCol + offsetCol;
        const newRow = nodeRow + offsetRow;

        // Out-of-bounds negative coordinates are invalid
        if (newCol < 0 || newRow < 0) {
            canPlace = false;
            return;
        }

        // If node exceeds current grid, mark for potential expansion
        if (newCol >= mapData.width || newRow >= mapData.height) {
            requiresExpansion = true;
        }

        const cell = document.querySelector(`[data-col="${newCol}"][data-row="${newRow}"]`);
        if (cell) {
            previewCells.push({ cell, newCol, newRow });

            const existingNodeKey = `${newCol},${newRow}`;
            if (mapData.nodes.has(existingNodeKey)) {
                hasConflicts = true;
            }
        }
    });

    // Update visual feedback
    previewCells.forEach(({ cell }) => {
        if (!canPlace) {
            cell.classList.add('placement-invalid');
        } else if (hasConflicts) {
            cell.classList.add('placement-conflict');
        } else {
            cell.classList.add('placement-preview');
        }
    });

    // UI Feedback
    document.getElementById('placementPosition').textContent = `(${targetCol}, ${targetRow})`;
    const statusElement = document.getElementById('placementStatus');
    const confirmButton = document.getElementById('confirmPlacement');

    if (!canPlace) {
        statusElement.textContent = 'Cannot place here - invalid location';
        statusElement.className = 'placement-status invalid';
        confirmButton.disabled = true;
    } else if (requiresExpansion) {
        statusElement.textContent = 'Valid placement - grid will expand to fit';
        statusElement.className = 'placement-status valid';
        confirmButton.disabled = false;
    } else if (hasConflicts) {
        statusElement.textContent = 'Warning: Will overwrite existing nodes';
        statusElement.className = 'placement-status conflict';
        confirmButton.disabled = false;
    } else {
        statusElement.textContent = 'Valid placement location';
        statusElement.className = 'placement-status valid';
        confirmButton.disabled = false;
    }

    // Store current placement metadata
    placementPreviewData.currentPlacement = {
        targetCol,
        targetRow,
        offsetCol,
        offsetRow,
        canPlace,
        hasConflicts,
        requiresExpansion
    };
}


function clearPlacementPreview() {
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        cell.classList.remove('placement-preview', 'placement-invalid', 'placement-conflict');
    });
}

function handlePlacementClick(event) {
    if (!placementMode || !placementPreviewData || !placementPreviewData.currentPlacement) return;

    const { canPlace, hasConflicts } = placementPreviewData.currentPlacement;

    if (!canPlace) return;

    if (hasConflicts) {
        const confirmed = confirm('This will overwrite existing nodes. Continue?');
        if (!confirmed) return;
    }

    // ✅ Mark the placement as finalized
    placementFinalized = true;

    // ✅ (Optional) Stop hover updates by detaching mousemove logic
    mapGrid.removeEventListener('mousemove', handlePlacementHover);

    // ✅ Update UI
    document.getElementById('confirmPlacement').disabled = false;
    document.getElementById('placementStatus').textContent = 'Click "Confirm Placement" to finalize';
    document.getElementById('placementStatus').className = 'placement-status valid';
}

function confirmPlacement() {
    if (!placementMode || !placementPreviewData || !placementPreviewData.currentPlacement) return;

    const { offsetCol, offsetRow, canPlace } = placementPreviewData.currentPlacement;
    if (!canPlace) return;

    // Check if we need to expand the grid
    let needsExpansion = false;
    let newWidth = mapData.width;
    let newHeight = mapData.height;

    placementPreviewData.nodes.forEach(node => {
        const nodeCol = node.x ?? node.column;
        const nodeRow = node.y ?? node.row;

        const newCol = nodeCol + offsetCol;
        const newRow = nodeRow + offsetRow;

        if (newCol >= mapData.width) {
            newWidth = Math.max(newWidth, newCol + 1);
            needsExpansion = true;
        }
        if (newRow >= mapData.height) {
            newHeight = Math.max(newHeight, newRow + 1);
            needsExpansion = true;
        }
    });

    if (needsExpansion) {
        mapData.width = newWidth;
        mapData.height = newHeight;
        generateGrid();
        applyAllNodeStyling();
    }

    // Place and connect nodes
    placementPreviewData.nodes.forEach(node => {
        const nodeCol = node.x ?? node.column;
        const nodeRow = node.y ?? node.row;

        const newCol = nodeCol + offsetCol;
        const newRow = nodeRow + offsetRow;

        setNodeData(newCol, newRow, {
            name: node.name,
            passage: node.passage,
            icon: node.icon,
            fogOfWar: node.fogOfWar,
            tags: node.tags,
            conditions: node.conditions,
            style: node.style,
            transitions: node.transitions
        });

        if (node.transitions) {
            Object.entries(node.transitions).forEach(([direction, transition]) => {
                let targetCol = newCol;
                let targetRow = newRow;

                switch (direction) {
                    case 'north': targetRow--; break;
                    case 'south': targetRow++; break;
                    case 'east':  targetCol++; break;
                    case 'west':  targetCol--; break;
                }

                const transitionKey = `${newCol},${newRow}-${targetCol},${targetRow}`;
                mapData.transitions.set(transitionKey, {
                    type: transition.type ?? 'bidirectional',
                    direction: transition.direction ?? null,
                    conditions: transition.conditions ?? []
                });
            });
        }
    });

    // Refresh visuals
    placementPreviewData.nodes.forEach(node => {
        const nodeCol = node.x ?? node.column;
        const nodeRow = node.y ?? node.row;
        const newCol = nodeCol + offsetCol;
        const newRow = nodeRow + offsetRow;

        const cell = document.querySelector(`[data-col="${newCol}"][data-row="${newRow}"]`);
        if (cell) {
            updateCellDisplay(cell, newCol, newRow);
            applyNodeStyling(cell, mapData.nodes.get(`${newCol},${newRow}`));
        }
    });

    cancelPlacement();
    alert('Map section placed successfully!');
}

function cancelPlacement() {
    placementMode = false;
    pendingImportData = null;
    placementPreviewData = null;
    
    document.getElementById('placementControls').classList.add('hidden');
    document.getElementById('mapGrid').classList.remove('placement-mode');
    
    clearPlacementPreview();
    
    // Remove hover listeners
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        cell.removeEventListener('mouseenter', handlePlacementHover);
        cell.removeEventListener('mouseleave', clearPlacementPreview);
        cell.removeEventListener('click', handlePlacementClick);
    });
}


// Dual file upload functionality
function setupTwineFileModalListeners() {
    document.getElementById('uploadTwineFile').addEventListener('click', async () => {
        if (supportsFileSystemAccess()) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Twine Files',
                        accept: { 'text/plain': ['.tw'] }
                    }],
                    multiple: false
                });
                
                const file = await handle.getFile();
                const content = await file.text();
                
                // Show processing status
                document.getElementById('twineUploadStatus').classList.remove('hidden');
                document.getElementById('twineStatusIcon').textContent = '⏳';
                document.getElementById('twineStatusText').textContent = 'Processing .tw file...';
                
                try {
                    twineFileContent = content;
                    processTwineFile(twineFileContent);
                } catch (error) {
                    document.getElementById('twineStatusIcon').textContent = '❌';
                    document.getElementById('twineStatusText').textContent = 'Error reading .tw file';
                    console.error('Twine file import error:', error);
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Error using File System Access API:', err);
                    // Fall back to file input
                    document.getElementById('twFileInput').click();
                }
            }
        } else {
            // Fallback
            document.getElementById('twFileInput').click();
        }
    });
    
    document.getElementById('skipTwineFile').addEventListener('click', () => {
        completeDualImport();
    });
    
    document.getElementById('completeTwineImport').addEventListener('click', () => {
        completeDualImport();
    });
}

function showTwineFileModal(importedData) {
    pendingTwineImport = importedData;
    
    // Update modal with import details
    const nodeCount = importedData.nodes ? importedData.nodes.length : 0;
    const hasPassageTexts = importedData.passageTexts && Object.keys(importedData.passageTexts).length > 0;
    
    document.getElementById('mapImportDetails').textContent = 
        `${nodeCount} nodes loaded${hasPassageTexts ? ' (with existing passage data)' : ''}`;
    
    // Show the modal
    document.getElementById('twineFileModal').classList.remove('hidden');
}

function hideTwineFileModal() {
    document.getElementById('twineFileModal').classList.add('hidden');
    pendingTwineImport = null;
    twineFileContent = null;
}

function handleTwineFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Show processing status
    document.getElementById('twineUploadStatus').classList.remove('hidden');
    document.getElementById('twineStatusIcon').textContent = '⏳';
    document.getElementById('twineStatusText').textContent = 'Processing .tw file...';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            twineFileContent = e.target.result;
            processTwineFile(twineFileContent);
        } catch (error) {
            document.getElementById('twineStatusIcon').textContent = '❌';
            document.getElementById('twineStatusText').textContent = 'Error reading .tw file';
            console.error('Twine file import error:', error);
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

function processTwineFile(twineContent) {
    try {
        const parsedPassages = parseTwineFile(twineContent);
        
        if (parsedPassages.size === 0) {
            document.getElementById('twineStatusIcon').textContent = '⚠️';
            document.getElementById('twineStatusText').textContent = 'No passages found in .tw file';
        } else {
            // Merge parsed passages with pending import data
            if (pendingTwineImport) {
                mergeTwinePassages(pendingTwineImport, parsedPassages);
            }
            
            document.getElementById('twineStatusIcon').textContent = '✅';
            document.getElementById('twineStatusText').textContent = 
                `Successfully processed ${parsedPassages.size} passages`;
        }
        
        // Show completion button
        document.getElementById('finalImportActions').classList.remove('hidden');
        
    } catch (error) {
        document.getElementById('twineStatusIcon').textContent = '❌';
        document.getElementById('twineStatusText').textContent = 'Error processing .tw file';
        console.error('Twine file processing error:', error);
    }
}

function parseTwineFile(content) {
    const passages = new Map();
    const lines = content.split('\n');
    let currentPassage = null;
    let currentContent = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check for passage header (:: PassageName)
        if (line.startsWith(':: ')) {
            // Save previous passage if exists
            if (currentPassage) {
                passages.set(currentPassage, currentContent.join('\n').trim());
            }
            
            // Start new passage
            currentPassage = line.substring(3).trim();
            currentContent = [];
        } else if (currentPassage) {
            // Add line to current passage content
            currentContent.push(line);
        }
    }
    
    // Save the last passage
    if (currentPassage) {
        passages.set(currentPassage, currentContent.join('\n').trim());
    }
    
    return passages;
}

function mergeTwinePassages(importData, parsedPassages) {
    // Create a map to store passage texts by node key
    const nodePassageTexts = new Map();
    
    // Go through each node and try to find matching passages
    importData.nodes.forEach(node => {
        const col = node.x !== undefined ? node.x : node.column;
        const row = node.y !== undefined ? node.y : node.row;
        const nodeKey = `${col},${row}`;
        
        const passageData = {
            main: '',
            conditions: {}
        };
        
        // Look for main passage
        if (node.passage && parsedPassages.has(node.passage)) {
            passageData.main = parsedPassages.get(node.passage);
        }
        
        // Look for conditional passages
        if (node.conditions && Array.isArray(node.conditions)) {
            node.conditions.forEach(condition => {
                if (condition.passage && parsedPassages.has(condition.passage)) {
                    passageData.conditions[condition.passage] = parsedPassages.get(condition.passage);
                }
            });
        }
        
        // Only store if we found some content
        if (passageData.main || Object.keys(passageData.conditions).length > 0) {
            nodePassageTexts.set(nodeKey, passageData);
        }
    });
    
    // Store the merged passage texts in the import data
    importData.passageTexts = Object.fromEntries(nodePassageTexts);
}

function completeDualImport() {
    if (!pendingTwineImport) return;
    
    // Load the map with the merged data
    loadImportedMapWithPassages(pendingTwineImport);
    
    // Hide the modal
    hideTwineFileModal();
}

function loadImportedMapWithPassages(importedData) {
    // Use the existing loadImportedMap function but also load passage texts
    loadImportedMap(importedData);
    
    // Load passage texts if they exist
    if (importedData.passageTexts) {
        // Clear existing passage texts
        passageTexts.clear();
        
        // Load the passage texts
        Object.entries(importedData.passageTexts).forEach(([nodeKey, passageData]) => {
            passageTexts.set(nodeKey, passageData);
        });
        
        console.log(`Loaded passage texts for ${Object.keys(importedData.passageTexts).length} nodes`);
    }
    
    // Load additional data if present
    if (importedData.projectTagLibrary) {
        importedData.projectTagLibrary.forEach(tag => projectTagLibrary.add(tag));
    }
    
    if (importedData.entryPointRegistry) {
        Object.entries(importedData.entryPointRegistry).forEach(([type, nodeKey]) => {
            entryPointRegistry.set(type, nodeKey);
        });
        updateEntryPointVisuals();
    }
}

// NEW: Navigation and interaction functionality
function setupNavigationListeners() {
    const gridContainer = document.querySelector('.grid-container');
    const mapGrid = document.getElementById('mapGrid');
    
    // Middle mouse button panning
    gridContainer.addEventListener('mousedown', handlePanStart);
    gridContainer.addEventListener('mousemove', handlePanMove);
    gridContainer.addEventListener('mouseup', handlePanEnd);
    gridContainer.addEventListener('mouseleave', handlePanEnd);
    
    // Zoom with Ctrl + scroll wheel
    gridContainer.addEventListener('wheel', handleZoom);
    
    // Arrow key navigation
    document.addEventListener('keydown', handleKeyNavigation);
    
    // Right-click selection
    mapGrid.addEventListener('contextmenu', handleRightClickStart);
    mapGrid.addEventListener('mousedown', handleSelectionStart);
    mapGrid.addEventListener('mousemove', handleSelectionMove);
    mapGrid.addEventListener('mouseup', handleSelectionEnd);
    
    // NEW: Add click handler to all grid cells for Ctrl+Click selection
    setupCellClickHandlers();
    
    // Apply initial transform
    updateMapTransform();
}

function setupCellClickHandlers() {
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });
}

function handleCellClick(e) {
    // Only handle Ctrl+Click for selection
    if (!e.ctrlKey && !e.metaKey) {
        // Let the event bubble up to the normal editNode handler
        return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const cell = e.currentTarget;
    const col = parseInt(cell.dataset.col);
    const row = parseInt(cell.dataset.row);
    const nodeKey = `${col},${row}`;
    
    if (navigationState.selectedNodes.has(nodeKey)) {
        // Deselect if already selected
        navigationState.selectedNodes.delete(nodeKey);
        cell.classList.remove('selected');
    } else {
        // Select the node
        navigationState.selectedNodes.add(nodeKey);
        cell.classList.add('selected');
    }
    
    updateBulkActionsUI();
    
    // Show bulk actions if nodes are selected
    if (navigationState.selectedNodes.size > 0) {
        showBulkActionsPanel();
    } else {
        hideBulkActionsPanel();
    }
}

function handlePanStart(e) {
    // Only handle middle mouse button (button 1)
    if (e.button === 1) {
        e.preventDefault();
        navigationState.isPanning = true;
        navigationState.lastPanX = e.clientX;
        navigationState.lastPanY = e.clientY;
        document.body.style.cursor = 'grabbing';
    }
}

function handlePanMove(e) {
    if (!navigationState.isPanning) return;
    
    e.preventDefault();
    const deltaX = e.clientX - navigationState.lastPanX;
    const deltaY = e.clientY - navigationState.lastPanY;
    
    mapViewState.panX += deltaX;
    mapViewState.panY += deltaY;
    
    navigationState.lastPanX = e.clientX;
    navigationState.lastPanY = e.clientY;
    
    updateMapTransform();
}

function handlePanEnd(e) {
    if (navigationState.isPanning) {
        navigationState.isPanning = false;
        document.body.style.cursor = '';
    }
}

function handleZoom(e) {
    // Only zoom when Ctrl is held
    if (!e.ctrlKey) return;
    
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = mapViewState.zoom * zoomFactor;
    
    // Constrain zoom level
    mapViewState.zoom = Math.max(mapViewState.minZoom, Math.min(mapViewState.maxZoom, newZoom));
    
    updateMapTransform();
}

function handleKeyNavigation(e) {
    // Don't interfere with input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
    }
    
    // Don't interfere with modals
    if (document.querySelector('.modal:not(.hidden)')) {
        return;
    }
    
    const moveDistance = 50; // pixels to move per keypress
    
    switch (e.key) {
        case 'ArrowUp':
            e.preventDefault();
            mapViewState.panY += moveDistance;
            updateMapTransform();
            break;
        case 'ArrowDown':
            e.preventDefault();
            mapViewState.panY -= moveDistance;
            updateMapTransform();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            mapViewState.panX += moveDistance;
            updateMapTransform();
            break;
        case 'ArrowRight':
            e.preventDefault();
            mapViewState.panX -= moveDistance;
            updateMapTransform();
            break;
        case 'Escape':
            // Clear selection
            clearSelection();
            break;
    }
}

function handleRightClickStart(e) {
    e.preventDefault(); // Prevent context menu
}

function handleSelectionStart(e) {
    // Only handle right mouse button for selection
    if (e.button === 2) {
        e.preventDefault();
        
        const rect = e.currentTarget.getBoundingClientRect();
        navigationState.isSelecting = true;
        navigationState.selectionStart = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        navigationState.selectionEnd = { ...navigationState.selectionStart };
        
        createSelectionBox();
    }
}

function handleSelectionMove(e) {
    if (!navigationState.isSelecting) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    navigationState.selectionEnd = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    
    updateSelectionBox();
    updateSelectedNodes();
}

function handleSelectionEnd(e) {
    if (navigationState.isSelecting && e.button === 2) {
        navigationState.isSelecting = false;
        finalizeSelection();
    }
}

function createSelectionBox() {
    if (selectionBox) {
        selectionBox.remove();
    }
    
    selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.position = 'absolute';
    selectionBox.style.border = '2px dashed var(--accent-color)';
    selectionBox.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
    selectionBox.style.pointerEvents = 'none';
    selectionBox.style.zIndex = '1000';
    
    document.getElementById('mapGrid').appendChild(selectionBox);
}

function updateSelectionBox() {
    if (!selectionBox) return;
    
    const start = navigationState.selectionStart;
    const end = navigationState.selectionEnd;
    
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
}

function updateSelectedNodes() {
    // Clear previous selection visual
    document.querySelectorAll('.grid-cell.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    
    navigationState.selectedNodes.clear();
    
    const start = navigationState.selectionStart;
    const end = navigationState.selectionEnd;
    
    const selectionRect = {
        left: Math.min(start.x, end.x),
        top: Math.min(start.y, end.y),
        right: Math.max(start.x, end.x),
        bottom: Math.max(start.y, end.y)
    };
    
    // Check each grid cell for intersection
    document.querySelectorAll('.grid-cell').forEach(cell => {
        const cellRect = cell.getBoundingClientRect();
        const gridRect = document.getElementById('mapGrid').getBoundingClientRect();
        
        const cellRelativeRect = {
            left: cellRect.left - gridRect.left,
            top: cellRect.top - gridRect.top,
            right: cellRect.right - gridRect.left,
            bottom: cellRect.bottom - gridRect.top
        };
        
        // Check if selection rectangle intersects with cell
        if (selectionRect.left < cellRelativeRect.right &&
            selectionRect.right > cellRelativeRect.left &&
            selectionRect.top < cellRelativeRect.bottom &&
            selectionRect.bottom > cellRelativeRect.top) {
            
            const col = parseInt(cell.dataset.col);
            const row = parseInt(cell.dataset.row);
            const nodeKey = `${col},${row}`;
            
            navigationState.selectedNodes.add(nodeKey);
            cell.classList.add('selected');
        }
    });
    
    updateBulkActionsUI();
}

function finalizeSelection() {
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }
    
    // Show bulk actions if nodes are selected
    if (navigationState.selectedNodes.size > 0) {
        showBulkActionsPanel();
    }
}

function clearSelection() {
    navigationState.selectedNodes.clear();
    document.querySelectorAll('.grid-cell.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    hideBulkActionsPanel();
    
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }
}

function updateMapTransform() {
    const mapGrid = document.getElementById('mapGrid');
    if (mapGrid) {
        mapGrid.style.transform = `translate(${mapViewState.panX}px, ${mapViewState.panY}px) scale(${mapViewState.zoom})`;
        mapGrid.style.transformOrigin = 'top left';
    }
}

function showBulkActionsPanel() {
    let panel = document.getElementById('bulkActionsPanel');
    if (!panel) {
        panel = createBulkActionsPanel();
    }
    panel.classList.remove('hidden');
    updateBulkActionsUI();
    updateBulkTagRemovalOptions(); // NEW: Update tag options when panel shows
}

function hideBulkActionsPanel() {
    const panel = document.getElementById('bulkActionsPanel');
    if (panel) {
        panel.classList.add('hidden');
    }
}

function createBulkActionsPanel() {
    const panel = document.createElement('div');
    panel.id = 'bulkActionsPanel';
    panel.className = 'bulk-actions-panel hidden';
    
    panel.innerHTML = `
        <div class="bulk-actions-header">
            <h3>Bulk Actions</h3>
            <span id="selectedCount">0 nodes selected</span>
            <button id="clearSelection" class="clear-selection-btn">&times;</button>
        </div>
        <div class="bulk-actions-content">
            <div class="bulk-action-group">
                <h4>Node Actions</h4>
                <button id="bulkDeleteNodes" class="bulk-action-btn danger">Delete Selected Nodes</button>
                <button id="bulkToggleFog" class="bulk-action-btn">Toggle Fog of War</button>
                <button id="bulkCopyNodes" class="bulk-action-btn">Copy Selected</button>
                <button id="bulkDeleteNodes" class="bulk-action-btn">Clear Node Data</button>
            </div>
            
            <div class="bulk-action-group">
                <h4>Tag Management</h4>
                <div class="bulk-tag-input-group">
                    <input type="text" id="bulkTagInput" placeholder="Enter tags to add (comma-separated)">
                    <button id="bulkAddTags" class="bulk-action-btn">Add Tags</button>
                </div>
                <div class="bulk-tag-remove-group">
                    <select id="bulkRemoveTagSelect">
                        <option value="">Select tag to remove...</option>
                    </select>
                    <button id="bulkRemoveTags" class="bulk-action-btn">Remove Tag</button>
                </div>
            </div>
            
            <div class="bulk-action-group">
                <h4>Style Settings</h4>
                <button id="bulkOpenStyleModal" class="bulk-action-btn">Edit Styles</button>
            </div>
            
            <div class="bulk-action-group">
                <h4>Transition Actions</h4>
                <label for="bulkTransitionType">Set transition type:</label>
                <select id="bulkTransitionType">
                    <option value="none">None</option>
                    <option value="bidirectional">Bidirectional</option>
                    <option value="one-way">One-Way</option>
                    <option value="locked">Locked</option>
                    <option value="secret">Secret</option>
                </select>
                <button id="applyBulkTransitions" class="bulk-action-btn">Apply to Selection</button>
            </div>
            
            <div class="bulk-action-group">
                <h4>Quick Actions</h4>
                <button id="bulkSelectConnected" class="bulk-action-btn">Select Connected</button>
                <button id="bulkSelectPath" class="bulk-action-btn">Select Path</button>
                <button id="bulkInvertSelection" class="bulk-action-btn">Invert Selection</button>
            </div>
        </div>
    `;
    
    // Add event listeners
    panel.querySelector('#clearSelection').addEventListener('click', clearSelection);
    panel.querySelector('#bulkDeleteNodes').addEventListener('click', bulkDeleteNodes);
    panel.querySelector('#bulkToggleFog').addEventListener('click', bulkToggleFog);
    panel.querySelector('#bulkCopyNodes').addEventListener('click', bulkCopyNodes);
    panel.querySelector('#bulkDeleteNodes').addEventListener('click', bulkDeleteNodes);
    panel.querySelector('#applyBulkTransitions').addEventListener('click', applyBulkTransitions);
    
    // NEW: Tag management listeners
    panel.querySelector('#bulkAddTags').addEventListener('click', bulkAddTags);
    panel.querySelector('#bulkRemoveTags').addEventListener('click', bulkRemoveTags);
    panel.querySelector('#bulkTagInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') bulkAddTags();
    });
    
    // NEW: Style editor listener
    panel.querySelector('#bulkOpenStyleModal').addEventListener('click', openBulkStyleModal);
    
    // NEW: Quick action listeners
    panel.querySelector('#bulkSelectConnected').addEventListener('click', bulkSelectConnected);
    panel.querySelector('#bulkSelectPath').addEventListener('click', bulkSelectPath);
    panel.querySelector('#bulkInvertSelection').addEventListener('click', bulkInvertSelection);
    
    document.body.appendChild(panel);
    return panel;
}

function updateBulkActionsUI() {
    const countElement = document.getElementById('selectedCount');
    if (countElement) {
        countElement.textContent = `${navigationState.selectedNodes.size} nodes selected`;
    }
}

function bulkAddTags() {
    const input = document.getElementById('bulkTagInput');
    const tagsToAdd = input.value.trim().split(',').map(tag => tag.trim()).filter(tag => tag);
    
    if (tagsToAdd.length === 0) {
        alert('Please enter at least one tag to add.');
        return;
    }
    
    let updatedCount = 0;
    
    navigationState.selectedNodes.forEach(nodeKey => {
        const nodeData = mapData.nodes.get(nodeKey);
        if (nodeData) {
            // Ensure tags is an array
            if (!Array.isArray(nodeData.tags)) {
                nodeData.tags = [];
            }
            
            // Add new tags that don't already exist
            tagsToAdd.forEach(tag => {
                if (!nodeData.tags.includes(tag)) {
                    nodeData.tags.push(tag);
                    projectTagLibrary.add(tag);
                }
            });
            
            updatedCount++;
            
            // Update display
            const [col, row] = nodeKey.split(',').map(Number);
            updateCellDisplay(document.querySelector(`[data-col="${col}"][data-row="${row}"]`), col, row);
        }
    });
    
    // Clear input
    input.value = '';
    
    // Update tag removal dropdown
    updateBulkTagRemovalOptions();
    
    alert(`Added tags to ${updatedCount} nodes.`);
}

function bulkRemoveTags() {
    const select = document.getElementById('bulkRemoveTagSelect');
    const tagToRemove = select.value;
    
    if (!tagToRemove) {
        alert('Please select a tag to remove.');
        return;
    }
    
    let updatedCount = 0;
    
    navigationState.selectedNodes.forEach(nodeKey => {
        const nodeData = mapData.nodes.get(nodeKey);
        if (nodeData && nodeData.tags) {
            const index = nodeData.tags.indexOf(tagToRemove);
            if (index > -1) {
                nodeData.tags.splice(index, 1);
                updatedCount++;
                
                // Update cell display
                const [col, row] = nodeKey.split(',').map(Number);
                const cell = document.querySelector(`[data-col="${col}"][data-row="${row}"]`);
                if (cell) {
                    updateCellDisplay(cell, col, row);
                }
            }
        }
    });
    
    // Reset selection
    select.value = '';
    
    // Update options
    updateBulkTagRemovalOptions();
    
    alert(`Removed tag "${tagToRemove}" from ${updatedCount} nodes.`);
}

function updateBulkTagRemovalOptions() {
    const select = document.getElementById('bulkRemoveTagSelect');
    if (!select) return;
    
    // Collect all unique tags from selected nodes
    const allTags = new Set();
    
    navigationState.selectedNodes.forEach(nodeKey => {
        const nodeData = mapData.nodes.get(nodeKey);
        if (nodeData && nodeData.tags) {
            nodeData.tags.forEach(tag => allTags.add(tag));
        }
    });
    
    // Update select options
    select.innerHTML = '<option value="">Select tag to remove...</option>';
    
    Array.from(allTags).sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        select.appendChild(option);
    });
}

function openBulkStyleModal() {
    createBulkStyleModal();
    document.getElementById('bulkStyleModal').classList.remove('hidden');
    
    // Initialize with common values or defaults
    initializeBulkStyleModal();
}

function createBulkStyleModal() {
    if (document.getElementById('bulkStyleModal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'bulkStyleModal';
    modal.className = 'modal hidden';
    
    modal.innerHTML = `
        <div class="modal-content bulk-style-modal">
            <div class="modal-header">
                <h2>Bulk Style Editor</h2>
                <span id="bulkStyleCount" class="style-count">Editing 0 nodes</span>
            </div>
            
            <div class="bulk-style-form">
                <div class="form-group">
                    <label>Icon Selection</label>
                    <div class="icon-selector-bulk">
                        <input type="hidden" id="bulkNodeIcon" value="">
                        <div class="selected-icon-display">
                            <div id="bulkSelectedIconSVG"></div>
                            <span id="bulkSelectedIconName">No Icon Selected</span>
                        </div>
                        <button type="button" id="bulkClearIcon" class="clear-icon-btn">Clear Icon</button>
                    </div>
                    <input type="text" id="bulkIconSearch" placeholder="Search icons..." class="icon-search">
                    <div id="bulkIconGrid" class="icon-grid"></div>
                </div>
                
                <div class="form-group">
                    <label>Colors & Pattern</label>
                    <div id="bulkColorPicker"></div>
                </div>
                
                <div class="form-group preview-group">
                    <label>Preview</label>
                    <div id="bulkStylePreview" class="bulk-style-preview">
                        <div class="preview-node">
                            <div class="node-content">
                                <i id="previewIcon" data-lucide="help-circle"></i>
                                <div class="node-name">Sample Node</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-actions">
                <button id="applyBulkStyles" class="primary-btn">Apply to Selected</button>
                <button id="cancelBulkStyles" class="secondary-btn">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Create color picker instance for bulk editor
    const bulkPicker = colorPickerSystem.createInstance('bulkColorPicker', {
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        showPattern: true,
        onColorChange: (colors) => {
            updateBulkStylePreview();
        }
    });
    
    // Store reference
    window.bulkColorPicker = bulkPicker;
    
    // Setup event listeners AFTER the modal is added to DOM
    setupBulkStyleModalListeners();
}

function setupBulkStyleModalListeners() {
    // Icon search and selection
    const iconSearch = document.getElementById('bulkIconSearch');
    if (iconSearch) {
        iconSearch.addEventListener('input', (e) => {
            renderBulkIconGrid(e.target.value);
        });
    }
    
    // Clear icon button
    const clearIconBtn = document.getElementById('bulkClearIcon');
    if (clearIconBtn) {
        clearIconBtn.addEventListener('click', () => {
            clearBulkIconSelection();
            updateBulkStylePreview();
        });
    }
    
    // Action buttons - these are the main fixes
    const applyBtn = document.getElementById('applyBulkStyles');
    const cancelBtn = document.getElementById('cancelBulkStyles');
    
    if (applyBtn) {
        applyBtn.addEventListener('click', applyBulkStyles);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeBulkStyleModal);
    }
}

function initializeBulkStyleModal() {
    // Update count
    document.getElementById('bulkStyleCount').textContent = `Editing ${navigationState.selectedNodes.size} nodes`;
    
    // Initialize icon grid
    renderBulkIconGrid('');
    
    // Set defaults or common values
    // You could analyze selected nodes for common values here
    updateBulkStylePreview();
}

function renderBulkIconGrid(filter = '') {
    const iconGrid = document.getElementById('bulkIconGrid');
    if (!iconGrid) return;
    
    iconGrid.innerHTML = '';
    
    // Get all available icons
    let allIcons = [];
    if (window.lucide && window.lucide.icons) {
        allIcons = Object.keys(window.lucide.icons)
            .map(name => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
                           .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
                           .toLowerCase())
            .sort();
    } else {
        allIcons = ['home', 'store', 'sword', 'shield', 'key', 'door-open', 'door-closed'];
    }
    
    const filteredIcons = allIcons.filter(icon => 
        icon.toLowerCase().includes(filter.toLowerCase())
    ).slice(0, 50); // Limit for performance
    
    filteredIcons.forEach(iconName => {
        const tile = document.createElement('div');
        tile.className = 'icon-tile';
        tile.setAttribute('data-icon', iconName);
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'icon-preview';
        const iconElement = document.createElement('i');
        iconElement.setAttribute('data-lucide', iconName);
        iconDiv.appendChild(iconElement);
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'icon-name';
        nameDiv.textContent = iconName;
        
        tile.appendChild(iconDiv);
        tile.appendChild(nameDiv);
        tile.addEventListener('click', () => selectBulkIcon(iconName));
        iconGrid.appendChild(tile);
    });
    
    // Re-render Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

function selectBulkIcon(iconName) {
    const iconInput = document.getElementById('bulkNodeIcon');
    const selectedIconName = document.getElementById('bulkSelectedIconName');
    const selectedIconSVG = document.getElementById('bulkSelectedIconSVG');
    
    iconInput.value = iconName;
    selectedIconName.textContent = iconName;
    
    selectedIconSVG.innerHTML = '';
    const iconElement = document.createElement('i');
    iconElement.setAttribute('data-lucide', iconName);
    selectedIconSVG.appendChild(iconElement);
    
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // Highlight selected
    document.querySelectorAll('#bulkIconGrid .icon-tile').forEach(tile => {
        tile.classList.toggle('selected', tile.dataset.icon === iconName);
    });
    
    updateBulkStylePreview();
}

function clearBulkIconSelection() {
    document.getElementById('bulkNodeIcon').value = '';
    document.getElementById('bulkSelectedIconName').textContent = 'No Icon Selected';
    document.getElementById('bulkSelectedIconSVG').innerHTML = '';
    
    document.querySelectorAll('#bulkIconGrid .icon-tile').forEach(tile => {
        tile.classList.remove('selected');
    });
}

function updateBulkStylePreview() {
    const preview = document.querySelector('#bulkStylePreview .preview-node');
    const icon = document.getElementById('bulkNodeIcon').value;
    const primaryColor = document.getElementById('bulkPrimaryColor').value;
    const secondaryColor = document.getElementById('bulkSecondaryColor').value;
    const pattern = document.getElementById('bulkPattern').value;
    
    // Apply styles
    preview.style.backgroundColor = primaryColor;
    preview.style.setProperty('--node-primary-color', primaryColor);
    preview.style.setProperty('--node-secondary-color', secondaryColor);
    
    // Remove old pattern classes
    preview.classList.remove(
        'node-pattern-diagonal-stripes', 'node-pattern-vertical-stripes',
        'node-pattern-horizontal-stripes', 'node-pattern-dots',
        'node-pattern-grid', 'node-pattern-checkerboard'
    );
    
    // Apply pattern
    if (pattern !== 'none') {
        preview.classList.add(`node-pattern-${pattern}`);
    }
    
    // Update icon
    const iconElement = preview.querySelector('i');
    if (icon) {
        iconElement.setAttribute('data-lucide', icon);
    } else {
        iconElement.setAttribute('data-lucide', 'help-circle');
    }
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

function applyBulkStyles() {
    if (navigationState.selectedNodes.size === 0) {
        alert('No nodes selected.');
        return;
    }
    
    const icon = document.getElementById('bulkNodeIcon')?.value || '';
    
    // Get colors from bulk color picker
    let colors = { primary: '#007bff', secondary: '#6c757d' };
    let pattern = 'none';
    
    if (window.bulkColorPicker) {
        colors = window.bulkColorPicker.getColors();
        const patternSelect = document.querySelector('#bulkColorPicker .pattern-select');
        if (patternSelect) {
            pattern = patternSelect.value || 'none';
        }
    }
    
    let updatedCount = 0;
    
    navigationState.selectedNodes.forEach(nodeKey => {
        let nodeData = mapData.nodes.get(nodeKey);
        
        // Create node data if it doesn't exist
        if (!nodeData) {
            const [col, row] = nodeKey.split(',').map(Number);
            setNodeData(col, row, {});
            nodeData = mapData.nodes.get(nodeKey);
        }
        
        if (nodeData) {
            // Update icon if one was selected
            if (icon) {
                nodeData.icon = icon;
            }
            
            // Update style
            if (!nodeData.style) nodeData.style = {};
            nodeData.style.primaryColor = colors.primary;
            nodeData.style.secondaryColor = colors.secondary;
            nodeData.style.pattern = pattern;
            
            updatedCount++;
            
            // Update cell display
            const [col, row] = nodeKey.split(',').map(Number);
            const cell = document.querySelector(`[data-col="${col}"][data-row="${row}"]`);
            if (cell) {
                updateCellDisplay(cell, col, row);
                applyNodeStyling(cell, nodeData);
            }
        }
    });
    
    // Add colors to recent
    if (window.colorPickerSystem) {
        colorPickerSystem.addRecentColor(colors.primary);
        if (colors.secondary !== '#6c757d') {
            colorPickerSystem.addRecentColor(colors.secondary);
        }
    }
    
    closeBulkStyleModal();
    alert(`Updated styles for ${updatedCount} nodes.`);
}

function closeBulkStyleModal() {
    const modal = document.getElementById('bulkStyleModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// NEW: Additional bulk selection functions
function bulkCopyNodes() {
    if (navigationState.selectedNodes.size === 0) return;
    
    // Store copied nodes data
    const copiedNodes = [];
    navigationState.selectedNodes.forEach(nodeKey => {
        const nodeData = mapData.nodes.get(nodeKey);
        if (nodeData) {
            const [col, row] = nodeKey.split(',').map(Number);
            copiedNodes.push({
                col, row,
                data: JSON.parse(JSON.stringify(nodeData)) // Deep copy
            });
        }
    });
    
    // Store in clipboard (you could enhance this with actual clipboard API)
    window.copiedMapNodes = copiedNodes;
    alert(`Copied ${copiedNodes.length} nodes. Use Ctrl+V on an empty area to paste.`);
}

function bulkDeleteNodes() {
    if (navigationState.selectedNodes.size === 0) return;

    const confirmed = confirm(`Clear data from ${navigationState.selectedNodes.size} selected nodes? The nodes will remain but all their content and transitions will be erased.`);
    if (!confirmed) return;

    navigationState.selectedNodes.forEach(nodeKey => {
        const [col, row] = nodeKey.split(',').map(Number);

        // Reset node data (but keep the node object in place)
        mapData.nodes.set(nodeKey, {
            name: '',
            passage: '',
            icon: '',
            fogOfWar: false,
            tags: [],
            style: {
                primaryColor: '#007bff',
                secondaryColor: '#6c757d',
                pattern: 'none'
            },
            conditions: [],
            transitions: {}
        });

        // Remove all transitions involving this node
        const transitionsToRemove = [];
        for (const [key, transition] of mapData.transitions) {
            const [from, to] = key.split('-');
            if (from === nodeKey || to === nodeKey) {
                transitionsToRemove.push(key);
            }
        }
        transitionsToRemove.forEach(key => mapData.transitions.delete(key));

        // Update cell display
        const cell = document.querySelector(`[data-col="${col}"][data-row="${row}"]`);
        if (cell) {
            updateCellDisplay(cell, col, row);
        }
    });

    // Refresh surrounding visuals
    navigationState.selectedNodes.forEach(nodeKey => {
        const [col, row] = nodeKey.split(',').map(Number);
        updateSurroundingCells(col, row);
    });

    clearSelection();
    alert(`Cleared ${navigationState.selectedNodes.size} nodes.`);
}

function bulkSelectConnected() {
    if (navigationState.selectedNodes.size === 0) return;
    
    const connected = new Set(navigationState.selectedNodes);
    const toCheck = Array.from(navigationState.selectedNodes);
    
    while (toCheck.length > 0) {
        const current = toCheck.pop();
        const [col, row] = current.split(',').map(Number);
        
        // Check all four directions
        const neighbors = [
            `${col+1},${row}`, `${col-1},${row}`,
            `${col},${row+1}`, `${col},${row-1}`
        ];
        
        neighbors.forEach(neighbor => {
            if (!connected.has(neighbor)) {
                // Check if there's a transition between current and neighbor
                const transitionKey1 = `${current}-${neighbor}`;
                const transitionKey2 = `${neighbor}-${current}`;
                
                if (mapData.transitions.has(transitionKey1) || mapData.transitions.has(transitionKey2)) {
                    connected.add(neighbor);
                    toCheck.push(neighbor);
                }
            }
        });
    }
    
    // Update selection
    navigationState.selectedNodes = connected;
    
    // Update visual selection
    document.querySelectorAll('.grid-cell').forEach(cell => {
        const nodeKey = `${cell.dataset.col},${cell.dataset.row}`;
        cell.classList.toggle('selected', navigationState.selectedNodes.has(nodeKey));
    });
    
    updateBulkActionsUI();
}

function bulkSelectPath() {
    if (navigationState.selectedNodes.size !== 2) {
        alert('Please select exactly 2 nodes to find a path between them.');
        return;
    }
    
    const nodes = Array.from(navigationState.selectedNodes);
    const start = nodes[0];
    const end = nodes[1];
    
    // Simple pathfinding (BFS)
    const path = findPath(start, end);
    
    if (path) {
        navigationState.selectedNodes = new Set(path);
        
        // Update visual selection
        document.querySelectorAll('.grid-cell').forEach(cell => {
            const nodeKey = `${cell.dataset.col},${cell.dataset.row}`;
            cell.classList.toggle('selected', navigationState.selectedNodes.has(nodeKey));
        });
        
        updateBulkActionsUI();
    } else {
        alert('No path found between the selected nodes.');
    }
}

function findPath(start, end) {
    const queue = [[start]];
    const visited = new Set([start]);
    
    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];
        
        if (current === end) {
            return path;
        }
        
        const [col, row] = current.split(',').map(Number);
        const neighbors = [
            `${col+1},${row}`, `${col-1},${row}`,
            `${col},${row+1}`, `${col},${row-1}`
        ];
        
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                // Check if there's a transition
                const transitionKey1 = `${current}-${neighbor}`;
                const transitionKey2 = `${neighbor}-${current}`;
                
                if (mapData.transitions.has(transitionKey1) || mapData.transitions.has(transitionKey2)) {
                    visited.add(neighbor);
                    queue.push([...path, neighbor]);
                }
            }
        }
    }
    
    return null;
}

function bulkInvertSelection() {
    const allNodeKeys = new Set();
    
    // Get all nodes with data
    for (const nodeKey of mapData.nodes.keys()) {
        allNodeKeys.add(nodeKey);
    }
    
    // Invert selection
    const newSelection = new Set();
    allNodeKeys.forEach(nodeKey => {
        if (!navigationState.selectedNodes.has(nodeKey)) {
            newSelection.add(nodeKey);
        }
    });
    
    navigationState.selectedNodes = newSelection;
    
    // Update visual selection
    document.querySelectorAll('.grid-cell').forEach(cell => {
        const nodeKey = `${cell.dataset.col},${cell.dataset.row}`;
        cell.classList.toggle('selected', navigationState.selectedNodes.has(nodeKey));
    });
    
    updateBulkActionsUI();
    
    if (navigationState.selectedNodes.size > 0) {
        showBulkActionsPanel();
    } else {
        hideBulkActionsPanel();
    }
}

function bulkToggleFog() {
    if (navigationState.selectedNodes.size === 0) return;
    
    // Determine if we should enable or disable fog based on majority
    let fogCount = 0;
    navigationState.selectedNodes.forEach(nodeKey => {
        const nodeData = mapData.nodes.get(nodeKey);
        if (nodeData && nodeData.fogOfWar) {
            fogCount++;
        }
    });
    
    const shouldEnableFog = fogCount < navigationState.selectedNodes.size / 2;
    
    navigationState.selectedNodes.forEach(nodeKey => {
        const nodeData = mapData.nodes.get(nodeKey);
        if (nodeData) {
            nodeData.fogOfWar = shouldEnableFog;
            
            // Update cell display
            const [col, row] = nodeKey.split(',').map(Number);
            const cell = document.querySelector(`[data-col="${col}"][data-row="${row}"]`);
            if (cell) {
                updateCellDisplay(cell, col, row);
            }
        }
    });
}

function applyBulkTransitions() {
    if (navigationState.selectedNodes.size === 0) return;
    
    const transitionType = document.getElementById('bulkTransitionType').value;
    const selectedArray = Array.from(navigationState.selectedNodes);
    
    // Apply transitions within the selection area only
    selectedArray.forEach(nodeKey => {
        const [col, row] = nodeKey.split(',').map(Number);
        
        // Check each direction for connections within selection
        const directions = [
            { dx: 1, dy: 0, dir: 'east' },
            { dx: 0, dy: 1, dir: 'south' },
            { dx: -1, dy: 0, dir: 'west' },
            { dx: 0, dy: -1, dir: 'north' }
        ];
        
        directions.forEach(({ dx, dy, dir }) => {
            const targetCol = col + dx;
            const targetRow = row + dy;
            const targetKey = `${targetCol},${targetRow}`;
            
            // Only apply if target is also in selection
            if (navigationState.selectedNodes.has(targetKey)) {
                const transitionKey = `${col},${row}-${targetCol},${targetRow}`;
                
                if (transitionType === 'none') {
                    mapData.transitions.delete(transitionKey);
                } else {
                    mapData.transitions.set(transitionKey, {
                        type: transitionType,
                        direction: transitionType === 'one-way' ? dir : null,
                        conditions: []
                    });
                }
            }
        });
    });
    
    // Update transition connectors for all affected cells
    selectedArray.forEach(nodeKey => {
        const [col, row] = nodeKey.split(',').map(Number);
        updateTransitionConnectors(col, row);
    });
    
    alert(`Applied ${transitionType} transitions to ${navigationState.selectedNodes.size} selected nodes.`);
}

function updateConditionModalWithColorPicker() {
    // Add color picker container to condition modal if it has style options
    const conditionModal = document.getElementById('conditionModal');
    if (!conditionModal) return;
    
    // Find or create style section
    let styleSection = conditionModal.querySelector('.condition-style-section');
    if (!styleSection) {
        styleSection = document.createElement('div');
        styleSection.className = 'condition-style-section form-group';
        styleSection.innerHTML = `
            <label>Condition Style (Optional)</label>
            <div id="conditionColorPicker"></div>
        `;
        
        // Insert before form actions
        const formActions = conditionModal.querySelector('.form-actions');
        formActions.parentNode.insertBefore(styleSection, formActions);
    }
    
    // Create color picker instance
    const conditionPicker = colorPickerSystem.createInstance('conditionColorPicker', {
        primaryColor: '#ffc107',
        secondaryColor: '#6c757d',
        showPattern: false,
        onColorChange: (colors) => {
            // Store colors for condition
            if (window.currentConditionColors) {
                window.currentConditionColors = colors;
            }
        }
    });
    
    window.conditionColorPicker = conditionPicker;
}


// Color Picker System
class ColorPickerSystem {
    constructor() {
        this.recentColors = this.loadRecentColors();
        this.maxRecentColors = 10;
        this.activeInstances = new Map();
    }
    
    loadRecentColors() {
        const stored = localStorage.getItem('twine-map-recent-colors');
        return stored ? JSON.parse(stored) : [];
    }
    
    saveRecentColors() {
        localStorage.setItem('twine-map-recent-colors', JSON.stringify(this.recentColors));
    }
    
    addRecentColor(color) {
        // Normalize color to hex
        const hex = this.normalizeColor(color);
        
        // Remove if already exists
        const index = this.recentColors.indexOf(hex);
        if (index > -1) {
            this.recentColors.splice(index, 1);
        }
        
        // Add to front
        this.recentColors.unshift(hex);
        
        // Trim to max
        if (this.recentColors.length > this.maxRecentColors) {
            this.recentColors = this.recentColors.slice(0, this.maxRecentColors);
        }
        
        this.saveRecentColors();
        this.updateAllInstances();
    }
    
    normalizeColor(color) {
        // Convert any color format to hex
        const div = document.createElement('div');
        div.style.color = color;
        document.body.appendChild(div);
        const computed = window.getComputedStyle(div).color;
        document.body.removeChild(div);
        
        // Convert rgb to hex
        const match = computed.match(/\d+/g);
        if (match) {
            const [r, g, b] = match.map(Number);
            return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        }
        return color;
    }
    
    createInstance(containerId, options = {}) {
        const instance = new ColorPickerInstance(this, containerId, options);
        this.activeInstances.set(containerId, instance);
        return instance;
    }
    
    updateAllInstances() {
        this.activeInstances.forEach(instance => instance.updateRecentColors());
    }
}


class ColorPickerInstance {
    constructor(system, containerId, options) {
        this.system = system;
        this.container = document.getElementById(containerId);
        this.options = {
            primaryColor: '#007bff',
            secondaryColor: '#6c757d',
            showPattern: true,
            onColorChange: null,
            ...options
        };
        
        this.activeSwatch = 'primary';
        this.colors = {
            primary: this.options.primaryColor,
            secondary: this.options.secondaryColor
        };
        
        this.currentHue = 0;
        this.currentSaturation = 100;
        this.currentLightness = 50;
        
        this.render();
        this.attachEventListeners();
        this.updateCursorsFromColor(this.colors[this.activeSwatch]);
    }
    
    render() {
        this.container.innerHTML = `
            <div class="unified-color-picker">
                <div class="color-swatches">
                    <div class="swatch-group">
                        <label>Primary</label>
                        <div class="color-swatch primary active" data-swatch="primary" style="background-color: ${this.colors.primary}"></div>
                    </div>
                    <div class="swatch-group">
                        <label>Secondary</label>
                        <div class="color-swatch secondary" data-swatch="secondary" style="background-color: ${this.colors.secondary}"></div>
                    </div>
                </div>
                
                <div class="color-picker-main">
                    <div class="color-gradient-picker">
                        <canvas class="color-canvas" width="200" height="150"></canvas>
                        <div class="color-cursor"></div>
                    </div>
                    <div class="color-slider">
                        <canvas class="hue-canvas" width="20" height="150"></canvas>
                        <div class="hue-cursor"></div>
                    </div>
                </div>
                
                <div class="color-inputs">
                    <div class="hex-input-group">
                        <label>HEX</label>
                        <input type="text" class="hex-input" value="${this.colors[this.activeSwatch]}" placeholder="#000000">
                    </div>
                    <div class="rgb-inputs">
                        <div class="rgb-group">
                            <label>R</label>
                            <input type="number" class="rgb-r" min="0" max="255" value="0">
                        </div>
                        <div class="rgb-group">
                            <label>G</label>
                            <input type="number" class="rgb-g" min="0" max="255" value="0">
                        </div>
                        <div class="rgb-group">
                            <label>B</label>
                            <input type="number" class="rgb-b" min="0" max="255" value="0">
                        </div>
                    </div>
                </div>
                
                <div class="recent-colors-section">
                    <label>Recent:</label>
                    <div class="recent-colors"></div>
                </div>
                
                ${this.options.showPattern ? `
                    <div class="pattern-selector">
                        <label>Pattern:</label>
                        <select class="pattern-select">
                            <option value="none">None</option>
                            <option value="diagonal-stripes">Diagonal Stripes</option>
                            <option value="vertical-stripes">Vertical Stripes</option>
                            <option value="horizontal-stripes">Horizontal Stripes</option>
                            <option value="dots">Dots</option>
                            <option value="grid">Grid</option>
                            <option value="checkerboard">Checkerboard</option>
                        </select>
                    </div>
                ` : ''}
            </div>
        `;
        
        this.initializeColorCanvas();
        this.updateRecentColors();
        this.updateColorInputs();
    }
    
    initializeColorCanvas() {
        this.colorCanvas = this.container.querySelector('.color-canvas');
        this.colorCtx = this.colorCanvas.getContext('2d');
        this.hueCanvas = this.container.querySelector('.hue-canvas');
        this.hueCtx = this.hueCanvas.getContext('2d');
        
        this.drawHueSlider();
        this.drawColorGradient(0);
    }
    
    drawHueSlider() {
        const gradient = this.hueCtx.createLinearGradient(0, 0, 0, 150);
        for (let i = 0; i <= 360; i += 60) {
            gradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
        }
        this.hueCtx.fillStyle = gradient;
        this.hueCtx.fillRect(0, 0, 20, 150);
    }
    
    drawColorGradient(hue) {
        // Create saturation gradient (left to right)
        const satGradient = this.colorCtx.createLinearGradient(0, 0, 200, 0);
        satGradient.addColorStop(0, `hsl(${hue}, 0%, 50%)`);
        satGradient.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
        this.colorCtx.fillStyle = satGradient;
        this.colorCtx.fillRect(0, 0, 200, 150);
        
        // Create lightness gradient (top to bottom)
        const lightGradient = this.colorCtx.createLinearGradient(0, 0, 0, 150);
        lightGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        lightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        lightGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
        lightGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
        this.colorCtx.fillStyle = lightGradient;
        this.colorCtx.fillRect(0, 0, 200, 150);
    }
    

    attachEventListeners() {
        // Swatch selection
        this.container.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => this.selectSwatch(swatch.dataset.swatch));
        });
        
        // Color canvas interaction with drag support
        let isDragging = false;
        this.colorCanvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            this.handleColorCanvasClick(e);
            const handleDrag = (e) => {
                if (isDragging) this.handleColorCanvasClick(e);
            };
            const handleRelease = () => {
                isDragging = false;
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', handleRelease);
            };
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleRelease);
        });
        
        // Hue canvas interaction with drag support
        let isHueDragging = false;
        this.hueCanvas.addEventListener('mousedown', (e) => {
            isHueDragging = true;
            this.handleHueCanvasClick(e);
            const handleDrag = (e) => {
                if (isHueDragging) this.handleHueCanvasClick(e);
            };
            const handleRelease = () => {
                isHueDragging = false;
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', handleRelease);
            };
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleRelease);
        });
        
        // Input changes
        this.container.querySelector('.hex-input').addEventListener('input', (e) => {
            this.updateFromHex(e.target.value);
        });
        
        ['r', 'g', 'b'].forEach(channel => {
            this.container.querySelector(`.rgb-${channel}`).addEventListener('input', () => {
                this.updateFromRGB();
            });
        });
        
        // Recent color clicks
        this.container.querySelector('.recent-colors').addEventListener('click', (e) => {
            if (e.target.classList.contains('recent-color')) {
                this.setColor(e.target.dataset.color);
            }
        });
        
        // Pattern change
        if (this.options.showPattern) {
            this.container.querySelector('.pattern-select').addEventListener('change', (e) => {
                if (this.options.onColorChange) {
                    this.options.onColorChange({
                        primary: this.colors.primary,
                        secondary: this.colors.secondary,
                        pattern: e.target.value
                    });
                }
            });
        }
    }


    handleColorCanvasClick(e) {
        const rect = this.colorCanvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(200, e.clientX - rect.left));
        const y = Math.max(0, Math.min(150, e.clientY - rect.top));
        
        // Update cursor position
        const cursor = this.container.querySelector('.color-cursor');
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
        
        // Get color at position
        const imageData = this.colorCtx.getImageData(x, y, 1, 1);
        const [r, g, b] = imageData.data;
        const hex = this.rgbToHex(r, g, b);
        
        this.setColor(hex, false); // false = don't update cursors since we're manually positioning
    }
    
    handleHueCanvasClick(e) {
        const rect = this.hueCanvas.getBoundingClientRect();
        const y = Math.max(0, Math.min(150, e.clientY - rect.top));
        const hue = (y / 150) * 360;
        
        // Update cursor position
        const cursor = this.container.querySelector('.hue-cursor');
        cursor.style.top = `${y}px`;
        cursor.style.left = '50%';
        
        this.currentHue = hue;
        this.drawColorGradient(hue);
        
        // Update the color to match the new hue while maintaining saturation/lightness
        const currentColor = this.colors[this.activeSwatch];
        const currentRgb = this.hexToRgb(currentColor);
        const currentHsl = this.rgbToHsl(currentRgb.r, currentRgb.g, currentRgb.b);
        
        // Convert back to RGB with new hue
        const newRgb = this.hslToRgb(hue, currentHsl.s, currentHsl.l);
        const newHex = this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        
        this.setColor(newHex, false);
    }
    
    hslToRgb(h, s, l) {
        h = h / 360;
        s = s / 100;
        l = l / 100;
        
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }
    
    selectSwatch(swatch) {
        this.activeSwatch = swatch;
        
        // Update active state
        this.container.querySelectorAll('.color-swatch').forEach(s => {
            s.classList.toggle('active', s.dataset.swatch === swatch);
        });
        
        // Update color inputs to show active swatch color
        this.updateColorInputs();
    }
    
    handleColorCanvasClick(e) {
        const rect = this.colorCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Get color at position
        const imageData = this.colorCtx.getImageData(x, y, 1, 1);
        const [r, g, b] = imageData.data;
        const hex = this.rgbToHex(r, g, b);
        
        this.setColor(hex);
    }
    
    handleHueCanvasClick(e) {
        const rect = this.hueCanvas.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const hue = (y / 150) * 360;
        
        this.drawColorGradient(hue);
        this.currentHue = hue;
    }
    
    setColor(color, updateCursors = true) {
        this.colors[this.activeSwatch] = color;
        
        // Update swatch
        this.container.querySelector(`.color-swatch.${this.activeSwatch}`).style.backgroundColor = color;
        
        // Update inputs
        this.updateColorInputs();
        
        // Update cursors if needed
        if (updateCursors) {
            this.updateCursorsFromColor(color);
        }
        
        // DON'T add to recent colors here - only on save
        
        // Trigger callback
        if (this.options.onColorChange) {
            this.options.onColorChange({
                primary: this.colors.primary,
                secondary: this.colors.secondary,
                pattern: this.container.querySelector('.pattern-select')?.value || 'none'
            });
        }
    }
    
    updateFromHex(hex) {
        if (/^#[0-9A-F]{6}$/i.test(hex)) {
            this.setColor(hex);
        }
    }
    
    updateFromRGB() {
        const r = parseInt(this.container.querySelector('.rgb-r').value) || 0;
        const g = parseInt(this.container.querySelector('.rgb-g').value) || 0;
        const b = parseInt(this.container.querySelector('.rgb-b').value) || 0;
        const hex = this.rgbToHex(r, g, b);
        this.setColor(hex);
    }
    
    updateColorInputs() {
        const color = this.colors[this.activeSwatch];
        const rgb = this.hexToRgb(color);
        
        this.container.querySelector('.hex-input').value = color;
        this.container.querySelector('.rgb-r').value = rgb.r;
        this.container.querySelector('.rgb-g').value = rgb.g;
        this.container.querySelector('.rgb-b').value = rgb.b;
    }
    
    updateRecentColors() {
        const container = this.container.querySelector('.recent-colors');
        container.innerHTML = this.system.recentColors
            .map(color => `<div class="recent-color" data-color="${color}" style="background-color: ${color}"></div>`)
            .join('');
    }
    
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
    
    getColors() {
        return { ...this.colors };
    }
    
    setColors(primary, secondary) {
        this.colors.primary = primary;
        this.colors.secondary = secondary;
        
        // Update swatch colors
        this.container.querySelector('.color-swatch.primary').style.backgroundColor = primary;
        this.container.querySelector('.color-swatch.secondary').style.backgroundColor = secondary;
        
        // Update inputs to reflect the active swatch
        this.updateColorInputs();
        
        // Update cursors to reflect the new color
        this.updateCursorsFromColor(this.colors[this.activeSwatch]);
    }

    updateCursorsFromColor(hex) {
        const rgb = this.hexToRgb(hex);
        const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
        
        // Update hue cursor
        const hueY = (hsl.h / 360) * 150;
        const hueCursor = this.container.querySelector('.hue-cursor');
        if (hueCursor) {
            hueCursor.style.top = `${hueY}px`;
            hueCursor.style.left = '50%';
        }
        
        // Redraw color gradient with new hue
        this.currentHue = hsl.h;
        this.drawColorGradient(hsl.h);
        
        // Update color cursor position
        const colorX = (hsl.s / 100) * 200;
        const colorY = ((100 - hsl.l) / 100) * 150;
        
        const colorCursor = this.container.querySelector('.color-cursor');
        if (colorCursor) {
            colorCursor.style.left = `${colorX}px`;
            colorCursor.style.top = `${colorY}px`;
        }
    }

    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    // Add keyboard support
    attachKeyboardListeners() {
        this.container.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && !e.shiftKey) {
                // Switch between swatches
                e.preventDefault();
                const newSwatch = this.activeSwatch === 'primary' ? 'secondary' : 'primary';
                this.selectSwatch(newSwatch);
            } else if (e.key === 'Enter') {
                // Confirm color selection
                this.system.addRecentColor(this.colors[this.activeSwatch]);
            }
        });
    }

    // Add eyedropper functionality
    addEyedropperTool() {
        const button = document.createElement('button');
        button.className = 'eyedropper-btn';
        button.innerHTML = '<i data-lucide="pipette"></i>';
        button.title = 'Pick color from map';
        
        button.addEventListener('click', () => {
            this.startEyedropper();
        });
        
        this.container.querySelector('.color-inputs').appendChild(button);
    }

    startEyedropper() {
        document.body.style.cursor = 'crosshair';
        
        const handleClick = (e) => {
            const cell = e.target.closest('.grid-cell');
            if (cell) {
                const computedStyle = window.getComputedStyle(cell);
                const bgColor = computedStyle.backgroundColor;
                this.setColor(this.system.normalizeColor(bgColor));
            }
            
            document.body.style.cursor = '';
            document.removeEventListener('click', handleClick);
        };
        
        document.addEventListener('click', handleClick);
    }

    // Add preset palettes
    addPresetPalettes() {
        const palettes = {
            'Forest': ['#228B22', '#8B4513', '#006400', '#8FBC8F'],
            'Ocean': ['#006994', '#0099CC', '#40E0D0', '#1E90FF'],
            'Sunset': ['#FF6347', '#FF8C00', '#FFD700', '#FF1493'],
            'Monochrome': ['#000000', '#404040', '#808080', '#C0C0C0']
        };
        
        const paletteContainer = document.createElement('div');
        paletteContainer.className = 'preset-palettes';
        paletteContainer.innerHTML = `
            <label>Presets:</label>
            <select class="palette-select">
                <option value="">Choose palette...</option>
                ${Object.keys(palettes).map(name => 
                    `<option value="${name}">${name}</option>`
                ).join('')}
            </select>
        `;
        
        paletteContainer.querySelector('.palette-select').addEventListener('change', (e) => {
            const palette = palettes[e.target.value];
            if (palette) {
                // Add palette colors to recent
                palette.forEach(color => this.system.addRecentColor(color));
            }
        });
        
        this.container.querySelector('.recent-colors-section').after(paletteContainer);
    }
}

// Initialize global color picker system
const colorPickerSystem = new ColorPickerSystem();

// Undo/Redo System
function saveState(action) {
    const state = {
        action: action,
        timestamp: Date.now(),
        mapData: {
            name: mapData.name,
            width: mapData.width,
            height: mapData.height,
            nodes: new Map(mapData.nodes),
            transitions: new Map(mapData.transitions)
        },
        passageTexts: new Map(passageTexts)
    };
    
    undoStack.push(state);
    
    // Limit undo stack size
    if (undoStack.length > MAX_UNDO_HISTORY) {
        undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    redoStack = [];
    
    updateUndoRedoButtons();
}

function performUndo() {
    if (undoStack.length === 0) return;

    // Save current state to redo stack
    const currentState = {
        action: 'redo_point',
        timestamp: Date.now(),
        mapData: {
            name: mapData.name,
            width: mapData.width,
            height: mapData.height,
            nodes: new Map(mapData.nodes),
            transitions: new Map(mapData.transitions)
        },
        passageTexts: new Map(passageTexts)
    };
    redoStack.push(currentState);

    // Restore previous state
    const previousState = undoStack.pop();
    restoreState(previousState);

    updateUndoRedoButtons();
}

function performRedo() {
    if (redoStack.length === 0) return;

    // Save current state to undo stack
    const currentState = {
        action: 'undo_point',
        timestamp: Date.now(),
        mapData: {
            name: mapData.name,
            width: mapData.width,
            height: mapData.height,
            nodes: new Map(mapData.nodes),
            transitions: new Map(mapData.transitions)
        },
        passageTexts: new Map(passageTexts)
    };
    undoStack.push(currentState);

    // Restore next state
    const nextState = redoStack.pop();
    restoreState(nextState);

    updateUndoRedoButtons();
}

function restoreState(state) {
    mapData = {
        name: state.mapData.name,
        width: state.mapData.width,
        height: state.mapData.height,
        nodes: new Map(state.mapData.nodes),
        transitions: new Map(state.mapData.transitions)
    };

    passageTexts = new Map(state.passageTexts);

    // Update UI
    document.getElementById('mapTitle').textContent = `Twine Map Editor - ${mapData.name}`;
    generateGrid();
    applyAllNodeStyling();
    closeSidebar();

    // ✅ Refresh all transition visuals
    for (let row = 0; row < mapData.height; row++) {
        for (let col = 0; col < mapData.width; col++) {
            updateTransitionConnectors(col, row);
        }
    }
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
}

// Node Styling System
function setupStyleControls() {
    const styleContainer = document.querySelector('.style-controls');
    if (!styleContainer) return;
    
    // Clear old content
    styleContainer.innerHTML = '<div id="nodeColorPicker"></div>';
    
    // Create color picker instance for node editor
    const nodePicker = colorPickerSystem.createInstance('nodeColorPicker', {
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        showPattern: true,
        onColorChange: (colors) => {
            if (currentEditingNode) {
                // Update node data
                const nodeKey = `${currentEditingNode.col},${currentEditingNode.row}`;
                const nodeData = mapData.nodes.get(nodeKey);
                if (nodeData) {
                    if (!nodeData.style) nodeData.style = {};
                    nodeData.style.primaryColor = colors.primary;
                    nodeData.style.secondaryColor = colors.secondary;
                    nodeData.style.pattern = colors.pattern;
                    
                    // Update visual
                    const cell = document.querySelector(`[data-col="${currentEditingNode.col}"][data-row="${currentEditingNode.row}"]`);
                    if (cell) {
                        updateCellDisplay(cell, currentEditingNode.col, currentEditingNode.row);
                        applyNodeStyling(cell, nodeData);
                    }
                }
                saveNodeMemory();
            }
        }
    });
    
    // Store reference
    window.nodeColorPicker = nodePicker;
}

function applyNodeStyling(cell, nodeData) {
    if (!nodeData || !nodeData.style) return;

    const { primaryColor, secondaryColor, pattern } = nodeData.style;

    // Apply primary color
    if (primaryColor && primaryColor !== '#007bff') {
        cell.style.backgroundColor = primaryColor;
        cell.style.setProperty('--node-primary-color', primaryColor);
    }

    // Apply secondary color for patterns
    if (secondaryColor && secondaryColor !== '#6c757d') {
        cell.style.setProperty('--node-secondary-color', secondaryColor);
    }

    // Reset any old pattern classes
    cell.classList.remove(
        'node-pattern-diagonal-stripes',
        'node-pattern-vertical-stripes',
        'node-pattern-horizontal-stripes',
        'node-pattern-dots',
        'node-pattern-grid',
        'node-pattern-checkerboard'
    );

    // Apply pattern if any
    if (pattern && pattern !== 'none') {
        cell.classList.add(`node-pattern-${pattern}`);
    }
}

function applyAllNodeStyling() {
    for (let row = 0; row < mapData.height; row++) {
        for (let col = 0; col < mapData.width; col++) {
            const key = `${col},${row}`;
            const nodeData = mapData.nodes.get(key);
            if (!nodeData) continue;

            const cell = document.querySelector(`.tile[data-col='${col}'][data-row='${row}']`);
            if (cell) {
                applyNodeStyling(cell, nodeData);
            }
        }
    }
}


// Professional Passage Text Editor System
let currentPassageEditor = {
    nodeKey: null,
    currentView: 'visual',
    visualContent: '',
    codeContent: '',
    isBeginnerMode: true,
    namedSpans: new Map(),
    lastSelection: null,
    isDirty: false
};

function openPassageTextEditor() {
    if (!currentEditingNode) return;
    
    const { col, row } = currentEditingNode;
    const nodeKey = `${col},${row}`;
    const nodeData = mapData.nodes.get(nodeKey) || {};
    
    currentEditingPassage = nodeKey;
    currentPassageEditor.nodeKey = nodeKey;
    
    // Set title and subtitle
    document.getElementById('passageEditorTitle').textContent = 'Professional Passage Editor';
    document.getElementById('passageEditorSubtitle').textContent = 
        `${nodeData.name || nodeData.passage || `Node (${col},${row})`}`;
    
    // Load existing passage text
    const passageData = passageTexts.get(nodeKey) || { main: '', conditions: {} };
    currentPassageEditor.codeContent = passageData.main || '';
    
    // Initialize the editor
    initializePassageEditor();
    
    // Show modal
    document.getElementById('passageTextModal').classList.remove('hidden');
    
    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

function initializePassageEditor() {
    // Setup view toggles
    setupViewToggles();
    
    // Setup toolbar
    setupWysiwygToolbar();
    
    // Load content into current view
    loadContentIntoViews();
    
    // Setup real-time sync
    setupViewSynchronization();
    
    // Update status
    updateEditorStatus();
    
    // Setup beginner mode
    setupBeginnerMode();
}

function setupViewToggles() {
    const viewToggles = document.querySelectorAll('.view-toggle');
    const editorViews = document.querySelectorAll('.editor-view');
    
    viewToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetView = toggle.dataset.view;
            
            // Save current view content before switching
            saveCurrentViewContent();
            
            // Update active states
            viewToggles.forEach(t => t.classList.remove('active'));
            editorViews.forEach(v => v.classList.remove('active'));
            
            toggle.classList.add('active');
            document.getElementById(`${targetView}View`).classList.add('active');
            
            // Update current view
            currentPassageEditor.currentView = targetView;
            
            // Load content into new view
            loadContentIntoCurrentView();
            
            // Update toolbar visibility
            updateToolbarVisibility();
        });
    });
}

function setupWysiwygToolbar() {
    // Passage selector
    document.getElementById('passageSelector').addEventListener('change', handlePassageSelection);
    
    // Populate passage selector when modal opens
    populatePassageSelector();
    
    // Basic formatting buttons
    document.getElementById('boldBtn').addEventListener('click', () => applyFormatting('bold'));
    document.getElementById('italicBtn').addEventListener('click', () => applyFormatting('italic'));
    document.getElementById('underlineBtn').addEventListener('click', () => applyFormatting('underline'));
    
    // Macro buttons
    document.getElementById('replaceBtn').addEventListener('click', () => openMacroBuilder('replace'));
    document.getElementById('appendBtn').addEventListener('click', () => openMacroBuilder('append'));
    document.getElementById('clearBtn').addEventListener('click', () => openMacroBuilder('clear'));
    
    // Span management
    document.getElementById('wrapSpanBtn').addEventListener('click', () => openMacroBuilder('span'));
    document.getElementById('targetPickerBtn').addEventListener('click', () => openTargetPicker());
    
    // Advanced features
    document.getElementById('conditionalBtn').addEventListener('click', () => openMacroBuilder('conditional'));
    document.getElementById('variableBtn').addEventListener('click', () => openMacroBuilder('variable'));
    document.getElementById('audioBtn').addEventListener('click', () => openMacroBuilder('audio'));
    
    // Tools
    document.getElementById('timelineBtn').addEventListener('click', () => openTimelineTool());
    document.getElementById('validateBtn').addEventListener('click', () => validatePassage());
    
    // Beginner mode toggle
    document.getElementById('beginnerMode').addEventListener('change', (e) => {
        currentPassageEditor.isBeginnerMode = e.target.checked;
        updateBeginnerMode();
    });
    
    // Code view actions
    document.getElementById('formatCodeBtn').addEventListener('click', () => formatCode());
    document.getElementById('syncFromCodeBtn').addEventListener('click', () => syncFromCodeToVisual());
    
    // Preview actions
    document.getElementById('refreshPreviewBtn').addEventListener('click', () => refreshPreview());
    document.getElementById('resetPreviewBtn').addEventListener('click', () => resetPreview());
    document.getElementById('fullscreenPreviewBtn').addEventListener('click', () => toggleFullscreenPreview());
}

function loadContentIntoViews() {
    // Load into visual editor
    const visualEditor = document.getElementById('visualEditor');
    visualEditor.innerHTML = convertCodeToVisual(currentPassageEditor.codeContent);
    
    // Load into code editor
    const codeEditor = document.getElementById('codeEditor');
    codeEditor.value = currentPassageEditor.codeContent;
    
    // Update preview
    refreshPreview();
    
    // Update span manager
    updateSpanManager();
}

function loadContentIntoCurrentView() {
    switch (currentPassageEditor.currentView) {
        case 'visual':
            const visualEditor = document.getElementById('visualEditor');
            visualEditor.innerHTML = convertCodeToVisual(currentPassageEditor.codeContent);
            updateSpanManager();
            break;
        case 'code':
            const codeEditor = document.getElementById('codeEditor');
            codeEditor.value = currentPassageEditor.codeContent;
            break;
        case 'preview':
            refreshPreview();
            break;
    }
}

function saveCurrentViewContent() {
    switch (currentPassageEditor.currentView) {
        case 'visual':
            const visualEditor = document.getElementById('visualEditor');
            currentPassageEditor.codeContent = convertVisualToCode(visualEditor.innerHTML);
            break;
        case 'code':
            const codeEditor = document.getElementById('codeEditor');
            currentPassageEditor.codeContent = codeEditor.value;
            break;
    }
    currentPassageEditor.isDirty = true;
    updateEditorStatus();
}

function setupViewSynchronization() {
    // Visual editor changes
    const visualEditor = document.getElementById('visualEditor');
    visualEditor.addEventListener('input', () => {
        saveCurrentViewContent();
        updateWordCount();
    });
    
    visualEditor.addEventListener('keydown', handleVisualEditorKeydown);
    visualEditor.addEventListener('mouseup', handleVisualEditorSelection);
    
    // Code editor changes
    const codeEditor = document.getElementById('codeEditor');
    codeEditor.addEventListener('input', () => {
        saveCurrentViewContent();
        validateCodeSyntax();
        updateWordCount();
    });
}

function handleVisualEditorKeydown(e) {
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'b':
                e.preventDefault();
                applyFormatting('bold');
                break;
            case 'i':
                e.preventDefault();
                applyFormatting('italic');
                break;
            case 'u':
                e.preventDefault();
                applyFormatting('underline');
                break;
        }
    }
}

function handleVisualEditorSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        currentPassageEditor.lastSelection = selection.getRangeAt(0).cloneRange();
    }
}

function applyFormatting(type) {
    if (currentPassageEditor.currentView !== 'visual') return;
    
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;
    
    const selectedText = range.toString();
    let formattedText = '';
    
    switch (type) {
        case 'bold':
            formattedText = `<strong>${selectedText}</strong>`;
            break;
        case 'italic':
            formattedText = `<em>${selectedText}</em>`;
            break;
        case 'underline':
            formattedText = `<u>${selectedText}</u>`;
            break;
    }
    
    if (formattedText) {
        range.deleteContents();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = formattedText;
        const fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
        }
        range.insertNode(fragment);
        
        saveCurrentViewContent();
    }
}

function openMacroBuilder(type) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    switch (type) {
        case 'replace':
            openReplaceMacroModal(selectedText);
            break;
        case 'append':
            openAppendMacroModal(selectedText);
            break;
        case 'clear':
            openClearMacroModal(selectedText);
            break;
        case 'span':
            openSpanWrapModal(selectedText);
            break;
        case 'conditional':
            openConditionalModal();
            break;
        case 'variable':
            openVariableModal();
            break;
        case 'audio':
            openAudioModal();
            break;
    }
}

function openReplaceMacroModal(selectedText) {
    document.getElementById('replaceSelection').value = selectedText;
    document.getElementById('replaceTargetSpan').value = '';
    document.getElementById('replaceContent').value = '';
    document.getElementById('replaceMacroModal').classList.remove('hidden');
}

function openAppendMacroModal(selectedText) {
    document.getElementById('appendSelection').value = selectedText;
    document.getElementById('appendTargetSpan').value = '';
    document.getElementById('appendContent').value = '';
    document.getElementById('appendMacroModal').classList.remove('hidden');
}

function openSpanWrapModal(selectedText) {
    document.getElementById('spanWrapSelection').value = selectedText;
    document.getElementById('spanWrapId').value = '';
    document.getElementById('spanWrapClass').value = '';
    document.getElementById('spanWrapModal').classList.remove('hidden');
}

function openConditionalModal() {
    document.getElementById('conditionalType').value = 'if';
    document.getElementById('conditionalVariable').value = '';
    document.getElementById('conditionalTrueContent').value = '';
    document.getElementById('conditionalFalseContent').value = '';
    updateConditionalModalFields();
    document.getElementById('conditionalModal').classList.remove('hidden');
}

function openAudioModal() {
    document.getElementById('audioType').value = 'sfx';
    document.getElementById('audioFile').value = '';
    document.getElementById('audioAction').value = 'play';
    document.getElementById('audioVolume').value = '0.7';
    document.getElementById('audioModal').classList.remove('hidden');
}

function closeMacroModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function buildReplaceMacro() {
    const selection = document.getElementById('replaceSelection').value;
    const targetSpan = document.getElementById('replaceTargetSpan').value;
    const content = document.getElementById('replaceContent').value;
    
    if (!selection || !targetSpan || !content) {
        alert('Please fill in all fields');
        return;
    }
    
    const macro = `<span id="${targetSpan}">${selection}<<link "${selection}">><<replace "#${targetSpan}">>${content}<</replace>><</link>></span>`;
    insertMacroIntoEditor(macro);
    closeMacroModal('replaceMacroModal');
}

function buildAppendMacro() {
    const selection = document.getElementById('appendSelection').value;
    const targetSpan = document.getElementById('appendTargetSpan').value;
    const content = document.getElementById('appendContent').value;
    
    if (!selection || !targetSpan || !content) {
        alert('Please fill in all fields');
        return;
    }
    
    const macro = `<<link "${selection}">><<append "#${targetSpan}">>${content}<</append>><</link>>`;
    insertMacroIntoEditor(macro);
    closeMacroModal('appendMacroModal');
}

function buildSpanWrap() {
    const selection = document.getElementById('spanWrapSelection').value;
    const spanId = document.getElementById('spanWrapId').value;
    const spanClass = document.getElementById('spanWrapClass').value;
    
    if (!selection || !spanId) {
        alert('Please provide selected text and span ID');
        return;
    }
    
    const classAttr = spanClass ? ` class="${spanClass}"` : '';
    const macro = `<span id="${spanId}"${classAttr}>${selection}</span>`;
    insertMacroIntoEditor(macro);
    
    // Add to span manager
    currentPassageEditor.namedSpans.set(spanId, {
        id: spanId,
        class: spanClass,
        type: 'named-span'
    });
    
    updateSpanManager();
    closeMacroModal('spanWrapModal');
}

function buildConditional() {
    const type = document.getElementById('conditionalType').value;
    const variable = document.getElementById('conditionalVariable').value;
    const trueContent = document.getElementById('conditionalTrueContent').value;
    const falseContent = document.getElementById('conditionalFalseContent').value;
    
    if (!variable || !trueContent) {
        alert('Please provide variable and true content');
        return;
    }
    
    let macro = `<<if ${variable}>>${trueContent}`;
    
    if (type === 'if-else' && falseContent) {
        macro += `<<else>>${falseContent}`;
    }
    
    macro += `<</if>>`;
    
    insertMacroIntoEditor(macro);
    closeMacroModal('conditionalModal');
}

function buildAudioMacro() {
    const type = document.getElementById('audioType').value;
    const file = document.getElementById('audioFile').value;
    const action = document.getElementById('audioAction').value;
    const volume = document.getElementById('audioVolume').value;
    
    if (!file) {
        alert('Please provide audio file path');
        return;
    }
    
    let macro = `<<audio "${file}" ${action}`;
    if (volume !== '0.7') {
        macro += ` volume ${volume}`;
    }
    macro += `>>`;
    
    insertMacroIntoEditor(macro);
    closeMacroModal('audioModal');
}

function insertMacroIntoEditor(macro) {
    if (currentPassageEditor.currentView === 'visual') {
        const visualEditor = document.getElementById('visualEditor');
        
        if (currentPassageEditor.lastSelection) {
            const range = currentPassageEditor.lastSelection;
            range.deleteContents();
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = macro;
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }
            range.insertNode(fragment);
        } else {
            visualEditor.innerHTML += macro;
        }
        
        saveCurrentViewContent();
    } else if (currentPassageEditor.currentView === 'code') {
        const codeEditor = document.getElementById('codeEditor');
        const cursorPos = codeEditor.selectionStart;
        const textBefore = codeEditor.value.substring(0, cursorPos);
        const textAfter = codeEditor.value.substring(codeEditor.selectionEnd);
        
        codeEditor.value = textBefore + macro + textAfter;
        codeEditor.selectionStart = codeEditor.selectionEnd = cursorPos + macro.length;
        
        saveCurrentViewContent();
    }
}

function convertCodeToVisual(code) {
    // Convert Twine/SugarCube code to visual representation
    let visual = code;
    
    // Convert basic formatting
    visual = visual.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    visual = visual.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert passage links
    visual = visual.replace(/\[\[(.*?)\]\]/g, '<a href="#" class="passage-link">$1</a>');
    
    // Convert macros to visual representations, preserving the original macro
    visual = visual.replace(/<<link\s+"([^"]+)">([\s\S]*?)<<\/link>>/g,
        (m, text) => `<span class="interactive-span" data-macro="${encodeURIComponent(m)}" data-macro-type="link">${text}</span>`);

    visual = visual.replace(/<<replace\s+"#([^"]+)">([\s\S]*?)<<\/replace>>/g,
        (m, target) => `<span class="interactive-span" data-macro="${encodeURIComponent(m)}" data-macro-type="replace" data-target="${target}">Replace: ${target}</span>`);

    visual = visual.replace(/<<append\s+"#([^"]+)">([\s\S]*?)<<\/append>>/g,
        (m, target) => `<span class="interactive-span" data-macro="${encodeURIComponent(m)}" data-macro-type="append" data-target="${target}">Append: ${target}</span>`);

    visual = visual.replace(/<<if\s+([^>]+)>>([\s\S]*?)<<\/if>>/g,
        (m, cond) => `<div class="interactive-span" data-macro="${encodeURIComponent(m)}" data-macro-type="conditional">If: ${cond}<br></div>`);

    visual = visual.replace(/<<set\s+([^>]+)>>/g,
        (m, expr) => `<span class="interactive-span" data-macro="${encodeURIComponent(m)}" data-macro-type="variable">Set: ${expr}</span>`);

    visual = visual.replace(/<<audio\s+"([^"]+)"\s+(\w+).*?>>/g,
        (m, file, act) => `<span class="interactive-span" data-macro="${encodeURIComponent(m)}" data-macro-type="audio">Audio: ${file} (${act})</span>`);
    
    // Convert named spans
    visual = visual.replace(/<span\s+id="([^"]+)"([^>]*)>(.*?)<\/span>/gs, 
        '<span id="$1" class="named-span"$2>$3</span>');
    
    // Convert line breaks
    visual = visual.replace(/\n/g, '<br>');
    
    return visual;
}

function convertVisualToCode(visual) {
    // Convert visual representation back to Twine/SugarCube code
    let code = visual;

    // Replace interactive macro placeholders with their original code
    code = code.replace(/<(span|div)[^>]*data-macro="([^"]+)"[^>]*>.*?<\/(span|div)>/gs,
        (m, _tag, macro) => decodeURIComponent(macro));

    // Remove visual-only classes and attributes
    code = code.replace(/\s*class="[^"]*interactive-span[^"]*"/g, '');
    code = code.replace(/\s*class="[^"]*named-span[^"]*"/g, '');
    code = code.replace(/\s*data-macro-type="[^"]*"/g, '');
    code = code.replace(/\s*data-target="[^"]*"/g, '');
    
    // Convert back to text formatting
    code = code.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
    code = code.replace(/<em>(.*?)<\/em>/g, '*$1*');
    code = code.replace(/<u>(.*?)<\/u>/g, '$1'); // Underline not supported in Twine
    
    // Convert passage links
    code = code.replace(/<a[^>]*class="passage-link"[^>]*>(.*?)<\/a>/g, '[[$1]]');

    // Convert line breaks
    code = code.replace(/<br\s*\/?>/g, '\n');

    // Decode HTML entities so macros appear correctly
    const textarea = document.createElement('textarea');
    textarea.innerHTML = code;
    code = textarea.value;

    // Preserve user spacing
    code = code.trim();

    return code;
}

function updateSpanManager() {
    const spanList = document.getElementById('spanList');
    spanList.innerHTML = '';
    
    // Extract spans from current content
    const visualEditor = document.getElementById('visualEditor');
    const spans = visualEditor.querySelectorAll('[id]');
    
    currentPassageEditor.namedSpans.clear();
    
    spans.forEach(span => {
        const id = span.id;
        const type = span.classList.contains('interactive-span') ? 'interactive' : 'named';
        
        currentPassageEditor.namedSpans.set(id, {
            id: id,
            type: type,
            element: span
        });
        
        const spanItem = document.createElement('div');
        spanItem.className = 'span-item';
        spanItem.innerHTML = `
            <div class="span-item-info">
                <div class="span-id">${id}</div>
                <div class="span-type">${type}</div>
            </div>
            <div class="span-actions">
                <button class="span-action-btn" onclick="highlightSpan('${id}')" title="Highlight">
                    <i data-lucide="eye"></i>
                </button>
                <button class="span-action-btn" onclick="editSpan('${id}')" title="Edit">
                    <i data-lucide="edit"></i>
                </button>
                <button class="span-action-btn" onclick="deleteSpan('${id}')" title="Delete">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
        
        spanList.appendChild(spanItem);
    });
    
    // Re-render Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

function highlightSpan(spanId) {
    const span = document.getElementById(spanId);
    if (span) {
        span.scrollIntoView({ behavior: 'smooth', block: 'center' });
        span.style.outline = '3px solid var(--accent-color)';
        setTimeout(() => {
            span.style.outline = '';
        }, 2000);
    }
}

function editSpan(spanId) {
    // Open appropriate modal based on span type
    const spanData = currentPassageEditor.namedSpans.get(spanId);
    if (spanData && spanData.element) {
        const text = spanData.element.textContent;
        document.getElementById('spanWrapSelection').value = text;
        document.getElementById('spanWrapId').value = spanId;
        document.getElementById('spanWrapClass').value = spanData.element.className || '';
        document.getElementById('spanWrapModal').classList.remove('hidden');
    }
}

function deleteSpan(spanId) {
    if (confirm(`Delete span "${spanId}"?`)) {
        const span = document.getElementById(spanId);
        if (span) {
            // Replace span with its text content
            span.outerHTML = span.textContent;
            saveCurrentViewContent();
            updateSpanManager();
        }
    }
}

let previewState = { originalHTML: '', variables: {} };

function refreshPreview() {
    const preview = document.getElementById('playerPreview');
    const content = currentPassageEditor.codeContent;

    if (!content.trim()) {
        preview.innerHTML = '<div class="preview-placeholder">Preview will appear here when you add content...</div>';
        document.getElementById('previewConditions').classList.add('hidden');
        return;
    }

    preview.innerHTML = '';
    const vars = extractPreviewVariables(content);
    vars.forEach(v => {
        if (!(v in previewState.variables)) previewState.variables[v] = 0;
    });
    setupPreviewConditions(vars);

    renderPreviewContent(content, preview);
    previewState.originalHTML = preview.innerHTML;
}

function resetPreview() {
    previewState.variables = {};
    refreshPreview();
}

function handlePreviewLink(e) {
    e.preventDefault();
    const link = e.currentTarget;
    const body = decodeURIComponent(link.dataset.body || '');
    const temp = document.createElement('span');
    renderPreviewContent(body, temp);
    link.replaceWith(...temp.childNodes);
}

function renderPreviewContent(content, container) {
    const macroRegex = /<<(link|replace|append|set|if)\b([^>]*)>>(.*?)<<\/\1>>/gs;
    let lastIndex = 0;
    let match;
    while ((match = macroRegex.exec(content)) !== null) {
        const plain = content.slice(lastIndex, match.index);
        container.insertAdjacentHTML('beforeend', formatPreviewText(plain));
        lastIndex = macroRegex.lastIndex;

        const type = match[1];
        const args = match[2].trim();
        const body = match[3];

        switch (type) {
            case 'link': {
                const t = args.match(/"([^"]+)"/);
                const text = t ? t[1] : args;
                const a = document.createElement('a');
                a.href = '#';
                a.className = 'preview-link';
                a.textContent = text;
                a.dataset.body = encodeURIComponent(body);
                a.addEventListener('click', handlePreviewLink);
                container.appendChild(a);
                break;
            }
            case 'replace': {
                const m = args.match(/"#?([^"]+)"/);
                const id = m ? m[1] : '';
                const target = container.querySelector('#' + id) || document.getElementById(id);
                if (target) {
                    const tmp = document.createElement('span');
                    renderPreviewContent(body, tmp);
                    target.innerHTML = tmp.innerHTML;
                }
                break;
            }
            case 'append': {
                const m = args.match(/"#?([^"]+)"/);
                const id = m ? m[1] : '';
                const target = container.querySelector('#' + id) || document.getElementById(id);
                if (target) {
                    const tmp = document.createElement('span');
                    renderPreviewContent(body, tmp);
                    target.insertAdjacentHTML('beforeend', tmp.innerHTML);
                }
                break;
            }
            case 'set':
                applyPreviewSet(args);
                break;
            case 'if':
                if (evaluatePreviewCondition(args)) {
                    renderPreviewContent(body, container);
                }
                break;
        }
    }
    const tail = content.slice(lastIndex);
    container.insertAdjacentHTML('beforeend', formatPreviewText(tail));
}

function formatPreviewText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[\[(.*?)\]\]/g, '<a href="#" class="passage-link">$1</a>')
        .replace(/\n/g, '<br>');
}

function extractPreviewVariables(text) {
    const vars = new Set();
    text.replace(/<<set\s+\$([\w]+)\s*=.*?>>/g, (_, v) => vars.add(v));
    text.replace(/<<if\s+\$([\w]+)/g, (_, v) => vars.add(v));
    return Array.from(vars);
}

function setupPreviewConditions(vars) {
    const panel = document.getElementById('previewConditions');
    panel.innerHTML = '';
    if (vars.length === 0) {
        panel.classList.add('hidden');
        return;
    }
    panel.classList.remove('hidden');
    vars.forEach(v => {
        const wrap = document.createElement('div');
        wrap.className = 'cond-item';
        const label = document.createElement('label');
        label.textContent = v;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = previewState.variables[v];
        input.dataset.var = v;
        input.addEventListener('input', () => {
            const val = parseFloat(input.value);
            previewState.variables[v] = isNaN(val) ? input.value : val;
        });
        wrap.appendChild(label);
        wrap.appendChild(input);
        panel.appendChild(wrap);
    });
}

function applyPreviewSet(expr) {
    const m = expr.match(/\$([\w]+)\s*=\s*(.+)/);
    if (m) {
        let val = m[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        const num = parseFloat(val);
        previewState.variables[m[1]] = isNaN(num) ? val : num;
        const input = document.querySelector(`#previewConditions input[data-var='${m[1]}']`);
        if (input) input.value = previewState.variables[m[1]];
    }
}

function evaluatePreviewCondition(expr) {
    const m = expr.match(/\$([\w]+)\s*(==|!=|>=|<=|>|<)?\s*(.*)?/);
    if (!m) return false;
    const val = previewState.variables[m[1]];
    const op = m[2];
    let comp = m[3];
    if (!op) return !!val;
    if (comp !== undefined) {
        comp = comp.trim();
        if (comp.startsWith('"') && comp.endsWith('"')) comp = comp.slice(1, -1);
        const num = parseFloat(comp);
        comp = isNaN(num) ? comp : num;
    }
    switch (op) {
        case '==': return val == comp;
        case '!=': return val != comp;
        case '>=': return val >= comp;
        case '<=': return val <= comp;
        case '>': return val > comp;
        case '<': return val < comp;
    }
    return false;
}

function updateToolbarVisibility() {
    const toolbar = document.getElementById('wysiwygToolbar');
    if (currentPassageEditor.currentView === 'visual') {
        toolbar.style.display = 'flex';
    } else {
        toolbar.style.display = 'none';
    }
}

function updateEditorStatus() {
    const statusIndicator = document.getElementById('editorStatus');
    if (currentPassageEditor.isDirty) {
        statusIndicator.textContent = 'Modified';
        statusIndicator.className = 'status-indicator warning';
    } else {
        statusIndicator.textContent = 'Ready';
        statusIndicator.className = 'status-indicator';
    }
}

function updateWordCount() {
    const wordCountElement = document.getElementById('wordCount');
    const content = currentPassageEditor.codeContent;
    const words = content.trim().split(/\s+/).filter(word => word.length > 0);
    wordCountElement.textContent = `${words.length} words`;
}

function setupBeginnerMode() {
    updateBeginnerMode();
}

function updateBeginnerMode() {
    const isBeginnerMode = currentPassageEditor.isBeginnerMode;
    const toolbarBtns = document.querySelectorAll('.toolbar-btn');
    
    if (isBeginnerMode) {
        // Add tooltips and help for beginners
        toolbarBtns.forEach(btn => {
            btn.addEventListener('mouseenter', showBeginnerTooltip);
            btn.addEventListener('mouseleave', hideBeginnerTooltip);
        });
    } else {
        // Remove beginner tooltips
        toolbarBtns.forEach(btn => {
            btn.removeEventListener('mouseenter', showBeginnerTooltip);
            btn.removeEventListener('mouseleave', hideBeginnerTooltip);
        });
        hideBeginnerTooltip();
    }
}

function showBeginnerTooltip(e) {
    if (!currentPassageEditor.isBeginnerMode) return;
    
    const btn = e.target.closest('.toolbar-btn');
    if (!btn) return;
    
    const tooltips = {
        'boldBtn': { title: 'Bold Text', desc: 'Makes selected text bold (**text**)' },
        'italicBtn': { title: 'Italic Text', desc: 'Makes selected text italic (*text*)' },
        'replaceBtn': { title: 'Replace Macro', desc: 'Creates interactive text that replaces content when clicked' },
        'appendBtn': { title: 'Append Macro', desc: 'Creates interactive text that adds content when clicked' },
        'conditionalBtn': { title: 'Conditional Logic', desc: 'Shows different content based on variables or conditions' },
        'audioBtn': { title: 'Audio Integration', desc: 'Adds sound effects or music to your passage' }
    };
    
    const tooltipData = tooltips[btn.id];
    if (!tooltipData) return;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'beginner-tooltip';
    tooltip.innerHTML = `
        <h5>${tooltipData.title}</h5>
        <p>${tooltipData.desc}</p>
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = btn.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 10}px`;
    
    setTimeout(() => tooltip.classList.add('show'), 10);
}

function hideBeginnerTooltip() {
    const tooltip = document.querySelector('.beginner-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

function validateCodeSyntax() {
    const codeEditor = document.getElementById('codeEditor');
    const validation = document.getElementById('codeValidation');
    const code = codeEditor.value;
    
    const errors = [];
    
    // Check for unclosed macros
    const macroPattern = /<<(\w+)(?:\s+[^>]*)?>>(?:(?!<<\/\1>>).)*$/gm;
    const matches = code.match(macroPattern);
    if (matches) {
        errors.push('Unclosed macro detected');
    }
    
    // Check for mismatched brackets
    const openBrackets = (code.match(/<<(?!\/)[\w\s"'#$=<>!]+>>/g) || []).length;
    const closeBrackets = (code.match(/<<\/\w+>>/g) || []).length;
    if (openBrackets !== closeBrackets) {
        errors.push('Mismatched macro brackets');
    }
    
    if (errors.length > 0) {
        validation.className = 'validation-status error';
        validation.textContent = errors.join(', ');
    } else {
        validation.className = 'validation-status success';
        validation.textContent = 'Code syntax is valid';
    }
}

function formatCode() {
    const codeEditor = document.getElementById('codeEditor');
    let code = codeEditor.value;
    
    // Basic formatting for Twine code
    code = code
        .replace(/<<(\w+)/g, '\n<<$1')  // New line before macros
        .replace(/>>/g, '>>\n')         // New line after macros
        .replace(/\n\s*\n/g, '\n\n')    // Clean up multiple newlines
        .trim();
    
    codeEditor.value = code;
    saveCurrentViewContent();
}

function syncFromCodeToVisual() {
    saveCurrentViewContent();
    loadContentIntoCurrentView();
    updateSpanManager();
}

function openTargetPicker() {
    // Show available spans for targeting
    const spans = Array.from(currentPassageEditor.namedSpans.keys());
    if (spans.length === 0) {
        alert('No named spans available. Create some spans first using the "Wrap in Span" tool.');
        return;
    }
    
    const spanId = prompt('Select a span to target:\n\n' + spans.join('\n'));
    if (spanId && spans.includes(spanId)) {
        highlightSpan(spanId);
    }
}

function openTimelineTool() {
    alert('Timeline tool coming soon! This will allow you to create staged reveals and timed content.');
}

function validatePassage() {
    const errors = [];
    const warnings = [];
    
    // Check for duplicate span IDs
    const spanIds = new Set();
    currentPassageEditor.namedSpans.forEach((span, id) => {
        if (spanIds.has(id)) {
            errors.push(`Duplicate span ID: ${id}`);
        }
        spanIds.add(id);
    });
    
    // Check for broken references
    const content = currentPassageEditor.codeContent;
    const replaceMatches = content.match(/<<replace\s+"#([^"]+)">>/g);
    const appendMatches = content.match(/<<append\s+"#([^"]+)">>/g);
    
    if (replaceMatches) {
        replaceMatches.forEach(match => {
            const spanId = match.match(/#([^"]+)/)[1];
            if (!currentPassageEditor.namedSpans.has(spanId)) {
                warnings.push(`Replace target "${spanId}" not found`);
            }
        });
    }
    
    if (appendMatches) {
        appendMatches.forEach(match => {
            const spanId = match.match(/#([^"]+)/)[1];
            if (!currentPassageEditor.namedSpans.has(spanId)) {
                warnings.push(`Append target "${spanId}" not found`);
            }
        });
    }
    
    let message = 'Validation Results:\n\n';
    if (errors.length > 0) {
        message += 'ERRORS:\n' + errors.join('\n') + '\n\n';
    }
    if (warnings.length > 0) {
        message += 'WARNINGS:\n' + warnings.join('\n') + '\n\n';
    }
    if (errors.length === 0 && warnings.length === 0) {
        message += 'No issues found! Your passage looks good.';
    }
    
    alert(message);
}

function toggleFullscreenPreview() {
    const previewContainer = document.querySelector('.preview-container');
    if (previewContainer.classList.contains('fullscreen')) {
        previewContainer.classList.remove('fullscreen');
        document.getElementById('fullscreenPreviewBtn').innerHTML = '<i data-lucide="maximize"></i> Fullscreen';
    } else {
        previewContainer.classList.add('fullscreen');
        document.getElementById('fullscreenPreviewBtn').innerHTML = '<i data-lucide="minimize"></i> Exit Fullscreen';
    }
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

function updateConditionalModalFields() {
    const type = document.getElementById('conditionalType').value;
    const falseGroup = document.getElementById('conditionalFalseGroup');
    
    if (type === 'if-else' || type === 'if-elseif-else') {
        falseGroup.style.display = 'block';
    } else {
        falseGroup.style.display = 'none';
    }
}

function openVariableModal() {
    const variable = prompt('Enter variable assignment (e.g., $player.health = 100):');
    if (variable) {
        const macro = `<<set ${variable}>>`;
        insertMacroIntoEditor(macro);
    }
}

function openClearMacroModal(selectedText) {
    const confirmed = confirm(`Create a clear macro for "${selectedText}"?\n\nThis will make the text disappear when clicked.`);
    if (confirmed) {
        const spanId = prompt('Enter span ID to clear:');
        if (spanId) {
            const macro = `<<link "${selectedText}">><<replace "#${spanId}">><</replace>><</link>>`;
            insertMacroIntoEditor(macro);
        }
    }
}

function populatePassageSelector() {
    if (!currentEditingPassage) return;
    
    const selector = document.getElementById('passageSelector');
    const nodeData = mapData.nodes.get(currentEditingPassage) || {};
    
    // Clear existing options
    selector.innerHTML = '';
    
    // Add main passage option
    const mainOption = document.createElement('option');
    mainOption.value = 'main';
    mainOption.textContent = 'Main Passage';
    selector.appendChild(mainOption);
    
    // Add conditional passage options
    if (nodeData.conditions && nodeData.conditions.length > 0) {
        nodeData.conditions.forEach((condition, index) => {
            if (condition.passage) {
                const option = document.createElement('option');
                option.value = `condition_${index}`;
                option.textContent = condition.passage;
                selector.appendChild(option);
            }
        });
    }
    
    // Set default selection to main
    selector.value = 'main';
}

function handlePassageSelection(e) {
    const selectedValue = e.target.value;
    
    // Check for unsaved changes
    if (currentPassageEditor.isDirty) {
        const shouldSave = confirm('Do you want to save your current passage before proceeding?');
        if (shouldSave) {
            saveCurrentPassageContent();
        }
    }
    
    // Load the selected passage content
    loadSelectedPassageContent(selectedValue);
}

function saveCurrentPassageContent() {
    if (!currentEditingPassage) return;
    
    // Save current content
    saveCurrentViewContent();
    
    const passageData = passageTexts.get(currentEditingPassage) || { main: '', conditions: {} };
    const selector = document.getElementById('passageSelector');
    const currentSelection = selector.value;
    
    if (currentSelection === 'main') {
        passageData.main = currentPassageEditor.codeContent;
    } else if (currentSelection.startsWith('condition_')) {
        const conditionIndex = parseInt(currentSelection.split('_')[1]);
        const nodeData = mapData.nodes.get(currentEditingPassage) || {};
        if (nodeData.conditions && nodeData.conditions[conditionIndex]) {
            const conditionPassage = nodeData.conditions[conditionIndex].passage;
            passageData.conditions[conditionPassage] = currentPassageEditor.codeContent;
        }
    }
    
    passageTexts.set(currentEditingPassage, passageData);
    currentPassageEditor.isDirty = false;
    updateEditorStatus();
}

function loadSelectedPassageContent(selectedValue) {
    if (!currentEditingPassage) return;
    
    const passageData = passageTexts.get(currentEditingPassage) || { main: '', conditions: {} };
    let contentToLoad = '';
    
    if (selectedValue === 'main') {
        contentToLoad = passageData.main || '';
    } else if (selectedValue.startsWith('condition_')) {
        const conditionIndex = parseInt(selectedValue.split('_')[1]);
        const nodeData = mapData.nodes.get(currentEditingPassage) || {};
        if (nodeData.conditions && nodeData.conditions[conditionIndex]) {
            const conditionPassage = nodeData.conditions[conditionIndex].passage;
            contentToLoad = passageData.conditions[conditionPassage] || '';
        }
    }
    
    // Update editor content
    currentPassageEditor.codeContent = contentToLoad;
    currentPassageEditor.isDirty = false;
    
    // Reload content into current view
    loadContentIntoCurrentView();
    updateEditorStatus();
    updateWordCount();
}

function closePassageTextEditor() {
    // Save current content before closing
    saveCurrentViewContent();
    
    // Save to passage texts
    if (currentEditingPassage) {
        passageTexts.set(currentEditingPassage, {
            main: currentPassageEditor.codeContent,
            conditions: {} // TODO: Handle conditional passages
        });
    }
    
    document.getElementById('passageTextModal').classList.add('hidden');
    currentEditingPassage = null;
    currentPassageEditor = {
        nodeKey: null,
        currentView: 'visual',
        visualContent: '',
        codeContent: '',
        isBeginnerMode: true,
        namedSpans: new Map(),
        lastSelection: null,
        isDirty: false
    };
}

function savePassageText() {
    // Save current content
    saveCurrentViewContent();
    
    // Save to passage texts
    if (currentEditingPassage) {
        passageTexts.set(currentEditingPassage, {
            main: currentPassageEditor.codeContent,
            conditions: {} // TODO: Handle conditional passages
        });
        
        currentPassageEditor.isDirty = false;
        updateEditorStatus();
        
        alert('Passage text saved successfully!');
    }
    
    closePassageTextEditor();
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'z':
                if (e.shiftKey) {
                    e.preventDefault();
                    performRedo();
                } else {
                    e.preventDefault();
                    performUndo();
                }
                break;
            case 'y':
                e.preventDefault();
                performRedo();
                break;
        }
    }
}


// NEW: Dynamic Tag Library System
function setupTagSystemListeners() {
    const tagInput = document.getElementById('nodeTags');
    const tagSuggestions = document.getElementById('tagSuggestions');
    
    if (!tagInput || !tagSuggestions) return;
    
    // Create the new tag container inside the input wrapper
    const inputWrapper = tagInput.parentElement;
    inputWrapper.classList.add('tag-input-wrapper');
    
    // Create container for tag chips that will appear inside the field
    const tagChipsContainer = document.createElement('div');
    tagChipsContainer.className = 'tag-chips-container';
    inputWrapper.insertBefore(tagChipsContainer, tagInput);
    
    // Wrap input in a flex container with chips
    const inputContainer = document.createElement('div');
    inputContainer.className = 'tag-input-with-chips';
    tagChipsContainer.parentNode.insertBefore(inputContainer, tagChipsContainer);
    inputContainer.appendChild(tagChipsContainer);
    inputContainer.appendChild(tagInput);
    
    // Update input to be minimal and grow with content
    tagInput.classList.add('tag-input-field');
    tagInput.placeholder = 'Add tags...';
    
    // Tag input event listeners
    tagInput.addEventListener('input', handleTagInput);
    tagInput.addEventListener('keydown', handleTagKeydown);
    tagInput.addEventListener('blur', hideTagSuggestions);
    
    // Click on container focuses input
    inputContainer.addEventListener('click', (e) => {
        if (e.target === inputContainer || e.target === tagChipsContainer) {
            tagInput.focus();
        }
    });
    
    // Remove the old selected tags display
    const oldDisplay = document.getElementById('selectedTagsDisplay');
    if (oldDisplay) {
        oldDisplay.remove();
    }
}

function handleTagInput(e) {
    const input = e.target.value;
    const lastCommaIndex = input.lastIndexOf(',');
    const currentTag = input.substring(lastCommaIndex + 1).trim();
    
    if (currentTag.length > 0) {
        showTagSuggestions(currentTag);
    } else {
        hideTagSuggestions();
    }
}

function handleTagKeydown(e) {
    const suggestions = document.querySelectorAll('.tag-suggestion:not(.hidden)');
    const input = e.target;
    
    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            tagSuggestionIndex = Math.min(tagSuggestionIndex + 1, suggestions.length - 1);
            updateTagSuggestionHighlight();
            break;
        case 'ArrowUp':
            e.preventDefault();
            tagSuggestionIndex = Math.max(tagSuggestionIndex - 1, -1);
            updateTagSuggestionHighlight();
            break;
        case 'Enter':
        case ',':
            e.preventDefault();
            if (tagSuggestionIndex >= 0 && suggestions[tagSuggestionIndex]) {
                selectTagSuggestion(suggestions[tagSuggestionIndex].textContent.replace(' (new)', ''));
            } else {
                // Add current input as new tag
                const currentTag = input.value.trim();
                if (currentTag) {
                    addTag(currentTag);
                    input.value = '';
                }
            }
            break;
        case 'Backspace':
            // If input is empty, remove last tag
            if (input.value === '' && selectedTags.size > 0) {
                e.preventDefault();
                const lastTag = Array.from(selectedTags).pop();
                removeTag(lastTag);
            }
            break;
        case 'Escape':
            hideTagSuggestions();
            break;
    }
}

function showTagSuggestions(query) {
    const tagSuggestions = document.getElementById('tagSuggestions');
    const suggestions = getTagSuggestions(query);
    
    tagSuggestions.innerHTML = '';
    tagSuggestionIndex = -1;
    
    if (suggestions.length === 0) {
        tagSuggestions.classList.add('hidden');
        return;
    }
    
    suggestions.forEach(suggestion => {
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'tag-suggestion';
        suggestionElement.textContent = suggestion.name;
        
        if (suggestion.isNew) {
            suggestionElement.classList.add('new-tag');
            suggestionElement.textContent += ' (new)';
        }
        
        suggestionElement.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur event
            selectTagSuggestion(suggestion.name);
        });
        
        tagSuggestions.appendChild(suggestionElement);
    });
    
    tagSuggestions.classList.remove('hidden');
}

function getTagSuggestions(query) {
    const suggestions = [];
    const queryLower = query.toLowerCase();
    
    // Get existing tags from project library
    for (const tag of projectTagLibrary) {
        if (tag.toLowerCase().includes(queryLower) && !selectedTags.has(tag)) {
            suggestions.push({ name: tag, isNew: false });
        }
    }
    
    // Add "new tag" option if query doesn't exactly match any existing tag
    if (!projectTagLibrary.has(query) && query.length > 0) {
        suggestions.push({ name: query, isNew: true });
    }
    
    return suggestions.slice(0, 10); // Limit to 10 suggestions
}

function updateTagSuggestionHighlight() {
    const suggestions = document.querySelectorAll('.tag-suggestion');
    suggestions.forEach((suggestion, index) => {
        suggestion.classList.toggle('highlighted', index === tagSuggestionIndex);
    });
}

function selectTagSuggestion(tagName) {
    addTag(tagName);
    hideTagSuggestions();
}

function addTag(tagName) {
    if (!tagName || selectedTags.has(tagName)) return;
    
    selectedTags.add(tagName);
    projectTagLibrary.add(tagName);
    updateTagChipsDisplay();
    
    // Clear the input
    const tagInput = document.getElementById('nodeTags');
    tagInput.value = '';
    
    if (currentEditingNode) {
        saveNodeMemory();
    }
}

function removeTag(tagName) {
    selectedTags.delete(tagName);
    updateTagChipsDisplay();
    
    if (currentEditingNode) {
        saveNodeMemory();
    }
}

function updateTagChipsDisplay() {
    const container = document.querySelector('.tag-chips-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    selectedTags.forEach(tagName => {
        const chip = document.createElement('div');
        chip.className = 'tag-chip-inline';
        
        // Check if it's an entry tag
        if (tagName.startsWith('entry-')) {
            chip.classList.add('entry-tag');
        }
        
        const tagText = document.createElement('span');
        tagText.className = 'tag-chip-text';
        tagText.textContent = tagName;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'tag-chip-remove';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove tag';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTag(tagName);
        });
        
        chip.appendChild(tagText);
        chip.appendChild(removeBtn);
        container.appendChild(chip);
    });
    
    // Update the hidden field value for form compatibility
    updateHiddenTagField();
}

function updateHiddenTagField() {
    // Create a hidden field to maintain compatibility with save functions
    let hiddenField = document.getElementById('nodeTagsHidden');
    if (!hiddenField) {
        hiddenField = document.createElement('input');
        hiddenField.type = 'hidden';
        hiddenField.id = 'nodeTagsHidden';
        document.getElementById('nodeTags').parentElement.appendChild(hiddenField);
    }
    hiddenField.value = Array.from(selectedTags).join(', ');
}

function updateSelectedTagsDisplay() {
    const selectedTagsDisplay = document.getElementById('selectedTagsDisplay');
    if (!selectedTagsDisplay) return;
    
    selectedTagsDisplay.innerHTML = '';
    
    selectedTags.forEach(tagName => {
        const tagChip = document.createElement('div');
        tagChip.className = 'tag-chip';
        
        // Check if it's an entry tag
        if (tagName.startsWith('entry-')) {
            tagChip.classList.add('entry-tag');
        }
        
        const tagText = document.createElement('span');
        tagText.textContent = tagName;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'tag-chip-remove';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => removeTag(tagName));
        
        tagChip.appendChild(tagText);
        tagChip.appendChild(removeBtn);
        selectedTagsDisplay.appendChild(tagChip);
    });
}

function hideTagSuggestions() {
    setTimeout(() => {
        const tagSuggestions = document.getElementById('tagSuggestions');
        if (tagSuggestions) {
            tagSuggestions.classList.add('hidden');
        }
        tagSuggestionIndex = -1;
    }, 150); // Small delay to allow click events to fire
}

function loadTagsFromNodeData(tags) {
    selectedTags.clear();
    
    // Handle both array format (old) and any other format
    if (tags) {
        if (Array.isArray(tags)) {
            // Old format: array of strings
            tags.forEach(tag => {
                if (typeof tag === 'string' && tag.trim()) {
                    selectedTags.add(tag.trim());
                    projectTagLibrary.add(tag.trim());
                }
            });
        } else if (typeof tags === 'string') {
            // Handle comma-separated string format
            tags.split(',').forEach(tag => {
                const trimmedTag = tag.trim();
                if (trimmedTag) {
                    selectedTags.add(trimmedTag);
                    projectTagLibrary.add(trimmedTag);
                }
            });
        }
    }
    
    updateTagChipsDisplay();
}


// NEW: Entry Point Management System
function setupEntryPointListeners() {
    const isEntryPointCheckbox = document.getElementById('isEntryPoint');
    const entryPointOptions = document.getElementById('entryPointOptions');
    const entryPointType = document.getElementById('entryPointType');
    const entryPointWarning = document.getElementById('entryPointWarning');
    
    if (!isEntryPointCheckbox || !entryPointOptions || !entryPointType || !entryPointWarning) return;
    
    // Entry point checkbox listener
    isEntryPointCheckbox.addEventListener('change', handleEntryPointToggle);
    
    // Entry point type change listener
    entryPointType.addEventListener('change', handleEntryPointTypeChange);
}

function handleEntryPointToggle(e) {
    const isChecked = e.target.checked;
    const entryPointOptions = document.getElementById('entryPointOptions');
    const entryPointType = document.getElementById('entryPointType');
    
    if (isChecked) {
        entryPointOptions.classList.remove('hidden');
        entryPointType.focus();
    } else {
        entryPointOptions.classList.add('hidden');
        // Remove entry point tag if it exists
        removeEntryPointFromCurrentNode();
    }
}

function handleEntryPointTypeChange(e) {
    const selectedType = e.target.value;
    const entryPointWarning = document.getElementById('entryPointWarning');
    
    if (!selectedType) {
        entryPointWarning.classList.add('hidden');
        return;
    }
    
    // Check for conflicts
    const existingNodeKey = entryPointRegistry.get(selectedType);
    if (existingNodeKey && currentEditingNode) {
        const currentNodeKey = `${currentEditingNode.col},${currentEditingNode.row}`;
        if (existingNodeKey !== currentNodeKey) {
            entryPointWarning.classList.remove('hidden');
        } else {
            entryPointWarning.classList.add('hidden');
        }
    } else {
        entryPointWarning.classList.add('hidden');
    }
    
    // Add entry point tag to current node
    if (currentEditingNode) {
        addEntryPointToCurrentNode(selectedType);
    }
}

function addEntryPointToCurrentNode(entryType) {
    if (!entryType || !currentEditingNode) return;
    
    // Remove any existing entry tags
    removeEntryPointFromCurrentNode();
    
    // Add the new entry tag
    addTag(entryType);
    
    // Update registry
    const nodeKey = `${currentEditingNode.col},${currentEditingNode.row}`;
    
    // Remove this entry type from any other node
    for (const [type, existingNodeKey] of entryPointRegistry.entries()) {
        if (type === entryType && existingNodeKey !== nodeKey) {
            entryPointRegistry.delete(type);
            // Remove the tag from the other node if it exists
            const otherNodeData = mapData.nodes.get(existingNodeKey);
            if (otherNodeData && otherNodeData.tags) {
                otherNodeData.tags = otherNodeData.tags.filter(tag => tag !== entryType);
            }
        }
    }
    
    entryPointRegistry.set(entryType, nodeKey);
    updateEntryPointVisuals();
}

function removeEntryPointFromCurrentNode() {
    if (!currentEditingNode) return;
    
    const nodeKey = `${currentEditingNode.col},${currentEditingNode.row}`;
    
    // Find and remove any entry tags
    const entryTags = Array.from(selectedTags).filter(tag => tag.startsWith('entry-'));
    entryTags.forEach(tag => {
        removeTag(tag);
        entryPointRegistry.delete(tag);
    });
    
    updateEntryPointVisuals();
}

function updateEntryPointVisuals() {
    // Update all grid cells to show/hide entry point indicators
    document.querySelectorAll('.grid-cell').forEach(cell => {
        cell.classList.remove('entry-point');
        
        const col = parseInt(cell.dataset.col);
        const row = parseInt(cell.dataset.row);
        const nodeKey = `${col},${row}`;
        const nodeData = mapData.nodes.get(nodeKey);
        
        if (nodeData && nodeData.tags) {
            const hasEntryTag = nodeData.tags.some(tag => tag.startsWith('entry-'));
            if (hasEntryTag) {
                cell.classList.add('entry-point');
            }
        }
    });
}

function loadEntryPointFromNodeData(nodeData) {
    const isEntryPointCheckbox = document.getElementById('isEntryPoint');
    const entryPointOptions = document.getElementById('entryPointOptions');
    const entryPointType = document.getElementById('entryPointType');
    
    if (!isEntryPointCheckbox || !entryPointOptions || !entryPointType) return;
    
    // Check if node has any entry tags
    const entryTag = nodeData.tags?.find(tag => tag.startsWith('entry-'));
    
    if (entryTag) {
        isEntryPointCheckbox.checked = true;
        entryPointOptions.classList.remove('hidden');
        entryPointType.value = entryTag;
        handleEntryPointTypeChange({ target: { value: entryTag } });
    } else {
        isEntryPointCheckbox.checked = false;
        entryPointOptions.classList.add('hidden');
        entryPointType.value = '';
    }
}

// Prompted File Naming for Exports
function promptForFilename(defaultName, extension) {
    // Only use prompt fallback if File System Access API is not supported
    if (supportsFileSystemAccess()) return defaultName;

    const lastUsedKey = `last-export-${mapData.name}-${extension}`;
    const lastUsed = localStorage.getItem(lastUsedKey);

    const filename = window.prompt(
        `Enter a filename for your ${extension.toUpperCase()} export:`,
        lastUsed || defaultName
    );

    if (filename === null) {
        return null; // User cancelled
    }

    const trimmed = filename.trim();
    const sanitized = trimmed
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '');

    const finalName = sanitized || defaultName;

    localStorage.setItem(lastUsedKey, finalName);
    return finalName;
}



function setNodeData(col, row, options = {}) {
    const nodeKey = `${col},${row}`;
    const existingNode = mapData.nodes.get(nodeKey) ?? {};

    mapData.nodes.set(nodeKey, {
        name: options.name ?? '',
        passage: options.passage ?? '',
        icon: options.icon ?? '',
        fogOfWar: options.fogOfWar ?? false,
        tags: options.tags ?? [],
        style: options.style ?? {
            primaryColor: '#007bff',
            secondaryColor: '#6c757d',
            pattern: 'none'
        },
        conditions: options.conditions ?? [],
        transitions: options.transitions ?? existingNode.transitions ?? {}
    });
}


// Initialize icon selection when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Lucide to load
    setTimeout(() => {
        initializeIconSelection();
        initializeConditionIconSelection();
        updateUndoRedoButtons();
        updateConditionModalWithColorPicker();
    }, 100);
});

