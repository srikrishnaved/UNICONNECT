import { colors as tColors } from '../theme/tokens';

export const APP_CONFIG = {
  // Brand Configuration
  appName: 'UniConnect',
  universityName: 'Christ University',
  campusName: 'Yeshwanthpur',
  legalName: 'UniConnect',

  // Timetable AI Assistant — per-university config
  // workingDays: read from university config at runtime; this is the fallback default.
  workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],

  // Scheduling constraints for the AI assistant.
  // Shape: { day, periodName, appliesTo: [classNames], reason }
  // These are seeded per-university. No hardcoded institution-specific rules in code.
  constraints: [
    {
      day: 'TUE',
      periodName: 'P2',
      appliesTo: ['1BcomIBA', '1BcomF&A', '1BcomIAF', '3BcomIBA', '3BcomF&A(A)', '3BcomF&A(B)', '3BcomIAF'],
      reason: 'Reserved for HED (Higher Education Department)',
    }
  ],
  
  // Registration Configuration
  allowedEmailDomains: ['christuniversity.in'],
  testEmailDomains: ['uniconnect.test'],
  
  // Campuses list
  campuses: ['Yeshwanthpur'],
  
  // Years list
  years: ['1st Year', '2nd Year', '3rd Year'],
  
  // Course/programme list
  courses: [
    {
      key: 'BCom IAF',
      full: 'BCom International Accounting & Finance',
      sub: 'Integrated with ACCA',
      color: tColors.info,
      bg: tColors.infoDim,
    },
    {
      key: 'BCom IBA',
      full: 'BCom International Business & Accounting',
      sub: 'Integrated with CPA Australia',
      color: tColors.accent,
      bg: tColors.accentDim,
    },
    {
      key: 'BCom F&A',
      full: 'BCom Finance & Accountancy',
      sub: null,
      color: tColors.success,
      bg: tColors.successDim,
    },
  ],

  // Specific class lists (for Timetable grid, etc.)
  classes: [
    '1BcomIBA', '1BcomF&A', '1BcomIAF',
    '3BcomIBA', '3BcomF&A(A)', '3BcomF&A(B)', '3BcomIAF',
    '5BcomF&A(A)', '5BcomF&A(B)', '5BcomIAF',
    '7BcomF&A',
  ],

  // Classes subject to HED reserved slot (TUE P2)
  hedClasses: [
    '1BcomIBA', '1BcomF&A', '1BcomIAF',
    '3BcomIBA', '3BcomF&A(A)', '3BcomF&A(B)', '3BcomIAF',
  ],

  // CHRIST-specific constraint seed data.
  // For CHRIST, TUE P2 is reserved for HED for 1st/3rd semester classes.
  // This is stored as a constraint entry rather than hardcoded logic.
  christConstraints: [
    {
      day: 'TUE',
      periodName: 'P2',
      appliesTo: ['1BcomIBA', '1BcomF&A', '1BcomIAF', '3BcomIBA', '3BcomF&A(A)', '3BcomF&A(B)', '3BcomIAF'],
      reason: 'Reserved for HED (Higher Education Department)',
    },
  ],

  // Register number bases for CR rolls (CRDashboardScreen)
  classRegBases: {
    '1BcomF&A':   2614600,
    '1BcomIAF':   2622400,
    '1BcomIBA':   2614500,
    '3BcomF&A A': 2514600,
    '3BcomF&A B': 2514600,
    '3BcomIAF':   2522400,
    '3BcomIBA':   2514500,
    '5BcomF&A A': 2414600,
    '5BcomF&A B': 2414500,
    '5BcomIAF':   2422300,
  },

  // Metadata mapping for subjects (subjectUtils)
  classMeta: {
    '1BcomIAF':    { programme: 'IAF', semester: '1' },
    '3BcomIAF':    { programme: 'IAF', semester: '3' },
    '5BcomIAF':    { programme: 'IAF', semester: '5' },
    '1BcomIBA':    { programme: 'IBA', semester: '1' },
    '3BcomIBA':    { programme: 'IBA', semester: '3' },
    '1BcomF&A':    { programme: 'F&A', semester: '1' },
    '3BcomF&A(A)': { programme: 'F&A', semester: '3' },
    '3BcomF&A(B)': { programme: 'F&A', semester: '3' },
    '5BcomF&A(A)': { programme: 'F&A', semester: '5' },
    '5BcomF&A(B)': { programme: 'F&A', semester: '5' },
    '7BcomF&A':    { programme: 'F&A', semester: '7' },
  },

  // Interests list
  interests: [
    'Finance', 'Accounting', 'Taxation', 'Auditing', 'Economics',
    'Marketing', 'Entrepreneurship', 'Management', 'Banking & Investment',
    'Business Law', 'International Business', 'Strategy',
    'Photography', 'Videography', 'Graphic Design', 'Content Creation',
    'Social Media', 'Public Speaking', 'Leadership', 'Volunteering',
    'Event Management', 'Music', 'Dance', 'Theatre & Drama',
    'Sports & Fitness', 'Research & Writing', 'Technology', 'AI & Data',
  ],
};

export const isEmailDomainValid = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) return false;
  const domain = email.trim().toLowerCase().split('@')[1];
  return (APP_CONFIG.allowedEmailDomains || []).includes(domain) || 
         (APP_CONFIG.testEmailDomains || []).includes(domain);
};
