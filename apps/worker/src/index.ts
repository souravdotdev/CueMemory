// No queues configured — the items/collections/reminders processing
// pipeline was torn down pending a schema redesign (see packages/items).
// This entry point comes back once a replacement queue/handler exists.
console.log("[worker] nothing to consume yet");
