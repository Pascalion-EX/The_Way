# Curriculum API

Base URL: `/api/curriculum`. All routes use the existing JWT cookie and require a
verified account. Reading is available to verified users; creating, updating, and
deleting requires one of `pascal`, `admin`, `leader`, or `pamela`, matching lessons.

Each curriculum has a required, trimmed `name`. Its root is generated with id
`root` and that name as its label. The root represents the curriculum; every other
node references an existing lesson. Nodes have a unique string `id`, a `lesson`
MongoDB id, and one `parentId` pointing to `root` or another node in the same
curriculum. Branches are allowed; cycles, duplicate node ids, and missing parents
are rejected. Node order in the array does not affect connectivity.

| Method | Path | Action |
| --- | --- | --- |
| POST | `/` | Create a named curriculum, optionally with nodes |
| GET | `/` | List curriculum, newest first |
| GET | `/:curriculumId` | Read one curriculum |
| PUT | `/:curriculumId` | Change name and/or replace all lesson nodes |
| DELETE | `/:curriculumId` | Delete the curriculum while preserving lessons |

Example create body (replace lesson ids with real ids from `/api/lessons`):

```json
{
  "name": "First Year Curriculum",
  "nodes": [
    { "id": "intro", "lesson": "6ab26b08171afea3091f04b2", "parentId": "root" },
    { "id": "prayer", "lesson": "6ab26b08171afea3091f04b5", "parentId": "intro" },
    { "id": "bible", "lesson": "6ab26b08171afea3091f04b6", "parentId": "intro" }
  ]
}
```

Create/read/update responses include `{ "success": true, "curriculum": ... }`;
list uses `curriculum`. Each curriculum includes stored fields (`_id`, `name`,
`nodes`, `createdBy`, timestamps), populated lesson documents in `nodes[].lesson`,
and a `graph` for rendering:

```json
{
  "rootId": "root",
  "nodes": [
    { "id": "root", "type": "root", "label": "First Year Curriculum" },
    { "id": "intro", "type": "lesson", "label": "Introduction", "lesson": {} }
  ],
  "edges": [{ "source": "root", "target": "intro" }]
}
```

The graph example abbreviates lesson content and the remaining nodes. Edges are
derived from parents, so there is a single source of truth for connections.
Renaming the curriculum automatically changes the root label. Creating with just
`{ "name": "First Year Curriculum" }` produces a root with no lesson nodes.

To add, move, or remove lessons, send the entire desired `nodes` array to `PUT`.
Omitting `nodes` preserves them; sending `nodes: []` leaves only the named root.
When removing a parent, remove its descendants or reparent them in the same
request. Send lesson ids in write requests, rather than populated lesson objects.
Curriculum names need not be unique, and lessons can be reused across curriculum
or nodes. Creator and root fields are managed by the backend.

Invalid input returns 400, forbidden edits 403, missing curriculum 404, and changes
that collide during a save 409. If a lesson is separately deleted through the
existing lesson API, its curriculum node remains connected but `lesson` becomes
`null` and its graph label is `Unavailable lesson`; update the curriculum to remove
or replace that reference.

Run the backend tests without a database connection:

```bash
node --test backend/tests/*.test.js
node backend/tests/curriculum.test.js
```
