import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ALL_CLASSES } from '../lib/subjectUtils';

const FALLBACK_PERIODS = ['M1', 'M2', 'P1', 'P2', 'P3', 'P4'].map(label => ({
  label,
  start_time: null,
  end_time: null,
  is_break: false,
}));

const getSubdomain = () => {
  if (typeof window !== 'undefined' && window.location) {
    const searchParams = new URLSearchParams(window.location.search);
    const uniParam = searchParams.get('uni');
    if (uniParam) return uniParam;

    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'dist-psi-ten-59') {
      return parts[0];
    }
  }
  return null;
};

export function useUniversityConfig() {
  const [classes, setClasses] = useState(ALL_CLASSES);
  const [periods, setPeriods] = useState(FALLBACK_PERIODS);
  const [subjects, setSubjects] = useState([]);
  const [enabledFeatures, setEnabledFeatures] = useState(['timetable', 'attendance', 'naac', 'clubs', 'networking']);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[useUniversityConfig] user.id:', user?.id);

        // Determine if the current user is the super admin.
        // Teachers use PIN auth (no Supabase session), so user may be null.
        let isSuperAdmin = false;
        let userUniId = null;
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_super_admin, university_id')
            .eq('id', user.id)
            .maybeSingle();
          isSuperAdmin = !!profile?.is_super_admin;
          userUniId = profile?.university_id;
        }

        let progress = null;
        let progressError = null;

        const subdomain = getSubdomain();
        console.log('[useUniversityConfig] Detected subdomain:', subdomain);

        if (subdomain) {
          const { data: rows, error } = await supabase
            .from('university_setup_progress')
            .select('enabled_classes, enabled_features, university_id')
            .eq('is_setup_complete', true)
            .ilike('university_website', `%${subdomain}%`)
            .limit(1);
          
          if (rows?.length) {
            progress = rows[0];
          } else {
            console.log('[useUniversityConfig] No workspace config found for subdomain:', subdomain);
          }
          progressError = error;
        }

        // Fallback to super admin session or logged-in user's university_id if no subdomain matches
        if (!progress) {
          if (isSuperAdmin) {
            ({ data: progress, error: progressError } = await supabase
              .from('university_setup_progress')
              .select('enabled_classes, enabled_features, university_id')
              .eq('university_id', user.id)
              .maybeSingle());
          } else if (userUniId) {
            ({ data: progress, error: progressError } = await supabase
              .from('university_setup_progress')
              .select('enabled_classes, enabled_features, university_id')
              .eq('university_id', userUniId)
              .maybeSingle());
          } else {
            // Default/anonymous fallback or CHRIST transition fallback
            ({ data: progress, error: progressError } = await supabase
              .from('university_setup_progress')
              .select('enabled_classes, enabled_features, university_id')
              .eq('university_id', '290a9e2c-c6b3-4397-a3ee-fd95f6e0addd')
              .maybeSingle());
          }
        }

        console.log('[useUniversityConfig] progress:', progress, 'progressError:', progressError);

        if (progress?.enabled_classes?.length) {
          setClasses(progress.enabled_classes);
        }
        // else keep ALL_CLASSES fallback so existing users aren't broken

        if (progress?.enabled_features) {
          setEnabledFeatures(progress.enabled_features);
        }

        if (progress?.university_id) {
          const [{ data: periodsData }, { data: subjectsData }] = await Promise.all([
            supabase
              .from('university_periods')
              .select('label, start_time, end_time, is_break')
              .eq('university_id', progress.university_id)
              .order('period_order'),
            supabase
              .from('university_subjects')
              .select('id, class_name, subject_name, subject_code, teacher_name, is_elective')
              .eq('university_id', progress.university_id)
              .order('class_name')
              .order('subject_name'),
          ]);

          if (periodsData?.length) {
            setPeriods(periodsData.map(p => ({
              label: p.label,
              start_time: p.start_time ?? null,
              end_time: p.end_time ?? null,
              is_break: !!p.is_break,
            })));
          }
          // else keep FALLBACK_PERIODS

          if (subjectsData) setSubjects(subjectsData);
        }

        setIsLoading(false);
      } catch (err) {
        console.log('[useUniversityConfig] caught error:', err);
        setIsLoading(false);
      }
    })();
  }, []);

  return { classes, periods, subjects, enabledFeatures, isLoading };
}
