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
    showSetupModal();
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('twine-map-editor-theme');
    if (savedTheme === 'dark') {
        toggleTheme();
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
   
    document.getElementById('conditionForm').addEventListener('submit', (e) => {
        if (conditionModalContext === 'node') {
            handleConditionSubmitEnhanced(e);
        } else {
            handleConditionSubmit(e);
        }
    });

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
}

function createGridCell(col, row) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.col = col;
    cell.dataset.row = row;
    
    // Add click handler for node editing
    cell.addEventListener('click', () => editNode(col, row));
    
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
    
    cell.innerHTML = '';
    
    // Recreate transition connectors
    createTransitionConnectors(cell, col, row);
    
    if (nodeData) {
        cell.classList.add('filled');
        if (nodeData.fogOfWar) {
            cell.classList.add('fog-of-war');
        } else {
            cell.classList.remove('fog-of-war');
        }
        
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
        
        cell.appendChild(content);
        
        // Re-render Lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }
    } else {
        cell.classList.remove('filled', 'fog-of-war');
        
        const emptyText = document.createElement('div');
        emptyText.className = 'empty-node-text';
        emptyText.textContent = 'Empty Node';
        cell.appendChild(emptyText);
        
        const coordsElement = document.createElement('div');
        coordsElement.className = 'node-coords';
        coordsElement.textContent = `(${col},${row})`;
        cell.appendChild(coordsElement);
    }
    
    // Update transition connectors
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

function editNode(col, row) {
    currentEditingNode = { col, row };
    currentEditingTransition = null;
    
    const nodeKey = `${col},${row}`;
    const nodeData = mapData.nodes.get(nodeKey) || {};
    
    // Populate form
    document.getElementById('nodeName').value = nodeData.name || '';
    document.getElementById('passageName').value = nodeData.passage || '';
    document.getElementById('nodeIcon').value = nodeData.icon || '';
    document.getElementById('fogOfWar').checked = nodeData.fogOfWar || false;
    
    // Show node editor
    document.getElementById('nodeEditor').classList.remove('hidden');
    document.getElementById('transitionEditor').classList.add('hidden');
    document.getElementById('sidebarTitle').textContent = `Edit Node (${col},${row})`;
    document.getElementById('sidebar').classList.remove('hidden');
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

function saveNode() {
    if (!currentEditingNode) return;
    
    const { col, row } = currentEditingNode;
    const nodeKey = `${col},${row}`;
    
    const name = document.getElementById('nodeName').value.trim();
    const passage = document.getElementById('passageName').value.trim();
    const icon = document.getElementById('nodeIcon').value;
    const fogOfWar = document.getElementById('fogOfWar').checked;
    
    if (name || passage || icon) {
        mapData.nodes.set(nodeKey, {
            name: name,
            passage: passage,
            icon: icon,
            fogOfWar: fogOfWar
        });
    } else {
        mapData.nodes.delete(nodeKey);
    }
    
    updateCellDisplay(document.querySelector(`[data-col="${col}"][data-row="${row}"]`), col, row);
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
    
    const action = document.getElementById('conditionAction').value;
    const type = document.getElementById('conditionType').value;
    const name = document.getElementById('conditionName').value.trim();
    const operator = document.getElementById('conditionOperator').value;
    const value = document.getElementById('conditionValue').value.trim();
    const changeTarget = document.getElementById('changeTarget').value;
    
    if (!name || !value) return;
    
    const condition = {
        action: action,
        type: type,
        name: name,
        operator: operator,
        value: value
    };
    
    if (action === 'changeIf') {
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

function exportMap() {
    if (mapData.nodes.size === 0) {
        alert('No nodes to export. Please add some nodes first.');
        return;
    }
    
    // Find a default start position (first node with data)
    let defaultStart = null;
    for (const [key, nodeData] of mapData.nodes) {
        const [col, row] = key.split(',').map(Number);
        defaultStart = { x: col, y: row };
        break;
    }
    
    if (!defaultStart) {
        alert('No valid nodes found for export.');
        return;
    }
    
    // Build export data
    const exportData = {
        mapId: mapData.name.toLowerCase().replace(/\s+/g, '_'),
        name: mapData.name,
        gridSize: {
            width: mapData.width,
            height: mapData.height
        },
        defaultStart: defaultStart,
        nodes: []
    };
    
    // Convert nodes to export format
    for (const [key, nodeData] of mapData.nodes) {
        const [col, row] = key.split(',').map(Number);
        
        const exportNode = {
            column: col,
            row: row,
            name: nodeData.name || '',
            passage: nodeData.passage || '',
            icon: nodeData.icon || '',
            fogOfWar: nodeData.fogOfWar || false,
            transitions: {}
        };
        
        // Add transitions for this node (both outgoing and incoming)
        for (const [transitionKey, transitionData] of mapData.transitions) {
            const [from, to] = transitionKey.split('-');
            const [fromCol, fromRow] = from.split(',').map(Number);
            const [toCol, toRow] = to.split(',').map(Number);
            
            // Handle outgoing transitions (this node is the source)
            if (fromCol === col && fromRow === row) {
                // Determine direction from this node to target
                let direction;
                if (toCol > fromCol) direction = 'east';
                else if (toCol < fromCol) direction = 'west';
                else if (toRow > fromRow) direction = 'south';
                else if (toRow < fromRow) direction = 'north';
                
                if (direction) {
                    exportNode.transitions[direction] = {
                        type: transitionData.type,
                        conditions: transitionData.conditions || []
                    };
                }
            }
            
            // Handle incoming transitions (this node is the target)
            // Only add if the transition is bidirectional or if it's a one-way pointing to this node
            if (toCol === col && toRow === row && fromCol !== col && fromRow !== row) {
                // Determine direction from target back to source
                let direction;
                if (fromCol > toCol) direction = 'east';
                else if (fromCol < toCol) direction = 'west';
                else if (fromRow > toRow) direction = 'south';
                else if (fromRow < toRow) direction = 'north';
                
                if (direction) {
                    // For bidirectional transitions, add the reverse direction
                    if (transitionData.type === 'bidirectional') {
                        exportNode.transitions[direction] = {
                            type: 'bidirectional',
                            conditions: transitionData.conditions || []
                        };
                    }
                    // For one-way transitions, add with proper directional restriction info
                    else if (transitionData.type === 'one-way') {
                        // Determine the original allowed direction from the transition data
                        let originalDirection = transitionData.direction;
                        
                        // If no specific direction was stored, infer it from the transition key
                        if (!originalDirection) {
                            if (toCol > fromCol) originalDirection = 'east';
                            else if (toCol < fromCol) originalDirection = 'west';
                            else if (toRow > fromRow) originalDirection = 'south';
                            else if (toRow < fromRow) originalDirection = 'north';
                        }
                        
                        // Add transition info showing this direction is blocked (reverse of allowed direction)
                        exportNode.transitions[direction] = {
                            type: 'one-way-blocked',
                            allowedDirection: originalDirection,
                            blockedDirection: direction,
                            conditions: transitionData.conditions || []
                        };
                    }
                    // For other transition types (locked, secret), also include them
                    else if (transitionData.type === 'locked' || transitionData.type === 'secret') {
                        exportNode.transitions[direction] = {
                            type: transitionData.type,
                            conditions: transitionData.conditions || []
                        };
                    }
                }
            }
        }
        
        exportData.nodes.push(exportNode);
    }
    
    // Download JSON file
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportData.mapId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Map exported successfully!');
}

// NEW FUNCTIONALITY

// Import map functionality
function importMap() {
    document.getElementById('fileInput').click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            loadImportedMap(importedData);
        } catch (error) {
            alert('Error reading file: Invalid JSON format');
            console.error('Import error:', error);
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

function loadImportedMap(importedData) {
    // Validate imported data structure
    if (!importedData.name || !importedData.nodes || !Array.isArray(importedData.nodes)) {
        alert('Invalid map file format');
        return;
    }
    
    // Determine grid size from nodes or use provided gridSize
    let maxCol = 0, maxRow = 0;
    let width = 5, height = 5; // defaults
    
    // Check if gridSize is provided in the import data
    if (importedData.gridSize) {
        width = importedData.gridSize.width;
        height = importedData.gridSize.height;
    } else {
        // Calculate from node positions
        importedData.nodes.forEach(node => {
            // Handle both formats: {x, y} and {column, row}
            const col = node.x !== undefined ? node.x : node.column;
            const row = node.y !== undefined ? node.y : node.row;
            
            if (col > maxCol) maxCol = col;
            if (row > maxRow) maxRow = row;
        });
        
        width = Math.max(maxCol + 1, 5);
        height = Math.max(maxRow + 1, 5);
    }
    
    // Create new map with imported data
    mapData = {
        name: importedData.name,
        width: width,
        height: height,
        nodes: new Map(),
        transitions: new Map()
    };
    
    // Load nodes
    importedData.nodes.forEach(node => {
        // Handle both formats: {x, y} and {column, row}
        const col = node.x !== undefined ? node.x : node.column;
        const row = node.y !== undefined ? node.y : node.row;
        
        const nodeKey = `${col},${row}`;
        mapData.nodes.set(nodeKey, {
            name: node.name || '',
            passage: node.passage || '',
            icon: node.icon || '',
            fogOfWar: node.fogOfWar || false,
            conditions: node.conditions || [],
            transitions: node.transitions || {}
        });
        
        // Load transitions
        if (node.transitions) {
            Object.entries(node.transitions).forEach(([direction, transition]) => {
                let targetCol = col;
                let targetRow = row;
                
                switch (direction) {
                    case 'north': targetRow--; break;
                    case 'south': targetRow++; break;
                    case 'east': targetCol++; break;
                    case 'west': targetCol--; break;
                }
                
                const transitionKey = `${col},${row}-${targetCol},${targetRow}`;
                mapData.transitions.set(transitionKey, {
                    type: transition.type || 'bidirectional',
                    direction: transition.direction || null,
                    conditions: transition.conditions || []
                });
            });
        }
    });
    
    // Update UI
    document.getElementById('mapTitle').textContent = `Twine Map Editor - ${mapData.name}`;
    generateGrid();
    // Refresh all connectors to reflect current transition types
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

function loadNodeMemory(col, row) {
    const nodeKey = `${col},${row}`;
    const memory = nodeMemory.get(nodeKey);

    if (memory) {
        document.getElementById('nodeName').value = memory.name || '';
        document.getElementById('passageName').value = memory.passage || '';
        document.getElementById('nodeIcon').value = memory.icon || '';
        document.getElementById('fogOfWar').checked = memory.fogOfWar || false;
        updateNodeConditionsList(memory.conditions || []);
        if (memory.transitions) {
            document.getElementById('transition-north').value = memory.transitions.north || 'none';
            document.getElementById('transition-west').value = memory.transitions.west || 'none';
            document.getElementById('transition-east').value = memory.transitions.east || 'none';
            document.getElementById('transition-south').value = memory.transitions.south || 'none';
        } else {
            populateTransitionControls(col, row);
        }
        return true;
    }
    return false;
}

// Enhanced editNode function with memory
function editNodeWithMemory(col, row) {
    currentEditingNode = { col, row };
    currentEditingTransition = null;
    
    const nodeKey = `${col},${row}`;
    
    // Try to load from memory first, then from saved data
    if (!loadedFromMemory) {
        const nodeData = mapData.nodes.get(nodeKey) || {};
        document.getElementById('nodeName').value = nodeData.name || '';
        document.getElementById('passageName').value = nodeData.passage || '';
        document.getElementById('nodeIcon').value = nodeData.icon || '';
        document.getElementById('fogOfWar').checked = nodeData.fogOfWar || false;
        updateNodeConditionsList(nodeData.conditions || []);
        
        // Update icon selection UI
        if (nodeData.icon) {
            updateIconSelection(nodeData.icon);
        } else {
            clearIconSelection();
        }
        populateTransitionControls(col, row);
    }
    
    // Show node editor
    document.getElementById('nodeEditor').classList.remove('hidden');
    document.getElementById('transitionEditor').classList.add('hidden');
    document.getElementById('sidebarTitle').textContent = `Edit Node (${col},${row})`;
    document.getElementById('sidebar').classList.remove('hidden');
}

// Node conditions functionality
function showConditionModal(context) {
    conditionModalContext = context;
    document.getElementById('conditionModal').classList.remove('hidden');
    document.getElementById('conditionForm').reset();
    handleConditionActionChange();
}

function handleConditionSubmitEnhanced(e) {
    e.preventDefault();
    
    const type = document.getElementById('conditionType').value;
    const value = document.getElementById('conditionValue').value.trim();
    const variableValue = document.getElementById('variableValue').value.trim();
    
    if (!value) return;
    
    const condition = { type };
    
    if (type === 'item') {
        condition.item = value;
    } else if (type === 'quest') {
        condition.quest = value;
    } else if (type === 'variable') {
        condition.variable = value;
        condition.value = variableValue;
    }
    
    if (conditionModalContext === 'node') {
        addNodeConditionToList(condition);
    } else {
        addConditionToList(condition);
    }
    
    hideConditionModal();
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

// Enhanced saveNode with conditions
function saveNodeEnhanced() {
    if (!currentEditingNode) return;
    
    const { col, row } = currentEditingNode;
    const nodeKey = `${col},${row}`;
    
    const name = document.getElementById('nodeName').value.trim();
    const passage = document.getElementById('passageName').value.trim();
    const icon = document.getElementById('nodeIcon').value;
    const fogOfWar = document.getElementById('fogOfWar').checked;
    const conditions = getCurrentNodeConditions();
    
    if (name || passage || icon) {
        mapData.nodes.set(nodeKey, {
            name: name,
            passage: passage,
            icon: icon,
            fogOfWar: fogOfWar,
            conditions: conditions
        });
    } else {
        mapData.nodes.delete(nodeKey);
    }
    
    // Clear memory for this node
    nodeMemory.delete(nodeKey);
    
    updateCellDisplay(document.querySelector(`[data-col="${col}"][data-row="${row}"]`), col, row);
    closeSidebar();
}

// Export Twine (.tw) file functionality
function exportTwineFile() {
    if (mapData.nodes.size === 0) {
        alert('No nodes to export. Please add some nodes first.');
        return;
    }
    
    const passages = new Set();
    
    // Collect all passage names from nodes
    for (const [key, nodeData] of mapData.nodes) {
        if (nodeData.passage) {
            passages.add(nodeData.passage);
        }
        
        // Add conditional passages based on node conditions
        if (nodeData.conditions && nodeData.conditions.length > 0) {
            nodeData.conditions.forEach(condition => {
                if (condition.type === 'variable') {
                    // Create conditional passage variants
                    passages.add(`${nodeData.passage}_${condition.variable}_${condition.value}`);
                }
            });
        }
    }
    
    // Collect passages from transition conditions
    for (const [key, transitionData] of mapData.transitions) {
        if (transitionData.conditions && transitionData.conditions.length > 0) {
            const [from] = key.split('-');
            const [fromCol, fromRow] = from.split(',').map(Number);
            const fromNodeKey = `${fromCol},${fromRow}`;
            const fromNode = mapData.nodes.get(fromNodeKey);
            
            if (fromNode && fromNode.passage) {
                transitionData.conditions.forEach(condition => {
                    if (condition.type === 'variable') {
                        passages.add(`${fromNode.passage}_${condition.variable}_${condition.value}`);
                    }
                });
            }
        }
    }
    
    // Generate .tw file content
    let twContent = '';
    
    passages.forEach(passageName => {
        twContent += `:: ${passageName}\n`;
        twContent += `<!-- Auto-generated passage for ${mapData.name} -->\n`;
        twContent += `<!-- Add your passage content here -->\n\n`;
    });
    
    // Add a special map data passage
    twContent += `:: ${mapData.name.replace(/\s+/g, '_')}_MapData\n`;
    twContent += `<!-- Map data for ${mapData.name} -->\n`;
    twContent += `<!-- This passage contains the map configuration -->\n\n`;
    
    // Download .tw file
    const blob = new Blob([twContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapData.name.toLowerCase().replace(/\s+/g, '_')}_passages.tw`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert(`Twine file exported with ${passages.size} passages!`);
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
                generateGrid();
                hideSetupModal();
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
    
    addNodeStateConditionToList(nodeCondition);
    hideNodeConditionModal();
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
    }

    function selectIcon(iconName) {
        selectedIcon = iconName;

        // Update hidden input field
        const nodeIconInput = document.getElementById('nodeIcon');
        if (nodeIconInput) {
            nodeIconInput.value = iconName;
        }

        if (selectedIconName) {
            selectedIconName.textContent = iconName;
        }

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
    renderIconGrid();

    // Expose functions globally
    window.updateIconSelection = function(iconName) {
        if (iconName && allIcons.includes(iconName)) {
            selectIcon(iconName);
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



// Replace original functions with enhanced versions
editNode = editNodeWithMemory;
saveNode = saveNodeEnhanced;


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
        selectedConditionIcon = iconName;

        // Update hidden input field
        const nodeConditionIconInput = document.getElementById('nodeConditionIcon');
        if (nodeConditionIconInput) {
            nodeConditionIconInput.value = iconName;
        }

        if (selectedConditionIconName) {
            selectedConditionIconName.textContent = iconName;
        }

        if (selectedConditionIconSVG) {
            selectedConditionIconSVG.innerHTML = '';
            const iconElement = document.createElement('i');
            iconElement.setAttribute('data-lucide', iconName);
            selectedConditionIconSVG.appendChild(iconElement);

            // Re-render Lucide icons
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
    
    const { targetCol, targetRow, offsetCol, offsetRow, canPlace } = placementPreviewData.currentPlacement;
    
    if (!canPlace) return;
    
    // Check if we need to expand the grid
    let needsExpansion = false;
    let newWidth = mapData.width;
    let newHeight = mapData.height;
    
    placementPreviewData.nodes.forEach(node => {
        const nodeCol = node.x !== undefined ? node.x : node.column;
        const nodeRow = node.y !== undefined ? node.y : node.row;
        
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
    
    // Expand grid if necessary
    if (needsExpansion) {
        mapData.width = newWidth;
        mapData.height = newHeight;
        generateGrid(); // Regenerate grid with new size
    }
    
    // Place the nodes
    placementPreviewData.nodes.forEach(node => {
        const nodeCol = node.x !== undefined ? node.x : node.column;
        const nodeRow = node.y !== undefined ? node.y : node.row;
        
        const newCol = nodeCol + offsetCol;
        const newRow = nodeRow + offsetRow;
        const nodeKey = `${newCol},${newRow}`;
        
        // Add the node
        mapData.nodes.set(nodeKey, {
            name: node.name || '',
            passage: node.passage || '',
            icon: node.icon || '',
            fogOfWar: node.fogOfWar || false,
            conditions: node.conditions || []
        });
        
        // Add transitions
        if (node.transitions) {
            Object.entries(node.transitions).forEach(([direction, transition]) => {
                let targetCol = newCol;
                let targetRow = newRow;
                
                switch (direction) {
                    case 'north': targetRow--; break;
                    case 'south': targetRow++; break;
                    case 'east': targetCol++; break;
                    case 'west': targetCol--; break;
                }
                
                const transitionKey = `${newCol},${newRow}-${targetCol},${targetRow}`;
                mapData.transitions.set(transitionKey, {
                    type: transition.type || 'bidirectional',
                    direction: transition.direction || null,
                    conditions: transition.conditions || []
                });
            });
        }
    });
    
    // Always update the affected cells after placement, regardless of expansion
    placementPreviewData.nodes.forEach(node => {
        const nodeCol = node.x !== undefined ? node.x : node.column;
        const nodeRow = node.y !== undefined ? node.y : node.row;

        const newCol = nodeCol + offsetCol;
        const newRow = nodeRow + offsetRow;

        const cell = document.querySelector(`[data-col="${newCol}"][data-row="${newRow}"]`);
        if (cell) {
            updateCellDisplay(cell, newCol, newRow);
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

// Modified import function to handle choice modal
function handleFileImportEnhanced(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Validate imported data structure
            if (!importedData.name || !importedData.nodes || !Array.isArray(importedData.nodes)) {
                alert('Invalid map file format');
                return;
            }
            
            pendingImportData = importedData;
            
            // Check if we have an existing map
            if (mapData.nodes.size > 0) {
                showImportChoiceModal();
            } else {
                loadImportedMap(importedData);
            }
        } catch (error) {
            alert('Error reading file: Invalid JSON format');
            console.error('Import error:', error);
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

// Replace the original file import handler
document.getElementById('fileInput').removeEventListener('change', handleFileImport);
document.getElementById('fileInput').addEventListener('change', handleFileImportEnhanced);

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
    
    // Apply initial transform
    updateMapTransform();
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
        </div>
    `;
    
    // Add event listeners
    panel.querySelector('#clearSelection').addEventListener('click', clearSelection);
    panel.querySelector('#bulkDeleteNodes').addEventListener('click', bulkDeleteNodes);
    panel.querySelector('#bulkToggleFog').addEventListener('click', bulkToggleFog);
    panel.querySelector('#applyBulkTransitions').addEventListener('click', applyBulkTransitions);
    
    document.body.appendChild(panel);
    return panel;
}

function updateBulkActionsUI() {
    const countElement = document.getElementById('selectedCount');
    if (countElement) {
        countElement.textContent = `${navigationState.selectedNodes.size} nodes selected`;
    }
}

function bulkDeleteNodes() {
    if (navigationState.selectedNodes.size === 0) return;
    
    const confirmed = confirm(`Delete ${navigationState.selectedNodes.size} selected nodes? This action cannot be undone.`);
    if (!confirmed) return;
    
    // Delete nodes and their transitions
    navigationState.selectedNodes.forEach(nodeKey => {
        mapData.nodes.delete(nodeKey);
        
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
        const [col, row] = nodeKey.split(',').map(Number);
        const cell = document.querySelector(`[data-col="${col}"][data-row="${row}"]`);
        if (cell) {
            updateCellDisplay(cell, col, row);
        }
    });
    
    // Update surrounding cells to refresh transition connectors
    navigationState.selectedNodes.forEach(nodeKey => {
        const [col, row] = nodeKey.split(',').map(Number);
        updateSurroundingCells(col, row);
    });
    
    clearSelection();
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
    closeSidebar();
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
}

// Node Styling System
function setupStyleControls() {
    // Color preset click handlers
    document.querySelectorAll('.color-preset').forEach(preset => {
        preset.addEventListener('click', function() {
            const color = this.dataset.color;
            const isSecondary = this.closest('.color-input-group').querySelector('#nodeSecondaryColor');
            
            if (isSecondary) {
                document.getElementById('nodeSecondaryColor').value = color;
            } else {
                document.getElementById('nodePrimaryColor').value = color;
            }
            
            // Update preset selection
            this.parentNode.querySelectorAll('.color-preset').forEach(p => p.classList.remove('selected'));
            this.classList.add('selected');
            
            if (currentEditingNode) {
                saveNodeMemory();
            }
        });
    });
    
    // Color input change handlers
    document.getElementById('nodePrimaryColor').addEventListener('change', function() {
        if (currentEditingNode) {
            saveNodeMemory();
        }
    });
    
    document.getElementById('nodeSecondaryColor').addEventListener('change', function() {
        if (currentEditingNode) {
            saveNodeMemory();
        }
    });
    
    document.getElementById('nodePattern').addEventListener('change', function() {
        if (currentEditingNode) {
            saveNodeMemory();
        }
    });
    
    // Tags input handler
    document.getElementById('nodeTags').addEventListener('input', function() {
        if (currentEditingNode) {
            saveNodeMemory();
        }
    });
}

function applyNodeStyling(cell, nodeData) {
    if (!nodeData.style) return;
    
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
    
    // Apply pattern
    if (pattern && pattern !== 'none') {
        cell.classList.add(`node-pattern-${pattern}`);
    }
}

// Enhanced node editing with new features
function editNodeEnhanced(col, row) {
    saveState(`Edit node (${col},${row})`);
    
    currentEditingNode = { col, row };
    currentEditingTransition = null;
    
    const nodeKey = `${col},${row}`;
    
    // Try to load from memory first, then from saved data
    if (!loadedFromMemory) {
        const nodeData = mapData.nodes.get(nodeKey) || {};
        
        // Basic fields
        document.getElementById('nodeName').value = nodeData.name || '';
        document.getElementById('passageName').value = nodeData.passage || '';
        document.getElementById('nodeIcon').value = nodeData.icon || '';
        document.getElementById('fogOfWar').checked = nodeData.fogOfWar || false;
        
        // Tags
        document.getElementById('nodeTags').value = (nodeData.tags || []).join(', ');
        
        // Style
        if (nodeData.style) {
            document.getElementById('nodePrimaryColor').value = nodeData.style.primaryColor || '#007bff';
            document.getElementById('nodeSecondaryColor').value = nodeData.style.secondaryColor || '#6c757d';
            document.getElementById('nodePattern').value = nodeData.style.pattern || 'none';
        } else {
            document.getElementById('nodePrimaryColor').value = '#007bff';
            document.getElementById('nodeSecondaryColor').value = '#6c757d';
            document.getElementById('nodePattern').value = 'none';
        }
        
        updateNodeConditionsList(nodeData.conditions || []);
        
        // Update icon selection UI
        if (nodeData.icon) {
            updateIconSelection(nodeData.icon);
        } else {
            clearIconSelection();
        }
        populateTransitionControls(col, row);
    } else {
        // memory loaded
        populateTransitionControls(col, row);
    }
    
    // Show node editor
    document.getElementById('nodeEditor').classList.remove('hidden');
    document.getElementById('transitionEditor').classList.add('hidden');
    document.getElementById('sidebarTitle').textContent = `Edit Node (${col},${row})`;
    document.getElementById('sidebar').classList.remove('hidden');
}

// Enhanced save node with new features
function saveNodeWithFeatures() {
    if (!currentEditingNode) return;
    
    const { col, row } = currentEditingNode;
    const nodeKey = `${col},${row}`;
    
    const name = document.getElementById('nodeName').value.trim();
    const passage = document.getElementById('passageName').value.trim();
    const icon = document.getElementById('nodeIcon').value;
    const fogOfWar = document.getElementById('fogOfWar').checked;
    
    // Parse tags
    const tagsInput = document.getElementById('nodeTags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    
    // Get style
    const style = {
        primaryColor: document.getElementById('nodePrimaryColor').value,
        secondaryColor: document.getElementById('nodeSecondaryColor').value,
        pattern: document.getElementById('nodePattern').value
    };
    
    const conditions = getCurrentNodeConditions();

    if (name || passage || icon || tags.length > 0) {
        const transitions = {
            north: document.getElementById('transition-north').value,
            west: document.getElementById('transition-west').value,
            east: document.getElementById('transition-east').value,
            south: document.getElementById('transition-south').value
        };

        mapData.nodes.set(nodeKey, {
            name: name,
            passage: passage,
            icon: icon,
            fogOfWar: fogOfWar,
            tags: tags,
            style: style,
            conditions: conditions,
            transitions: transitions
        });

        ['north','west','east','south'].forEach(dir => handleTransitionSelect(dir));
    } else {
        mapData.nodes.delete(nodeKey);
    }
    
    // Clear memory for this node
    nodeMemory.delete(nodeKey);
    
    const cell = document.querySelector(`[data-col="${col}"][data-row="${row}"]`);
    updateCellDisplay(cell, col, row);
    
    // Apply styling
    const nodeData = mapData.nodes.get(nodeKey);
    if (nodeData) {
        applyNodeStyling(cell, nodeData);
    }
    
    closeSidebar();
}

// Enhanced updateCellDisplay with styling
function updateCellDisplayEnhanced(cell, col, row) {
    const nodeKey = `${col},${row}`;
    const nodeData = mapData.nodes.get(nodeKey);
    
    cell.innerHTML = '';
    
    // Remove all pattern classes
    cell.classList.remove('node-pattern-diagonal-stripes', 'node-pattern-vertical-stripes', 
                         'node-pattern-horizontal-stripes', 'node-pattern-dots', 
                         'node-pattern-grid', 'node-pattern-checkerboard');
    
    // Reset inline styles
    cell.style.backgroundColor = '';
    cell.style.removeProperty('--node-primary-color');
    cell.style.removeProperty('--node-secondary-color');
    
    // Recreate transition connectors
    createTransitionConnectors(cell, col, row);
    
    if (nodeData) {
        cell.classList.add('filled');
        if (nodeData.fogOfWar) {
            cell.classList.add('fog-of-war');
        } else {
            cell.classList.remove('fog-of-war');
        }
        
        // Apply styling
        applyNodeStyling(cell, nodeData);
        
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
        
        // Tags (show first few)
        if (nodeData.tags && nodeData.tags.length > 0) {
            const tagsElement = document.createElement('div');
            tagsElement.className = 'node-tags';
            tagsElement.textContent = nodeData.tags.slice(0, 2).join(', ');
            if (nodeData.tags.length > 2) {
                tagsElement.textContent += '...';
            }
            content.appendChild(tagsElement);
        }
        
        // Coordinates
        const coordsElement = document.createElement('div');
        coordsElement.className = 'node-coords';
        coordsElement.textContent = `(${col},${row})`;
        content.appendChild(coordsElement);
        
        cell.appendChild(content);
        
        // Re-render Lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }
    } else {
        cell.classList.remove('filled', 'fog-of-war');
        
        const emptyText = document.createElement('div');
        emptyText.className = 'empty-node-text';
        emptyText.textContent = 'Empty Node';
        cell.appendChild(emptyText);
        
        const coordsElement = document.createElement('div');
        coordsElement.className = 'node-coords';
        coordsElement.textContent = `(${col},${row})`;
        cell.appendChild(coordsElement);
    }
    
    // Update transition connectors
    updateTransitionConnectors(col, row);
}

// Passage Text Editor
function openPassageTextEditor() {
    if (!currentEditingNode) return;
    
    const { col, row } = currentEditingNode;
    const nodeKey = `${col},${row}`;
    const nodeData = mapData.nodes.get(nodeKey) || {};
    
    currentEditingPassage = nodeKey;
    
    // Set title
    document.getElementById('passageEditorTitle').textContent = 
        `Edit Passage Text - ${nodeData.name || nodeData.passage || `Node (${col},${row})`}`;
    
    // Load existing passage text
    const passageData = passageTexts.get(nodeKey) || { main: '', conditions: {} };
    document.getElementById('mainPassageText').value = passageData.main || '';
    
    // Setup tabs and populate conditional passages
    setupPassageTabs();
    populateConditionalPassages(nodeData, passageData);
    
    // Show modal
    document.getElementById('passageTextModal').classList.remove('hidden');
    
    // Update preview
    updatePassagePreview();
}

function closePassageTextEditor() {
    document.getElementById('passageTextModal').classList.add('hidden');
    currentEditingPassage = null;
}

function savePassageText() {
    if (!currentEditingPassage) return;
    
    const mainText = document.getElementById('mainPassageText').value;
    
    // Collect conditional passage texts
    const conditionalTexts = {};
    const conditionalTextareas = document.querySelectorAll('[id^="conditionalText_"]');
    
    conditionalTextareas.forEach(textarea => {
        const index = textarea.id.split('_')[1];
        const conditionEditor = textarea.closest('.conditional-passage-editor');
        const passageName = conditionEditor.querySelector('h4').textContent.replace('Conditional Passage: ', '');
        conditionalTexts[passageName] = textarea.value;
    });
    
    // Save to passage texts
    passageTexts.set(currentEditingPassage, {
        main: mainText,
        conditions: conditionalTexts
    });
    
    closePassageTextEditor();
    alert('Passage text saved successfully!');
}

function setupPassageTabs() {
    const tabs = document.querySelectorAll('.passage-tab');
    const panels = document.querySelectorAll('.tab-panel');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active from all tabs and panels
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            
            // Add active to clicked tab and corresponding panel
            tab.classList.add('active');
            const targetPanel = document.getElementById(`${tab.dataset.tab}PassageTab`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });
    
    // Setup real-time preview
    document.getElementById('mainPassageText').addEventListener('input', updatePassagePreview);
}

function updatePassagePreview() {
    const text = document.getElementById('mainPassageText').value;
    const preview = document.getElementById('mainPassagePreview');
    
    // Simple markdown-like rendering
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        .replace(/\[\[(.*?)\]\]/g, '<span style="color: var(--accent-color); font-weight: bold;">→ $1</span>')
        .replace(/<<(.*?)>>/g, '<span style="color: var(--warning-color); font-style: italic;">&lt;&lt;$1&gt;&gt;</span>')
        .replace(/\n/g, '<br>');
    
    // Wrap list items
    html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
    
    preview.innerHTML = html || '<em>Preview will appear here as you type...</em>';
}

function populateConditionalPassages(nodeData, passageData) {
    const conditionalPassagesList = document.getElementById('conditionalPassagesList');
    
    // Clear existing content
    conditionalPassagesList.innerHTML = '';
    
    // Check if node has conditions
    if (!nodeData.conditions || nodeData.conditions.length === 0) {
        conditionalPassagesList.innerHTML = `
            <div class="help-text">
                No conditional passages available. Add node conditions in the sidebar to create conditional passages.
            </div>
        `;
        return;
    }
    
    // Create editors for each conditional passage
    nodeData.conditions.forEach((condition, index) => {
        const conditionPassageName = condition.passage;
        const conditionText = passageData.conditions[conditionPassageName] || '';
        
        const conditionEditor = document.createElement('div');
        conditionEditor.className = 'conditional-passage-editor';
        conditionEditor.innerHTML = `
            <div class="condition-header">
                <h4>Conditional Passage: ${conditionPassageName}</h4>
                <div class="condition-description">
                    <strong>Condition:</strong> ${condition.type} "${condition.name}" ${condition.operator} ${condition.value}
                    ${condition.description ? `<br><em>${condition.description}</em>` : ''}
                </div>
            </div>
            <div class="condition-editor-content">
                <div class="form-group">
                    <label for="conditionalText_${index}">Passage Content:</label>
                    <textarea id="conditionalText_${index}" rows="8" placeholder="Enter content for this conditional passage...

This passage will be used when: ${condition.type} '${condition.name}' ${condition.operator} ${condition.value}

You can use Twine syntax like:
[[Link to another passage]]
<<set $variable = value>>
<<if $condition>>...<<endif>>">${conditionText}</textarea>
                </div>
                <div class="condition-preview">
                    <label>Preview:</label>
                    <div id="conditionalPreview_${index}" class="preview-content"></div>
                </div>
            </div>
        `;
        
        conditionalPassagesList.appendChild(conditionEditor);
        
        // Add real-time preview for this conditional passage
        const textarea = conditionEditor.querySelector(`#conditionalText_${index}`);
        const preview = conditionEditor.querySelector(`#conditionalPreview_${index}`);
        
        function updateConditionalPreview() {
            const text = textarea.value;
            let html = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                .replace(/^- (.*$)/gm, '<li>$1</li>')
                .replace(/\[\[(.*?)\]\]/g, '<span style="color: var(--accent-color); font-weight: bold;">→ $1</span>')
                .replace(/<<(.*?)>>/g, '<span style="color: var(--warning-color); font-style: italic;">&lt;&lt;$1&gt;&gt;</span>')
                .replace(/\n/g, '<br>');
            
            html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
            preview.innerHTML = html || '<em>Preview will appear here as you type...</em>';
        }
        
        textarea.addEventListener('input', updateConditionalPreview);
        updateConditionalPreview(); // Initial preview
    });
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

// Enhanced export with new features
function exportMapEnhanced() {
    if (mapData.nodes.size === 0) {
        alert('No nodes to export. Please add some nodes first.');
        return;
    }
    
    // Find a default start position (first node with data)
    let defaultStart = null;
    for (const [key, nodeData] of mapData.nodes) {
        const [col, row] = key.split(',').map(Number);
        defaultStart = { x: col, y: row };
        break;
    }
    
    if (!defaultStart) {
        alert('No valid nodes found for export.');
        return;
    }
    
    // Build export data
    const exportData = {
        mapId: mapData.name.toLowerCase().replace(/\s+/g, '_'),
        name: mapData.name,
        gridSize: {
            width: mapData.width,
            height: mapData.height
        },
        defaultStart: defaultStart,
        nodes: [],
        passageTexts: Object.fromEntries(passageTexts)
    };
    
    // Convert nodes to export format
    for (const [key, nodeData] of mapData.nodes) {
        const [col, row] = key.split(',').map(Number);
        
        const exportNode = {
            column: col,
            row: row,
            name: nodeData.name || '',
            passage: nodeData.passage || '',
            icon: nodeData.icon || '',
            fogOfWar: nodeData.fogOfWar || false,
            tags: nodeData.tags || [],
            style: nodeData.style || {},
            conditions: nodeData.conditions || [],
            transitions: {}
        };
        
        // Add transitions for this node
        for (const [transitionKey, transitionData] of mapData.transitions) {
            const [from, to] = transitionKey.split('-');
            const [fromCol, fromRow] = from.split(',').map(Number);
            const [toCol, toRow] = to.split(',').map(Number);
            
            if (fromCol === col && fromRow === row) {
                // Determine direction
                let direction;
                if (toCol > fromCol) direction = 'east';
                else if (toCol < fromCol) direction = 'west';
                else if (toRow > fromRow) direction = 'south';
                else if (toRow < fromRow) direction = 'north';
                
                if (direction) {
                    exportNode.transitions[direction] = {
                        type: transitionData.type,
                        conditions: transitionData.conditions || []
                    };
                }
            }
        }
        
        exportData.nodes.push(exportNode);
    }
    
    // Download JSON file
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportData.mapId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Map exported successfully!');
}

// Enhanced Twine export with passage texts
function exportTwineFileEnhanced() {
    if (mapData.nodes.size === 0) {
        alert('No nodes to export. Please add some nodes first.');
        return;
    }
    
    let twContent = '';
    
    // Export passage texts
    for (const [nodeKey, nodeData] of mapData.nodes) {
        if (nodeData.passage) {
            const passageData = passageTexts.get(nodeKey);
            
            // Main passage
            twContent += `:: ${nodeData.passage}\n`;
            if (passageData && passageData.main) {
                twContent += passageData.main + '\n\n';
            } else {
                twContent += `<!-- Auto-generated passage for ${mapData.name} -->\n`;
                twContent += `<!-- Add your passage content here -->\n\n`;
            }
            
            // Conditional passages
            if (nodeData.conditions && nodeData.conditions.length > 0) {
                nodeData.conditions.forEach(condition => {
                    const conditionPassageName = condition.passage;
                    twContent += `:: ${conditionPassageName}\n`;
                    
                    if (passageData && passageData.conditions[condition.passage]) {
                        twContent += passageData.conditions[condition.passage] + '\n\n';
                    } else {
                        twContent += `<!-- Conditional passage: ${condition.description || 'No description'} -->\n`;
                        twContent += `<!-- Condition: ${condition.type} "${condition.name}" ${condition.operator} ${condition.value} -->\n`;
                        twContent += `<!-- Add your conditional passage content here -->\n\n`;
                    }
                });
            }
        }
    }
    
    // Add a special map data passage
    twContent += `:: ${mapData.name.replace(/\s+/g, '_')}_MapData\n`;
    twContent += `<!-- Map data for ${mapData.name} -->\n`;
    twContent += `<!-- This passage contains the map configuration -->\n\n`;
    
    // Download .tw file
    const blob = new Blob([twContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapData.name.toLowerCase().replace(/\s+/g, '_')}_passages.tw`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const passageCount = Array.from(mapData.nodes.values())
        .filter(node => node.passage)
        .reduce((count, node) => count + 1 + (node.conditions ? node.conditions.length : 0), 0);
    
    alert(`Twine file exported with ${passageCount} passages!`);
}

// Replace original functions with enhanced versions
editNode = editNodeEnhanced;
saveNode = saveNodeWithFeatures;
updateCellDisplay = updateCellDisplayEnhanced;
exportMap = exportMapEnhanced;
exportTwineFile = exportTwineFileEnhanced;

// NEW: Dynamic Tag Library System
function setupTagSystemListeners() {
    const tagInput = document.getElementById('nodeTags');
    const tagSuggestions = document.getElementById('tagSuggestions');
    const selectedTagsDisplay = document.getElementById('selectedTagsDisplay');
    
    if (!tagInput || !tagSuggestions || !selectedTagsDisplay) return;
    
    // Tag input event listeners
    tagInput.addEventListener('input', handleTagInput);
    tagInput.addEventListener('keydown', handleTagKeydown);
    tagInput.addEventListener('blur', hideTagSuggestions);
    
    // Initialize selected tags display
    updateSelectedTagsDisplay();
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
            e.preventDefault();
            if (tagSuggestionIndex >= 0 && suggestions[tagSuggestionIndex]) {
                selectTagSuggestion(suggestions[tagSuggestionIndex].textContent);
            } else {
                // Add current input as new tag
                const input = e.target.value;
                const lastCommaIndex = input.lastIndexOf(',');
                const currentTag = input.substring(lastCommaIndex + 1).trim();
                if (currentTag) {
                    addTag(currentTag);
                }
            }
            break;
        case 'Escape':
            hideTagSuggestions();
            break;
        case ',':
            // Auto-add tag when comma is typed
            setTimeout(() => {
                const input = e.target.value;
                const tags = input.split(',').map(tag => tag.trim()).filter(tag => tag);
                if (tags.length > selectedTags.size) {
                    const newTag = tags[tags.length - 1];
                    if (newTag && !selectedTags.has(newTag)) {
                        addTag(newTag);
                    }
                }
            }, 0);
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
    
    // Clear the input after the last comma
    const tagInput = document.getElementById('nodeTags');
    const input = tagInput.value;
    const lastCommaIndex = input.lastIndexOf(',');
    tagInput.value = input.substring(0, lastCommaIndex + 1).trim();
    if (tagInput.value && !tagInput.value.endsWith(',')) {
        tagInput.value += ', ';
    }
    tagInput.focus();
}

function addTag(tagName) {
    if (!tagName || selectedTags.has(tagName)) return;
    
    selectedTags.add(tagName);
    projectTagLibrary.add(tagName); // Add to project library
    updateSelectedTagsDisplay();
    
    // Update the input field
    const tagInput = document.getElementById('nodeTags');
    tagInput.value = Array.from(selectedTags).join(', ');
    
    if (currentEditingNode) {
        saveNodeMemory();
    }
}

function removeTag(tagName) {
    selectedTags.delete(tagName);
    updateSelectedTagsDisplay();
    
    // Update the input field
    const tagInput = document.getElementById('nodeTags');
    tagInput.value = Array.from(selectedTags).join(', ');
    
    if (currentEditingNode) {
        saveNodeMemory();
    }
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
    if (tags && Array.isArray(tags)) {
        tags.forEach(tag => {
            selectedTags.add(tag);
            projectTagLibrary.add(tag); // Add to project library
        });
    }
    updateSelectedTagsDisplay();
    
    // Update the input field to reflect the loaded tags
    const tagInput = document.getElementById('nodeTags');
    if (tagInput) {
        tagInput.value = Array.from(selectedTags).join(', ');
    }
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

// NEW: Prompted File Naming for Exports
function promptForFilename(defaultName, extension) {
    const filename = window.prompt(
        `Enter a filename for your ${extension.toUpperCase()} export:`,
        defaultName
    );
    
    if (filename === null) {
        return null; // User cancelled
    }
    
    if (filename.trim() === '') {
        return defaultName; // Use default if empty
    }
    
    // Sanitize filename
    const sanitized = filename.trim()
        .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
    
    return sanitized || defaultName;
}

// Enhanced export functions with prompted naming
function exportMapWithPrompt() {
    if (mapData.nodes.size === 0) {
        alert('No nodes to export. Please add some nodes first.');
        return;
    }
    
    const defaultFilename = mapData.name.toLowerCase().replace(/\s+/g, '_');
    const filename = promptForFilename(defaultFilename, 'json');
    
    if (filename === null) {
        return; // User cancelled
    }
    
    // Find a default start position (first node with data)
    let defaultStart = null;
    for (const [key, nodeData] of mapData.nodes) {
        const [col, row] = key.split(',').map(Number);
        defaultStart = { x: col, y: row };
        break;
    }
    
    if (!defaultStart) {
        alert('No valid nodes found for export.');
        return;
    }
    
    // Build export data
    const exportData = {
        mapId: filename,
        name: mapData.name,
        gridSize: {
            width: mapData.width,
            height: mapData.height
        },
        defaultStart: defaultStart,
        nodes: [],
        passageTexts: Object.fromEntries(passageTexts),
        projectTagLibrary: Array.from(projectTagLibrary),
        entryPointRegistry: Object.fromEntries(entryPointRegistry)
    };
    
    // Convert nodes to export format
    for (const [key, nodeData] of mapData.nodes) {
        const [col, row] = key.split(',').map(Number);
        
        const exportNode = {
            column: col,
            row: row,
            name: nodeData.name || '',
            passage: nodeData.passage || '',
            icon: nodeData.icon || '',
            fogOfWar: nodeData.fogOfWar || false,
            tags: nodeData.tags || [],
            style: nodeData.style || {},
            conditions: nodeData.conditions || [],
            transitions: {}
        };
        
        // Add transitions for this node
        for (const [transitionKey, transitionData] of mapData.transitions) {
            const [from, to] = transitionKey.split('-');
            const [fromCol, fromRow] = from.split(',').map(Number);
            const [toCol, toRow] = to.split(',').map(Number);
            
            if (fromCol === col && fromRow === row) {
                // Determine direction
                let direction;
                if (toCol > fromCol) direction = 'east';
                else if (toCol < fromCol) direction = 'west';
                else if (toRow > fromRow) direction = 'south';
                else if (toRow < fromRow) direction = 'north';
                
                if (direction) {
                    exportNode.transitions[direction] = {
                        type: transitionData.type,
                        conditions: transitionData.conditions || []
                    };
                }
            }
        }
        
        exportData.nodes.push(exportNode);
    }
    
    // Download JSON file
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Map exported successfully!');
}

function exportTwineFileWithPrompt() {
    if (mapData.nodes.size === 0) {
        alert('No nodes to export. Please add some nodes first.');
        return;
    }
    
    const defaultFilename = `${mapData.name.toLowerCase().replace(/\s+/g, '_')}_passages`;
    const filename = promptForFilename(defaultFilename, 'tw');
    
    if (filename === null) {
        return; // User cancelled
    }
    
    let twContent = '';
    
    // Export passage texts
    for (const [nodeKey, nodeData] of mapData.nodes) {
        if (nodeData.passage) {
            const passageData = passageTexts.get(nodeKey);
            
            // Main passage
            twContent += `:: ${nodeData.passage}\n`;
            if (passageData && passageData.main) {
                twContent += passageData.main + '\n\n';
            } else {
                twContent += `<!-- Auto-generated passage for ${mapData.name} -->\n`;
                twContent += `<!-- Add your passage content here -->\n\n`;
            }
            
            // Conditional passages
            if (nodeData.conditions && nodeData.conditions.length > 0) {
                nodeData.conditions.forEach(condition => {
                    const conditionPassageName = condition.passage;
                    twContent += `:: ${conditionPassageName}\n`;
                    
                    if (passageData && passageData.conditions[condition.passage]) {
                        twContent += passageData.conditions[condition.passage] + '\n\n';
                    } else {
                        twContent += `<!-- Conditional passage: ${condition.description || 'No description'} -->\n`;
                        twContent += `<!-- Condition: ${condition.type} "${condition.name}" ${condition.operator} ${condition.value} -->\n`;
                        twContent += `<!-- Add your conditional passage content here -->\n\n`;
                    }
                });
            }
        }
    }
    
    // Add a special map data passage
    twContent += `:: ${mapData.name.replace(/\s+/g, '_')}_MapData\n`;
    twContent += `<!-- Map data for ${mapData.name} -->\n`;
    twContent += `<!-- This passage contains the map configuration -->\n\n`;
    
    // Download .tw file
    const blob = new Blob([twContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.tw`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const passageCount = Array.from(mapData.nodes.values())
        .filter(node => node.passage)
        .reduce((count, node) => count + 1 + (node.conditions ? node.conditions.length : 0), 0);
    
    alert(`Twine file exported with ${passageCount} passages!`);
}

// Enhanced node editing to support new features
function editNodeWithNewFeatures(col, row) {
    saveState(`Edit node (${col},${row})`);
    
    currentEditingNode = { col, row };
    currentEditingTransition = null;
    
    const nodeKey = `${col},${row}`;
    
    // IMPORTANT: Clear the selectedTags Set first to prevent tag bleeding between nodes
    selectedTags.clear();
    const loadedFromMemory = loadNodeMemory(col, row);
    
    // Try to load from memory first, then from saved data
    if (!loadedFromMemory) {
        const nodeData = mapData.nodes.get(nodeKey) || {};
        
        // Basic fields
        document.getElementById('nodeName').value = nodeData.name || '';
        document.getElementById('passageName').value = nodeData.passage || '';
        document.getElementById('nodeIcon').value = nodeData.icon || '';
        document.getElementById('fogOfWar').checked = nodeData.fogOfWar || false;
        
        // Load tags into the new system (this will populate selectedTags)
        loadTagsFromNodeData(nodeData.tags);
        
        // Load entry point data
        loadEntryPointFromNodeData(nodeData);
        
        // Style
        if (nodeData.style) {
            document.getElementById('nodePrimaryColor').value = nodeData.style.primaryColor || '#007bff';
            document.getElementById('nodeSecondaryColor').value = nodeData.style.secondaryColor || '#6c757d';
            document.getElementById('nodePattern').value = nodeData.style.pattern || 'none';
        } else {
            document.getElementById('nodePrimaryColor').value = '#007bff';
            document.getElementById('nodeSecondaryColor').value = '#6c757d';
            document.getElementById('nodePattern').value = 'none';
        }
        
        updateNodeConditionsList(nodeData.conditions || []);
        
        // Update icon selection UI
        if (nodeData.icon) {
            updateIconSelection(nodeData.icon);
        } else {
            clearIconSelection();
        }
    }
    populateTransitionControls(col, row);
    
    // Show node editor
    document.getElementById('nodeEditor').classList.remove('hidden');
    document.getElementById('transitionEditor').classList.add('hidden');
    document.getElementById('sidebarTitle').textContent = `Edit Node (${col},${row})`;
    document.getElementById('sidebar').classList.remove('hidden');
}

// Enhanced save node with new features
function saveNodeWithAllFeatures() {
    if (!currentEditingNode) return;
    
    const { col, row } = currentEditingNode;
    const nodeKey = `${col},${row}`;
    
    const name = document.getElementById('nodeName').value.trim();
    const passage = document.getElementById('passageName').value.trim();
    const icon = document.getElementById('nodeIcon').value;
    const fogOfWar = document.getElementById('fogOfWar').checked;
    
    // Get tags from the new system
    const tags = Array.from(selectedTags);
    
    // Get style
    const style = {
        primaryColor: document.getElementById('nodePrimaryColor').value,
        secondaryColor: document.getElementById('nodeSecondaryColor').value,
        pattern: document.getElementById('nodePattern').value
    };
    
    const conditions = getCurrentNodeConditions();
    
    if (name || passage || icon || tags.length > 0) {
        mapData.nodes.set(nodeKey, {
            name: name,
            passage: passage,
            icon: icon,
            fogOfWar: fogOfWar,
            tags: tags,
            style: style,
            conditions: conditions
        });
        
        // Update entry point registry
        const entryTag = tags.find(tag => tag.startsWith('entry-'));
        if (entryTag) {
            entryPointRegistry.set(entryTag, nodeKey);
        }
    } else {
        mapData.nodes.delete(nodeKey);

        ['north','west','east','south'].forEach(dir => {
            const [dx, dy] = directionOffsets[dir];
            const tCol = col + dx;
            const tRow = row + dy;
            const key = `${col},${row}-${tCol},${tRow}`;
            const revKey = `${tCol},${tRow}-${col},${row}`;
            mapData.transitions.delete(key);
            mapData.transitions.delete(revKey);
        });

        // Remove from entry point registry
        for (const [type, registeredNodeKey] of entryPointRegistry.entries()) {
            if (registeredNodeKey === nodeKey) {
                entryPointRegistry.delete(type);
            }
        }
    }
    
    // Clear memory for this node
    nodeMemory.delete(nodeKey);
    
    const cell = document.querySelector(`[data-col="${col}"][data-row="${row}"]`);
    updateCellDisplay(cell, col, row);
    
    // Apply styling
    const nodeData = mapData.nodes.get(nodeKey);
    if (nodeData) {
        applyNodeStyling(cell, nodeData);
    }
    
    // Update entry point visuals
    updateEntryPointVisuals();
    
    closeSidebar();
}

// Replace export functions with prompted versions
exportMap = exportMapWithPrompt;
exportTwineFile = exportTwineFileWithPrompt;

// Replace node editing functions with enhanced versions
editNode = editNodeWithNewFeatures;
saveNode = saveNodeWithAllFeatures;

// Initialize icon selection when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Lucide to load
    setTimeout(() => {
        initializeIconSelection();
        initializeConditionIconSelection();
        updateUndoRedoButtons();
    }, 100);
});
