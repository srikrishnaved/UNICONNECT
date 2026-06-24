const SEM_MAP  = { '1st Year': '1', '2nd Year': '3', '3rd Year': '5' };
const SPEC_MAP = { 'BCom IAF': 'IAF', 'BCom IBA': 'IBA', 'BCom F&A': 'F&A' };

export function computeClass(course, year) {
  const sem  = SEM_MAP[year];
  const spec = SPEC_MAP[course];
  if (!sem || !spec) return null;
  return `${sem}Bcom${spec}`;
}
