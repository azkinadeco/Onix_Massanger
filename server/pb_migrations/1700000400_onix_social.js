/// <reference path="../pb_data/types.d.ts" />
// Tahap 5: profil (mood, privasi, blokir), state chat per-user, admin grup + undangan,
// story, VOOM (post, like, komentar), laporan.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new JSONField({ name: "mood", maxSize: 4096 }));
  users.fields.add(new JSONField({ name: "privacy", maxSize: 2048 }));
  users.fields.add(new RelationField({ name: "blocked", collectionId: users.id, maxSelect: 500, cascadeDelete: false }));
  app.save(users);

  const state = app.findCollectionByNameOrId("chat_state");
  state.fields.add(new BoolField({ name: "pinned" }));
  state.fields.add(new BoolField({ name: "muted" }));
  state.fields.add(new BoolField({ name: "archived" }));
  state.fields.add(new NumberField({ name: "clearedAt" }));
  app.save(state);

  const chats = app.findCollectionByNameOrId("chats");
  chats.fields.add(new RelationField({ name: "owner", collectionId: users.id, maxSelect: 1, cascadeDelete: false }));
  chats.fields.add(new RelationField({ name: "admins", collectionId: users.id, maxSelect: 64, cascadeDelete: false }));
  chats.fields.add(new TextField({ name: "invite", max: 24 }));
  chats.indexes.push("CREATE UNIQUE INDEX idx_chats_invite ON chats (invite) WHERE invite != ''");
  // anggota biasa cuma boleh keluar (hapus diri) / ganti nama; atur anggota & admin cuma admin/owner
  chats.updateRule = "members.id ?= @request.auth.id && (type = 'direct' || owner = '' || owner = @request.auth.id || admins.id ?= @request.auth.id || (@request.body.admins:isset = false && @request.body.owner:isset = false && @request.body.invite:isset = false))";
  app.save(chats);

  const authed = "@request.auth.id != ''";
  const stories = new Collection({
    type: "base", name: "stories",
    listRule: authed, viewRule: authed,
    createRule: "user = @request.auth.id", updateRule: null, deleteRule: "user = @request.auth.id",
    fields: [
      { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "text", type: "text", max: 300 },
      { name: "bg", type: "number" },
      { name: "font", type: "text", max: 12 },
      { name: "image", type: "file", maxSelect: 1, maxSize: 10485760, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
      { name: "expires", type: "number" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE INDEX idx_stories_user ON stories (user, created)"],
  });
  app.save(stories);

  const views = new Collection({
    type: "base", name: "story_views",
    listRule: "story.user = @request.auth.id || user = @request.auth.id", viewRule: "story.user = @request.auth.id || user = @request.auth.id",
    createRule: "user = @request.auth.id", updateRule: "user = @request.auth.id && @request.body.user:isset = false && @request.body.story:isset = false", deleteRule: null,
    fields: [
      { name: "story", type: "relation", required: true, collectionId: stories.id, maxSelect: 1, cascadeDelete: true },
      { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "react", type: "text", max: 16 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_story_views_su ON story_views (story, user)"],
  });
  app.save(views);

  const posts = new Collection({
    type: "base", name: "posts",
    listRule: authed, viewRule: authed,
    createRule: "user = @request.auth.id", updateRule: "user = @request.auth.id && @request.body.user:isset = false", deleteRule: "user = @request.auth.id",
    fields: [
      { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "cid", type: "text", max: 40 },
      { name: "text", type: "text", max: 1000 },
      { name: "images", type: "file", maxSelect: 10, maxSize: 10485760, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE INDEX idx_posts_created ON posts (created)"],
  });
  app.save(posts);

  const likes = new Collection({
    type: "base", name: "post_likes",
    listRule: authed, viewRule: authed, createRule: "user = @request.auth.id", updateRule: null, deleteRule: "user = @request.auth.id",
    fields: [
      { name: "post", type: "relation", required: true, collectionId: posts.id, maxSelect: 1, cascadeDelete: true },
      { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_post_likes_pu ON post_likes (post, user)"],
  });
  app.save(likes);

  const comments = new Collection({
    type: "base", name: "post_comments",
    listRule: authed, viewRule: authed, createRule: "user = @request.auth.id", updateRule: null, deleteRule: "user = @request.auth.id || post.user = @request.auth.id",
    fields: [
      { name: "post", type: "relation", required: true, collectionId: posts.id, maxSelect: 1, cascadeDelete: true },
      { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "cid", type: "text", max: 40 },
      { name: "text", type: "text", required: true, max: 500 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE INDEX idx_post_comments_post ON post_comments (post, created)"],
  });
  app.save(comments);

  const reports = new Collection({
    type: "base", name: "reports",
    listRule: null, viewRule: null, createRule: "reporter = @request.auth.id", updateRule: null, deleteRule: null,
    fields: [
      { name: "reporter", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "target", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "reason", type: "text", max: 300 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
  });
  app.save(reports);
}, (app) => {
  for (const n of ["reports", "post_comments", "post_likes", "posts", "story_views", "stories"]) {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {}
  }
});
