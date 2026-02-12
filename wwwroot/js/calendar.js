// FBCA Door Control Calendar - Main JavaScript

const API_BASE = '/api';
let calendar;
let allDoors = [];
let allSchedules = [];
let currentSelectedEvent = null;

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
        const response = await fetch(`${API_BASE}/doors`);
        if (!response.ok) throw new Error('Failed to load doors');
        
        const data = await response.json();
        const doors = data.doors || data; // Handle both {doors: [...]} and [...] formats
        
        // Normalize property names (API returns doorID, scheduleID with capital ID)
        allDoors = doors.map(door => ({
            ...door,
            doorId: door.doorID || door.doorId,
            doorName: door.doorName,
            viaDeviceId: door.viaDeviceID || door.viaDeviceId,
            isActive: door.isActive
        }));
        
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

// Populate door dropdowns
function populateDoorDropdowns() {
    const createSelect = document.getElementById('createDoorId');
    const filterSelect = document.getElementById('doorFilter');
    
    // Clear existing options (keep placeholder)
    createSelect.innerHTML = '<option value="">Select a door...</option>';
    filterSelect.innerHTML = '<option value="">All Doors</option>';
    
    // Sort doors by name
    const sortedDoors = [...allDoors].sort((a, b) => 
        a.doorName.localeCompare(b.doorName)
    );
    
    // Add door options
    sortedDoors.forEach(door => {
        const option = document.createElement('option');
        option.value = door.doorId;
        option.textContent = door.doorName;
        createSelect.appendChild(option.cloneNode(true));
        filterSelect.appendChild(option);
    });
}

// Show create schedule modal
function showCreateModal(selectedDate = null) {
    const modal = new bootstrap.Modal(document.getElementById('createScheduleModal'));
    
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
function filterDoors() {
    const selectedDoorId = parseInt(document.getElementById('doorFilter').value);
    
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
