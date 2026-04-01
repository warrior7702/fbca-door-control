// FBCA Door Status Monitor
// Uses /api/schedules/active for real-time unlocked door count

const API_BASE = '';
let allDoors = [];
let currentFilter = 'all';
let currentBuildingFilter = 'all';
let unlockedDoorIds = [];
let activeSchedules = []; // Current active schedules from API
let upcomingSchedules = []; // Next event per door from API
let selectedDoorId = null;
let pendingBuildingAction = null; // { buildingName, action }
let isInitialLoad = true;

// Building mapping
const BUILDING_MAP = {
    'Wade': { name: 'Wade Building' },
    'Main': { name: 'Main Church' },
    'Student Center': { name: 'Student Center' },
    'PCB': { name: "Preschool & Children's Building" }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadStatus();
    // Auto-refresh every 30 seconds
    setInterval(loadStatus, 30000);
});

// Load door status AND active schedules (for real unlocked count)
async function loadStatus() {
    // Only show loading spinner on initial load
    if (isInitialLoad) {
        showLoading();
    }

    try {
        // Fetch all three endpoints in parallel
        const [doorsRes, activeRes, upcomingRes] = await Promise.all([
            fetch(`${API_BASE}/api/doors`),
            fetch(`${API_BASE}/api/schedules/active`),
            fetch(`${API_BASE}/api/schedules/upcoming`)
        ]);

        if (!doorsRes.ok) throw new Error('Failed to fetch doors');

        const data = await doorsRes.json();
        allDoors = (data.doors || []).filter(d => isActualDoor(d.doorName));

        // Get real unlocked door count from active schedules
        unlockedDoorIds = [];
        activeSchedules = [];
        if (activeRes.ok) {
            const activeData = await activeRes.json();
            unlockedDoorIds = activeData.unlockedDoorIds || [];
            activeSchedules = activeData.schedules || [];
        }
        
        // Get upcoming schedules
        upcomingSchedules = [];
        if (upcomingRes.ok) {
            const upcomingData = await upcomingRes.json();
            upcomingSchedules = upcomingData.schedules || [];
        }

        updateStats();
        
        // Only render full tree on initial load, otherwise just update cards
        if (isInitialLoad) {
            renderTree();
            isInitialLoad = false;
        } else {
            updateDoorCards();
        }
        
        updateLastSync();

        // If a door was selected, refresh its panel data
        if (selectedDoorId !== null) {
            const updatedDoor = allDoors.find(d => d.doorID === selectedDoorId);
            if (updatedDoor) populateDetailPanel(updatedDoor);
        }

    } catch (error) {
        console.error('Error loading status:', error);
        if (isInitialLoad) {
            document.getElementById('statusTree').innerHTML = `
                <div class="loading-state">
                    <p>⚠️ Failed to load door status. Will retry...</p>
                </div>
            `;
        }
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

function getActiveScheduleForDoor(doorID) {
    return activeSchedules.find(s => s.doorID === doorID);
}

function getUpcomingScheduleForDoor(doorID) {
    return upcomingSchedules.find(s => s.doorID === doorID);
}

function formatScheduleTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatScheduleInfo(schedule, isUpcoming = false) {
    if (!schedule) return null;
    const start = formatScheduleTime(schedule.startTime);
    const end = formatScheduleTime(schedule.endTime);
    return {
        name: schedule.scheduleName,
        time: `${start} - ${end}`,
        prefix: isUpcoming ? 'Next: ' : ''
    };
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
        const buildingInfo = BUILDING_MAP[buildingName] || { name: buildingName };
        // Flatten: get all doors from all controllers in this building
        const buildingDoors = Object.values(controllers).flat();
        const onlineCount = buildingDoors.filter(d => d.isActive).length;
        const unlockedCount = buildingDoors.filter(d => isDoorUnlocked(d.doorID)).length;
        const totalCount = buildingDoors.length;

        html += `
            <div class="tree-building" data-building="${buildingName}">
                <div class="tree-building-header" onclick="toggleBuilding(this)">
                    <span class="tree-toggle">▼</span>
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

// Update existing door cards without re-rendering tree (preserves collapse state)
function updateDoorCards() {
    // Update building stats
    document.querySelectorAll('.tree-building').forEach(buildingEl => {
        const buildingName = buildingEl.dataset.building;
        const buildingDoors = allDoors.filter(d => getBuildingFromController(d.controllerName) === buildingName);
        const onlineCount = buildingDoors.filter(d => d.isActive).length;
        const unlockedCount = buildingDoors.filter(d => isDoorUnlocked(d.doorID)).length;
        const totalCount = buildingDoors.length;
        
        const statsEl = buildingEl.querySelector('.tree-building-stats');
        if (statsEl) {
            statsEl.innerHTML = `
                <span class="stat-badge">${totalCount} doors</span>
                ${unlockedCount > 0 ? `<span class="stat-badge unlocked">${unlockedCount} unlocked</span>` : `<span class="stat-badge online">${onlineCount} online</span>`}
            `;
        }
    });
    
    // Update individual door cards
    document.querySelectorAll('.door-card-flat').forEach(card => {
        const doorName = card.dataset.doorName;
        const door = allDoors.find(d => d.doorName === doorName);
        if (!door) return;
        
        const isOnline = door.isActive;
        const isUnlocked = isDoorUnlocked(door.doorID);
        
        console.log(`Updating card: ${doorName} (ID: ${door.doorID}) → isUnlocked: ${isUnlocked}`);
        
        // Update classes
        card.className = 'door-card-flat';
        if (isOnline) card.classList.add('online');
        else card.classList.add('offline');
        if (isUnlocked) card.classList.add('unlocked');
        if (door.doorID === selectedDoorId) card.classList.add('selected');
        
        // Update data attributes
        card.dataset.status = isOnline ? 'online' : 'offline';
        card.dataset.unlocked = isUnlocked;
        
        // Update status indicator
        const indicator = card.querySelector('.door-status-indicator');
        if (indicator) {
            indicator.className = `door-status-indicator ${isOnline ? 'online' : 'offline'}`;
        }
        
        // Update lock icon text
        const lockIcon = card.querySelector('.door-lock-icon');
        if (lockIcon) {
            lockIcon.textContent = isUnlocked ? 'UNLOCKED' : 'LOCKED';
        }
    });
    
    applyFilter();
}

// Flat door renderer - no controller grouping
function renderDoorsFlat(doors) {
    const actualDoors = doors.filter(d => isActualDoor(d.doorName));
    if (actualDoors.length === 0) return '<div class="no-doors">No doors</div>';

    return `
        <div class="doors-grid">
            ${actualDoors.map(door => renderDoorCard(door)).join('')}
        </div>
    `;
}

// Individual door card
function renderDoorCard(door) {
    const isOnline = door.isActive;
    const isUnlocked = isDoorUnlocked(door.doorID);
    
    let cardClass = isOnline ? 'online' : 'offline';
    if (isUnlocked) cardClass += ' unlocked';
    const isSelected = door.doorID === selectedDoorId ? ' selected' : '';
    
    let scheduleHtml = '';
    
    if (isUnlocked) {
        // Show current active schedule
        const schedule = getActiveScheduleForDoor(door.doorID);
        const scheduleInfo = formatScheduleInfo(schedule);
        if (scheduleInfo) {
            scheduleHtml = `
                <div class="door-schedule-info">
                    <div class="schedule-name">${scheduleInfo.name}</div>
                    <div class="schedule-time">${scheduleInfo.time}</div>
                </div>
            `;
        }
    } else {
        // Show next upcoming schedule
        const upcomingSchedule = getUpcomingScheduleForDoor(door.doorID);
        const scheduleInfo = formatScheduleInfo(upcomingSchedule, true);
        if (scheduleInfo) {
            scheduleHtml = `
                <div class="door-schedule-info upcoming">
                    <div class="schedule-name">${scheduleInfo.prefix}${scheduleInfo.name}</div>
                    <div class="schedule-time">${scheduleInfo.time}</div>
                </div>
            `;
        }
    }

    return `
        <div class="door-card-flat ${cardClass}${isSelected}"
             data-door-name="${door.doorName}"
             data-status="${isOnline ? 'online' : 'offline'}"
             data-unlocked="${isUnlocked}"
             onclick="showDoorDetail(${door.doorID})">
            <div class="door-status-indicator ${isOnline ? 'online' : 'offline'}"></div>
            <div class="door-info-flat">
                <div class="door-name-flat">${door.doorName}</div>
                ${scheduleHtml}
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
    document.querySelectorAll('.stat-pill').forEach(pill => {
        pill.classList.remove('active');
        if (pill.dataset.filter === filter) pill.classList.add('active');
    });
    applyFilter();
}

function filterByBuilding(value) {
    currentBuildingFilter = value;
    document.querySelectorAll('.tree-building').forEach(building => {
        if (value === 'all' || building.dataset.building === value) {
            building.style.display = '';
        } else {
            building.style.display = 'none';
        }
    });
}

function applyFilter() {
    const searchTerm = document.getElementById('doorSearch').value.toLowerCase();
    console.log('applyFilter called with searchTerm:', searchTerm);

    let visibleCount = 0;
    document.querySelectorAll('.door-card-flat').forEach(card => {
        const isOnline = card.dataset.status === 'online';
        const isUnlocked = card.dataset.unlocked === 'true';
        const doorName = card.dataset.doorName.toLowerCase();
        const matchesSearch = doorName.includes(searchTerm);

        let matchesFilter = true;
        if (currentFilter === 'online') matchesFilter = isOnline;
        if (currentFilter === 'offline') matchesFilter = !isOnline;
        if (currentFilter === 'unlocked') matchesFilter = isUnlocked;

        const shouldShow = matchesFilter && matchesSearch;
        card.classList.toggle('hidden', !shouldShow);
        if (shouldShow) visibleCount++;
    });

    console.log('Visible doors after filter:', visibleCount);

    // Re-apply building filter
    if (currentBuildingFilter !== 'all') {
        filterByBuilding(currentBuildingFilter);
    }
}

// Handle door search with autocomplete
function handleDoorSearch() {
    const searchInput = document.getElementById('doorSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const autocompleteDiv = document.getElementById('doorAutocomplete');
    
    console.log('handleDoorSearch called:', { searchTerm, hasDoors: allDoors.length, hasAutocomplete: !!autocompleteDiv });
    
    // Always apply filter to update the door list in real-time
    applyFilter();
    
    // Show autocomplete only if search term is 2+ characters
    if (!searchTerm || searchTerm.length < 2) {
        if (autocompleteDiv) autocompleteDiv.style.display = 'none';
        return;
    }
    
    // Find matching doors
    const matchingDoors = allDoors.filter(door => 
        door.doorName.toLowerCase().includes(searchTerm)
    ).slice(0, 10); // Limit to 10 results
    
    console.log('Matching doors:', matchingDoors.length);
    
    if (matchingDoors.length > 0 && autocompleteDiv) {
        // Show autocomplete dropdown
        autocompleteDiv.innerHTML = '';
        matchingDoors.forEach(door => {
            const building = door.controllerName || 'Unknown Building';
            const div = document.createElement('div');
            div.style.cssText = 'padding: 0.75rem 1rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.1); color: #fff;';
            div.innerHTML = `
                <div style="font-weight: 600;">${door.doorName}</div>
                <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">${building}</div>
            `;
            div.addEventListener('click', () => selectDoor(door.doorName));
            div.addEventListener('mouseover', () => div.style.background = 'rgba(255,255,255,0.1)');
            div.addEventListener('mouseout', () => div.style.background = 'transparent');
            autocompleteDiv.appendChild(div);
        });
        
        // Position dropdown below search input using fixed positioning
        const inputRect = searchInput.getBoundingClientRect();
        autocompleteDiv.style.top = `${inputRect.bottom + 4}px`;
        autocompleteDiv.style.left = `${inputRect.left}px`;
        autocompleteDiv.style.width = `${inputRect.width}px`;
        
        console.log('Showing autocomplete with', matchingDoors.length, 'items');
        autocompleteDiv.style.display = 'block';
    } else if (autocompleteDiv) {
        console.log('Hiding autocomplete');
        autocompleteDiv.style.display = 'none';
    }
}

// Select door from autocomplete
function selectDoor(doorName) {
    const searchInput = document.getElementById('doorSearch');
    const autocompleteDiv = document.getElementById('doorAutocomplete');
    
    console.log('selectDoor called with:', doorName);
    if (searchInput) {
        searchInput.value = doorName;
        console.log('Set input value to:', searchInput.value);
    }
    if (autocompleteDiv) autocompleteDiv.style.display = 'none';
    
    console.log('Calling applyFilter after selection');
    applyFilter();
}

// Clear search filter
function clearSearchFilter() {
    const searchInput = document.getElementById('doorSearch');
    const autocompleteDiv = document.getElementById('doorAutocomplete');
    
    if (searchInput) searchInput.value = '';
    if (autocompleteDiv) autocompleteDiv.style.display = 'none';
    
    applyFilter();
}

// Legacy function for backward compatibility
function searchDoors() {
    handleDoorSearch();
}

function refreshStatus() {
    const spinner = document.getElementById('refreshSpinner');
    spinner.classList.remove('d-none');
    loadStatus().finally(() => spinner.classList.add('d-none'));
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function showDoorDetail(doorId) {
    const door = allDoors.find(d => d.doorID === doorId);
    if (!door) return;

    selectedDoorId = doorId;
    populateDetailPanel(door);

    // Open the panel
    document.getElementById('detailPanel').classList.add('open');
}

function populateDetailPanel(door) {
    const isOnline = door.isActive;
    const isUnlocked = isDoorUnlocked(door.doorID);

    document.getElementById('detailPanelTitle').textContent = door.doorName;
    document.getElementById('panelStatus').innerHTML =
        `<span class="badge ${isOnline ? 'bg-success' : 'bg-danger'}">${isOnline ? 'Online' : 'Offline'}</span>` +
        ` <span class="badge ${isUnlocked ? 'bg-warning text-dark' : 'bg-secondary'}">${isUnlocked ? 'Unlocked' : 'Locked'}</span>`;
    document.getElementById('panelController').textContent = door.controllerName;
    document.getElementById('panelLastSync').textContent = formatLastSync(door.lastSyncTime);
    document.getElementById('panelDeviceId').textContent = door.viaDeviceID;
    
    // Show schedule info
    const panelSchedule = document.getElementById('panelSchedule');
    if (panelSchedule) {
        if (isUnlocked) {
            const schedule = getActiveScheduleForDoor(door.doorID);
            const scheduleInfo = formatScheduleInfo(schedule);
            if (scheduleInfo) {
                panelSchedule.innerHTML = `
                    <div style="color: #75D3F2; font-weight: 500;">${scheduleInfo.name}</div>
                    <div style="color: rgba(255,255,255,0.6); font-size: 0.85rem; margin-top: 0.25rem;">${scheduleInfo.time}</div>
                `;
            } else {
                panelSchedule.textContent = 'No active schedule';
            }
        } else {
            const upcomingSchedule = getUpcomingScheduleForDoor(door.doorID);
            const scheduleInfo = formatScheduleInfo(upcomingSchedule, true);
            if (scheduleInfo) {
                panelSchedule.innerHTML = `
                    <div style="color: rgba(255,255,255,0.5); font-style: italic;">${scheduleInfo.prefix}${scheduleInfo.name}</div>
                    <div style="color: rgba(255,255,255,0.4); font-size: 0.85rem; margin-top: 0.25rem;">${scheduleInfo.time}</div>
                `;
            } else {
                panelSchedule.textContent = 'No upcoming schedules';
            }
        }
    }

    // Enable/disable buttons based on online status
    const unlockBtn = document.getElementById('panelUnlockBtn');
    const lockBtn = document.getElementById('panelLockBtn');
    unlockBtn.disabled = !isOnline;
    lockBtn.disabled = !isOnline;
}

function closeDetailPanel() {
    document.getElementById('detailPanel').classList.remove('open');
    selectedDoorId = null;
}

async function unlockSelectedDoor() {
    if (selectedDoorId === null) return;
    await sendDoorAction(selectedDoorId, 'unlock');
}

async function lockSelectedDoor() {
    if (selectedDoorId === null) return;
    await sendDoorAction(selectedDoorId, 'lock');
}

async function sendDoorAction(doorId, action) {
    const door = allDoors.find(d => d.doorID === doorId);
    const doorName = door ? door.doorName : `Door ${doorId}`;

    // Disable both buttons while working
    const unlockBtn = document.getElementById('panelUnlockBtn');
    const lockBtn = document.getElementById('panelLockBtn');
    if (unlockBtn) unlockBtn.disabled = true;
    if (lockBtn) lockBtn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/doors/${doorId}/test-quick-controls`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });

        const result = await res.json();

        if (res.ok && result.success) {
            // Update unlockedDoorIds immediately for instant visual feedback
            if (action === 'unlock') {
                if (!unlockedDoorIds.includes(doorId)) {
                    unlockedDoorIds.push(doorId);
                }
            } else if (action === 'lock') {
                unlockedDoorIds = unlockedDoorIds.filter(id => id !== doorId);
            }
            
            // Update UI instantly
            updateDoorCards();
            updateStats();
            
            // Update detail panel if it's still open for this door
            if (selectedDoorId === doorId && door) {
                populateDetailPanel(door);
            }
            
            showSuccess(`${doorName} ${action}ed successfully`);
        } else {
            showError(result.error || result.errorMessage || `Failed to ${action} ${doorName}`);
        }
    } catch (err) {
        console.error(`Error sending ${action} to door ${doorId}:`, err);
        showError(`Network error — could not ${action} ${doorName}`);
    } finally {
        // Re-enable buttons
        if (unlockBtn) unlockBtn.disabled = false;
        if (lockBtn) lockBtn.disabled = false;
    }
}

// ── Building-level Actions ────────────────────────────────────────────────────

function confirmBuildingAction(buildingName, action) {
    const buildingInfo = BUILDING_MAP[buildingName] || { name: buildingName };
    const buildingDoors = allDoors.filter(d => getBuildingFromController(d.controllerName) === buildingName && d.isActive);

    pendingBuildingAction = { buildingName, action };

    document.getElementById('confirmTitle').textContent = `${action === 'unlock' ? 'Unlock' : 'Lock'} All Doors`;
    document.getElementById('confirmMessage').textContent =
        `Are you sure you want to ${action} all active doors in ${buildingInfo.name}?`;
    document.getElementById('confirmDetails').textContent =
        `This will affect ${buildingDoors.length} active door${buildingDoors.length !== 1 ? 's' : ''}.`;

    new bootstrap.Modal(document.getElementById('buildingActionModal')).show();
}

async function executeBuildingAction() {
    if (!pendingBuildingAction) return;

    const { buildingName, action } = pendingBuildingAction;
    pendingBuildingAction = null;

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('buildingActionModal'));
    if (modal) modal.hide();

    const buildingDoors = allDoors.filter(d => getBuildingFromController(d.controllerName) === buildingName && d.isActive);

    if (buildingDoors.length === 0) {
        showError('No active doors found in this building.');
        return;
    }

    let successCount = 0;
    let failCount = 0;
    const failedDoors = [];
    const successfulDoorIds = [];

    // Process doors one at a time (MonitorCast can't handle parallel auth requests)
    for (const door of buildingDoors) {
        try {
            const res = await fetch(`${API_BASE}/api/doors/${door.doorID}/test-quick-controls`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const result = await res.json();
            if (res.ok && result.success) {
                successCount++;
                successfulDoorIds.push(door.doorID);
                console.log(`✅ ${door.doorName} ${action}ed successfully`);
            } else {
                failCount++;
                failedDoors.push(door.doorName);
                console.error(`❌ ${door.doorName} failed:`, result.error || result.errorMessage);
            }
        } catch (err) {
            failCount++;
            failedDoors.push(door.doorName);
            console.error(`❌ ${door.doorName} network error:`, err);
        }
    }
    
    // Immediately update unlockedDoorIds for instant visual feedback
    if (action === 'unlock') {
        unlockedDoorIds = [...new Set([...unlockedDoorIds, ...successfulDoorIds])];
        console.log('Updated unlockedDoorIds after unlock:', unlockedDoorIds);
    } else if (action === 'lock') {
        unlockedDoorIds = unlockedDoorIds.filter(id => !successfulDoorIds.includes(id));
        console.log('Updated unlockedDoorIds after lock:', unlockedDoorIds);
    }

    // Update door cards immediately with new lock states
    console.log('Calling updateDoorCards() with', successfulDoorIds.length, 'successful doors');
    updateDoorCards();
    updateStats();
    
    if (failCount === 0) {
        showSuccess(`All ${successCount} doors ${action}ed successfully`);
    } else {
        const failedList = failedDoors.slice(0, 3).join(', ');
        const more = failedDoors.length > 3 ? ` +${failedDoors.length - 3} more` : '';
        showError(`${successCount} doors ${action}ed, ${failCount} failed: ${failedList}${more}`);
        console.error('Failed doors:', failedDoors);
    }

    // Don't call loadStatus() here - it overwrites unlockedDoorIds before schedules activate
    // Next 30s auto-refresh will sync with server state
}

// ── Toasts ────────────────────────────────────────────────────────────────────

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
