// Recurring Schedule Functions

function showRecurringModal() {
    const modal = new bootstrap.Modal(document.getElementById('recurringModal'));
    
    // Set default start date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('recurringStartDate').value = today;
    
    // Load doors into the container
    const container = document.getElementById('recurringDoorsContainer');
    container.innerHTML = renderBuildingsForRecurring();
    
    modal.show();
}

function updateRecurrenceOptions() {
    const type = document.getElementById('recurringType').value;
    
    // Show/hide options based on type
    document.getElementById('weeklyOptions').classList.toggle('d-none', type !== 'WEEKLY' && type !== 'BIWEEKLY');
    document.getElementById('monthlyOptions').classList.toggle('d-none', type !== 'MONTHLY');
}

function renderBuildingsForRecurring() {
    const buildings = {
        'wade': { name: 'Wade Building', emoji: '🏢', buildingKey: 'Wade' },
        'mainChurch': { name: 'Main Church', emoji: '⛪', buildingKey: 'Main Church' },
        'studentCenter': { name: 'Student Center', emoji: '🎓', buildingKey: 'Student Center' },
        'pcb': { name: 'PCB', emoji: '👶', buildingKey: 'PCB' }
    };

    let html = '';
    for (const [key, building] of Object.entries(buildings)) {
        // Use the same doorsByBuilding object that the Multi-Door Event modal uses
        const doorsInBuilding = (doorsByBuilding[building.buildingKey] || [])
            .filter(door => {
                // Exclude card readers and emergency exits (same filtering as loadDoors)
                const name = door.doorName.toLowerCase();
                return !name.includes('reader') && !name.includes('emergency');
            });

        if (doorsInBuilding.length === 0) continue;
        
        html += `
            <div class="building-section-modern" id="recurring_${key}">
                <div class="building-header">
                    <div class="building-title">
                        <span class="building-emoji">${building.emoji}</span>
                        <span>${building.name}</span>
                    </div>
                    <div class="building-actions">
                        <button type="button" class="btn btn-sm btn-select-all" onclick="selectAllRecurringBuilding('${key}')">
                            Select All
                        </button>
                    </div>
                </div>
                <div class="doors-grid">
                    ${doorsInBuilding.map(door => `
                        <label class="door-checkbox-modern">
                            <input type="checkbox" name="recurringDoor" value="${door.doorId}" data-building="${key}">
                            <span class="door-checkbox-label">${door.doorName}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function selectAllRecurringBuilding(building) {
    const checkboxes = document.querySelectorAll(`#recurring_${building} input[name="recurringDoor"]`);
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
}

async function createRecurringPattern() {
    // Gather form data
    const patternName = document.getElementById('recurringPatternName').value.trim();
    const recurrenceType = document.getElementById('recurringType').value;
    const eventType = document.getElementById('recurringEventType').value;
    const unlockTime = document.getElementById('recurringUnlockTime').value;
    const lockTime = document.getElementById('recurringLockTime').value;
    const startDate = document.getElementById('recurringStartDate').value;
    const endDate = document.getElementById('recurringEndDate').value;
    
    // Validation
    if (!patternName) {
        showError('Please enter a pattern name');
        return;
    }
    if (!eventType) {
        showError('Please select an event type (Regular or Special)');
        return;
    }
    if (!recurrenceType) {
        showError('Please select a recurrence pattern');
        return;
    }
    if (!unlockTime || !lockTime) {
        showError('Please specify both unlock and lock times');
        return;
    }
    if (!startDate) {
        showError('Please specify a start date');
        return;
    }
    
    // Get selected doors
    const selectedDoors = Array.from(document.querySelectorAll('input[name="recurringDoor"]:checked'))
        .map(cb => parseInt(cb.value));
    
    if (selectedDoors.length === 0) {
        showError('Please select at least one door');
        return;
    }
    
    // Convert times to full datetime (using start date as base)
    const startDateTime = new Date(`${startDate}T${unlockTime}`);
    const endDateTime = new Date(`${startDate}T${lockTime}`);
    
    if (endDateTime <= startDateTime) {
        // Lock time is next day
        endDateTime.setDate(endDateTime.getDate() + 1);
    }
    
    // Build payload
    let payload = {
        eventName: patternName,
        recurrenceType: recurrenceType,
        isSpecialEvent: eventType === 'special',
        unlockTime: startDateTime.toISOString(),
        lockTime: endDateTime.toISOString(),
        startDate: startDate,
        endDate: endDate || null,
        doorIds: selectedDoors,
        isActive: true
    };
    
    // Add recurrence-specific fields
    if (recurrenceType === 'WEEKLY' || recurrenceType === 'BIWEEKLY') {
        const selectedDays = Array.from(document.querySelectorAll('input[name="recurringDays"]:checked'))
            .map(cb => parseInt(cb.value));
        
        if (selectedDays.length === 0) {
            showError('Please select at least one day of the week');
            return;
        }
        
        payload.daysOfWeek = selectedDays;
        if (recurrenceType === 'BIWEEKLY') {
            payload.weekInterval = 2;
        }
    } else if (recurrenceType === 'MONTHLY') {
        const dayOfMonth = document.getElementById('recurringDayOfMonth').value;
        if (!dayOfMonth) {
            showError('Please enter a day of the month');
            return;
        }
        payload.dayOfMonth = parseInt(dayOfMonth);
    }
    
    // Send to API
    try {
        const response = await fetch(`${API_BASE}/recurring-patterns`, {
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
        bootstrap.Modal.getInstance(document.getElementById('recurringModal')).hide();
        
        // Reset form
        document.getElementById('recurringForm').reset();
        
        // Show success
        showSuccess(`Recurring schedule "${patternName}" created successfully!`);
        
        // Reload calendar
        await loadSchedules();
        
    } catch (error) {
        console.error('Error creating recurring pattern:', error);
        showError(`Failed to create recurring schedule: ${error.message}`);
    }
}