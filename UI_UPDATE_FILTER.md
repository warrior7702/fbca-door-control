# Quick UI Update: FBCA Colors + Filter Button

## Changes Made

### 1. Updated Color Variables (CSS)
```css
:root {
    /* FBCA Official Colors */
    --fbca-light-blue: #75D3F2;     /* Accent, highlights */
    --fbca-medium-blue: #004da8;    /* Primary brand */
    --fbca-dark-blue: #1B365F;      /* Headers, emphasis */
    --fbca-light-gray: #DDE5FD;     /* Backgrounds */
    --fbca-gray: #BBBDC7;           /* Borders, recurring schedules */
    
    /* Event vs Recurring Colors */
    --event-color: #004da8;          /* Special events - stand out */
    --recurring-color: #BBBDC7;      /* Daily schedules - fade back */
}
```

### 2. Background Gradient
```css
body {
    background: linear-gradient(135deg, #ffffff 0%, #1B365F 100%);
}
```

### 3. Event Styling
```css
/* Special Events - BOLD */
.fc-event.event-special {
    background: linear-gradient(135deg, #004da8, #1B365F) !important;
    opacity: 1 !important;
    font-weight: 700 !important;
    box-shadow: 0 4px 12px rgba(0, 77, 168, 0.4);
}

/* Recurring Schedules - FADED */
.fc-event.event-recurring {
    background: #BBBDC7 !important;
    opacity: 0.5 !important;
    font-weight: 400 !important;
}

.fc-event.event-recurring:hover {
    opacity: 0.8 !important;
}

/* When recurring schedules are hidden */
.fc-event.event-recurring.hidden-recurring {
    display: none !important;
}
```

### 4. Filter Toggle Button (JavaScript)
```javascript
// Add to calendar.js initialization
let showRecurring = true;

function toggleRecurringSchedules() {
    showRecurring = !showRecurring;
    const recurringEvents = document.querySelectorAll('.fc-event.event-recurring');
    recurringEvents.forEach(event => {
        if (showRecurring) {
            event.classList.remove('hidden-recurring');
        } else {
            event.classList.add('hidden-recurring');
        }
    });
    
    // Update button text
    const btn = document.getElementById('toggleRecurringBtn');
    btn.innerHTML = showRecurring ? 
        '👁️ Hide Daily Schedules' : 
        '👁️ Show Daily Schedules';
}
```

### 5. Button HTML (Add to navbar)
```html
<button id="toggleRecurringBtn" 
        class="modern-btn btn-glass" 
        onclick="toggleRecurringSchedules()">
    👁️ Hide Daily Schedules
</button>
```

---

## Implementation (5 minutes)

Copy these 3 updated files to server:
1. `wwwroot/css/calendar.css` → Update colors
2. `wwwroot/js/calendar.js` → Add filter function  
3. `wwwroot/calendar.html` → Add button

Files ready in OneDrive!
