/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mwhpoxiiau7d76n")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "axufosre",
    "name": "screenshot",
    "type": "file",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "maxSelect": 1,
      "maxSize": 307200,
      "mimeTypes": [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/avif"
      ],
      "thumbs": [
        "380x144",
        "100x100"
      ],
      "protected": false
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("mwhpoxiiau7d76n")

  // remove
  collection.schema.removeField("axufosre")

  return dao.saveCollection(collection)
})
