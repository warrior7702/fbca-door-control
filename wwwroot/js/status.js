// FBCA Door Status Monitor - ICONS REMOVED VERSION
// Uses /api/schedules/active for real-time unlocked door count

const API_BASE = '';
let allDoors = [];
let currentFilter = 'all';
let unlockedDoorIds = [];

// Building mapping
const BUILDING_MAP = {
    'Wade': { emoji: '🏢', name: 'Wade Building' },
    'Main': { emoji: '⛪', name: 'Main Church' },
    'Student Center': { emoji: '🎓', name: 'Student Center' },
    'PCB': { emoji: '👶', name: "Preschool & Children's Building" }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadStatus();
    // Auto-refresh every 30 seconds
    setInterval(loadStatus, 30000);
});

// Load door status AND active schedules (for real unlocked count)
async function loadStatus() {
    showLoading();
    
    try {
        // Fetch both endpoints in parallel
        const [doorsRes, activeRes] = await Promise.all([
            fetch(`${API_BASE}/api/doors`),
            fetch(`${API_BASE}/api/schedules/active`)
        ]);
        
        if (!doorsRes.ok) throw new Error('Failed to fetch doors');
        
        const data = await doorsRes.json();
        allDoors = (data.doors || []).filter(d => isActualDoor(d.doorName));
        
        // Get real unlocked door count from active schedules
        unlockedDoorIds = [];
        if (activeRes.ok) {
            const activeData = await activeRes.json();
            unlockedDoorIds = activeData.unlockedDoorIds || [];
        }
        
        updateStats();
        renderTree();
        updateLastSync();
        
    } catch (error) {
        console.error('Error loading status:', error);
        document.getElementById('statusTree').innerHTML = `
            <div class="loading-state">
                <p>⚠️ Failed to load door status. Will retry...</p>
            </div>
        `;
    }
}

function showLoading() {
    document.getElementById('statusTree').innerHTML = `
        <div class="loading-state">
            <div class="spinner-border text-primary"></div>
            <p>Loading door status...</p>
        </div>
    `;
}

function updateStats() {
    const total = allDoors.length;
    const online = allDoors.filter(d => d.isActive).length;
    const offline = total - online;
    const unlocked = allDoors.filter(d => unlockedDoorIds.includes(d.doorID)).length;
    
    document.getElementById('totalDoors').textContent = total;
    document.getElementById('onlineDoors').textContent = online;
    document.getElementById('offlineDoors').textContent = offline;
    document.getElementById('unlockedDoors').textContent = unlocked;
}

function isDoorUnlocked(doorID) {
    return unlockedDoorIds.includes(doorID);
}

function updateLastSync() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('lastSyncTime').textContent = timeStr;
}

function organizeDoors() {
    const buildings = {};
    const actualDoors = allDoors.filter(d => isActualDoor(d.doorName));
    
    actualDoors.forEach(door => {
        const buildingName = getBuildingFromController(door.controllerName);
        if (!buildings[buildingName]) buildings[buildingName] = {};
        if (!buildings[buildingName][door.controllerName]) buildings[buildingName][door.controllerName] = [];
        buildings[buildingName][door.controllerName].push(door);
    });
    
    return buildings;
}

function getBuildingFromController(controllerName) {
    const name = controllerName.toLowerCase();
    if (name.includes('wade')) return 'Wade';
    if (name.includes('student') || name.includes('sc-')) return 'Student Center';
    if (name.includes('preschool') || name.includes('pcb') || name.includes('children')) return 'PCB';
    return 'Main';
}

function renderTree() {
    const tree = document.getElementById('statusTree');
    const buildings = organizeDoors();
    
    let html = '';
    for (const [buildingName, controllers] of Object.entries(buildings)) {
        const buildingInfo = BUILDING_MAP[buildingName] || { emoji: '🏢', name: buildingName };
        // Flatten: get all doors from all controllers in this building
        const buildingDoors = Object.values(controllers).flat();
        const onlineCount = buildingDoors.filter(d => d.isActive).length;
        const unlockedCount = buildingDoors.filter(d => isDoorUnlocked(d.doorID)).length;
        const totalCount = buildingDoors.length;
        
        html += `
            <div class="tree-building" data-building="${buildingName}">
                <div class="tree-building-header" onclick="toggleBuilding(this)">
                    <span class="tree-toggle">▼</span>
                    <span class="tree-building-icon">${buildingInfo.emoji}</span>
                    <span class="tree-building-name">${buildingInfo.name}</span>
                    <div class="building-actions">
                        <button class="btn-building-action btn-building-unlock" onclick="event.stopPropagation(); confirmBuildingAction('${buildingName}', 'unlock')">Unlock All</button>
                        <button class="btn-building-action btn-building-lock" onclick="event.stopPropagation(); confirmBuildingAction('${buildingName}', 'lock')">Lock All</button>
                    </div>
                    <div class="tree-building-stats">
                        <span class="stat-badge">${totalCount} doors</span>
                        ${unlockedCount > 0 ? `<span class="stat-badge unlocked">${unlockedCount} unlocked</span>` : `<span class="stat-badge online">${onlineCount} online</span>`}
                    </div>
                </div>
                <div class="tree-doors-flat">
                    ${renderDoorsFlat(buildingDoors)}
                </div>
            </div>
        `;
    }
    
    tree.innerHTML = html;
    applyFilter();
}

// Flat door renderer - no controller grouping (Phase 1.1)
function renderDoorsFlat(doors) {
    const actualDoors = doors.filter(d => isActualDoor(d.doorName));
    if (actualDoors.length === 0) return '<div class="no-doors">No doors</div>';
    
    return `
        <div class="doors-grid">
            ${actualDoors.map(door => renderDoorCard(door)).join('')}
        </div>
    `;
}

// Individual door card - Phase 1: trimmed, colored - ICONS REMOVED
function renderDoorCard(door) {
    const isOnline = door.isActive;
    const isUnlocked = isDoorUnlocked(door.doorID);
    
    // Phase 1.4: Color coding
    let cardClass = isOnline ? 'online' : 'offline';
    if (isUnlocked) cardClass += ' unlocked';
    
    return `
        <div class="door-card-flat ${cardClass}" 
             data-door-name="${door.doorName}"
             data-status="${isOnline ? 'online' : 'offline'}"
             data-unlocked="${isUnlocked}"
             onclick="showDoorDetail(${door.doorID})">
            <div class="door-status-indicator ${isOnline ? 'online' : 'offline'}"></div>
            <div class="door-info-flat">
                <div class="door-name-flat">${door.doorName}</div>
            </div>
            <div class="door-lock-icon">${isUnlocked ? 'UNLOCKED' : 'LOCKED'}</div>
        </div>
    `;
}

function isActualDoor(doorName) {
    const name = doorName.toLowerCase();
    const exclusions = ['request to exit', 'rex', 'aux input', 'aux output', 'alarm', 'strike', 'contact', 'dps', 'handicap'];
    return !exclusions.some(ex => name.includes(ex));
}

function renderDoors(doors) {
    const actualDoors = doors.filter(d => isActualDoor(d.doorName));
    if (actualDoors.length === 0) return '<div class="no-doors">No doors</div>';
    
    return actualDoors.map(door => {
        const isOnline = door.isActive;
        const isUnlocked = isDoorUnlocked(door.doorID);
        return `
            <div class="door-card ${isOnline ? 'online' : 'offline'}" 
                 data-door-name="${door.doorName}"
                 data-status="${isOnline ? 'online' : 'offline'}"
                 data-unlocked="${isUnlocked}"
                 onclick="showDoorDetail(${door.doorID})">
                <div class="door-status ${isOnline ? 'online' : 'offline'}"></div>
                <div class="door-info">
                    <div class="door-name">${door.doorName}</div>
                    <div class="door-meta">${formatLastSync(door.lastSyncTime)}</div>
                </div>
                <div class="door-lock">${isUnlocked ? 'UNLOCKED' : 'LOCKED'}</div>
            </div>
        `;
    }).join('');
}

function formatLastSync(syncTime) {
    if (!syncTime) return 'Never synced';
    const sync = new Date(syncTime);
    const now = new Date();
    const diffMins = Math.floor((now - sync) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    return sync.toLocaleDateString();
}

function toggleBuilding(header) {
    header.closest('.tree-building').classList.toggle('collapsed');
}

function toggleController(header) {
    header.closest('.tree-controller').classList.toggle('collapsed');
}

function expandAll() {
    document.querySelectorAll('.tree-building, .tree-controller').forEach(el => el.classList.remove('collapsed'));
}

function collapseAll() {
    document.querySelectorAll('.tree-building, .tree-controller').forEach(el => el.classList.add('collapsed'));
}

function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.stat-box.clickable').forEach(box => {
        box.classList.remove('active');
        if (box.dataset.filter === filter) {
            box.classList.add('active');
        }
    });
    applyFilter();
}

function applyFilter() {
    const searchTerm = document.getElementById('doorSearch').value.toLowerCase();
    
    document.querySelectorAll('.door-card').forEach(card => {
        const isOnline = card.dataset.status === 'online';
        const isUnlocked = card.dataset.unlocked === 'true';
        const doorName = card.dataset.doorName.toLowerCase();
        const matchesSearch = doorName.includes(searchTerm);
        
        let matchesFilter = true;
        if (currentFilter === 'online') matchesFilter = isOnline;
        if (currentFilter === 'offline') matchesFilter = !isOnline;
        if (currentFilter === 'unlocked') matchesFilter = isUnlocked;
        
        card.classList.toggle('hidden', !(matchesFilter && matchesSearch));
    });
}

function searchDoors() {
    applyFilter();
}

function refreshStatus() {
    const spinner = document.getElementById('refreshSpinner');
    spinner.classList.remove('d-none');
    loadStatus().finally(() => spinner.classList.add('d-none'));
}

function showDoorDetail(doorId) {
    const door = allDoors.find(d => d.doorID === doorId);
    if (!door) return;
    
    const isOnline = door.isActive;
    document.getElementById('detailTitle').textContent = door.doorName;
    document.getElementById('detailStatus').innerHTML = `<span class="badge ${isOnline ? 'bg-success' : 'bg-danger'}">${isOnline ? 'Online' : 'Offline'}</span>`;
    document.getElementById('detailController').textContent = door.controllerName;
    document.getElementById('detailLastSync').textContent = formatLastSync(door.lastSyncTime);
    document.getElementById('detailDeviceId').textContent = door.viaDeviceID;
    
    new bootstrap.Modal(document.getElementById('doorDetailModal')).show();
}

function toggleDoorLock() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('doorDetailModal'));
    modal.hide();
}

function showSuccess(message) {
    const toast = document.getElementById('successToast');
    document.getElementById('successToastMessage').textContent = message;
    new bootstrap.Toast(toast).show();
}

function showError(message) {
    const toast = document.getElementById('errorToast');
    document.getElementById('errorToastMessage').textContent = message;
    new bootstrap.Toast(toast).show();
}