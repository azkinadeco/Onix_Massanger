/// <reference path="../pb_data/types.d.ts" />
// Tahap 3: aksi interaktif per orang per pesan (vote polling, RSVP event, bayar, pilihan suit)
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const chats = app.findCollectionByNameOrId("chats");
  const messages = app.findCollectionByNameOrId("messages");
  const c = new Collection({
    type: "base",
    name: "msg_actions",
    listRule: "chat.members.id ?= @request.auth.id",
    viewRule: "chat.members.id ?= @request.auth.id",
    createRule: "user = @request.auth.id && chat.members.id ?= @request.auth.id && msg.chat = chat",
    updateRule: "user = @request.auth.id && @request.body.user:isset = false && @request.body.chat:isset = false && @request.body.msg:isset = false && @request.body.kind:isset = false",
    deleteRule: null,
    fields: [
      { name: "msg", type: "relation", required: true, collectionId: messages.id, maxSelect: 1, cascadeDelete: true },
      { name: "chat", type: "relation", required: true, collectionId: chats.id, maxSelect: 1, cascadeDelete: true },
      { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "kind", type: "text", required: true, max: 20 },
      { name: "value", type: "json", maxSize: 4096 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_msg_actions_muk ON msg_actions (msg, user, kind)"],
  });
  app.save(c);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("msg_actions")); } catch (_) {}
});
