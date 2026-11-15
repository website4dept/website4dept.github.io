/* =====================================================================
   DEPARTMENT PEOPLE DATA — the single source for the whole website
   =====================================================================
   Everything on people.html and every profile page (profile.html?id=…)
   is built from this one list. Change a person here and every page updates.

   FIELDS  (every field is optional except id, name, type, status;
            an empty field shows "To be added." on the profile page)

   BASIC
   id           unique, lowercase-with-dashes; used in profile.html?id=…
   name         full name as it should appear
   type         "faculty" | "adjunct" | "postdoc" | "scholar" | "staff"
   designation  faculty: "professor" | "associate-professor" | "assistant-professor"
                others: any text, e.g. "NBHM Postdoctoral Fellow", "Ph.D. Scholar"
   grade        optional, e.g. "Grade-I" (shown after Assistant Professor)
   head         true for the current Head of the Department
   status       "current" | "former" (moves to Former Faculty) |
                "alumni" (scholars/postdocs, moves to Alumni)
   photo        "" = photos/<id>.jpg ; or any other path/URL
   updated      date the profile was last updated, e.g. "Nov 2026"

   CONTACT & LINKS
   email, phone, office, office_hours, website, cv (path to PDF), profile (IIT KGP page)
   links        {"scholar":"", "orcid":"", "scopus":"", "mathscinet":"", "dblp":"",
                 "researchgate":"", "arxiv":"", "linkedin":""}

   OVERVIEW TAB
   responsibilities  ["Head, Mathematics", "Warden, …"]   (shown under the name)
   bio, interests    text; separate paragraphs with a blank line (\n\n)
   areas        research subarea ids (see DEPT_AREAS below)
   education    [{"degree":"Ph.D.", "subject":"Mathematics", "institution":"…", "year":"2010", "thesis":"…"}]
   experience   [{"position":"Associate Professor", "organisation":"IIT Kharagpur", "from":"2015", "to":"2021"}]
   awards       [{"title":"…", "body":"awarding body", "year":"2022"}]
   memberships  [{"name":"Indian Mathematical Society", "role":"Life Member"}]

   PUBLICATIONS TAB
   publications [{"type":"journal"|"conference"|"book"|"chapter"|"preprint",
                  "authors":"A. Author, B. Author", "title":"…", "venue":"Journal name",
                  "volume":"12", "pages":"1-20", "year":"2024", "doi":"10.xxxx/…", "url":""}]

   RESEARCH & PROJECTS TAB
   projects     [{"title":"…", "agency":"SERB/ANRF", "role":"PI", "from":"2023", "to":"2026",
                  "amount":"₹ 30 lakh", "status":"ongoing"|"completed"}]
   consultancy  [{"title":"…", "client":"…", "from":"", "to":""}]
   patents      [{"title":"…", "number":"…", "status":"Granted", "year":""}]
   collaborators [{"name":"…", "institution":"…"}]

   STUDENTS TAB  (scholars/postdocs in this file whose "supervisor" is this id
                  appear automatically; add others here)
   students     [{"name":"…", "level":"PhD"|"Postdoc"|"M.Sc."|"M.Tech."|"BS-MS",
                  "topic":"…", "year":"2024", "status":"current"|"graduated", "now":"…"}]

   TEACHING TAB
   teaching     [{"code":"MA10001", "title":"Mathematics-I", "level":"UG", "semester":"Autumn 2025"}]
   materials    [{"title":"Lecture notes", "url":"…"}]

   ACTIVITIES TAB
   admin        [{"role":"Head of the Department", "from":"2024", "to":""}]
   talks        [{"title":"…", "event":"…", "place":"…", "date":"Jan 2025"}]
   editorial    [{"role":"Associate Editor", "journal":"…", "from":"", "to":""}]
   events       [{"title":"…", "role":"Convener", "date":"Dec 2024"}]
   visits       [{"institution":"…", "place":"…", "date":"…"}]

   SCHOLARS & POSTDOCS ONLY
   supervisor   id of the faculty supervisor / mentor
   year         joining year; for alumni, year completed
   now          alumni/former: current position
   ===================================================================== */

window.DEPT_AREAS = {
  "optimisation": "Optimisation & Operations Research",
  "data-analysis": "Data Analysis",
  "cryptography": "Cryptography",
  "algebra": "Algebra",
  "analysis": "Analysis",
  "algorithms-complexity": "Algorithms & Complexity",
  "computational-geometry": "Computational Geometry & Topology",
  "statistical-inference": "Statistical Inference",
  "reliability-survival": "Reliability & Survival Analysis",
  "fluid-dynamics": "Fluid Dynamics",
  "differential-equations": "Differential & Integral Equations",
  "scientific-computing": "Scientific Computing",
  "combinatorics": "Combinatorics & Number Theory",
  "stochastic-processes": "Applied Probability",
  "topology": "Topology",
  "blockchain": "Blockchain & Secure Computation"
};

window.DEPT_PEOPLE = [

  /* ---------------- FACULTY ---------------- */
  {"id": "adrijit-goswami", "name": "Adrijit Goswami", "type": "faculty", "designation": "professor", "grade": "", "head": true, "status": "current", "photo": "", "areas": ["optimisation", "data-analysis", "cryptography"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-goswami", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "aniket-biswas", "name": "Aniket Biswas", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-II", "head": false, "status": "current", "photo": "", "areas": [], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-aniket.biswas", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "apurba-das", "name": "Apurba Das", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": ["algebra"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-apurbadas348", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "arindam-banerjee", "name": "Arindam Banerjee", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": [], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-123.arindam", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "bappaditya-bhowmik", "name": "Bappaditya Bhowmik", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["analysis"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-bappaditya", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "bodhayan-roy", "name": "Bodhayan Roy", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": ["algorithms-complexity", "computational-geometry"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-broy", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "buddhananda-banerjee", "name": "Buddhananda Banerjee", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": ["statistical-inference", "reliability-survival", "data-analysis"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-bbanerjee", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "chandal-nahak", "name": "Chandal Nahak", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["analysis", "optimisation"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-cnahak", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "debapriya-biswas", "name": "Debapriya Biswas", "type": "faculty", "designation": "associate-professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["analysis"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-priya", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "debjani-chakraborty", "name": "Debjani Chakraborty", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["optimisation"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-debjani", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "dipankar-ghosh", "name": "Dipankar Ghosh", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": ["algebra"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-dipankar", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "firoj-sk", "name": "Firoj Sk", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": [], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-U1h3K1hmVkphcWRkcGZTeFAwMEE5Zz09", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "g-p-raja-sekhar", "name": "G P Raja Sekhar", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["fluid-dynamics"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-rajas", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "geetanjali-panda", "name": "Geetanjali Panda", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["optimisation"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-geetanjali", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "gnaneshwar-nelakanti", "name": "Gnaneshwar Nelakanti", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["differential-equations", "scientific-computing"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-gnanesh", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "hari-shankar-mahato", "name": "Hari Shankar Mahato", "type": "faculty", "designation": "associate-professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["differential-equations"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-hsmahato", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "husney-parvez-sarwar", "name": "Husney Parvez Sarwar", "type": "faculty", "designation": "associate-professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["algebra"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-parvez", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "kamalakshya-mahatab", "name": "Kamalakshya Mahatab", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": ["combinatorics"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-kamalakshya", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "koeli-ghoshal", "name": "Koeli Ghoshal", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["fluid-dynamics"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-koeli", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "mithun-bhowmik", "name": "Mithun Bhowmik", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": ["analysis"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-mithun", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "mousumi-mandal", "name": "Mousumi Mandal", "type": "faculty", "designation": "associate-professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["algebra", "combinatorics"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-mousumi", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "nabakumar-jana", "name": "Nabakumar Jana", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": ["statistical-inference"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-nabakumarjana", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "naveen-kumar-garg", "name": "Naveen Kumar Garg", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": ["differential-equations", "scientific-computing"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-gargnk", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "nitin-gupta", "name": "Nitin Gupta", "type": "faculty", "designation": "associate-professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["stochastic-processes", "reliability-survival"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-nitin.gupta", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "p-v-s-n-murthy", "name": "P V S N Murthy", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["fluid-dynamics"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-pvsnm", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "pawan-kumar", "name": "Pawan Kumar", "type": "faculty", "designation": "associate-professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": [], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-pawan", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "prateep-chakraborty", "name": "Prateep Chakraborty", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": ["topology", "computational-geometry"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-prateep", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "pratima-panigrahi", "name": "Pratima Panigrahi", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["combinatorics"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-pratima", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "rajni-kant-pandey", "name": "Rajni Kant Pandey", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["differential-equations"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-rkp", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "ramakrishna-nanduri", "name": "Ramakrishna Nanduri", "type": "faculty", "designation": "associate-professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["algebra", "combinatorics"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-nanduri", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "ratna-dutta", "name": "Ratna Dutta", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["cryptography", "blockchain"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-ratna", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "rupanwita-gayen", "name": "Rupanwita Gayen", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["fluid-dynamics"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-rupanwita", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "somesh-kumar", "name": "Somesh Kumar", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["statistical-inference", "reliability-survival", "data-analysis"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-smsh", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "somnath-bhattacharyya", "name": "Somnath Bhattacharyya", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["fluid-dynamics"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-somnath", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "soumitra-ghara", "name": "Soumitra Ghara", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": ["analysis"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-soumitra", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "soumyarup-banerjee", "name": "Soumyarup Banerjee", "type": "faculty", "designation": "assistant-professor", "grade": "Grade-I", "head": false, "status": "current", "photo": "", "areas": ["combinatorics"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-soumyarup", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "sourav-mukhopadhyay", "name": "Sourav Mukhopadhyay", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["cryptography", "blockchain"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-sourav", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "swanand-ravindra-khare", "name": "Swanand Ravindra Khare", "type": "faculty", "designation": "associate-professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["scientific-computing"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-srkhare", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "swarup-kumar-panda", "name": "Swarup Kumar Panda", "type": "faculty", "designation": "associate-professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["combinatorics"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-spanda", "bio": "", "education": [], "interests": "", "publications": []},
  {"id": "t-raja-sekhar", "name": "T Raja Sekhar", "type": "faculty", "designation": "professor", "grade": "", "head": false, "status": "current", "photo": "", "areas": ["differential-equations"], "email": "", "office": "", "phone": "", "website": "", "cv": "", "profile": "https://www.iitkgp.ac.in/department/MA/faculty/ma-trajasekhar", "bio": "", "education": [], "interests": "", "publications": []},

  /* ---------------- SAMPLE PROFILE (not listed anywhere) ----------------
     Open profile.html?id=sample-profile to see how a fully filled profile looks.
     Copy its fields when filling in a real person. Delete it when no longer needed. */
  {"id":"sample-profile","name":"Sample Faculty Member","type":"faculty","designation":"associate-professor","grade":"","head":false,"status":"sample","photo":"","updated":"Nov 2026",
   "email":"name@maths.iitkgp.ac.in","phone":"+91-3222-28XXXX","office":"Room XXX, Department of Mathematics","office_hours":"Tue & Thu, 3–4 pm",
   "website":"https://example.org","cv":"","profile":"",
   "links":{"scholar":"https://scholar.google.com","orcid":"https://orcid.org","mathscinet":"https://mathscinet.ams.org"},
   "responsibilities":["Faculty Advisor, M.Sc. Mathematics"],
   "areas":["algebra","combinatorics"],
   "bio":"This is a sample biography. Write two or three short paragraphs about your background and research.\n\nThe second paragraph can describe current work, collaborations or the kind of students you are looking for.",
   "interests":"Commutative algebra, homological methods, combinatorial algebra.",
   "education":[{"degree":"Ph.D.","subject":"Mathematics","institution":"Sample Institute","year":"2010","thesis":"Title of the doctoral thesis"},{"degree":"M.Sc.","subject":"Mathematics","institution":"Sample University","year":"2005"}],
   "experience":[{"position":"Associate Professor","organisation":"IIT Kharagpur","from":"2021","to":""},{"position":"Assistant Professor","organisation":"IIT Kharagpur","from":"2015","to":"2021"},{"position":"Postdoctoral Fellow","organisation":"Sample Institute","from":"2010","to":"2015"}],
   "awards":[{"title":"Sample Young Scientist Award","body":"Sample Academy","year":"2019"}],
   "memberships":[{"name":"Sample Mathematical Society","role":"Life Member"}],
   "publications":[
     {"type":"journal","authors":"S. Faculty, A. Coauthor","title":"A sample journal article title","venue":"Journal of Sample Mathematics","volume":"12","pages":"1-20","year":"2025","doi":"10.0000/sample.2025"},
     {"type":"journal","authors":"S. Faculty","title":"Another sample article","venue":"Sample Mathematical Journal","volume":"8","pages":"100-118","year":"2023"},
     {"type":"conference","authors":"S. Faculty, B. Student","title":"A sample conference paper","venue":"Proceedings of the Sample Conference","pages":"55-66","year":"2024"},
     {"type":"preprint","authors":"S. Faculty, C. Student","title":"A sample preprint","venue":"arXiv:0000.00000","year":"2026","url":"https://arxiv.org"}],
   "projects":[{"title":"Sample research project title","agency":"SERB/ANRF","role":"PI","from":"2024","to":"2027","amount":"₹ 30 lakh","status":"ongoing"},{"title":"Earlier sample project","agency":"NBHM","role":"Co-PI","from":"2019","to":"2022","status":"completed"}],
   "students":[{"name":"Sample Scholar One","level":"PhD","topic":"Sample research topic","year":"2023","status":"current"},{"name":"Sample Graduate","level":"PhD","topic":"Sample thesis title","year":"2022","status":"graduated","now":"Assistant Professor, Sample University"},{"name":"Sample M.Sc. Student","level":"M.Sc.","topic":"Sample project title","year":"2025"}],
   "teaching":[{"code":"MA10001","title":"Mathematics-I","level":"UG","semester":"Autumn 2025"},{"code":"MA60000","title":"Sample Postgraduate Course","level":"PG","semester":"Spring 2025"}],
   "admin":[{"role":"Faculty Advisor, M.Sc. Mathematics","from":"2024","to":""}],
   "talks":[{"title":"Sample invited talk","event":"Sample Conference 2025","place":"Sample City","date":"Jan 2025"}],
   "editorial":[{"role":"Reviewer","journal":"Mathematical Reviews (MathSciNet)"}],
   "events":[{"title":"Sample Workshop on Algebra","role":"Convener","date":"Dec 2024"}]},

  /* ---------------- ADJUNCT & INSPIRE FACULTY ----------------
     Example (remove the slash-star comment marks to use):
  {"id":"firstname-lastname","name":"Firstname Lastname","type":"adjunct","designation":"INSPIRE Faculty","status":"current","photo":"","areas":["algebra"],"supervisor":"","email":"","bio":""},
  */

  /* ---------------- POSTDOCTORAL FELLOWS ----------------
  {"id":"firstname-lastname","name":"Firstname Lastname","type":"postdoc","designation":"NBHM Postdoctoral Fellow","status":"current","photo":"","areas":["analysis"],"supervisor":"mithun-bhowmik","year":"2025","email":"","bio":""},
  */

  /* ---------------- RESEARCH SCHOLARS ----------------
  {"id":"firstname-lastname","name":"Firstname Lastname","type":"scholar","designation":"Ph.D. Scholar","status":"current","photo":"","areas":["cryptography"],"supervisor":"ratna-dutta","year":"2023","email":"","bio":""},
     When the scholar graduates, change "status":"current" to "status":"alumni",
     set "year" to the year of completion and optionally "now":"Assistant Professor, …".
  */

  /* ---------------- STAFF ----------------
  {"id":"firstname-lastname","name":"Firstname Lastname","type":"staff","designation":"Technical Officer","status":"current","photo":"","email":"","phone":""},
  */

];
