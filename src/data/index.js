export const students = [
  { id:1,  name:'Aanya Sharma',     course:'BCom IAF', year:'2nd Year',   campus:'Yeshwanthpur', interest:'Finance & Audit' },
  { id:2,  name:'Rithvik Nair',     course:'BCom IBA', year:'3rd Year',   campus:'Yeshwanthpur', interest:'Markets & Trading' },
  { id:4,  name:'Karthik Reddy',    course:'BCom F&A', year:'1st Year',   campus:'Yeshwanthpur', interest:'Marketing' },
  { id:6,  name:'Aryan Verma',      course:'BCom IBA', year:'2nd Year',   campus:'Yeshwanthpur', interest:'Investment Banking' },
  { id:7,  name:'Sneha Pillai',     course:'BCom F&A', year:'1st Year',   campus:'Yeshwanthpur', interest:'Research & Equity' },
  { id:8,  name:'Rohan Das',        course:'BCom IAF', year:'1st Year',   campus:'Yeshwanthpur', interest:'Leadership' },
  { id:9,  name:'Nisha Krishnan',   course:'BCom IAF', year:'3rd Year',   campus:'Yeshwanthpur', interest:'Audit' },
  { id:10, name:'Akhil Raj',        course:'BCom F&A', year:'2nd Year',   campus:'Yeshwanthpur', interest:'Entrepreneurship' },
  { id:13, name:'Pooja Agarwal',    course:'BCom IBA', year:'2nd Year',   campus:'Yeshwanthpur', interest:'Corporate Finance' },
  { id:14, name:'Siddharth Nambiar',course:'BCom IAF', year:'1st Year',   campus:'Yeshwanthpur', interest:'Ethics & Law' },
  { id:15, name:'Anjali Suresh',    course:'BCom F&A', year:'3rd Year',   campus:'Yeshwanthpur', interest:'Marketing' },
  { id:16, name:'Nikhil Bhat',      course:'BCom IBA', year:'1st Year',   campus:'Yeshwanthpur', interest:'Global Markets' },
  { id:17, name:'Lakshmi Patel',    course:'BCom F&A', year:'2nd Year',   campus:'Yeshwanthpur', interest:'Statistics' },
  { id:19, name:'Kavya Shetty',     course:'BCom IAF', year:'2nd Year',   campus:'Yeshwanthpur', interest:'Financial Reporting' },
];
// My own profile (Srikrishna)
export const myProfile = {
  id: 0,
  name: 'Srikrishna',
  course: 'BCom IAF',
  year: '3rd Year',
  campus: 'Yeshwanthpur',
  bio: 'Bcom IAF student currently revising for the AA paper. Lead the TechTeam at my department — we handle digital posters, videos, and AV/tech setup for club events.',
  interests: ['Audit', 'Ethics', 'Photography', 'Video Editing', 'Event Tech', 'Design'],
  stats: { connections: 89, groups: 5, sessions: 18 },
  leadership: { role: 'TechTeam Lead', detail: '3 wings · 28 members' },
};

// === Study Groups ===
export const studyGroups = [
  // ── BCom IAF (ACCA pathway) ──────────────────────────────────────────
  {
    id: 1,
    name: 'ACCA AA — Audit Risk & Procedures',
    course: 'BCom IAF',
    emoji: '⚖️',
    members: 28,
    active: true,
    desc: 'Covering audit risk, procedures, and internal controls together. We go chapter by chapter through the AA exam kit — doubts welcome anytime.',
    recentMessages: [
      { user: 'Nisha', text: 'Chapter 7 is up — audit evidence and procedures', time: '9:15 AM' },
      { user: 'Aanya', text: 'Can someone explain the difference between tests of control vs substantive procedures?', time: '9:31 AM' },
      { user: 'Srikrishna', text: 'Tests of control check if controls are working. Substantive = directly testing figures.', time: '9:34 AM' },
      { user: 'Kavya', text: 'That clears it up, thanks Sri!', time: '9:36 AM' },
    ],
  },
  {
    id: 2,
    name: 'ACCA TX — Income Tax & GST',
    course: 'BCom IAF',
    emoji: '🧾',
    members: 21,
    active: true,
    desc: 'TX paper study group — income tax, GST, capital gains, and deductions. Past papers every weekend.',
    recentMessages: [
      { user: 'Divya', text: 'Anyone else confused by Section 44AD presumptive taxation?', time: '5:10 PM' },
      { user: 'Priya', text: 'Yeah — it applies when turnover < ₹2Cr and you declare 8% profit. Saves you from detailed books.', time: '5:18 PM' },
      { user: 'Divya', text: 'Oh that makes sense, thanks Priya', time: '5:20 PM' },
    ],
  },
  {
    id: 3,
    name: 'ACCA FR — IFRS & Consolidations',
    course: 'BCom IAF',
    emoji: '📊',
    members: 17,
    active: false,
    desc: 'Financial Reporting paper — IFRS standards, group accounts, goodwill, and NCI. Notes and worked examples shared regularly.',
    recentMessages: [
      { user: 'Kavya', text: 'Uploading my IFRS 15 summary notes tonight', time: '3 days ago' },
      { user: 'Rohan', text: 'Please do! Stuck on step 5 of the revenue model', time: '3 days ago' },
    ],
  },
  {
    id: 4,
    name: 'IAF Ethics & SBL Prep',
    course: 'BCom IAF',
    emoji: '🎯',
    members: 19,
    active: true,
    desc: 'ACCA Ethics module + SBL strategy prep. Case discussions, mock scenarios, and professional judgment practice.',
    recentMessages: [
      { user: 'Siddharth', text: 'Working through the ACCA Ethics module — anyone want to pair up for the scenarios?', time: '11:00 AM' },
      { user: 'Priya', text: 'Yes! The module 5 scenarios are tough, lets do them together', time: '11:15 AM' },
    ],
  },
  {
    id: 5,
    name: 'AA Mock Sprint — Past Papers',
    course: 'BCom IAF',
    emoji: '⚡',
    members: 31,
    active: true,
    desc: 'Daily past paper questions and MCQ sets. Mock full papers every Sunday at 10am. Active during exam season.',
    recentMessages: [
      { user: 'Nisha', text: 'New MCQ set pinned — 20 questions on audit sampling', time: '8:00 AM' },
      { user: 'Aanya', text: 'Got 16/20! Slipped on block sampling vs random', time: '8:45 AM' },
      { user: 'Srikrishna', text: 'Same lol — posting a note on that now', time: '8:48 AM' },
      { user: 'Rohan', text: 'Sunday mock still on? Block 3 library at 10?', time: '9:00 AM' },
      { user: 'Nisha', text: 'Yes! Bring your past paper pack', time: '9:02 AM' },
    ],
  },

  // ── BCom IBA (CPA Australia pathway) ────────────────────────────────
  {
    id: 6,
    name: 'CPA — Financial Accounting & Reporting',
    course: 'BCom IBA',
    emoji: '📘',
    members: 16,
    active: true,
    desc: 'Covering the FFA and financial reporting modules of CPA Australia. Concepts, worked problems, and exam-style practice.',
    recentMessages: [
      { user: 'Meera', text: 'Anyone done the consolidated cash flow statement practice set?', time: '2:30 PM' },
      { user: 'Pooja', text: 'Yes — the indirect method section is the tricky part. Sharing my workings', time: '2:45 PM' },
      { user: 'Tarun', text: 'Thanks Pooja, that saves me a lot of time', time: '2:48 PM' },
    ],
  },
  {
    id: 7,
    name: 'Markets & Trading Circle',
    course: 'BCom IBA',
    emoji: '📈',
    members: 23,
    active: true,
    desc: 'For students interested in equity, derivatives, and global markets. Weekly market debriefs, live watchlists, and trading simulations.',
    recentMessages: [
      { user: 'Rithvik', text: 'Nifty broke 24,500 today — anyone tracking the IT index?', time: '3:30 PM' },
      { user: 'Aryan', text: 'Watching closely. TCS results tomorrow could swing things', time: '3:35 PM' },
      { user: 'Nikhil', text: 'Anyone want to run a mock portfolio challenge this week?', time: '4:00 PM' },
      { user: 'Rithvik', text: 'Im in — winner buys chai 😄', time: '4:03 PM' },
    ],
  },
  {
    id: 8,
    name: 'Corporate Finance — M&A & Valuation',
    course: 'BCom IBA',
    emoji: '💼',
    members: 14,
    active: false,
    desc: 'DCF valuation, M&A modelling, and corporate restructuring. Case studies from real deals shared weekly.',
    recentMessages: [
      { user: 'Tarun', text: 'Shared the Tata-Corus deal case study in files — great for valuation practice', time: '2 days ago' },
    ],
  },
  {
    id: 9,
    name: 'Global Business & Strategy',
    course: 'BCom IBA',
    emoji: '🌏',
    members: 18,
    active: true,
    desc: "CPA GSME module + global business strategy discussions. Case competitions, Porter's Five Forces, and PESTLE analyses.",
    recentMessages: [
      { user: 'Meera', text: 'Anyone watching the ACE case competition brief? Strategy components are heavy', time: '10:00 AM' },
      { user: 'Pooja', text: 'Yeah — using VRIO + Porter for the competitive analysis section', time: '10:12 AM' },
    ],
  },

  // ── BCom F&A ─────────────────────────────────────────────────────────
  {
    id: 10,
    name: 'Management Accounting — Costing & Budgets',
    course: 'BCom F&A',
    emoji: '📋',
    members: 22,
    active: true,
    desc: 'Costing methods, variance analysis, budgeting, and performance measurement. Exam-style problems every Tuesday.',
    recentMessages: [
      { user: 'Lakshmi', text: 'Variance analysis is killing me — anyone free this evening?', time: '1:00 PM' },
      { user: 'Karthik', text: "Let's do a study session at 6pm, Block 4 canteen area", time: '1:15 PM' },
      { user: 'Anjali', text: 'Ill come too! Bringing my costing notes', time: '1:18 PM' },
      { user: 'Rahul', text: 'Same — I have the past paper on throughput accounting too', time: '1:20 PM' },
    ],
  },
  {
    id: 11,
    name: 'F&A Financial Modelling',
    course: 'BCom F&A',
    emoji: '📉',
    members: 13,
    active: false,
    desc: 'Building financial models from scratch — DCF, LBO basics, and scenario analysis. Excel-heavy, beginners welcome.',
    recentMessages: [
      { user: 'Vishal', text: 'Uploaded the 3-statement model template to shared drive', time: '4 days ago' },
      { user: 'Sneha', text: 'This is exactly what I needed for the project, thank you!', time: '4 days ago' },
    ],
  },
  {
    id: 12,
    name: 'Marketing & Brand Strategy',
    course: 'BCom F&A',
    emoji: '🎨',
    members: 20,
    active: true,
    desc: 'Marketing strategy, brand positioning, digital marketing basics, and consumer behaviour. Industry talks and case discussions.',
    recentMessages: [
      { user: 'Anjali', text: 'Anyone read the Zara brand strategy breakdown I shared? Worth discussing', time: '5:00 PM' },
      { user: 'Karthik', text: 'Just finished it — the fast fashion positioning angle is clever', time: '5:10 PM' },
    ],
  },
  {
    id: 13,
    name: 'Entrepreneurship & Startups Circle',
    course: 'BCom F&A',
    emoji: '🚀',
    members: 26,
    active: true,
    desc: 'For anyone thinking about building something. Pitch practice, startup case studies, and connecting founders with mentors.',
    recentMessages: [
      { user: 'Akhil', text: 'Anyone working on a pitch deck for the Christ E-Cell comp?', time: '6:30 PM' },
      { user: 'Vishal', text: 'Yes! My idea is a B2B SaaS for CA firms. Looking for co-founder', time: '6:38 PM' },
      { user: 'Akhil', text: 'Interesting — lets sync. I have operations background', time: '6:42 PM' },
    ],
  },

  // ── All courses ───────────────────────────────────────────────────────
  {
    id: 14,
    name: 'Big 4 Placement Prep',
    course: 'All',
    emoji: '🏆',
    members: 74,
    active: true,
    desc: 'Targeting Deloitte, EY, KPMG, PwC? This group covers aptitude rounds, case interviews, group discussions, and CV reviews. Open to all courses.',
    recentMessages: [
      { user: 'Priya', text: 'EY campus drive announced — 3rd and Final Year students eligible', time: '9:00 AM' },
      { user: 'Tarun', text: 'What rounds does EY usually have for BCom students?', time: '9:12 AM' },
      { user: 'Priya', text: 'Typically aptitude → group discussion → HR → partner round', time: '9:15 AM' },
      { user: 'Rithvik', text: 'Is there a technical round? Like accounting knowledge?', time: '9:18 AM' },
      { user: 'Priya', text: 'Yes for audit roles. Brush up on audit basics and IFRS', time: '9:20 AM' },
    ],
  },
  {
    id: 15,
    name: 'Resume & LinkedIn Hub',
    course: 'All',
    emoji: '📝',
    members: 58,
    active: true,
    desc: 'Get your CV reviewed, LinkedIn optimised, and cover letters polished. Peer feedback and templates for internship and campus placement season.',
    recentMessages: [
      { user: 'Meera', text: 'Sharing my LinkedIn headline formula — got 3 recruiter inbounds this month', time: '7:30 PM' },
      { user: 'Nikhil', text: 'Please share! My profile has barely any views', time: '7:35 PM' },
      { user: 'Meera', text: 'Formula: [Role you want] | [Top skill] | [Credential or affiliation]. Keep it recruiter-readable.', time: '7:38 PM' },
    ],
  },
];

// === Clubs & Teams (Hub) ===
export const hubClubs = [
  { id:1,  name:'FLC',             fullName:'Finance and Leadership Cell',              type:'Club', emoji:'💼', color:'#3B82F6', members:48,  coordinator:'Dr. Murthy HN',       desc:'Workshops, stock market simulations, and leadership labs for finance enthusiasts.' },
  { id:2,  name:'ACE',             fullName:'Accountancy and Commerce Enthusiasts',     type:'Club', emoji:'📊', color:'#10B981', members:62,  coordinator:'Dr. Ravi',             desc:'Sharpening commerce skills through quizzes, case studies, and industry talks.' },
  { id:3,  name:'CACOPS',          fullName:'CPA Australia Club of Professional Studies',type:'Club', emoji:'🌏', color:'#A855F7', members:34,  coordinator:null,                   desc:'CPA Australia chapter — global accounting community, mentorship, and certification prep.' },
  { id:4,  name:'Festing Club',    fullName:'Festing Club',                             type:'Club', emoji:'🎉', color:'#EC4899', members:79,  coordinator:'',    desc:'Brings the department to life — fests, themed nights, and signature events.' },
  { id:5,  name:'Ranbhoomi Club',  fullName:'Ranbhoomi Club',                           type:'Club', emoji:'🎭', color:'#F59E0B', members:41,  coordinator:null,                   desc:'Theatre and dramatics — stage performances, street plays, and acting workshops.' },
  { id:6,  name:'Research Club',   fullName:'Research Club',                            type:'Club', emoji:'🔬', color:'#14B8A6', members:27,  coordinator:null,                   desc:'For the curious minds — research papers, case competitions, and academic deep dives.' },
  { id:7,  name:'Sports Club',     fullName:'Sports Club',                              type:'Club', emoji:'⚽', color:'#EF4444', members:104, coordinator:null,                   desc:'Tournaments, fitness drives, and the home of inter-year sporting rivalries.' },
  { id:8,  name:'Industry Connect',fullName:'Industry Connect',                         type:'Club', emoji:'🤝', color:'#8B5CF6', members:53,  coordinator:'ACCA Bhoomika Urs',   desc:'Bridges students and industry — guest lectures, internships, and networking sessions.' },
  { id:17, name:'SAPS',            fullName:'Society of Accounting & Professional Studies',type:'Club',emoji:'📋', color:'#0EA5E9', members:44, coordinator:'CS Monika Agarwal',  desc:'Professional development for CS and accounting students — workshops, mock exams, and industry exposure.' },
  { id:18, name:'Social Media Club', fullName:'Social Media Club',             type:'Club', emoji:'🎬', color:'#E11D48', members:0,   coordinator:null,                   desc:'Reels, blogs, podcasts, and everything in between — for students who create.' },

  { id:9,  name:'Tech Team',       fullName:'Tech Team',                                type:'Team', emoji:'✦',  color:'#A855F7', members:28,  coordinator:null,                   desc:'Posters, video editing, AV setup. Three wings: Photo/Video, Design, Social Media.' },
  { id:10, name:'Audi Team',       fullName:'Audi Team',                                type:'Team', emoji:'🎤', color:'#06B6D4', members:14,  coordinator:null,                   desc:'Manages auditorium logistics — lighting, sound, stage setup for every event.' },
  { id:11, name:'Documentation',   fullName:'Documentation Team',                       type:'Team', emoji:'📝', color:'#84CC16', members:11,  coordinator:null,                   desc:'Records every event in words — reports, archives, and official department documentation.' },
  { id:12, name:'Creative Team',   fullName:'Creative Team',                            type:'Team', emoji:'🎨', color:'#F97316', members:18,  coordinator:null,                   desc:'Branding, posters, merchandise, and the visual identity of every event.' },
  { id:13, name:'Junoon',          fullName:'Junoon · Cultural Team (Dance)',           type:'Team', emoji:'💃', color:'#DB2777', members:32,  coordinator:'',    desc:'The dance crew of the department — choreography, performances, and inter-college battles.' },
  { id:14, name:'Mehfil',          fullName:'Mehfil · Cultural Team (Singing)',         type:'Team', emoji:'🎶', color:'#9333EA', members:24,  coordinator:'',    desc:'Vocal performers — solo, group, classical, contemporary. Every event needs a song.' },
  { id:15, name:'PR & Emcee',      fullName:'PR & Emcee Team',                          type:'Team', emoji:'📣', color:'#FBBF24', members:16,  coordinator:null,                   desc:'The face and voice of every event — hosting, PR, and audience engagement.' },
];

// === Events ===
export const hubEvents = [];

// === Pending approvals (App Admin queue) ===
export const pendingClubs = [
  { id:101, name:'Anime & Manga Club',  type:'Club', applicant:'Aanya Sharma',    course:'ACCA',   year:'2nd Year',   submitted:'2 days ago',  desc:'A community for anime and manga fans — screenings, discussions, cosplay events.' },
  { id:102, name:'Investment Society',  type:'Club', applicant:'Priya Menon',     course:'MBA',    year:'4th Year', submitted:'4 days ago',  desc:'Student-run investment portfolio with real (small) capital. Learn by doing.' },
  { id:103, name:'Astronomy Team',      type:'Team', applicant:'Rithvik Nair',    course:'B.Tech', year:'3rd Year',   submitted:'1 week ago',  desc:'Telescope observation nights, planetarium visits, and astrophysics study sessions.' },
];

// === Tutors (tuition postings) ===
export const tutors = [
  { id:1, name:'Deepak Joshi',   course:'ACCA',   year:'4th Year', rating:4.9, reviews:22, type:'paid', price:299, topics:['Advanced Audit','AAA','Ethics','SBL'], slots:'Mon, Wed, Fri evenings',   verified:true,  bio:'Final-year ACCA, AAA specialist. Cleared AA with distinction.' },
  { id:2, name:'Divya Iyer',     course:'ACCA',   year:'4th Year', rating:4.8, reviews:17, type:'paid', price:249, topics:['Taxation','TX','ATX','VAT'],            slots:'Tue & Thu 6–8pm',           verified:true,  bio:'Tax specialist, can help with TX and ATX. Cleared both with strong scores.' },
  { id:3, name:'Nisha Krishnan', course:'ACCA',   year:'3rd Year',   rating:4.7, reviews:11, type:'free', price:0,   topics:['AA Paper','Audit basics','MCQ practice'], slots:'Weekends',                verified:false, bio:'Currently doing AA myself. Happy to do group revision sessions for free.' },
  { id:4, name:'Priya Menon',    course:'MBA',    year:'4th Year', rating:4.9, reviews:28, type:'paid', price:399, topics:['Strategy','Case studies','Finance'],   slots:'Mon–Sat by appointment',    verified:true,  bio:'MBA finalist with strong case competition record. Strategy frameworks made simple.' },
  { id:5, name:'Vishal Kumar',   course:'B.Tech', year:'4th Year', rating:4.8, reviews:19, type:'paid', price:249, topics:['UI/UX','Figma','React','CSS'],         slots:'Weekdays 7–9pm',            verified:true,  bio:'Frontend dev + UX designer. Helped 19 students land internships.' },
  { id:6, name:'Rithvik Nair',   course:'B.Tech', year:'3rd Year',   rating:4.7, reviews:14, type:'free', price:0,   topics:['Machine Learning','Python','Data Sci'], slots:'Tue, Thu, Sat',           verified:true,  bio:'ML enthusiast. Glad to help juniors get started with Python and basic ML for free.' },
  { id:7, name:'Meera Thomas',   course:'B.Sc',   year:'4th Year', rating:4.8, reviews:13, type:'paid', price:149, topics:['Statistics','R','SPSS'],               slots:'Mon, Wed, Fri',             verified:true,  bio:'Stats and R programming. Perfect for thesis-stage students needing help with data analysis.' },
  { id:8, name:'Anjali Suresh',  course:'BBA',    year:'3rd Year',   rating:4.7, reviews:8,  type:'free', price:0,   topics:['Marketing','Brand strategy','SEO'],   slots:'Sat & Sun mornings',        verified:true,  bio:'Marketing major. Peer-led workshops, no fee, just love teaching this stuff.' },
];

export const teachers = [
  { id:1, name:'Dr. Hridhya P K',     initials:'HP', isHOD:false, position:'Department Coordinator',       specialisation:'Department Administration',   subjects:['Academic Planning','Student Affairs','Coordination'],              code:'12', coordinatorClubIds:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18] },
  { id:2, name:'Dr. Kantharaju NP',   initials:'KN', isHOD:false, position:'Faculty',                      specialisation:'Sustainable Development',      subjects:['SDGs','Social Impact','Environmental Studies'],                    code:'34', coordinatorClubIds:[] },
  { id:3, name:'Dr. Ravi',            initials:'DR', isHOD:false, position:'ACE Club Coordinator',         specialisation:'Accountancy & Commerce',       subjects:['Accounting','Commerce','Case Studies'],                            code:'56', coordinatorClubIds:[2] },
  { id:4, name:'Dr. Bhagyalakshmi',   initials:'BL', isHOD:false, position:'Faculty',                      specialisation:'Finance & Accountancy',        subjects:['Financial Accounting','Corporate Finance','Taxation'],              code:'78', coordinatorClubIds:[] },
  { id:6, name:'CS Monika Agarwal',   initials:'MA', isHOD:false, position:'SAPS Coordinator',             specialisation:'Company Secretaryship',        subjects:['Company Law','Secretarial Practice','CS Examinations'],            code:'25', coordinatorClubIds:[17] },
  { id:7, name:'ACCA Bhoomika Urs',   initials:'BU', isHOD:false, position:'Industry Connect Coordinator', specialisation:'ACCA & Industry Relations',    subjects:['ACCA','Professional Skills','Industry Connect'],                    code:'47', coordinatorClubIds:[8] },
  { id:8, name:'Dr. Murthy HN',       initials:'MH', isHOD:false, position:'FLC Club Coordinator',         specialisation:'Finance & Leadership',         subjects:['Finance','Leadership','Investment Analysis'],                       code:'63', coordinatorClubIds:[1] },
];

// === Mentor Programme ===
// Half of each class assigned to one teacher, other half to another.
// studentId 0 = Srikrishna (myProfile). All others map to students array.
export const mentorAssignments = [
  { teacherId: 2, course: 'BCom IAF', group: 'A', studentIds: [1,  5,  9, 19] },  // Dr. Kantharaju NP
  { teacherId: 3, course: 'BCom IAF', group: 'B', studentIds: [0,  3,  8, 14] },  // Dr. Ravi (0 = Srikrishna)
  { teacherId: 4, course: 'BCom IBA', group: 'A', studentIds: [2,  6, 16] },       // Dr. Bhagyalakshmi
  { teacherId: 6, course: 'BCom F&A', group: 'A', studentIds: [4,  7, 10] },       // CS Monika Agarwal
  { teacherId: 7, course: 'BCom F&A', group: 'B', studentIds: [12, 15, 17, 20] }, // ACCA Bhoomika Urs
];

// Completed visit count per student this semester (5 required)
export const mentorVisitCounts = {
  0: 3,   1: 5,   2: 4,   3: 5,   4: 2,
  5: 3,   6: 4,   7: 1,   8: 2,   9: 4,
  10: 3,  11: 5,  12: 2,  13: 4,  14: 4,
  15: 3,  16: 1,  17: 5,  18: 4,  19: 3,  20: 2,
};

// Srikrishna's mentor session log (detailed)
export const myMentorSessions = [
  {
    id: 1,
    date: 'Mon 6 Jan 2026',
    topic: 'Academic progress review',
    notes: 'Discussed ACCA AA preparation and confirmed target exam date for June. Identified weak areas in ethics and audit procedures and agreed on a daily practice schedule.',
  },
  {
    id: 2,
    date: 'Wed 29 Jan 2026',
    topic: 'Career goals & internship planning',
    notes: 'Explored Big 4 internship opportunities at Deloitte and EY. Refined CV, discussed LinkedIn strategy and approaching campus placement officers.',
  },
  {
    id: 3,
    date: 'Fri 21 Feb 2026',
    topic: 'Mid-semester check-in',
    notes: 'Reviewed mid-term grades and discussed balancing AA exam prep with TechTeam lead responsibilities. Adopted time-blocking; mentor suggested delegating design tasks to wing leads.',
  },
];