// No queues configured — the items/collections/reminders processing
// pipeline was torn down pending a schema redesign (the Items domain now lives in apps/api).
// This entry point comes back once a replacement queue/handler exists.
console.log("[worker] nothing to consume yet");
