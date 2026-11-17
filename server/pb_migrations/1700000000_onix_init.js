/// <reference path="../pb_data/types.d.ts" />
// Skema awal Onix: users (+handle), chats, messages
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new TextField({ name: "handle", required: true, min: 3, max: 20, pattern: "^[a-z0-9._]+$" }));
  users.fields.add(new NumberField({ name: "hue" }));
  users.fields.add(new TextField({ name: "status", max: 80 }));
  users.indexes.push("CREATE UNIQUE INDEX idx_users_handle ON users (handle)");
  users.passwordAuth.identityFields = ["email", "handle"];
  users.listRule = "@request.auth.id != ''";
  users.viewRule = "@request.auth.id != ''";
  app.save(users);

  const chats = new Collection({
    type: "base",
    name: "chats",
    listRule: "members.id ?= @request.auth.id",
    viewRule: "members.id ?= @request.auth.id",
    createRule: "@request.auth.id != '' && members.id ?= @request.auth.id",
    updateRule: "members.id ?= @request.auth.id",
    deleteRule: null,
    fields: [
      { name: "type", type: "select", required: true, maxSelect: 1, values: ["direct", "group"] },
      { name: "name", type: "text", max: 60 },
      { name: "emoji", type: "text", max: 16 },
      { name: "hue", type: "number" },
      { name: "members", type: "relation", required: true, collectionId: users.id, maxSelect: 64, cascadeDelete: false },
      { name: "dkey", type: "text", max: 80 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_chats_dkey ON chats (dkey) WHERE dkey != ''"],
  });
  app.save(chats);

  const messages = new Collection({
    type: "base",
    name: "messages",
    listRule: "chat.members.id ?= @request.auth.id",
    viewRule: "chat.members.id ?= @request.auth.id",
    createRule: "@request.auth.id != '' && sender = @request.auth.id && chat.members.id ?= @request.auth.id",
    updateRule: "sender = @request.auth.id",
    deleteRule: null,
    fields: [
      { name: "chat", type: "relation", required: true, collectionId: chats.id, maxSelect: 1, cascadeDelete: true },
      { name: "sender", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "cid", type: "text", max: 40 },
      { name: "type", type: "text", max: 20 },
      { name: "text", type: "text", max: 4000 },
      { name: "data", type: "json", maxSize: 5242880 },
      { name: "file", type: "file", maxSelect: 1, maxSize: 52428800 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_messages_chat ON messages (chat, created)"],
  });
  app.save(messages);
}, (app) => {
  for (const n of ["messages", "chats"]) {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {}
  }
});
