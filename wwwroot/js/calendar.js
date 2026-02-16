// FBCA Door Control Calendar - Main JavaScript

const API_BASE = '/api';
let calendar;
let allDoors = [];
let allSchedules = [];
let currentSelectedEvent = null;
let doorsByBuilding = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    loadDoors();
    loadSchedules();
    checkHealth();
    
    // Refresh every 30 seconds
    setInterval(() => {
        loadSchedules();
        updateStats();
    }, 30000);
});

// Initialize FullCalendar
function initializeCalendar() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        timeZone: 'local', // Convert UTC times from API to local timezone
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
        },
        editable: false,
        selectable: true,
        selectMirror: true,
        dayMaxEvents: true,
        weekends: true,
        height: 'auto',
        
        // When user clicks a date/time
        select: function(info) {
            showCreateModal(info.startStr);
        },
        
        // When user clicks an event
        eventClick: function(info) {
            showEventDetails(info.event);
        },
        
        // Event rendering
        eventDidMount: function(info) {
            // Add tooltip
            info.el.title = `${info.event.title}\n${info.event.extendedProps.doorName || ''}`;
        }
    });
    
    calendar.render();
}

// Load all doors from API
async function loadDoors() {
    try {
        const response = await fetch(`${API_BASE}/doors?isActive=true`);
        if (!response.ok) throw new Error('Failed to load doors');
        
        const data = await response.json();
        const doors = data.doors || data; // Handle both {doors: [...]} and [...] formats
        
        // Normalize property names (API returns doorID, scheduleID with capital ID)
        allDoors = doors
            .map(door => ({
                ...door,
                doorId: door.doorID || door.doorId,
                doorName: door.doorName,
                viaDeviceId: door.viaDeviceID || door.viaDeviceId,
                isActive: door.isActive
            }))
            // Filter out card readers (kept in DB for future alarm/monitoring use)
            .filter(door => {
                const name = door.doorName.toLowerCase();
                return !name.includes('reader');
            });
        
        populateDoorDropdowns();
        updateStats();
        
    } catch (error) {
        console.error('Error loading doors:', error);
        showError('Failed to load doors: ' + error.message);
    }
}

// Load all schedules from API
async function loadSchedules() {
    try {
        const response = await fetch(`${API_BASE}/schedules`);
        if (!response.ok) throw new Error('Failed to load schedules');
        
        const data = await response.json();
        const schedules = data.schedules || data; // Handle both {schedules: [...]} and [...] formats
        
        // Normalize property names (API returns scheduleID, doorID with capital ID)
        allSchedules = schedules.map(schedule => ({
            ...schedule,
            scheduleId: schedule.scheduleID || schedule.scheduleId,
            doorId: schedule.doorID || schedule.doorId,
            unlockTime: schedule.startTime || schedule.unlockTime,
            lockTime: schedule.endTime || schedule.lockTime,
            eventName: schedule.scheduleName || schedule.eventName,
            status: schedule.status || 'Pending',
            notes: schedule.notes || '',
            createdAt: schedule.createdAt,
            lastModified: schedule.lastModified || schedule.updatedAt
        }));
        
        renderCalendarEvents();
        updateStats();
        
    } catch (error) {
        console.error('Error loading schedules:', error);
        showError('Failed to load schedules: ' + error.message);
    }
}

// Render schedules as calendar events
function renderCalendarEvents() {
    if (!calendar) return;
    
    // Clear existing events
    calendar.removeAllEvents();
    
    // Convert schedules to FullCalendar events
    const events = allSchedules.map(schedule => {
        const door = allDoors.find(d => d.doorId === schedule.doorId);
        const doorName = door ? door.doorName : `Door ${schedule.doorId}`;
        
        // Determine event color based on status
        let color = '#0d6efd'; // pending = blue
        if (schedule.status === 'Executed') color = '#198754'; // green
        if (schedule.status === 'Failed') color = '#dc3545'; // red
        if (schedule.status === 'Cancelled') color = '#6c757d'; // gray
        
        return {
            id: schedule.scheduleId,
            title: schedule.eventName || doorName,
            start: schedule.unlockTime,
            end: schedule.lockTime,
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
                scheduleId: schedule.scheduleId,
                doorId: schedule.doorId,
                doorName: doorName,
                status: schedule.status,
                notes: schedule.notes,
                createdAt: schedule.createdAt,
                lastModified: schedule.lastModified
            }
        };
    });
    
    calendar.addEventSource(events);
}

// Building key mapping
const BUILDINGS = {
    wade: 'Wade',
    mainChurch: 'Main Church',
    studentCenter: 'Student Center',
    pcb: 'PCB'
};

// Extract building name from controller name
function extractBuilding(controllerName, doorName = '') {
    if (!controllerName) return 'Unknown';
    
    // Format: "Controller 2: Wade Building" -> extract building
    const ctrlName = controllerName.toLowerCase();
    const dName = doorName.toLowerCase();
    
    // Check both controller name and door name for building keywords
    if (ctrlName.includes('wade') || dName.includes('wade')) return 'Wade';
    if (ctrlName.includes('pcb') || dName.includes('pcb') || 
        ctrlName.includes('preschool') || dName.includes('preschool') || 
        ctrlName.includes('children') || dName.includes('children')) return 'PCB';
    if (ctrlName.includes('student') || dName.includes('student') || 
        dName.includes('sc-')) return 'Student Center';
    if (ctrlName.includes('main') || ctrlName.includes('church') || 
        dName.includes('fbc-') || dName.includes('flc-') || dName.includes('parlor')) return 'Main Church';
    
    // Fallback
    return controllerName.split(':')[1]?.trim() || controllerName;
}

// Populate door dropdowns with building grouping
function populateDoorDropdowns() {
    // Clear all building filter dropdowns
    document.getElementById('doorFilterWade').innerHTML = '<option value="">Select door...</option>';
    document.getElementById('doorFilterMainChurch').innerHTML = '<option value="">Select door...</option>';
    document.getElementById('doorFilterStudentCenter').innerHTML = '<option value="">Select door...</option>';
    document.getElementById('doorFilterPCB').innerHTML = '<option value="">Select door...</option>';
    
    // Group doors by building (store globally for create modal)
    doorsByBuilding = {
        'Wade': [],
        'Main Church': [],
        'Student Center': [],
        'PCB': []
    };
    
    allDoors.forEach(door => {
        const building = extractBuilding(door.controllerName, door.doorName);
        if (doorsByBuilding[building]) {
            doorsByBuilding[building].push(door);
        }
    });
    
    // Sort doors within each building
    Object.keys(doorsByBuilding).forEach(building => {
        doorsByBuilding[building].sort((a, b) => a.doorName.localeCompare(b.doorName));
    });
    
    // Populate individual building filter dropdowns
    populateBuildingDropdown('doorFilterWade', doorsByBuilding['Wade']);
    populateBuildingDropdown('doorFilterMainChurch', doorsByBuilding['Main Church']);
    populateBuildingDropdown('doorFilterStudentCenter', doorsByBuilding['Student Center']);
    populateBuildingDropdown('doorFilterPCB', doorsByBuilding['PCB']);
}

// Update door list in create modal based on selected building
function updateCreateDoorList() {
    const buildingSelect = document.getElementById('createBuilding');
    const doorSelect = document.getElementById('createDoorId');
    
    const selectedBuilding = buildingSelect.value;
    
    if (!selectedBuilding) {
        // No building selected - disable door dropdown
        doorSelect.disabled = true;
        doorSelect.innerHTML = '<option value="">Select a building first...</option>';
        return;
    }
    
    // Enable door dropdown and populate with doors from selected building
    doorSelect.disabled = false;
    doorSelect.innerHTML = '<option value="">Select a door...</option>';
    
    const doors = doorsByBuilding[selectedBuilding] || [];
    
    if (doors.length === 0) {
        doorSelect.innerHTML = '<option value="">No doors found for this building</option>';
        doorSelect.disabled = true;
        return;
    }
    
    doors.forEach(door => {
        const option = document.createElement('option');
        option.value = door.doorId;
        option.textContent = door.doorName;
        doorSelect.appendChild(option);
    });
}

// Populate a single building dropdown
function populateBuildingDropdown(selectId, doors) {
    const select = document.getElementById(selectId);
    
    // Sort doors by name
    doors.sort((a, b) => a.doorName.localeCompare(b.doorName));
    
    doors.forEach(door => {
        const option = document.createElement('option');
        option.value = door.doorId;
        option.textContent = door.doorName;
        select.appendChild(option);
    });
}

// Show create schedule modal
function showCreateModal(selectedDate = null) {
    const modal = new bootstrap.Modal(document.getElementById('createScheduleModal'));
    
    // Reset building/door selectors
    document.getElementById('createBuilding').value = '';
    document.getElementById('createDoorId').value = '';
    document.getElementById('createDoorId').disabled = true;
    document.getElementById('createDoorId').innerHTML = '<option value="">Select a building first...</option>';
    
    // Pre-fill date if provided
    if (selectedDate) {
        const unlockInput = document.getElementById('createUnlockTime');
        const lockInput = document.getElementById('createLockTime');
        
        // Set unlock time to selected date
        const date = new Date(selectedDate);
        unlockInput.value = formatDateTimeLocal(date);
        
        // Set lock time to 2 hours later
        const lockDate = new Date(date);
        lockDate.setHours(lockDate.getHours() + 2);
        lockInput.value = formatDateTimeLocal(lockDate);
    }
    
    modal.show();
}

// Create schedule
async function createSchedule() {
    const doorId = parseInt(document.getElementById('createDoorId').value);
    const unlockTime = document.getElementById('createUnlockTime').value;
    const lockTime = document.getElementById('createLockTime').value;
    const eventName = document.getElementById('createEventName').value;
    const notes = document.getElementById('createNotes').value;
    
    // Validation
    if (!doorId) {
        alert('Please select a door');
        return;
    }
    
    if (!unlockTime || !lockTime) {
        alert('Please specify both unlock and lock times');
        return;
    }
    
    if (new Date(lockTime) <= new Date(unlockTime)) {
        alert('Lock time must be after unlock time');
        return;
    }
    
    const payload = {
        doorId: doorId,
        startTime: new Date(unlockTime).toISOString(),
        endTime: new Date(lockTime).toISOString(),
        scheduleName: eventName || null,
        source: "Manual"
    };
    
    try {
        const response = await fetch(`${API_BASE}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        const created = await response.json();
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('createScheduleModal')).hide();
        
        // Reset form
        document.getElementById('createScheduleForm').reset();
        
        // Reload schedules
        await loadSchedules();
        
        showSuccess('Schedule created successfully!');
        
    } catch (error) {
        console.error('Error creating schedule:', error);
        showError('Failed to create schedule: ' + error.message);
    }
}

// Show event details modal
function showEventDetails(event) {
    currentSelectedEvent = event;
    
    const props = event.extendedProps;
    const startTime = new Date(event.start);
    const endTime = event.end ? new Date(event.end) : null;
    
    const content = `
        <div class="event-detail-row">
            <span class="event-detail-label">Schedule ID:</span>
            <span class="event-detail-value">${props.scheduleId}</span>
        </div>
        <div class="event-detail-row">
            <span class="event-detail-label">Door:</span>
            <span class="event-detail-value">${props.doorName}</span>
        </div>
        <div class="event-detail-row">
            <span class="event-detail-label">Event Name:</span>
            <span class="event-detail-value">${event.title}</span>
        </div>
        <div class="event-detail-row">
            <span class="event-detail-label">Unlock Time:</span>
            <span class="event-detail-value">${formatDateTime(startTime)}</span>
        </div>
        <div class="event-detail-row">
            <span class="event-detail-label">Lock Time:</span>
            <span class="event-detail-value">${endTime ? formatDateTime(endTime) : 'N/A'}</span>
        </div>
        <div class="event-detail-row">
            <span class="event-detail-label">Status:</span>
            <span class="badge status-badge-${(props.status || 'pending').toLowerCase()}">${props.status || 'Pending'}</span>
        </div>
        ${props.notes ? `
        <div class="event-detail-row">
            <span class="event-detail-label">Notes:</span>
            <span class="event-detail-value">${props.notes}</span>
        </div>
        ` : ''}
        <div class="event-detail-row">
            <span class="event-detail-label">Created:</span>
            <span class="event-detail-value">${formatDateTime(new Date(props.createdAt))}</span>
        </div>
    `;
    
    document.getElementById('eventDetailsContent').innerHTML = content;
    
    const modal = new bootstrap.Modal(document.getElementById('eventDetailsModal'));
    modal.show();
}

// Delete schedule
async function deleteSchedule() {
    if (!currentSelectedEvent) return;
    
    if (!confirm('Are you sure you want to delete this schedule?')) {
        return;
    }
    
    const scheduleId = currentSelectedEvent.extendedProps.scheduleId;
    
    try {
        const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal')).hide();
        
        // Reload schedules
        await loadSchedules();
        
        showSuccess('Schedule deleted successfully!');
        
    } catch (error) {
        console.error('Error deleting schedule:', error);
        showError('Failed to delete schedule: ' + error.message);
    }
}

// Sync doors from VIA database
async function syncDoors() {
    const spinner = document.getElementById('syncSpinner');
    spinner.classList.remove('d-none');
    
    try {
        const response = await fetch(`${API_BASE}/doors/sync`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        const result = await response.json();
        
        await loadDoors();
        
        showSuccess(`Doors synced! Added: ${result.doorsAdded}, Updated: ${result.doorsUpdated}`);
        
        // Update last sync time
        document.getElementById('statLastSync').textContent = formatDateTime(new Date());
        
    } catch (error) {
        console.error('Error syncing doors:', error);
        showError('Failed to sync doors: ' + error.message);
    } finally {
        spinner.classList.add('d-none');
    }
}

// Filter calendar by door
function filterDoors(building) {
    // Get the selected door ID from the appropriate dropdown
    let selectedDoorId;
    
    if (building === 'wade') {
        selectedDoorId = parseInt(document.getElementById('doorFilterWade').value);
        // Clear other dropdowns
        document.getElementById('doorFilterMainChurch').value = '';
        document.getElementById('doorFilterStudentCenter').value = '';
        document.getElementById('doorFilterPCB').value = '';
    } else if (building === 'mainChurch') {
        selectedDoorId = parseInt(document.getElementById('doorFilterMainChurch').value);
        document.getElementById('doorFilterWade').value = '';
        document.getElementById('doorFilterStudentCenter').value = '';
        document.getElementById('doorFilterPCB').value = '';
    } else if (building === 'studentCenter') {
        selectedDoorId = parseInt(document.getElementById('doorFilterStudentCenter').value);
        document.getElementById('doorFilterWade').value = '';
        document.getElementById('doorFilterMainChurch').value = '';
        document.getElementById('doorFilterPCB').value = '';
    } else if (building === 'pcb') {
        selectedDoorId = parseInt(document.getElementById('doorFilterPCB').value);
        document.getElementById('doorFilterWade').value = '';
        document.getElementById('doorFilterMainChurch').value = '';
        document.getElementById('doorFilterStudentCenter').value = '';
    }
    
    if (!selectedDoorId) {
        // Show all events
        renderCalendarEvents();
    } else {
        // Filter events
        if (!calendar) return;
        
        calendar.removeAllEvents();
        
        const filteredSchedules = allSchedules.filter(s => s.doorId === selectedDoorId);
        const events = filteredSchedules.map(schedule => {
            const door = allDoors.find(d => d.doorId === schedule.doorId);
            const doorName = door ? door.doorName : `Door ${schedule.doorId}`;
            
            let color = '#0d6efd';
            if (schedule.status === 'Executed') color = '#198754';
            if (schedule.status === 'Failed') color = '#dc3545';
            if (schedule.status === 'Cancelled') color = '#6c757d';
            
            return {
                id: schedule.scheduleId,
                title: schedule.eventName || doorName,
                start: schedule.unlockTime,
                end: schedule.lockTime,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    scheduleId: schedule.scheduleId,
                    doorId: schedule.doorId,
                    doorName: doorName,
                    status: schedule.status,
                    notes: schedule.notes,
                    createdAt: schedule.createdAt,
                    lastModified: schedule.lastModified
                }
            };
        });
        
        calendar.addEventSource(events);
    }
}

// Check system health
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const health = await response.json();
        
        const statusEl = document.getElementById('healthStatus');
        
        if (health.status === 'Healthy') {
            statusEl.innerHTML = '<span class="health-ok">✅ All Systems Operational</span>';
        } else {
            statusEl.innerHTML = `<span class="health-error">⚠️ ${health.status}</span>`;
        }
        
    } catch (error) {
        console.error('Error checking health:', error);
        document.getElementById('healthStatus').innerHTML = 
            '<span class="health-error">❌ Health Check Failed</span>';
    }
}

// Update statistics
function updateStats() {
    document.getElementById('statTotalDoors').textContent = allDoors.length;
    
    const activeSchedules = allSchedules.filter(s => 
        s.status === 'Pending' && new Date(s.lockTime) > new Date()
    );
    document.getElementById('statActiveSchedules').textContent = activeSchedules.length;
}

// Show success toast
function showSuccess(message) {
    const toastEl = document.getElementById('successToast');
    document.getElementById('successToastMessage').textContent = message;
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

// Show error toast
function showError(message) {
    const toastEl = document.getElementById('errorToast');
    document.getElementById('errorToastMessage').textContent = message;
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

// Format datetime for display
function formatDateTime(date) {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Format datetime for input[type="datetime-local"]
function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// ===== MULTI-DOOR EVENT FUNCTIONS =====

let multiDoorStep = 1;
let multiDoorSelectedDoors = [];

// Show multi-door event modal
function showMultiDoorModal() {
    const modal = new bootstrap.Modal(document.getElementById('multiDoorModal'));
    
    // Reset to step 1
    multiDoorStep = 1;
    multiDoorSelectedDoors = [];
    
    // Reset form
    document.getElementById('multiDoorForm').reset();
    document.getElementById('multiEventName').value = '';
    
    // Show step 1, hide step 2
    document.getElementById('multiDoorStep1').classList.remove('d-none');
    document.getElementById('multiDoorStep2').classList.add('d-none');
    
    // Show/hide buttons
    document.getElementById('multiDoorNextBtn').classList.remove('d-none');
    document.getElementById('multiDoorBackBtn').classList.add('d-none');
    document.getElementById('multiDoorCreateBtn').classList.add('d-none');
    
    // Pre-fill with current date/time
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    document.getElementById('multiDefaultUnlockTime').value = formatDateTimeLocal(now);
    document.getElementById('multiDefaultLockTime').value = formatDateTimeLocal(twoHoursLater);
    
    modal.show();
}

// Next button - move to step 2
function multiDoorNext() {
    if (multiDoorStep === 1) {
        // Validate step 1
        const eventName = document.getElementById('multiEventName').value.trim();
        const unlockTime = document.getElementById('multiDefaultUnlockTime').value;
        const lockTime = document.getElementById('multiDefaultLockTime').value;
        
        if (!eventName) {
            alert('Please enter an event name');
            return;
        }
        
        if (!unlockTime || !lockTime) {
            alert('Please specify unlock and lock times');
            return;
        }
        
        if (new Date(lockTime) <= new Date(unlockTime)) {
            alert('Lock time must be after unlock time');
            return;
        }
        
        // Move to step 2
        multiDoorStep = 2;
        document.getElementById('multiDoorStep1').classList.add('d-none');
        document.getElementById('multiDoorStep2').classList.remove('d-none');
        
        // Update buttons
        document.getElementById('multiDoorNextBtn').classList.add('d-none');
        document.getElementById('multiDoorBackBtn').classList.remove('d-none');
        document.getElementById('multiDoorCreateBtn').classList.remove('d-none');
        
        // Populate door checkboxes
        populateMultiDoorCheckboxes();
    }
}

// Back button - return to step 1
function multiDoorBack() {
    if (multiDoorStep === 2) {
        multiDoorStep = 1;
        document.getElementById('multiDoorStep1').classList.remove('d-none');
        document.getElementById('multiDoorStep2').classList.add('d-none');
        
        // Update buttons
        document.getElementById('multiDoorNextBtn').classList.remove('d-none');
        document.getElementById('multiDoorBackBtn').classList.add('d-none');
        document.getElementById('multiDoorCreateBtn').classList.add('d-none');
    }
}

// Populate door checkboxes by building
function populateMultiDoorCheckboxes() {
    // Populate each building
    populateBuildingCheckboxes('wade', 'Wade', doorsByBuilding['Wade'] || []);
    populateBuildingCheckboxes('mainChurch', 'Main Church', doorsByBuilding['Main Church'] || []);
    populateBuildingCheckboxes('studentCenter', 'Student Center', doorsByBuilding['Student Center'] || []);
    populateBuildingCheckboxes('pcb', 'PCB', doorsByBuilding['PCB'] || []);
}

// Populate checkboxes for a specific building
function populateBuildingCheckboxes(buildingKey, buildingName, doors) {
    const containerId = `doors${buildingKey.charAt(0).toUpperCase() + buildingKey.slice(1)}`;
    const container = document.getElementById(containerId);
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (doors.length === 0) {
        container.innerHTML = '<p class="text-muted small">No doors found for this building</p>';
        return;
    }
    
    doors.forEach(door => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'door-checkbox-multi';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `door_${door.doorId}`;
        checkbox.value = door.doorId;
        checkbox.className = 'form-check-input';
        checkbox.onchange = updateMultiDoorSelection;
        
        const label = document.createElement('label');
        label.htmlFor = `door_${door.doorId}`;
        label.className = 'form-check-label';
        label.textContent = door.doorName;
        
        checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(label);
        container.appendChild(checkboxDiv);
    });
}

// Toggle custom times for a building
function toggleCustomTimes(buildingKey) {
    const customTimesId = `customTimes${buildingKey.charAt(0).toUpperCase() + buildingKey.slice(1)}`;
    const customTimesDiv = document.getElementById(customTimesId);
    
    if (customTimesDiv.classList.contains('d-none')) {
        customTimesDiv.classList.remove('d-none');
        
        // Pre-fill with default times
        const defaultUnlock = document.getElementById('multiDefaultUnlockTime').value;
        const defaultLock = document.getElementById('multiDefaultLockTime').value;
        
        const unlockInput = document.getElementById(`${buildingKey}UnlockTime`);
        const lockInput = document.getElementById(`${buildingKey}LockTime`);
        
        if (!unlockInput.value) unlockInput.value = defaultUnlock;
        if (!lockInput.value) lockInput.value = defaultLock;
    } else {
        customTimesDiv.classList.add('d-none');
    }
}

// Select all doors in a building
function selectAllBuilding(buildingKey) {
    const containerId = `doors${buildingKey.charAt(0).toUpperCase() + buildingKey.slice(1)}`;
    const container = document.getElementById(containerId);
    
    if (!container) return;
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
    
    updateMultiDoorSelection();
}

// Update selection preview
function updateMultiDoorSelection() {
    const allCheckboxes = document.querySelectorAll('.door-checkbox-multi input[type="checkbox"]');
    multiDoorSelectedDoors = Array.from(allCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));
    
    const previewDiv = document.getElementById('selectedDoorsPreview');
    const countSpan = document.getElementById('selectedDoorsCount');
    const listDiv = document.getElementById('selectedDoorsList');
    
    if (multiDoorSelectedDoors.length === 0) {
        previewDiv.classList.add('d-none');
        return;
    }
    
    previewDiv.classList.remove('d-none');
    countSpan.textContent = `✅ ${multiDoorSelectedDoors.length} Door(s) Selected`;
    
    // Build badge list
    listDiv.innerHTML = '';
    multiDoorSelectedDoors.forEach(doorId => {
        const door = allDoors.find(d => d.doorId === doorId);
        if (!door) return;
        
        const badge = document.createElement('span');
        badge.className = 'selected-door-badge-multi';
        badge.textContent = door.doorName;
        listDiv.appendChild(badge);
    });
}

// Create multi-door event
async function createMultiDoorEvent() {
    try {
        // Validate selection
        if (multiDoorSelectedDoors.length === 0) {
            alert('Please select at least one door');
            return;
        }
        
        const eventName = document.getElementById('multiEventName').value.trim();
        const defaultUnlock = document.getElementById('multiDefaultUnlockTime').value;
        const defaultLock = document.getElementById('multiDefaultLockTime').value;
        
        // Build door requests with custom times
        const doorRequests = multiDoorSelectedDoors.map(doorId => {
            const door = allDoors.find(d => d.doorId === doorId);
            if (!door) return null;
            
            const building = extractBuilding(door.controllerName, door.doorName);
            const buildingKey = getBuildingKey(building);
            
            // Check if building has custom times
            const customTimesDiv = document.getElementById(`customTimes${buildingKey.charAt(0).toUpperCase() + buildingKey.slice(1)}`);
            
            let customUnlock = null;
            let customLock = null;
            
            if (customTimesDiv && !customTimesDiv.classList.contains('d-none')) {
                const unlockInput = document.getElementById(`${buildingKey}UnlockTime`);
                const lockInput = document.getElementById(`${buildingKey}LockTime`);
                
                if (unlockInput && unlockInput.value) {
                    customUnlock = new Date(unlockInput.value).toISOString();
                }
                if (lockInput && lockInput.value) {
                    customLock = new Date(lockInput.value).toISOString();
                }
            }
            
            return {
                doorId: doorId,
                customStartTime: customUnlock,
                customEndTime: customLock
            };
        }).filter(r => r !== null);
        
        const payload = {
            eventName: eventName,
            defaultStartTime: new Date(defaultUnlock).toISOString(),
            defaultEndTime: new Date(defaultLock).toISOString(),
            doors: doorRequests,
            source: 'Multi-Door Event'
        };
        
        // Call batch API
        const response = await fetch(`${API_BASE}/schedules/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        const result = await response.json();
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('multiDoorModal')).hide();
        
        // Reload schedules
        await loadSchedules();
        
        showSuccess(result.message || `Created ${result.successCount} schedule(s)!`);
        
        if (result.errors && result.errors.length > 0) {
            console.warn('Some doors had errors:', result.errors);
        }
        
    } catch (error) {
        console.error('Error creating multi-door event:', error);
        showError('Failed to create multi-door event: ' + error.message);
    }
}

// Get building key from building name
function getBuildingKey(buildingName) {
    const map = {
        'Wade': 'wade',
        'Main Church': 'mainChurch',
        'Student Center': 'studentCenter',
        'PCB': 'pcb'
    };
    return map[buildingName] || 'wade';
}
