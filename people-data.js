/* =====================================================================
   DEPARTMENT PEOPLE DATA — the single source for the whole website
   =====================================================================
   Everything on people.html and every profile page (profile.html?id=…)
   is built from this one list. Change a person here and every page updates.

   FIELDS
   id           unique, lowercase-with-dashes. Used in the profile link:
                profile.html?id=adrijit-goswami
   name         full name as it should appear
   type         "faculty" | "adjunct" | "postdoc" | "scholar" | "staff"
   designation  faculty only: "professor" | "associate-professor" |
                "assistant-professor"   (leave "" if not yet confirmed)
                adjunct/postdoc/scholar/staff: any text, e.g. "INSPIRE Faculty",
                "NBHM Postdoctoral Fellow", "Ph.D. Scholar", "Technical Officer"
   grade        optional, e.g. "Grade-I" (shown after Assistant Professor)
   head         true for the current Head of the Department (one person only)
   status       "current"  – shown in their normal section
                "former"   – faculty/adjunct/staff who retired or left
                             (moves automatically to Former Faculty)
                "alumni"   – postdocs/scholars who completed
                             (moves automatically to Alumni)
   photo        leave "" to use photos/<id>.jpg  (upload that file to change
                the photo everywhere). Or give any other path or URL.
   areas        research subarea ids from research.html (see AREAS below)
   supervisor   scholars/postdocs: the id of their faculty mentor
   year         scholars/postdocs: joining year; for alumni, year completed
   now          alumni/former: current position (optional)
   email, office, phone, website, cv   contact and links ("" = hidden)
   profile      official IIT Kharagpur profile page (shown as a link)
   bio, interests                       paragraphs of text
   education    list of strings, e.g. ["Ph.D., IIT Kharagpur (2010)"]
   publications list of strings (one publication per string)
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
