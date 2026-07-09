import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ALL_CLASSES } from '../lib/subjectUtils';

const FALLBACK_PERIODS = ['M1', 'M2', 'P1', 'P2', 'P3', 'P4'].map(label => ({
  label,
  start_time: null,
  end_time: null,
  is_break: false,
}));

export function useUniversityConfig() {
  const [classes, setClasses] = useState(ALL_CLASSES);
  const [periods, setPeriods] = useState(FALLBACK_PERIODS);
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[useUniversityConfig] user.id:', user?.id);

        // Determine if the current user is the super admin.
        // Teachers use PIN auth (no Supabase session), so user may be null.
        let isSuperAdmin = false;
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .maybeSingle();
          isSuperAdmin = !!profile?.is_super_admin;
        }

        // Super admin: their own setup row. Everyone else: the completed row
        // (single-tenant — only one university will ever have is_setup_complete = true).
        let progress, progressError;
        if (isSuperAdmin) {
          ({ data: progress, error: progressError } = await supabase
            .from('university_setup_progress')
            .select('enabled_classes, university_id')
            .eq('university_id', user.id)
            .maybeSingle());
        } else {
          const { data: rows, error } = await supabase
            .from('university_setup_progress')
            .select('enabled_classes, university_id')
            .eq('is_setup_complete', true)
            .order('updated_at', { ascending: false })
            .limit(1);
          progress = rows?.[0] ?? null;
          progressError = error;
        }

        console.log('[useUniversityConfig] progress:', progress, 'progressError:', progressError);

        if (progress?.enabled_classes?.length) {
          setClasses(progress.enabled_classes);
        }
        // else keep ALL_CLASSES fallback so existing users aren't broken

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

  return { classes, periods, subjects, isLoading };
}
