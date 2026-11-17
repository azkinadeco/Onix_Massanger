/// <reference path="../pb_data/types.d.ts" />
// Tahap 4: sinyal panggilan WebRTC (offer/answer/ice/end/reject/busy)
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const chats = app.findCollectionByNameOrId("chats");
  const c = new Collection({
    type: "base",
    name: "call_signals",
    listRule: "sender = @request.auth.id || target = @request.auth.id",
    viewRule: "sender = @request.auth.id || target = @request.auth.id",
    createRule: "sender = @request.auth.id && target != @request.auth.id && chat.members.id ?= @request.auth.id",
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "chat", type: "relation", required: true, collectionId: chats.id, maxSelect: 1, cascadeDelete: true },
      { name: "sender", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "target", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "call", type: "text", required: true, max: 40 },
      { name: "kind", type: "text", required: true, max: 12 },
      { name: "data", type: "json", maxSize: 65536 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE INDEX idx_call_signals_target ON call_signals (target, created)"],
  });
  app.save(c);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("call_signals")); } catch (_) {}
});
