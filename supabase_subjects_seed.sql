-- Run this AFTER supabase_subjects_tables.sql
-- Seeds all BCom IAF subjects across semesters 1, 3, and 5

INSERT INTO subjects (name, code, class, programme, semester, status, created_by) VALUES

-- Semester 1 — 1BcomIAF
('Mathematics for Managerial Decisions',               'MAT144',     '1BcomIAF', 'IAF', '1', 'active', NULL),
('Holistic Education and Development',                  'HED181-1',   '1BcomIAF', 'IAF', '1', 'active', NULL),
('Business Economics',                                  'DPS103-1',   '1BcomIAF', 'IAF', '1', 'active', NULL),
('Financial Accounting',                                'BIAF101-1',  '1BcomIAF', 'IAF', '1', 'active', NULL),
('Business Management and Organisational Behaviour',    'DPS102-1',   '1BcomIAF', 'IAF', '1', 'active', NULL),
('Foundational Kannada',                                'KAN081-1Y',  '1BcomIAF', 'IAF', '1', 'active', NULL),
('French',                                              'FRE181-1',   '1BcomIAF', 'IAF', '1', 'active', NULL),
('Organisational Study',                                'DPS161-1',   '1BcomIAF', 'IAF', '1', 'active', NULL),
('Environmental Studies',                               'EVS181-1',   '1BcomIAF', 'IAF', '1', 'active', NULL),
('English',                                             'ENG181-1',   '1BcomIAF', 'IAF', '1', 'active', NULL),

-- Semester 3 — 3BcomIAF
('Business and Corporate Law',                          'BIAF203-3',  '3BcomIAF', 'IAF', '3', 'active', NULL),
('Holistic Education Development II',                   'HED-NEP181-3','3BcomIAF','IAF', '3', 'active', NULL),
('Mental Health and Wellbeing',                         'NOC25-HS109','3BcomIAF', 'IAF', '3', 'active', NULL),
('Leadership Skill Development Level 1 and 2',          'CPCG185-3',  '3BcomIAF', 'IAF', '3', 'active', NULL),
('Entrepreneurship',                                    'DPS161-3',   '3BcomIAF', 'IAF', '3', 'active', NULL),
('Yoga and Mental Wellbeing',                           'DPS181-3',   '3BcomIAF', 'IAF', '3', 'active', NULL),
('Cost Accounting',                                     'BIAF201-3',  '3BcomIAF', 'IAF', '3', 'active', NULL),
('Auditing',                                            'BIAF202-3',  '3BcomIAF', 'IAF', '3', 'active', NULL),
('Financial Management',                                'BIAF204-3',  '3BcomIAF', 'IAF', '3', 'active', NULL),

-- Semester 5 — 5BcomIAF
('Corporate Governance Risk and Ethics',                'BIAF302-5',  '5BcomIAF', 'IAF', '5', 'active', NULL),
('Strategic Business Management',                       'BIAF303-5',  '5BcomIAF', 'IAF', '5', 'active', NULL),
('Industry Practicum',                                  'DPS481-5',   '5BcomIAF', 'IAF', '5', 'active', NULL),
('Entrepreneurial Venture Planning and Communication Strategy', 'BIAF303B-5','5BcomIAF','IAF','5','active',NULL),
('Corporate Reporting',                                 'BIAF301-5',  '5BcomIAF', 'IAF', '5', 'active', NULL);
