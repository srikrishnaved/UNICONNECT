import { colors as tColors } from '../theme/tokens';

export const APP_CONFIG = {
  // Brand Configuration
  appName: 'UniConnect',
  universityName: 'UniConnect Platform',
  campusName: 'Main Campus',
  legalName: 'UniConnect',
  
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
  return emailRegex.test(email.trim());
};
