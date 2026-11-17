/// <reference path="../pb_data/types.d.ts" />
// Gabung grup lewat kode undangan: POST /api/onix/join/{code}
routerAdd("POST", "/api/onix/join/{code}", (e) => {
  const uid = e.auth?.id;
  if (!uid) throw new UnauthorizedError("Login dulu");
  const code = e.request.pathValue("code");
  let chat;
  try { chat = $app.findFirstRecordByData("chats", "invite", code); } catch (_) { throw new NotFoundError("Link nggak valid"); }
  if (!code || chat.get("type") !== "group") throw new NotFoundError("Link nggak valid");
  const blocked = [];
  const members = chat.getStringSlice("members");
  if (!members.includes(uid)) {
    if (members.length >= 64) throw new BadRequestError("Grup penuh");
    members.push(uid);
    chat.set("members", members);
    $app.save(chat);
  }
  return e.json(200, { id: chat.id, name: chat.get("name") });
}, $apis.requireAuth());
