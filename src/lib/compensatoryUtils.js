// Call after any timetable_change_log insert where a teacher loses a class.
// Always inserts as 'pending' — the timetable team selects a slot from the UI.

export async function createCompensatoryRequest(supabase, {
  changeLogId = null,
  teacherName,
  className,
  day,
  periodName,
}) {
  if (!teacherName || !className) return;
  await supabase.from('compensatory_requests').insert({
    teacher_name:         teacherName,
    original_class_name:  className,
    original_day:         day,
    original_period_name: periodName,
    source_change_log_id: changeLogId || null,
    status:               'pending',
  });
}
