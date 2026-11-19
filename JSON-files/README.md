# JSON files: one folder per kind of person, one file per list

Every data JSON file is here. The folder says WHO, the file name says WHAT.
Files starting with **example-** are samples: copy one, rename it, fill it in. Never import an example file as it is.

| Folder | Real file | Samples |
|---|---|---|
| `1-faculty/` | `faculty-current.json` (40 faculty) | `example-faculty-profile-all-fields.json`, `example-adjunct-or-inspire-faculty.json`, `example-former-faculty.json` |
| `2-research-scholars/` | `research-scholars-current.json` (129 scholars) | `example-research-scholars.json` |
| `3-postdocs/` | `postdocs-current.json` | `example-postdoc.json` |
| `4-staff/` | `staff-current.json` (5 staff) | `example-staff.json` |
| `5-alumni/` | (add your own, see below) | `example-alumni-research-scholars.json`, `example-alumni-postdocs.json`, `example-alumni-bsms.json`, `example-alumni-msc.json`, `example-alumni-mtech.json` |
| `6-students-current/` | (add your own, see below) | `example-bsms-batch-2024.json`, `example-msc-batch-2025.json`, `example-mtech-batch-2024.json` |
| `7-mailing-lists/` | | `example-mailing-list-contacts.json` |

## Naming your own files
* Alumni, one file per type: `alumni-research-scholars.json`, `alumni-postdocs.json`, `alumni-bsms.json`, `alumni-msc.json`, `alumni-mtech.json`
* Current students, one file per programme and batch: `bsms-2024.json`, `msc-2025.json`, `mtech-2024.json`
* Anything else: `<who>-<current or alumni>.json`

## How each kind is used
**Faculty, research scholars, postdocs, staff, scholar/postdoc alumni** (profiles):
Admin portal → **Import data (JSON)** → choose the file (or `python backend/server.py import file.json`).
Profiles with the same `id` are updated, new ones added. Then *Export for website* (until the portal runs on CIC).

**Student alumni (BS-MS, M.Sc., M.Tech.) and current students**:
Programme (and batch) are written once at the top of the file, then the names.
* Portal: Admin → **Students** → Import from a JSON file, one file after another.
* GitHub website without a server: put your files in `5-alumni/` or `6-students-current/`, run
  `python build_students_data.py` in the main folder (it rewrites `students-data.js`), upload `students-data.js`.
  (The builder only reads the student-style files; scholar/postdoc alumni files go through the portal.)

**Mailing lists**: portal → Import data / Mailing lists.

## Server settings (not data; they stay where they are)
* `backend/config.example.json`: settings for running the portal on your own computer (copy to `backend/config.json`)
* `deploy/config.cic.example.json`: the same, with the values for the CIC server
