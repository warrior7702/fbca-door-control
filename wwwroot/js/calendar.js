// FBCA Door Control Calendar - Main JavaScript

const API_BASE = '/api';
let calendar;
let allDoors = [];
let allSchedules = [];
let currentSelectedEvent = null;
let doorsByBuilding = {};
let eventFilter = 'all'; // Filter state: 'all', 'special', 'weekly'
let doorSearchTerm = ''; // Live search filter
let buildingFilter = ''; // Building filter
let activeScheduleIds = new Set(); // Currently active schedule IDs
let activeScheduleData = {}; // Map of scheduleID -> { minutesRemaining, endTime }

// Helper: Clean up recurring event names (remove "2a ", "3b ", etc.)
function cleanEventName(eventName, isRecurring) {
    if (!isRecurring || !eventName) return eventName;
    // Remove leading instance numbers like "2a ", "3b ", etc.
    return eventName.replace(/^\d+[a-z]?\s+/i, '');
}

// Three-way event filter
function changeEventFilter() {
    const dropdown = document.getElementById('eventFilterDropdown');
    if (dropdown) {
        eventFilter = dropdown.value;
    }
    
    // Re-render calendar with filter applied
    renderCalendarEvents();
}

// Handle door search with autocomplete
function handleDoorSearch() {
    const searchInput = document.getElementById('doorSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const autocompleteDiv = document.getElementById('doorAutocomplete');
    
    if (!searchTerm || searchTerm.length < 2) {
        // Hide autocomplete if search is empty or too short
        if (autocompleteDiv) autocompleteDiv.style.display = 'none';
        doorSearchTerm = '';
        renderCalendarEvents();
        return;
    }
    
    // Find matching doors
    const matchingDoors = allDoors.filter(door => 
        door.doorName.toLowerCase().includes(searchTerm)
    ).slice(0, 10); // Limit to 10 results
    
    if (matchingDoors.length > 0 && autocompleteDiv) {
        // Show autocomplete dropdown
        autocompleteDiv.innerHTML = matchingDoors.map(door => {
            const building = extractBuilding(door.controllerName, door.doorName);
            return `
                <div onclick="selectDoor('${door.doorName.replace(/'/g, "\\'")}')" 
                     style="padding: 0.75rem 1rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.1); color: #fff;"
                     onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                     onmouseout="this.style.background='transparent'">
                    <div style="font-weight: 600;">${door.doorName}</div>
                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">${building}</div>
                </div>
            `;
        }).join('');
        autocompleteDiv.style.display = 'block';
    } else if (autocompleteDiv) {
        autocompleteDiv.style.display = 'none';
    }
    
    // Apply filter
    doorSearchTerm = searchTerm;
    renderCalendarEvents();
}

// Select door from autocomplete
function selectDoor(doorName) {
    const searchInput = document.getElementById('doorSearch');
    const autocompleteDiv = document.getElementById('doorAutocomplete');
    
    if (searchInput) searchInput.value = doorName;
    if (autocompleteDiv) autocompleteDiv.style.display = 'none';
    
    doorSearchTerm = doorName.toLowerCase();
    renderCalendarEvents();
}

// Filter by building dropdown
function filterCalendarByBuilding() {
    const buildingSelect = document.getElementById('buildingFilter');
    buildingFilter = buildingSelect ? buildingSelect.value : '';
    renderCalendarEvents();
}

// Clear all filters
function clearAllFilters() {
    const searchInput = document.getElementById('doorSearch');
    const buildingSelect = document.getElementById('buildingFilter');
    const eventFilterDropdown = document.getElementById('eventFilterDropdown');
    const autocompleteDiv = document.getElementById('doorAutocomplete');
    
    if (searchInput) searchInput.value = '';
    if (buildingSelect) buildingSelect.value = '';
    if (eventFilterDropdown) eventFilterDropdown.value = 'all';
    if (autocompleteDiv) autocompleteDiv.style.display = 'none';
    
    doorSearchTerm = '';
    buildingFilter = '';
    eventFilter = 'all';
    renderCalendarEvents();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    loadDoors();
    loadSchedules();
    checkHealth();
    loadUserName();
    
    // Close autocomplete when clicking outside
    document.addEventListener('click', function(e) {
        const searchInput = document.getElementById('doorSearch');
        const autocompleteDiv = document.getElementById('doorAutocomplete');
        if (autocompleteDiv && searchInput && !searchInput.contains(e.target) && !autocompleteDiv.contains(e.target)) {
            autocompleteDiv.style.display = 'none';
        }
    });
    
    // Refresh every 30 seconds
    setInterval(() => {
        loadSchedules();
        pollActiveSchedules(); // Check active status
        updateStats();
        checkHealth(); // Update status indicator
    }, 30000);
    
    // Initial active status check
    pollActiveSchedules();
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
        
        // Event content - take control to prevent FullCalendar auto-abbreviations (no "2a", "3a" prefixes!)
        eventContent: function(arg) {
            const props = arg.event.extendedProps;
            const doorCount = props.doorCount || 1;
            const status = props.status || 'Pending';
            const schedules = props.schedules || [];
            
            // Check if any schedule in this event is currently active
            // Only show active for current/past events, not future recurring instances
            const isFutureEvent = arg.event.start > new Date();
            const activeSchedule = !isFutureEvent ? schedules.find(s => activeScheduleIds.has(s.scheduleId)) : null;
            const isActive = !!activeSchedule;
            const minutesRemaining = isActive && activeSchedule ? (activeScheduleData[activeSchedule.scheduleId]?.minutesRemaining || 0) : 0;
            
            // Status indicator dot (colored circle on left)
            const statusColors = {
                'Pending': '#3b82f6',      // Blue
                'Executing': '#f59e0b',    // Orange
                'Executed': '#10b981',     // Green
                'Failed': '#ef4444',       // Red
                'Cancelled': '#6b7280'     // Gray
            };
            
            // Active events get pulsing green dot, otherwise normal status color
            const dotColor = isActive ? '#10b981' : (statusColors[status] || statusColors['Pending']);
            const pulseAnimation = isActive ? 'animation: pulse 2s infinite;' : '';
            
            // Build tooltip
            const startTime = arg.event.start ? new Date(arg.event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
            const endTime = arg.event.end ? new Date(arg.event.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
            const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : '';
            
            const doorNames = props.schedules ? props.schedules.map(s => {
                const door = allDoors.find(d => d.doorId === s.doorId);
                return door ? door.doorName : `Door ${s.doorId}`;
            }).join(', ') : '';
            
            const activeStatus = isActive ? `\n🟢 ACTIVE NOW (${minutesRemaining}m remaining)` : '';
            const tooltip = `${arg.event.title}\nTime: ${timeRange}\nDoors: ${doorCount}\nStatus: ${status}${activeStatus}\n${doorNames}`;

            // Build status badge (dot only, no text - text is in tooltip)
            const statusBadge = ``;
            
            // Build active badge (only show if active)
            const activeBadge = isActive ? `<span class="active-badge" style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 4px; white-space: nowrap;">${minutesRemaining}m left</span>` : '';
            
            return {
                html: `<div class="fc-event-main-frame" title="${tooltip}">
                    <div class="fc-event-title-container">
                        <span class="event-status-dot" style="background-color: ${dotColor}; ${pulseAnimation}"></span>
                        <div class="fc-event-title fc-sticky">${arg.event.title}${statusBadge}${activeBadge}</div>
                    </div>
                </div>`
            };
        },
        
        // Event rendering
        eventDidMount: function(info) {
            // Apply visual hierarchy: recurring vs special events
            const schedules = info.event.extendedProps.schedules || [];
            const isRecurring = schedules.some(s => s.isRecurring === true);
            
            if (isRecurring) {
                info.el.classList.add('event-recurring');
            } else {
                info.el.classList.add('event-special');
            }
        },
        
        // Re-render events when calendar view changes (month/week navigation)
        datesSet: function(dateInfo) {
            // When user navigates to a different month, regenerate recurring instances
            renderCalendarEvents();
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
        
        // Check if user is not authenticated (returns "User")
        if (!data.givenName || data.givenName === 'User') {
            // Redirect to index.html (sign-in page)
            window.location.href = '/index.html';
            return;
        }
        
        if (userNameEl) {
            userNameEl.textContent = data.givenName;
        }
    } catch (error) {
        console.error('Error loading user name:', error);
        // On error, redirect to sign-in
        window.location.href = '/index.html';
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
        allSchedules = schedules.map(schedule => {
            // Keep "Z" suffix - database times ARE actually UTC, FullCalendar will convert to local
            let unlockTime = schedule.startTime || schedule.unlockTime;
            let lockTime = schedule.endTime || schedule.lockTime;
            
            return {
                ...schedule,
                scheduleId: schedule.scheduleID || schedule.scheduleId,
                doorId: schedule.doorID || schedule.doorId,
                unlockTime: unlockTime,
                lockTime: lockTime,
                eventName: schedule.ScheduleName || schedule.scheduleName || schedule.eventName,
                status: schedule.status || schedule.Status || 'Pending',
                notes: schedule.notes || schedule.Notes || '',
                isRecurring: schedule.isRecurring || schedule.IsRecurring || false,  // Track if auto-generated from pattern
                eventType: schedule.eventType || schedule.EventType || 'Special',  // Weekly or Special
                createdAt: schedule.createdAt,
                lastModified: schedule.lastModified || schedule.updatedAt
            };
        });
        
        renderCalendarEvents();
        updateStats();
        
    } catch (error) {
        console.error('Error loading schedules:', error);
        showError('Failed to load schedules: ' + error.message);
    }
}

// Poll active schedules (currently unlocking doors)
async function pollActiveSchedules() {
    try {
        const response = await fetch(`${API_BASE}/schedules/active`);
        if (!response.ok) {
            console.warn('Failed to fetch active schedules');
            return;
        }
        
        const data = await response.json();
        const schedules = data.schedules || [];
        
        // Update active schedule tracking
        activeScheduleIds = new Set(schedules.map(s => s.scheduleID));
        activeScheduleData = {};
        
        schedules.forEach(s => {
            activeScheduleData[s.scheduleID] = {
                minutesRemaining: s.minutesRemaining || 0,
                endTime: s.endTime
            };
        });
        
        // Re-render calendar events to show active status
        renderCalendarEvents();
        
    } catch (error) {
        console.error('Error polling active schedules:', error);
    }
}

// Generate recurring event instances for calendar display
function expandRecurringEvents(group, startWindow, endWindow) {
    const instances = [];
    const isRecurring = group.schedules.some(s => s.isRecurring === true);
    
    if (!isRecurring) {
        // Non-recurring event - return as-is
        return [group];
    }
    
    // For weekly recurring events, generate instances for the visible calendar range
    const firstEventDate = new Date(group.unlockTime);
    const windowStart = new Date(startWindow);
    const windowEnd = new Date(endWindow);
    
    // Calculate day of week for the event
    const dayOfWeek = firstEventDate.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Find first occurrence in or after the window
    let currentDate = new Date(firstEventDate);
    
    // If first event is before window, advance to first Sunday in window
    if (currentDate < windowStart) {
        currentDate = new Date(windowStart);
        // Advance to correct day of week
        const daysToAdd = (dayOfWeek - currentDate.getDay() + 7) % 7;
        currentDate.setDate(currentDate.getDate() + daysToAdd);
    }
    
    // Generate instances up to 6 months ahead or window end (whichever is sooner)
    const maxDate = new Date(Math.min(
        windowEnd.getTime(),
        Date.now() + (180 * 24 * 60 * 60 * 1000) // 6 months
    ));
    
    while (currentDate <= maxDate) {
        // Create instance with same time as original but on this date
        const instanceStart = new Date(currentDate);
        instanceStart.setHours(firstEventDate.getHours(), firstEventDate.getMinutes(), 0, 0);
        
        const instanceEnd = new Date(instanceStart);
        const duration = new Date(group.lockTime) - new Date(group.unlockTime);
        instanceEnd.setTime(instanceStart.getTime() + duration);
        
        instances.push({
            eventName: group.eventName,
            unlockTime: instanceStart.toISOString(),
            lockTime: instanceEnd.toISOString(),
            schedules: group.schedules,
            status: 'Pending', // Future instances are always pending
            notes: group.notes,
            createdAt: group.createdAt,
            isRecurringInstance: true
        });
        
        // Move to next week
        currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return instances.length > 0 ? instances : [group];
}

// Render schedules as calendar events (event-centered, not door-centered)
function renderCalendarEvents() {
    if (!calendar) return;
    
    // Clear existing events
    calendar.removeAllEvents();
    
    // Get current calendar view range (expand recurring events for visible range only)
    const view = calendar.view;
    const windowStart = view.currentStart;
    const windowEnd = view.currentEnd;
    
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
    
    // Expand recurring events into multiple instances
    const expandedGroups = [];
    Object.values(eventGroups).forEach(group => {
        const instances = expandRecurringEvents(group, windowStart, windowEnd);
        expandedGroups.push(...instances);
    });
    
    // Convert event groups (including recurring instances) to FullCalendar events
    const events = expandedGroups
        .filter(group => {
            // Apply three-way filter based on EventType field
            const eventType = group.schedules[0]?.eventType || 'Special';
            
            if (eventFilter === 'special') {
                if (eventType !== 'Special') return false;
            } else if (eventFilter === 'weekly') {
                if (eventType !== 'Weekly') return false;
            }
            
            // Apply door search filter
            if (doorSearchTerm) {
                const doorNames = group.schedules.map(s => {
                    const door = allDoors.find(d => d.doorId === s.doorId);
                    return door ? door.doorName.toLowerCase() : '';
                });
                if (!doorNames.some(name => name.includes(doorSearchTerm))) {
                    return false;
                }
            }
            
            // Apply building filter
            if (buildingFilter) {
                const buildings = group.schedules.map(s => {
                    const door = allDoors.find(d => d.doorId === s.doorId);
                    if (!door) return '';
                    return extractBuilding(door.controllerName, door.doorName);
                });
                if (!buildings.includes(buildingFilter)) {
                    return false;
                }
            }
            
            return true;
        })
        .map(group => {
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
        
        // Database times are UTC - keep "Z" so FullCalendar converts to local
        let startTime = group.unlockTime;
        let endTime = group.lockTime;
        
        // Determine event color based on status
        // For recurring instances in the future, always show as Pending (blue)
        const isFutureInstance = group.isRecurringInstance && new Date(startTime) > new Date();
        let color = '#0d6efd'; // pending = blue (default)
        
        if (!isFutureInstance) {
            // Only apply actual status colors for past/current events
            if (group.status === 'Executed') color = '#198754'; // green
            if (group.status === 'Failed') color = '#dc3545'; // red
            if (group.status === 'Cancelled') color = '#6c757d'; // gray
        }
        
        return {
            id: `event_${group.eventName}_${group.unlockTime}`,
            title: cleanedEventName, // NO DOOR COUNT - removed (X doors) suffix
            start: startTime,
            end: endTime,
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

// Populate door dropdowns with building grouping (sidebar removed, only build doorsByBuilding)
function populateDoorDropdowns() {
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
    
    // Sidebar filter dropdowns removed - doorsByBuilding is still used by create modals
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
    
    // For recurring events, we need to check if this day matches their day-of-week
    const targetDayOfWeek = dayStart.getDay(); // 0 = Sunday, 6 = Saturday
    
    const daySchedules = [];
    allSchedules.forEach(schedule => {
        const unlockTime = new Date(schedule.unlockTime);
        const isRecurring = schedule.isRecurring === true;
        
        if (isRecurring) {
            // Check if the recurring event happens on this day of the week
            const scheduleDayOfWeek = unlockTime.getDay();
            if (scheduleDayOfWeek === targetDayOfWeek && dayStart >= new Date(unlockTime.toDateString())) {
                // Clone the schedule but with the target date
                const instanceSchedule = { ...schedule };
                const instanceStart = new Date(dayStart);
                instanceStart.setHours(unlockTime.getHours(), unlockTime.getMinutes(), 0, 0);
                const lockTime = new Date(schedule.lockTime);
                const instanceEnd = new Date(instanceStart);
                const duration = lockTime - unlockTime;
                instanceEnd.setTime(instanceStart.getTime() + duration);
                
                instanceSchedule.unlockTime = instanceStart.toISOString();
                instanceSchedule.lockTime = instanceEnd.toISOString();
                daySchedules.push(instanceSchedule);
            }
        } else {
            // Non-recurring: check exact date match
            if (unlockTime >= dayStart && unlockTime <= dayEnd) {
                daySchedules.push(schedule);
            }
        }
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
            
            // Clean event name if recurring
            const displayName = cleanEventName(schedule.eventName || 'Unnamed Event', schedule.isRecurring);
            
            scheduleListHTML += `
                <div class="day-schedule-item">
                    <div class="day-schedule-door">${doorName}</div>
                    <div class="day-schedule-event">${displayName}</div>
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
    const eventType = document.getElementById('createEventType').value;
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
        eventType: eventType === 'weekly' ? 'Weekly' : 'Special', // Set event type for filtering
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
    
    // Check if any schedule in this event is currently active
    // Only show active for current/past events, not future recurring instances
    const schedules = props.schedules || [];
    const isFutureEvent = event.start > new Date();
    const activeSchedule = !isFutureEvent ? schedules.find(s => activeScheduleIds.has(s.scheduleId)) : null;
    const isActive = !!activeSchedule;
    const minutesRemaining = isActive && activeSchedule ? (activeScheduleData[activeSchedule.scheduleId]?.minutesRemaining || 0) : 0;
    
    // Build door list HTML
    let doorListHTML = '';
    if (props.schedules && props.schedules.length > 0) {
        doorListHTML = '<div class="event-door-list">';
        props.schedules.forEach(schedule => {
            const door = allDoors.find(d => d.doorId === schedule.doorId);
            const doorName = door ? door.doorName : `Door ${schedule.doorId}`;
            // For future events, always show Pending; for past events show actual status
            // Check if THIS SPECIFIC SCHEDULE has ended (not just event start time)
            const scheduleEndTime = schedule.lockTime ? new Date(schedule.lockTime) : (event.end ? new Date(event.end) : new Date());
            const scheduleHasEnded = scheduleEndTime < new Date();
            const scheduleStatus = scheduleHasEnded ? (schedule.status || 'Pending') : 'Pending';
            // Only show ACTIVE badge for current/past events, not future instances
            const scheduleIsActive = !isFutureEvent && activeScheduleIds.has(schedule.scheduleId);
            const activeBadge = scheduleIsActive ? `<span class="badge" style="background: #10b981; color: white; margin-left: 8px;">ACTIVE (${activeScheduleData[schedule.scheduleId]?.minutesRemaining || 0}m left)</span>` : '';
            doorListHTML += `
                <div class="event-door-item">
                    <span class="event-door-name">${doorName}</span>
                    <span class="badge status-badge-${scheduleStatus.toLowerCase()}">${scheduleStatus}</span>
                    ${activeBadge}
                </div>
            `;
        });
        doorListHTML += '</div>';
    }
    
    // Check if event is recurring and clean name
    const isRecurring = props.schedules && props.schedules.some(s => s.isRecurring === true);
    const displayEventName = cleanEventName(props.eventName, isRecurring);
    
    const content = `
        ${isActive ? `
        <div class="alert" style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">🟢</span>
            <div>
                <div style="font-weight: 600; color: #10b981;">CURRENTLY ACTIVE</div>
                <div style="font-size: 0.9rem; color: rgba(255,255,255,0.7);">Doors are unlocked — ${minutesRemaining} minutes remaining</div>
            </div>
        </div>
        ` : ''}
        <div class="event-detail-row">
            <span class="event-detail-label">Event Name:</span>
            <span class="event-detail-value">${displayEventName}</span>
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
            <span class="badge status-badge-${(event.start > new Date() ? 'pending' : (props.status || 'pending').toLowerCase())}">${event.start > new Date() ? 'Pending' : (props.status || 'Pending')}</span>
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
    
    // Show/hide "Skip This Day" button based on whether event is recurring
    const skipBtn = document.getElementById('skipThisDayBtn');
    if (skipBtn) {
        skipBtn.style.display = isRecurring ? 'inline-flex' : 'none';
    }
    
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
            // Get error details from failed responses
            const errorDetails = await Promise.all(
                failed.map(async r => {
                    try {
                        const text = await r.text();
                        return `${r.status}: ${text}`;
                    } catch {
                        return `${r.status}: ${r.statusText}`;
                    }
                })
            );
            console.error('Delete failures:', errorDetails);
            throw new Error(`Failed to delete ${failed.length} schedule(s): ${errorDetails.join(', ')}`);
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

// Skip this day for recurring event (deactivate schedules for this specific date only)
async function skipThisDay() {
    if (!currentSelectedEvent) return;
    
    const props = currentSelectedEvent.extendedProps;
    const eventDate = currentSelectedEvent.start;
    const formattedDate = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    const doorCount = props.schedules ? props.schedules.length : 0;
    const confirmMsg = `Skip "${props.eventName}" on ${formattedDate}?\n\nThis will deactivate ${doorCount} door schedule(s) for this date only.\nFuture occurrences will continue as normal.`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    try {
        // Deactivate all schedules for this specific date
        const schedules = props.schedules || [];
        const updatePromises = schedules.map(schedule =>
            fetch(`${API_BASE}/schedules/${schedule.scheduleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...schedule,
                    isActive: false
                })
            })
        );
        
        const responses = await Promise.all(updatePromises);
        
        // Check if any failed
        const failed = responses.filter(r => !r.ok);
        if (failed.length > 0) {
            throw new Error(`Failed to skip ${failed.length} schedule(s)`);
        }
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal')).hide();
        
        // Reload schedules
        await loadSchedules();
        
        showSuccess(`Skipped "${props.eventName}" on ${formattedDate}. Future occurrences are still active.`);
        
    } catch (error) {
        console.error('Error skipping day:', error);
        showError('Failed to skip this day: ' + error.message);
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
            
            // Check if recurring and clean event name
            const isRecurring = group.schedules.some(s => s.isRecurring === true);
            const cleanedEventName = cleanEventName(group.eventName, isRecurring);
            
            // FIX TIMEZONE: Strip Z for recurring events, keep Z for regular events
            let startTime = group.unlockTime;
            let endTime = group.lockTime;
            
            if (isRecurring) {
                startTime = startTime.replace(/Z$/, '');
                endTime = endTime.replace(/Z$/, '');
            }
            
            let color = '#0d6efd';
            if (group.status === 'Executed') color = '#198754';
            if (group.status === 'Failed') color = '#dc3545';
            if (group.status === 'Cancelled') color = '#6c757d';
            
            return {
                id: `event_${group.eventName}_${group.unlockTime}`,
                title: cleanedEventName, // NO DOOR COUNT
                start: startTime,
                end: endTime,
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

// Check system health and update status indicator
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        
        if (!response.ok) {
            console.error('Health check failed:', response.status, response.statusText);
            throw new Error(`HTTP ${response.status}`);
        }
        
        const health = await response.json();
        console.log('Health check result:', health);
        
        const indicator = document.getElementById('statusIndicator');
        if (!indicator) {
            console.warn('Status indicator element not found');
            return;
        }
        
        if (health.status === 'Healthy') {
            // Green - All systems operational
            indicator.style.background = '#28a745';
            indicator.style.boxShadow = '0 0 8px #28a745';
            indicator.title = 'System Healthy';
        } else if (health.status === 'Degraded') {
            // Yellow - Partial issues
            indicator.style.background = '#ffc107';
            indicator.style.boxShadow = '0 0 8px #ffc107';
            indicator.title = 'System Degraded';
        } else {
            // Red - System issues
            indicator.style.background = '#dc3545';
            indicator.style.boxShadow = '0 0 8px #dc3545';
            indicator.title = 'System Unhealthy';
        }
    } catch (error) {
        console.error('Health check error:', error);
        // Gray - Cannot reach health endpoint
        const indicator = document.getElementById('statusIndicator');
        if (indicator) {
            indicator.style.background = '#6c757d';
            indicator.style.boxShadow = '0 0 8px #6c757d';
            indicator.title = 'Status Unknown: ' + error.message;
        }
    }
}

// Update statistics (sidebar removed, keeping function for compatibility)
function updateStats() {
    // Sidebar elements removed - no-op function
    return;
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
        const eventType = document.getElementById('multiEventType').value;
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
            eventType: eventType === 'weekly' ? 'Weekly' : 'Special', // Set event type for filtering
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

// Edit schedule - opens appropriate modal based on event type
function editSchedule() {
    if (!currentSelectedEvent) return;
    
    const props = currentSelectedEvent.extendedProps;
    const schedules = props.schedules || [];
    const isRecurring = schedules.some(s => s.isRecurring === true);
    const isMultiDoor = schedules.length > 1;
    
    // Close the details modal
    bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal')).hide();
    
    // Pre-fill the appropriate modal with current data
    if (isRecurring) {
        // Recurring schedule - open recurring modal with prefill
        showRecurringModal(currentSelectedEvent);
    } else if (isMultiDoor) {
        // Multi-door event - open multi-door modal with prefill
        showMultiDoorModal(currentSelectedEvent);
    } else {
        // Single door schedule - open create modal with prefill
        showCreateModal(null, currentSelectedEvent);
    }
}
