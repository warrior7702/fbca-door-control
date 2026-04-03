# FBCA Door Control → PCO Door Mapping
## For B.O.B. — Phase 2 Integration Planning

**Date:** March 3, 2026  
**Source:** FBCA Door Control System (API: 100.123.239.124:5002)  
**Total Active Doors:** 41

---

## Building Overview

| Building | Controller | Door Count | Primary Use |
|----------|------------|------------|-------------|
| **Wade Building** | 2, 3, 4 | 3 | Offices, Business, Lobby |
| **Main Church (FBC)** | 5, 6, 8, 9, 12, 13, 14, 15 | 14 | Worship, Offices, Classrooms |
| **Student Center (SC)** | 7 | 4 | Youth, Student activities |
| **PCB (Preschool/Children)** | 10, 11 | 18 | Children's ministry, Preschool |
| **Flex Space (FLX)** | 5, 6, 13, 14 | 4 | Multi-purpose rooms |

---

## Door Mapping by Building

### Wade Building

| Door ID | System Name | Location | PCO Resource Name | Typical Events |
|---------|-------------|----------|-------------------|----------------|
| 1 | WADE-EXT-N | North Entry | Wade North Entrance | Staff meetings, Business hours |
| 6 | WADE-F3-BUS | 3rd Floor Business | Wade Business Office | Business meetings, Admin |
| 11 | WADE-F5-LOB | 5th Floor Lobby | Wade Lobby | General access, Meetings |

### Main Church Building (FBC)

| Door ID | System Name | Location | PCO Resource Name | Typical Events |
|---------|-------------|----------|-------------------|----------------|
| 41 | A | 1st Floor Maint | Main BLD - Office A | Maintenance, Staff only |
| 71 | FBC-EXT-FH | Family Hall | Main - Family Hall Ext | Youth events, Family activities |
| 55 | FBC-EXT-South | South Exterior | Main - South Entrance | Sunday services, General |
| 70 | FBC-EXT-South Hall | South Hall | Main - South Hall | Services, Events |
| 54 | FBC-F1-South Hall | 1st Floor S Hall | Main - South Hall Int | Services, Ministry |
| 40 | Playground Gate | Playground | Main - Playground | Children's events, Recreation |
| 87 | FBC-EXT-Center Street | Center St | Main - Center Street | Public entrance, Services |
| 86 | FBC-EXT-Parlor | Parlor | Main - Parlor | Meetings, Small groups |
| 241 | FBC-EXT-Courtyard Gate | Courtyard | Main - Courtyard | Outdoor events, Weddings |
| 240 | FBC-EXT-East Hall | East Hall | Main - East Hall | Services, Fellowship |
| 281 | FBC-EXT-Chapel | Chapel | Main - Chapel | Worship, Prayer, Ceremonies |
| 280 | FBC-F1-Hamill South | Hamill Hall S | Main - Hamill Hall | Large events, Conferences |

### Student Center

| Door ID | System Name | Location | PCO Resource Name | Typical Events |
|---------|-------------|----------|-------------------|----------------|
| 27 | SC-EXT-E | East Entrance | Student Center East | Youth group, Student events |
| 26 | SC-EXT-N | North Entrance | Student Center North | Wednesday nights, Activities |
| 225 | SC-EXT-S | South Entrance | Student Center South | Weekend events, Games |
| 224 | SC-EXT-W | West Entrance | Student Center West | Youth worship, Band practice |

### Flex Space (FLX)

| Door ID | System Name | Location | PCO Resource Name | Typical Events |
|---------|-------------|----------|-------------------|----------------|
| 16 | FLX-F2-South | 2nd Floor S | Flex Space 2F South | Classes, Small groups |
| 21 | FLX-F3-North | 3rd Floor N | Flex Space 3F North | Meetings, Training |
| 254 | FLX-F2-North | 2nd Floor N | Flex Space 2F North | Workshops, Events |
| 259 | FLX-F3-South | 3rd Floor S | Flex Space 3F South | Seminars, Classes |

### Preschool & Children's Building (PCB)

| Door ID | System Name | Location | PCO Resource Name | Typical Events |
|---------|-------------|----------|-------------------|----------------|
| 114 | 1st Floor Stair A Reader R1 | Stair A | PCB - 1F Stair A North | Children's check-in |
| 115 | 1st Floor Stair A Reader R2 | Stair A | PCB - 1F Stair A South | Sunday School, Pickup |
| 130 | 1st Floor Stair B Reader R1 | Stair B | PCB - 1F Stair B North | Nursery, Toddlers |
| 131 | 1st Floor Stair B Reader R2 | Stair B | PCB - 1F Stair B South | Preschool access |
| 146 | 2nd Floor Stair A Reader R1 | 2F Stair A | PCB - 2F Stair A North | Elementary classes |
| 147 | 2nd Floor Stair A Reader R2 | 2F Stair A | PCB - 2F Stair A South | Children's church |
| 100 | PCB-F2-6HALL | 2F Hall 6 | PCB - 2F Hallway 6 | Classrooms, Events |
| 101 | PCB-F2-DBL | 2F Double | PCB - 2F Double Doors | Large group, Worship |
| 208 | 2nd Floor Stair B Reader R1 | 2F Stair B | PCB - 2F Stair B North | Grade school |
| 209 | 2nd Floor Stair B Reader R2 | 2F Stair B | PCB - 2F Stair B South | Activities |
| 193 | PCB-EXT-COURT | Courtyard | PCB - Courtyard | Outdoor play, Events |
| 192 | PCB-EXT-MAIN | Main Entrance | PCB - Main Entrance | Sunday mornings, Check-in |
| 176 | PCB-Ext-N | North Exit | PCB - North Exit | Emergency, Dismissal |
| 163 | PCB-EXT-W Stairwell | West Stair | PCB - West Stairwell | Emergency exits |
| 177 | PCB-F1-Lobby Door | Lobby | PCB - Lobby | Main entry, Security |
| 264 | PCB-F1-South Emergency Exit | South Emergency | PCB - South Emergency | Emergency only |
| 162 | Reader R1 | PCB Reader 1 | PCB - Reader Station 1 | Check-in/out |
| 265 | Reader R2 | PCB Reader 2 | PCB - Reader Station 2 | Check-in/out |

---

## PCO Integration Notes for B.O.B.

### API Endpoints

**Get all doors:**
```
GET http://100.123.239.124:5002/api/doors
```

**Create schedule (for PCO events):**
```
POST http://100.123.239.124:5002/api/schedules
Content-Type: application/json

{
  "doorId": 192,           // PCB-EXT-MAIN for Sunday morning
  "startTime": "2026-03-09T08:00:00Z",
  "endTime": "2026-03-09T12:30:00Z",
  "scheduleName": "Sunday Service - Main Entrance",
  "source": "PCO"          // Marks as PCO-generated
}
```

### Key Doors for PCO Events

| Event Type | Primary Doors | Secondary Doors |
|------------|---------------|-----------------|
| **Sunday Worship** | 192 (PCB Main), 86 (Parlor), 55 (South) | 27, 26 (Student Center) |
| **Youth Group** | 27, 26, 225, 224 (Student Center) | — |
| **Children's Church** | 192, 177 (PCB), 114, 115 (Check-in) | 193 (Courtyard) |
| **Staff Meeting** | 1 (Wade N), 6 (Wade F3) | 41 (Office A) |
| **Wedding** | 281 (Chapel), 241 (Courtyard) | 87 (Center St) |
| **Conference** | 280 (Hamill), 259, 254 (Flex) | Various |

### Door Groups for Batch Operations

```json
{
  "sundayWorship": [55, 70, 86, 87, 192, 177],
  "studentCenter": [27, 26, 225, 224],
  "childrensBuilding": [192, 177, 114, 115, 193],
  "allExterior": [1, 55, 70, 86, 87, 27, 26, 225, 224, 192, 176, 241, 240, 281]
}
```

---

## Auth Status

**Current:** API is open on local network (no token required for service-to-service)
**Azure AD:** Required for browser UI login only
**For PCO Integration:** Open API access from internal network

---

## Next Steps

1. **B.O.B.:** Use door IDs above when creating PCO → Door Control integration
2. **Mapping:** PCO resource names should match "PCO Resource Name" column
3. **Testing:** Start with door 192 (PCB-EXT-MAIN) for Sunday morning events
4. **Batch:** Use `/api/schedules/batch` for multi-door events

---

**Questions?** Cornerstone has the full door list and can help map PCO events to specific doors.

**Document created by:** Cornerstone (FBCA AI Operations Manager)  
**For:** B.O.B. (Infrastructure Agent)  
**Date:** March 3, 2026
