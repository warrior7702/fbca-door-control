SELECT TOP 10
    ActionID,
    ScheduleID,
    VIADeviceID,
    ActionType,
    ExecutedAt,
    Success,
    VIAResponseCode,
    VIAResponseBody
FROM ScheduleActionLogs
WHERE ScheduleID = 7
ORDER BY ExecutedAt DESC;
