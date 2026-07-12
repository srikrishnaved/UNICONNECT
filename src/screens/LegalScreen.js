import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';
import { Lock, ClipboardList } from 'lucide-react-native';
import { APP_CONFIG } from '../config/appConfig';

const PRIVACY_POLICY = [
  {
    heading: 'Overview',
    body: 'UniConnect ("the App") is a student and faculty engagement platform for registered educational institutions. This Privacy Policy explains what personal data we collect, how we use it, your rights under the Digital Personal Data Protection Act 2023, and how to contact us with concerns.',
  },
  {
    heading: 'Who Can Use This App',
    body: 'Access is restricted to verified students and faculty members of registered institutions. By signing up, you confirm you are a current student or approved faculty member. Students must have a valid institutional email address.',
  },
  {
    heading: 'Data We Collect',
    body: 'When you create an account we collect:\n• Full name\n• Institutional email address\n• University affiliation, course, and year of study\n• Campus location\n• Bio (optional)\n• Social media links (optional)\n\nWhen you use the App we also collect:\n• Timetable and class schedule data\n• Club memberships and event interactions\n• Study planner data (exam dates, topics, syllabi)\n• Direct messages and group messages\n• Notification records\n• Reports submitted against other users',
  },
  {
    heading: 'How We Use Your Data',
    body: 'Your data is used solely to provide the features of the App:\n• Displaying your profile to other verified users\n• Powering the study planner and timetable features\n• Enabling group and direct messaging\n• Managing club memberships and event tracking\n• Generating AI-assisted study plans and documentation\n• Surfacing you in Discover and Search screens\n• Reviewing safety reports submitted by users\n\nWe do not sell, rent, or share your data with any third party for advertising or commercial purposes.',
  },
  {
    heading: 'Third-Party Processors',
    body: 'We use the following third-party services to power the App:\n\n• Supabase (database and authentication) — your account credentials and all App data are stored on Supabase infrastructure.\n\n• Anthropic (AI features) — when you use the AI Study Planner or AI-assisted documentation features, your syllabus content, event descriptions, and related text may be sent to Anthropic\'s API for processing. Anthropic\'s use of this data is governed by Anthropic\'s usage policies.\n\nWe only share the minimum data necessary with these processors to deliver the relevant feature.',
  },
  {
    heading: 'Who Can See Your Data',
    body: 'Other signed-up users of the App can see your public profile (name, course, year, bio, and social links you choose to share). Your messages are only visible to the intended recipients. Reports you submit are only visible to the App administrator.',
  },
  {
    heading: 'Data Retention',
    body: 'Your data is retained until your account is deleted. You may delete your account at any time from the My Profile screen. Upon deletion, your profile and all associated data are permanently removed from our database.',
  },
  {
    heading: 'Your Rights',
    body: 'Under the Digital Personal Data Protection Act 2023 (India), you have the right to:\n• Access the personal data we hold about you\n• Correct inaccurate or incomplete data\n• Erasure of your personal data (account deletion)\n• Withdraw consent for data processing\n• Nominate a person to exercise these rights on your behalf\n\nTo exercise any of these rights, contact us at the email below.',
  },
  {
    heading: 'Governing Law',
    body: 'This Privacy Policy is governed by the laws of Karnataka, India, including the Digital Personal Data Protection Act 2023. Any disputes arising from this policy shall be subject to the jurisdiction of courts in Bangalore, Karnataka.',
  },
  {
    heading: 'Contact',
    body: 'For any privacy-related questions, data requests, or concerns, please contact:\nsrikrishnavedkodakalla@gmail.com\n\nThis policy was last updated on 24 June 2026.',
  },
];

const TERMS_OF_SERVICE = [
  {
    heading: 'Acceptance of Terms',
    body: 'By creating an account on UniConnect, you agree to these Terms of Service. If you do not agree, do not use the App.',
  },
  {
    heading: 'Eligibility',
    body: 'The App is for verified students and faculty members of registered educational institutions. You must register with a valid institutional email address. Accounts created with non-institutional emails may be rejected. By signing up you confirm you are at least 18 years of age, or that you have obtained parental or guardian consent.',
  },
  {
    heading: 'Acceptable Use',
    body: 'You agree to use the App in a respectful and lawful manner. You may:\n• Connect and communicate with other students and faculty\n• Join study groups and participate in club activities\n• Follow clubs and express interest in events\n• Share relevant academic or co-curricular content\n\nYou must not:\n• Harass, bully, threaten, or intimidate any user\n• Misuse or distribute another user\'s personal data without consent\n• Impersonate another student, faculty member, or any other person\n• Post spam, fake content, or misleading information\n• Use the App for commercial solicitation\n• Attempt to bypass security or access controls',
  },
  {
    heading: 'Intellectual Property',
    body: 'UniConnect (the platform, branding, and underlying software) is owned by Srikrishna Ved Kodakalla. You may not copy, modify, or distribute the platform without written permission.\n\nYou own the content you create and share through the App (messages, club posts, etc.). By posting content, you grant UniConnect a limited, non-exclusive licence to display it within the App to other users.',
  },
  {
    heading: 'AI Features',
    body: 'The App includes AI-powered features including AI study plan generation (SAGE) and AI-assisted documentation generation (NFA documents, activity reports). These features are powered by Anthropic\'s API.\n\nAI-generated content is provided for assistance only. You must review all AI-generated content before official submission or use. UniConnect and its developer are not liable for any inaccuracy, omission, or error in AI-generated output, and accept no liability for any consequence arising from reliance on unreviewed AI-generated content.',
  },
  {
    heading: 'Disclaimer',
    body: 'The App is provided "as is" without warranty of any kind. We make no guarantee of uptime, data availability, or continuity of service. The App may be updated, modified, or discontinued at any time without notice. We are not liable for any loss of data, missed connections, or disruptions to service.',
  },
  {
    heading: 'Termination',
    body: 'UniConnect may suspend or permanently terminate your account if you violate these Terms of Service. Violations may result in a warning, temporary suspension, or permanent removal from the platform. Serious violations may be referred to your institution\'s administration or relevant authorities.',
  },
  {
    heading: 'Changes to These Terms',
    body: 'We may update these Terms from time to time. Continued use of the App after changes are posted constitutes your acceptance of the updated terms. We will make reasonable efforts to notify users of material changes.',
  },
  {
    heading: 'Governing Law',
    body: 'These Terms of Service are governed by the laws of Karnataka, India. Any disputes arising from these Terms shall be subject to the jurisdiction of courts in Bangalore, Karnataka.',
  },
  {
    heading: 'Contact',
    body: 'For questions about these terms or to report a violation, contact:\nsrikrishnavedkodakalla@gmail.com\n\nThese terms were last updated on 24 June 2026.',
  },
];

export default function LegalScreen({ route }) {
  const type = route?.params?.type ?? 'privacy';
  const isPrivacy = type === 'privacy';
  const sections = isPrivacy ? PRIVACY_POLICY : TERMS_OF_SERVICE;
  const titleIcon = isPrivacy ? <Lock size={20} color={colors.textSecondary} /> : <ClipboardList size={20} color={colors.textSecondary} />;
  const titleText = isPrivacy ? 'Privacy Policy' : 'Terms of Service';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:4}}>{titleIcon}<Text style={styles.title}>{titleText}</Text></View>
      <Text style={styles.subtitle}>UniConnect · {APP_CONFIG.universityName || 'your university'}</Text>

      {sections.map((section, i) => (
        <View key={i} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },

  title: { fontSize: 22, ...font.bold, color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 12, color: colors.textTertiary, marginBottom: spacing.xl },

  section: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  heading: { fontSize: 13, ...font.bold, color: colors.textPrimary, marginBottom: 6 },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
});
