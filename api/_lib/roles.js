export const OFFICER_ROLES = [
  'Super Admin',
  'President',
  'Vice President',
  'Event Coordinator',
  'Technical Lead',
  'Research Lead',
  'Marketing Lead',
  'Secretary',
  'Treasurer'
];

const UPLOAD_PATH_PREFIX = 'public/assets/uploads/';
const UPLOAD_ROLES = ['President', 'Vice President', 'Marketing Lead', 'Event Coordinator'];

// Mirrors OfficerSessionService.canManage() in src/app/core/services/officer-session.service.ts.
// public/assets/data/officers.json is intentionally omitted here: it has no listed roles, so
// only the 'Super Admin' short-circuit in isAuthorizedForPath grants access to it.
const PATH_RULES = [
  { path: 'public/assets/data/officers.json', roles: [] },
  { path: 'public/assets/data/leadership.json', roles: ['President', 'Vice President'] },
  { path: 'public/assets/data/events.json', roles: ['President', 'Vice President', 'Event Coordinator', 'Research Lead'] },
  { path: 'public/assets/data/projects.json', roles: ['President', 'Vice President', 'Technical Lead', 'Research Lead'] },
  { path: 'public/assets/data/gallery.json', roles: ['President', 'Vice President', 'Marketing Lead', 'Event Coordinator'] },
  { path: 'public/assets/data/site-content.json', roles: OFFICER_ROLES }
];

export function isAuthorizedForPath(path, role) {
  if (role === 'Super Admin') return true;
  const rule = PATH_RULES.find((entry) => entry.path === path);
  if (rule) return rule.roles.includes(role);
  if (path.startsWith(UPLOAD_PATH_PREFIX)) return UPLOAD_ROLES.includes(role);
  return false;
}
