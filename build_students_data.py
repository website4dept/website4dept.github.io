#!/usr/bin/env python3
"""Reads every student .json file in the JSON-files/5-alumni and JSON-files/6-students-current folders and writes students-data.js
(the file the Students page reads on the GitHub website).   Run:  python build_students_data.py"""
import glob, json, os, sys

here = os.path.dirname(os.path.abspath(__file__))
batches = []
folders = ["5-alumni", "6-students-current"]
files = []
for fol in folders:
    files += sorted(f for f in glob.glob(os.path.join(here, "JSON-files", fol, "*.json")) if not os.path.basename(f).startswith(("_", "example-")))
for path in files:
    try:
        data = json.load(open(path, encoding="utf-8"))
    except ValueError as e:
        sys.exit("Problem in {}: {}".format(os.path.basename(path), e))
    for item in (data if isinstance(data, list) else [data]):
        if not isinstance(item, dict) or not isinstance(item.get("students"), list):
            if "5-alumni" in path:
                continue              # scholar / postdoc alumni are profiles: import them through the portal
            sys.exit("{}: expected \"programme\", \"batch\" (or \"passout\") and a \"students\" list.".format(os.path.basename(path)))
        batches.append(item)
header = open(os.path.join(here, "students-data.js"), encoding="utf-8").read().split("window.DEPT_STUDENTS")[0] if os.path.exists(os.path.join(here, "students-data.js")) else ""
out = header + "window.DEPT_STUDENTS = [];\nwindow.DEPT_STUDENT_BATCHES = " + json.dumps(batches, ensure_ascii=False, indent=1) + ";\n"
open(os.path.join(here, "students-data.js"), "w", encoding="utf-8").write(out)
print("Wrote students-data.js from {} batch file(s), {} students.".format(len(batches), sum(len(b["students"]) for b in batches)))
