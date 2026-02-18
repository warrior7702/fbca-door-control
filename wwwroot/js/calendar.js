// FBCA Door Control Calendar - Main JavaScript

const API_BASE = '/api';
let calendar;
let allDoors = [];
let allSchedules = [];
let currentSelectedEvent = null;
let doorsByBuilding = {};

// Helper: Clean up recurring event names (remove "2a ", "3b ", etc.)
function cleanEventName(eventName, isRecurring) {
    if (!isRecurring || !eventName) return eventName;
    // Remove leading instance numbers like "2a ", "3b ", etc.
    return eventName.replace(/^\d+[a-z]?\s+/i, '');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    loadDoors();
    loadSchedules();
    checkHealth();
    loadUserName();
    
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
            showDaySummary(info.start);
        },
        
        // When user clicks an event
        eventClick: function(info) {
            showEventDetails(info.event);
        },
        
        // Event rendering
        eventDidMount: function(info) {
            // Add tooltip
            info.el.title = `${info.event.title}\n${info.event.extendedProps.doorName || ''}`;
            
            // Apply visual hierarchy: recurring vs special events
            const schedules = info.event.extendedProps.schedules || [];
            const isRecurring = schedules.some(s => s.isRecurring === true);
            
            if (isRecurring) {
                info.el.classList.add('event-recurring');
            } else {
                info.el.classList.add('event-special');
            }
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
            // Filter out card readers and emergency exits (kept in DB for future alarm/monitoring use)
            .filter(door => {
                const name = door.doorName.toLowerCase();
                return !name.includes('reader') && !name.includes('emergency');
            });
        
        populateDoorDropdowns();
        updateStats();
        
    } catch (error) {
        console.error('Error loading doors:', error);
        showError('Failed to load doors: ' + error.message);
    }
}

// Load current user's name from authentication
async function loadUserName() {
    try {
        const response = await fetch(`${API_BASE}/auth/user`);
        if (!response.ok) throw new Error('Failed to load user info');
        
        const data = await response.json();
        const userNameEl = document.getElementById('userName');
        if (userNameEl && data.givenName) {
            userNameEl.textContent = data.givenName;
        }
    } catch (error) {
        console.error('Error loading user name:', error);
        // Silently fail - not critical
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = 'User';
        }
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
            isRecurring: schedule.isRecurring || false,  // Track if auto-generated from pattern
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

// Render schedules as calendar events (event-centered, not door-centered)
function renderCalendarEvents() {
    if (!calendar) return;
    
    // Clear existing events
    calendar.removeAllEvents();
    
    // Group schedules by event name + time (one calendar event per actual event)
    const eventGroups = {};
    
    allSchedules.forEach(schedule => {
        const eventKey = `${schedule.eventName || 'Unnamed Event'}_${schedule.unlockTime}_${schedule.lockTime}`;
        
        if (!eventGroups[eventKey]) {
            eventGroups[eventKey] = {
                eventName: schedule.eventName || 'Unnamed Event',
                unlockTime: schedule.unlockTime,
                lockTime: schedule.lockTime,
                schedules: [],
                status: schedule.status, // Track worst status
                notes: schedule.notes,
                createdAt: schedule.createdAt
            };
        }
        
        eventGroups[eventKey].schedules.push(schedule);
        
        // Update status to worst case (Failed > Cancelled > Pending > Executed)
        if (schedule.status === 'Failed') eventGroups[eventKey].status = 'Failed';
        else if (schedule.status === 'Cancelled' && eventGroups[eventKey].status !== 'Failed') 
            eventGroups[eventKey].status = 'Cancelled';
        else if (schedule.status === 'Pending' && eventGroups[eventKey].status === 'Executed')
            eventGroups[eventKey].status = 'Pending';
    });
    
    // Convert event groups to FullCalendar events
    const events = Object.values(eventGroups).map(group => {
        const doorCount = group.schedules.length;
        const doorList = group.schedules
            .map(s => {
                const door = allDoors.find(d => d.doorId === s.doorId);
                return door ? door.doorName : `Door ${s.doorId}`;
            })
            .join(', ');
        
        // Check if any schedule in this group is recurring
        const isRecurring = group.schedules.some(s => s.isRecurring === true);
        
        // Clean up event name (remove instance numbers like "2a " for recurring events)
        const cleanedEventName = cleanEventName(group.eventName, isRecurring);
        
        // Determine event color based on status
        let color = '#0d6efd'; // pending = blue
        if (group.status === 'Executed') color = '#198754'; // green
        if (group.status === 'Failed') color = '#dc3545'; // red
        if (group.status === 'Cancelled') color = '#6c757d'; // gray
        
        return {
            id: `event_${group.eventName}_${group.unlockTime}`,
            title: doorCount > 1 ? `${cleanedEventName} (${doorCount} doors)` : cleanedEventName,
            start: group.unlockTime,
            end: group.lockTime,
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
                eventName: group.eventName,
                schedules: group.schedules,
                doorCount: doorCount,
                doorList: doorList,
                status: group.status,
                notes: group.notes,
                createdAt: group.createdAt
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

// Show day summary modal
function showDaySummary(selectedDate) {
    const date = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Find schedules for this day
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    const daySchedules = allSchedules.filter(schedule => {
        const unlockTime = new Date(schedule.unlockTime);
        return unlockTime >= dayStart && unlockTime <= dayEnd;
    });
    
    // Build schedule list
    let scheduleListHTML = '';
    if (daySchedules.length === 0) {
        scheduleListHTML = '<p class="text-muted-modern">No schedules for this day</p>';
    } else {
        scheduleListHTML = '<div class="day-schedule-list">';
        daySchedules.forEach(schedule => {
            const door = allDoors.find(d => d.doorId === schedule.doorId);
            const doorName = door ? door.doorName : `Door ${schedule.doorId}`;
            const unlockTime = new Date(schedule.unlockTime);
            const lockTime = new Date(schedule.lockTime);
            const timeRange = `${formatTime(unlockTime)} - ${formatTime(lockTime)}`;
            
            scheduleListHTML += `
                <div class="day-schedule-item">
                    <div class="day-schedule-door">${doorName}</div>
                    <div class="day-schedule-event">${schedule.eventName || 'Unnamed Event'}</div>
                    <div class="day-schedule-time">${timeRange}</div>
                </div>
            `;
        });
        scheduleListHTML += '</div>';
    }
    
    // Update modal content
    document.getElementById('daySummaryDate').textContent = dateStr;
    document.getElementById('daySummarySchedules').innerHTML = scheduleListHTML;
    document.getElementById('daySummaryCreateBtn').onclick = () => {
        bootstrap.Modal.getInstance(document.getElementById('daySummaryModal')).hide();
        showCreateModal(date);
    };
    
    const modal = new bootstrap.Modal(document.getElementById('daySummaryModal'));
    modal.show();
}

// Format time only (no date)
function formatTime(date) {
    return date.toLocaleString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
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

// Show event details modal (event-centered with all doors)
function showEventDetails(event) {
    currentSelectedEvent = event;
    
    const props = event.extendedProps;
    const startTime = new Date(event.start);
    const endTime = event.end ? new Date(event.end) : null;
    
    // Build door list HTML
    let doorListHTML = '';
    if (props.schedules && props.schedules.length > 0) {
        doorListHTML = '<div class="event-door-list">';
        props.schedules.forEach(schedule => {
            const door = allDoors.find(d => d.doorId === schedule.doorId);
            const doorName = door ? door.doorName : `Door ${schedule.doorId}`;
            const scheduleStatus = schedule.status || 'Pending';
            doorListHTML += `
                <div class="event-door-item">
                    <span class="event-door-name">${doorName}</span>
                    <span class="badge status-badge-${scheduleStatus.toLowerCase()}">${scheduleStatus}</span>
                </div>
            `;
        });
        doorListHTML += '</div>';
    }
    
    const content = `
        <div class="event-detail-row">
            <span class="event-detail-label">Event Name:</span>
            <span class="event-detail-value">${props.eventName}</span>
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
            <span class="event-detail-label">Doors (${props.doorCount}):</span>
        </div>
        ${doorListHTML}
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

// Delete schedule (deletes all door schedules in the event)
async function deleteSchedule() {
    if (!currentSelectedEvent) return;
    
    const props = currentSelectedEvent.extendedProps;
    const doorCount = props.schedules ? props.schedules.length : 0;
    const confirmMsg = doorCount > 1 
        ? `Are you sure you want to delete this event and all ${doorCount} door schedules?`
        : 'Are you sure you want to delete this schedule?';
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    try {
        // Delete all schedules in this event
        const schedules = props.schedules || [];
        const deletePromises = schedules.map(schedule => 
            fetch(`${API_BASE}/schedules/${schedule.scheduleId}`, { method: 'DELETE' })
        );
        
        const responses = await Promise.all(deletePromises);
        
        // Check if any failed
        const failed = responses.filter(r => !r.ok);
        if (failed.length > 0) {
            throw new Error(`Failed to delete ${failed.length} schedule(s)`);
        }
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal')).hide();
        
        // Reload schedules
        await loadSchedules();
        
        showSuccess(`Event deleted successfully! (${schedules.length} door schedule(s) removed)`);
        
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
        // Filter events - show events that include the selected door
        if (!calendar) return;
        
        calendar.removeAllEvents();
        
        // Filter schedules that match the selected door
        const filteredSchedules = allSchedules.filter(s => s.doorId === selectedDoorId);
        
        // Group by event (same logic as renderCalendarEvents)
        const eventGroups = {};
        
        filteredSchedules.forEach(schedule => {
            const eventKey = `${schedule.eventName || 'Unnamed Event'}_${schedule.unlockTime}_${schedule.lockTime}`;
            
            if (!eventGroups[eventKey]) {
                eventGroups[eventKey] = {
                    eventName: schedule.eventName || 'Unnamed Event',
                    unlockTime: schedule.unlockTime,
                    lockTime: schedule.lockTime,
                    schedules: [],
                    status: schedule.status,
                    notes: schedule.notes,
                    createdAt: schedule.createdAt
                };
            }
            
            // Include ALL schedules for this event (not just the filtered door)
            // Find all schedules with same event name and times
            const allEventSchedules = allSchedules.filter(s => 
                s.eventName === schedule.eventName &&
                s.unlockTime === schedule.unlockTime &&
                s.lockTime === schedule.lockTime
            );
            
            eventGroups[eventKey].schedules = allEventSchedules;
            
            if (schedule.status === 'Failed') eventGroups[eventKey].status = 'Failed';
            else if (schedule.status === 'Cancelled' && eventGroups[eventKey].status !== 'Failed') 
                eventGroups[eventKey].status = 'Cancelled';
            else if (schedule.status === 'Pending' && eventGroups[eventKey].status === 'Executed')
                eventGroups[eventKey].status = 'Pending';
        });
        
        // Convert to calendar events
        const events = Object.values(eventGroups).map(group => {
            const doorCount = group.schedules.length;
            
            let color = '#0d6efd';
            if (group.status === 'Executed') color = '#198754';
            if (group.status === 'Failed') color = '#dc3545';
            if (group.status === 'Cancelled') color = '#6c757d';
            
            return {
                id: `event_${group.eventName}_${group.unlockTime}`,
                title: doorCount > 1 ? `${group.eventName} (${doorCount} doors)` : group.eventName,
                start: group.unlockTime,
                end: group.lockTime,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    eventName: group.eventName,
                    schedules: group.schedules,
                    doorCount: doorCount,
                    status: group.status,
                    notes: group.notes,
                    createdAt: group.createdAt
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
