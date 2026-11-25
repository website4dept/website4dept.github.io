# Department forms — how the download page works

The blank forms the department hands out: CL leave, sick leave, restricted
holiday, TA claims, no-dues. The office puts them up; anybody downloads them
from the website without signing in.

---

## For the office: putting a form up

1. Portal → **Forms** → **Add a form**
2. **Title** — what people will look for: *Casual Leave (CL)*
3. **Group** *(optional)* — *Leave*, *Travel*, … Forms with no group fall under
   "Other forms" at the bottom. Leave it blank until you have enough forms that
   grouping helps.
4. **One line of explanation** *(optional)* — *"One or two days at a time."*
5. **The file** — a PDF or a Word file, up to 10 MB
6. **Add it**
7. Administration → **Export for website**, then copy the exported
   `forms-data.js` **and** the `uploads/forms/` folder across

That last step is the one people forget. The form is in the portal straight
away; it reaches the website when you export.

### Replacing a form with a newer version

Press **Edit**, choose the new file, **Save**. The download link does not
change, so anything already written on a notice board or sent in an e-mail
keeps working. The old file is cleared away.

### Taking a form off the website

**Hide** keeps it, with its file, but off the public page — use this when a
form is out of date and you are waiting for the new one. **Delete** removes the
file as well, and cannot be undone.

### The order they appear in

The ▲ ▼ buttons. The public page keeps your order, and each group appears where
its first form does, so moving a form to the top moves its group with it.

---

## Who can do what

| | |
|---|---|
| Anybody, signed in or not | download any form from `forms.html` |
| `office` | add, edit, replace, hide, reorder, delete |
| `admin` | the same — this is website content, like Notices and the Gallery |
| `hod`, `member` | download only |

---

## Where things actually are

```
forms.html              the public page   (do not edit: it draws itself)
forms.js                draws the list
forms-data.js           the list itself   (rewritten by the portal — never edit by hand)
uploads/forms/*.pdf     the files people download
backend/forms.py        the whole feature, server side
portal/forms.js         the Forms screen in the portal
backend/test_forms.py   43 checks
```

**Why a folder of files and a .js list, rather than the database:** the website
has to work with nothing running behind it. That is how it is previewed on
GitHub Pages, and it is why a Python fault cannot take the downloads with it.
nginx serves `uploads/forms/` straight from disk.

---

## What is checked when a file is uploaded

* It must really be a PDF or a Word file. The first bytes of the file are read
  and compared, because an extension is only a name — a `.exe` renamed to
  `.pdf` is refused. A `.docx` is opened as a zip and must contain the
  `word/` folder every real Word document has.
* Under 10 MB. A blank form is a few hundred KB.
* The stored filename is **made from the title**, never taken from the upload,
  so a crafted name cannot escape the folder.
* Two forms with the same title get `-2`, `-3` and so on. Nothing is overwritten
  by accident.
* Adding, editing, reordering and deleting are all written to the activity log
  with the e-mail address of whoever did it.

---

## If a form is missing from the website

In this order:

1. Is it **Hidden** in the portal?
2. Has **Export for website** been run since it was added?
3. Were **both** `forms-data.js` and `uploads/forms/` copied across? Copying
   only the first gives a form that is listed but will not download; only the
   second gives a file nobody can find.
