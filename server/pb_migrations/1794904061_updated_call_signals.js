/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1418729534")

  // update collection data
  unmarshal({
    "createRule": "sender = @request.auth.id && target != @request.auth.id && chat.members.id ?= @request.auth.id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1418729534")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != ''"
  }, collection)

  return app.save(collection)
})
