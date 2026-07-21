const OWNER = process.env.GITHUB_CMS_OWNER || 'sesha456';
const REPO = process.env.GITHUB_CMS_REPO || 'SSAI_Website';
const BRANCH = process.env.GITHUB_CMS_BRANCH || 'main';
const REGISTRY_PATH = 'public/assets/data/officers.json';

// Matches OfficerSessionService.defaultRegistry - lets the initial Super Admin log in
// before public/assets/data/officers.json has ever been published to GitHub.
const DEFAULT_REGISTRY = [
  { name: 'Sesha Siva Sankar', email: 'SeshaSivaSankar@my.unt.edu', role: 'Super Admin', active: true }
];

export async function findActiveOfficer(email) {
  const normalized = email.trim().toLowerCase();
  let registry = DEFAULT_REGISTRY;

  try {
    const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${REGISTRY_PATH}?t=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok) {
      const parsed = await response.json();
      if (Array.isArray(parsed) && parsed.length) registry = parsed;
    }
  } catch {
    // Network/parse failure - fall back to the default registry above.
  }

  const officer = registry.find((entry) =>
    entry?.active !== false && String(entry?.email || '').trim().toLowerCase() === normalized
  );
  return officer ? { name: officer.name, email: officer.email, role: officer.role } : null;
}
