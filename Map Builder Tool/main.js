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

// Auto-save functionality
let autoSaveInterval = null;
const AUTO_SAVE_DELAY = 2000; // 2 seconds

// Condition modal context
let conditionModalContext = null; // 'node' or 'transition'

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
    document.getElementById('exportBtn').addEventListener('click', exportMap);
    document.getElementById('exportTwBtn').addEventListener('click', exportTwineFile);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
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
    
    // Condition management
    document.getElementById('addCondition').addEventListener('click', () => showConditionModal('transition'));
    document.getElementById('addNodeCondition').addEventListener('click', () => showConditionModal('node'));
    document.getElementById('conditionForm').addEventListener('submit', handleConditionSubmit);
    document.getElementById('cancelCondition').addEventListener('click', hideConditionModal);
    document.getElementById('conditionType').addEventListener('change', handleConditionTypeChange);
    
    // Node memory - save form data on input
    setupNodeMemoryListeners();
    
    // Auto-save setup
    setupAutoSave();
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
        rightConnector.addEventListener('click', (e) => {
            e.stopPropagation();
            editTransition(col, row, col + 1, row, 'east');
        });
        cell.appendChild(rightConnector);
    }
    
    // Bottom connector
    if (row < mapData.height - 1) {
        const bottomConnector = document.createElement('div');
        bottomConnector.className = 'transition-connector vertical bottom';
        bottomConnector.addEventListener('click', (e) => {
            e.stopPropagation();
            editTransition(col, row, col, row + 1, 'south');
        });
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
        connector.classList.remove('active', 'oneway');
        
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
        
        if (transition) {
            connector.classList.add('active');
            if (transition.type === 'oneway') {
                connector.classList.add('oneway');
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
        type: 'bi',
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
    
    if (type === 'oneway') {
        directionGroup.classList.remove('hidden');
    } else {
        directionGroup.classList.add('hidden');
    }
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
        direction: type === 'oneway' ? direction : null,
        conditions: conditions
    });
    
    updateTransitionConnectors(fromCol, fromRow);
    updateTransitionConnectors(toCol, toRow);
    
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

function showConditionModal() {
    document.getElementById('conditionModal').classList.remove('hidden');
    document.getElementById('conditionForm').reset();
    handleConditionTypeChange();
}

function hideConditionModal() {
    document.getElementById('conditionModal').classList.add('hidden');
}

function handleConditionTypeChange() {
    const type = document.getElementById('conditionType').value;
    const variableGroup = document.getElementById('variableValueGroup');
    
    if (type === 'variable') {
        variableGroup.classList.remove('hidden');
        document.getElementById('conditionValue').placeholder = 'Variable name';
    } else {
        variableGroup.classList.add('hidden');
        document.getElementById('conditionValue').placeholder = type === 'item' ? 'Item name' : 'Quest name';
    }
}

function handleConditionSubmit(e) {
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
    
    addConditionToList(condition);
    hideConditionModal();
}

function addConditionToList(condition) {
    const conditionsList = document.getElementById('conditionsList');
    
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
    const conditionItems = document.querySelectorAll('.condition-item');
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

function closeSidebar() {
    document.getElementById('sidebar').classList.add('hidden');
    currentEditingNode = null;
    currentEditingTransition = null;
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
    
    // Determine grid size from nodes
    let maxCol = 0, maxRow = 0;
    importedData.nodes.forEach(node => {
        if (node.column > maxCol) maxCol = node.column;
        if (node.row > maxRow) maxRow = node.row;
    });
    
    // Create new map with imported data
    mapData = {
        name: importedData.name,
        width: Math.max(maxCol + 1, 5),
        height: Math.max(maxRow + 1, 5),
        nodes: new Map(),
        transitions: new Map()
    };
    
    // Load nodes
    importedData.nodes.forEach(node => {
        const nodeKey = `${node.column},${node.row}`;
        mapData.nodes.set(nodeKey, {
            name: node.name || '',
            passage: node.passage || '',
            icon: node.icon || '',
            fogOfWar: node.fogOfWar || false,
            conditions: node.conditions || []
        });
        
        // Load transitions
        if (node.transitions) {
            Object.entries(node.transitions).forEach(([direction, transition]) => {
                let targetCol = node.column;
                let targetRow = node.row;
                
                switch (direction) {
                    case 'north': targetRow--; break;
                    case 'south': targetRow++; break;
                    case 'east': targetCol++; break;
                    case 'west': targetCol--; break;
                }
                
                const transitionKey = `${node.column},${node.row}-${targetCol},${targetRow}`;
                mapData.transitions.set(transitionKey, {
                    type: transition.type || 'bi',
                    direction: transition.direction || null,
                    conditions: transition.conditions || []
                });
            });
        }
    });
    
    // Update UI
    document.getElementById('mapTitle').textContent = `Twine Map Editor - ${mapData.name}`;
    generateGrid();
    closeSidebar();
    hideSetupModal();
    
    alert('Map imported successfully!');
}

// Node memory functionality
function setupNodeMemoryListeners() {
    const nodeInputs = ['nodeName', 'passageName', 'nodeIcon', 'fogOfWar'];
    
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
        conditions: getCurrentNodeConditions()
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
    if (!loadNodeMemory(col, row)) {
        const nodeData = mapData.nodes.get(nodeKey) || {};
        document.getElementById('nodeName').value = nodeData.name || '';
        document.getElementById('passageName').value = nodeData.passage || '';
        document.getElementById('nodeIcon').value = nodeData.icon || '';
        document.getElementById('fogOfWar').checked = nodeData.fogOfWar || false;
        updateNodeConditionsList(nodeData.conditions || []);
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
    handleConditionTypeChange();
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

// Replace original functions with enhanced versions
editNode = editNodeWithMemory;
saveNode = saveNodeEnhanced;
handleConditionSubmit = handleConditionSubmitEnhanced;
