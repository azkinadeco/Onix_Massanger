/// <reference path="../pb_data/types.d.ts" />
// Tahap 2: reaksi/edit/tarik pesan, presence, read receipt + typing (chat_state)
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new NumberField({ name: "lastActive" }));
  users.fields.add(new BoolField({ name: "online" }));
  app.save(users);

  const messages = app.findCollectionByNameOrId("messages");
  messages.fields.add(new JSONField({ name: "reactions", maxSize: 65536 }));
  messages.fields.add(new BoolField({ name: "unsent" }));
  messages.fields.add(new BoolField({ name: "edited" }));
  // pengirim boleh ubah apa saja; anggota lain cuma boleh ubah reaksi
  messages.updateRule = "chat.members.id ?= @request.auth.id && (sender = @request.auth.id || (" +
    ["text", "data", "type", "sender", "chat", "cid", "unsent", "edited", "file"].map(f => `@request.body.${f}:isset = false`).join(" && ") +
    "))";
  app.save(messages);

  const chats = app.findCollectionByNameOrId("chats");
  const state = new Collection({
    type: "base",
    name: "chat_state",
    listRule: "chat.members.id ?= @request.auth.id",
    viewRule: "chat.members.id ?= @request.auth.id",
    createRule: "user = @request.auth.id && chat.members.id ?= @request.auth.id",
    updateRule: "user = @request.auth.id && @request.body.user:isset = false && @request.body.chat:isset = false",
    deleteRule: null,
    fields: [
      { name: "chat", type: "relation", required: true, collectionId: chats.id, maxSelect: 1, cascadeDelete: true },
      { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "readAt", type: "number" },
      { name: "typingAt", type: "number" },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_chat_state_cu ON chat_state (chat, user)"],
  });
  app.save(state);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("chat_state")); } catch (_) {}
});
