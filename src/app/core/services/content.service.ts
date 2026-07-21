import { Injectable, inject, signal } from '@angular/core';
import { EventItem, GalleryCollection, GalleryItem, GalleryPhoto, PastEvent, ProjectItem, SiteContent, StatItem, TeamMember, Testimonial } from '../../shared/models/content.models';
import { GitHubCmsService } from './github-cms.service';
import { organizationAgeInfo } from '../utils/organization-age';

type EditablePublishState = 'pending' | 'published' | 'failed';
type EditableSection = 'team' | 'events' | 'projects' | 'galleryCollections' | 'siteContent';

interface EditableDataSnapshot {
  team: TeamMember[];
  events: EventItem[];
  projects: ProjectItem[];
  galleryCollections: GalleryCollection[];
  siteContent: SiteContent;
}

interface EditableCache extends EditableDataSnapshot {
  savedAt: number;
  publishState: EditablePublishState;
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly github = inject(GitHubCmsService);
  private readonly editableResetVersion = '2026-06-01-server-cms-reset';
  private readonly editableResetKey = 'ssai-editable-content-reset-version';
  private readonly editableStorageKey = 'ssai-editable-content';
  private readonly publishedCacheGraceMs = 30 * 60 * 1000;
  private readonly dirtySections = new Set<EditableSection>();
  private publishQueue = Promise.resolve();
  readonly version = signal(0);
  readonly saveMessage = signal('');
  readonly linkedInUrl = 'https://www.linkedin.com/company/society-for-student-ai-innovation/?viewAsMember=true';
  siteContent: SiteContent = {
    aboutHero: {
      eyebrow: 'About SSAI',
      title: 'An academic AI society for curious builders, researchers, and future leaders.',
      copy: 'SSAI was founded to give students a professional environment for exploring artificial intelligence beyond the classroom through research, technical projects, events, and interdisciplinary collaboration.'
    },
    aboutCards: [
      { title: 'Vision', copy: 'To become a recognized university hub where students shape trustworthy, useful, and creative AI systems.' },
      { title: 'Mission', copy: 'To empower students through AI education, research mentorship, applied projects, and professional exposure.' },
      { title: 'Objectives', copy: 'Host technical programs, support research groups, connect students with mentors, and showcase student innovation.' },
      { title: 'What SSAI Does', copy: 'SSAI runs workshops, hackathons, speaker sessions, project sprints, research meetups, and interdisciplinary collaborations.' }
    ],
    aboutFocus: {
      eyebrow: 'Focus Areas',
      title: 'From core AI foundations to emerging applied research.',
      areas: ['Artificial Intelligence', 'Machine Learning', 'Healthcare AI', 'Robotics', 'NLP', 'Computer Vision', 'Generative AI', 'AI Research']
    },
    aboutTimeline: {
      eyebrow: 'Milestones',
      title: 'A timeline designed for scale.',
      items: [
        { year: '2024', title: 'Founding Chapter', copy: 'Student founders organize the first AI learning circles and project teams.' },
        { year: '2025', title: 'Research Tracks', copy: 'Healthcare AI, RAG systems, robotics, and vision groups launch with faculty guidance.' },
        { year: '2026', title: 'Industry Portal', copy: 'SSAI expands public programming, partnerships, and project showcases for external collaborators.' }
      ]
    },
    eventsHero: {
      eyebrow: 'Events',
      title: 'Workshops, hackathons, conferences, meetups, and speaker sessions.',
      copy: 'Filter upcoming SSAI programming by format and find the next event that matches your goals.'
    },
    pastEventsHero: {
      eyebrow: 'Past Events',
      title: 'Conference recaps and signature SSAI programs.',
      copy: 'Explore previous SSAI events, speakers, highlights, student showcases, and networking activities.'
    },
    projectsHero: {
      eyebrow: 'Projects & Research',
      title: 'AI project showcases across health, language, agents, robotics, and discovery.',
      copy: 'Search by title, domain, technology, or contributor, then open a project for deeper details.'
    },
    leadershipHero: {
      eyebrow: 'Leadership Team',
      title: 'Faculty mentors, current officers, and SSAI leadership alumni.',
      copy: 'The SSAI leadership team coordinates programs, guides research teams, builds technical infrastructure, and keeps the community connected.'
    }
  };

  get stats(): StatItem[] {
    const age = organizationAgeInfo();
    return [
      { label: `Founded: ${age.foundedLabel}`, value: `Age: ${age.ageLabel}`, suffix: '' },
      { label: 'members', value: 50, suffix: '+' },
      { label: 'annual conference', value: 1, suffix: '' }
    ];
  }

  events: EventItem[] = [
    {
      id: 1,
      slug: 'applied-ai-research-night',
      title: 'Applied AI Research Night',
      tagline: 'Student research lightning talks',
      category: 'Research',
      status: 'Upcoming',
      eventType: 'Research Showcase',
      date: '2026-06-12',
      time: '5:30 PM',
      venue: 'Innovation Hall Auditorium',
      description: 'Lightning talks from student research teams working on healthcare AI, RAG systems, and multi-agent workflows.',
      image: 'linear-gradient(135deg, #45f0d1, #2563eb)',
      registrationLink: 'mailto:events@ssai.org?subject=Register%20for%20Applied%20AI%20Research%20Night',
      page: {
        about: 'Student research teams share concise demos, lessons learned, and next-step collaboration opportunities across healthcare AI, RAG systems, and multi-agent workflows.',
        highlights: [
          { icon: 'science', title: 'Research Lightning Talks', description: 'Fast-moving student presentations from active SSAI project teams.' },
          { icon: 'groups', title: 'Research Networking', description: 'Connect with peers looking for collaborators and mentors.' }
        ],
        speakers: [],
        gallery: [],
        sponsors: [],
        videos: [],
        customSections: []
      }
    },
    {
      id: 2,
      slug: 'generative-ai-build-workshop',
      title: 'Generative AI Build Workshop',
      tagline: 'Hands-on applied AI practice',
      category: 'Workshop',
      status: 'Upcoming',
      eventType: 'Workshop',
      date: '2026-06-20',
      time: '2:00 PM',
      venue: 'AI Lab 204',
      description: 'Hands-on session covering prompt design, retrieval pipelines, evaluation, and responsible deployment.',
      image: 'linear-gradient(135deg, #8b5cf6, #38bdf8)',
      registrationLink: 'mailto:events@ssai.org?subject=Register%20for%20Generative%20AI%20Build%20Workshop',
      page: {
        about: 'A practical workshop for building useful generative AI workflows, from prompt design through retrieval, evaluation, and deployment habits.',
        highlights: [],
        speakers: [],
        gallery: [],
        sponsors: [],
        videos: [],
        customSections: []
      }
    },
    {
      id: 3,
      slug: 'campus-ai-hackathon',
      title: 'Campus AI Hackathon',
      tagline: 'Prototype useful AI systems in one day',
      category: 'Competition',
      status: 'Upcoming',
      eventType: 'Hackathon',
      date: '2026-07-11',
      time: '9:00 AM',
      venue: 'Engineering Commons',
      description: 'A full-day competition for prototypes that solve research, campus, and community challenges with AI.',
      image: 'linear-gradient(135deg, #f8d36b, #ef476f)',
      registrationLink: 'mailto:events@ssai.org?subject=Register%20for%20Campus%20AI%20Hackathon',
      page: {
        about: 'A full-day build sprint for student teams creating AI prototypes for research, campus, and community challenges.',
        highlights: [],
        speakers: [],
        gallery: [],
        sponsors: [],
        videos: [],
        customSections: []
      }
    },
    {
      id: 4,
      slug: 'industry-ai-mixer',
      title: 'Industry AI Mixer',
      tagline: 'Meet builders, founders, and recruiters',
      category: 'Networking',
      status: 'Upcoming',
      eventType: 'Networking Event',
      date: '2026-07-25',
      time: '6:00 PM',
      venue: 'University Center',
      description: 'Meet AI engineers, founders, graduate researchers, and recruiters from applied AI teams.',
      image: 'linear-gradient(135deg, #14b8a6, #7c3aed)',
      registrationLink: 'mailto:events@ssai.org?subject=Register%20for%20Industry%20AI%20Mixer',
      page: {
        about: 'A networking evening for students to meet AI engineers, founders, researchers, and recruiters from applied AI teams.',
        highlights: [],
        speakers: [],
        gallery: [],
        sponsors: [],
        videos: [],
        customSections: []
      }
    },
    {
      id: 5,
      slug: 'gen-ai-hackathon',
      title: 'Gen AI Hackathon',
      tagline: 'Generative AI prototype sprint',
      category: 'Competition',
      status: 'Upcoming',
      eventType: 'Hackathon',
      date: '2026-07-09',
      time: '1:00pm to 4:00pm',
      venue: 'Gateway Center',
      description: 'Hello',
      image: 'linear-gradient(135deg, #45f0d1, #2563eb)',
      registrationLink: 'mailto:events@ssai.org?subject=Register%20for%20Gen%20AI%20Hackathon',
      page: {
        about: 'Hello',
        highlights: [],
        speakers: [],
        gallery: [],
        sponsors: [],
        videos: [],
        customSections: []
      }
    }
  ];

  readonly pastEvents: PastEvent[] = [
    {
      id: 1,
      slug: 'ai-horizons-2026',
      title: 'AI Horizons 2026 - AI Conference & Networking Event',
      tagline: 'Where Innovation Meets Opportunity',
      overview: 'A one-day AI conference organized by SSAI in collaboration with Swagath and GSC at the University of North Texas, bringing together industry professionals, researchers and students to explore the future of Artificial Intelligence.',
      date: '2026-04-25',
      time: '9:00 AM - 5:00 PM',
      venue: 'Gateway Center, Room 35, University of North Texas, Denton TX',
      organizedBy: 'SSAI (Society for Student AI Innovation) x Swagath x GSC',
      campus: 'University of North Texas',
      banner: 'linear-gradient(135deg, rgba(69, 240, 209, 0.95), rgba(56, 189, 248, 0.72) 42%, rgba(139, 92, 246, 0.92))',
      videoUrl: '/assets/media/ai-horizons-event-day.mp4',
      bannerVideoUrl: '/assets/media/ai-horizons-banner.mp4',
      stats: [
        { label: 'Speaker sessions', value: 7, suffix: '' },
        { label: 'Conference hours', value: 8, suffix: '' },
        { label: 'Awarded posters', value: 3, suffix: '' },
        { label: 'Partner organizations', value: 3, suffix: '' }
      ],
      highlights: [
        { icon: 'record_voice_over', title: '7 Industry Speaker Sessions', description: 'Sessions covering AI, Agentic Systems, Digital Marketing, Job Search, and more.' },
        { icon: 'workspace_premium', title: 'Poster Presentation Competition', description: 'Student research posters with awards for the top three presenters.' },
        { icon: 'groups', title: 'Student Organization Introductions', description: 'Campus groups introduced their missions, opportunities, and collaboration paths.' },
        { icon: 'forum', title: 'Panel Discussion', description: 'A moderated exchange on applied AI, career readiness, and responsible innovation.' },
        { icon: 'hub', title: 'Evening Networking Session', description: 'Students connected with professionals, founders, technologists, and researchers.' }
      ],
      speakers: [
        { name: 'Mariam Hency Varghese', designation: 'CDO (Fractional) & Founder', organization: 'Avodah', initials: 'MV', linkedin: 'https://linkedin.com/' },
        { name: 'Daniel Pulipati', designation: 'Mechanical Test Lead', organization: 'Shield AI', initials: 'DP', linkedin: 'https://linkedin.com/' },
        { name: 'Bakht Singh', designation: 'AI Engineer', organization: 'Independent AI Professional', initials: 'BS', linkedin: 'https://linkedin.com/' },
        { name: 'Joe Edwards', designation: 'CEO', organization: 'Tonic 3', initials: 'JE', linkedin: 'https://linkedin.com/' },
        { name: 'Noel Jerke', designation: 'Founder & CEO', organization: 'Power Digital Services', initials: 'NJ', linkedin: 'https://linkedin.com/' },
        { name: 'Vara Prasad Talari', designation: 'Principal Technologist', organization: 'AWS', initials: 'VT', linkedin: 'https://linkedin.com/' },
        { name: 'Rob Adams', designation: 'Consultant, Trainer & Founder', organization: 'Chai & Coaching', initials: 'RA', linkedin: 'https://linkedin.com/' }
      ],
      schedule: [
        { time: '9:00 AM', title: 'Registration and welcome breakfast' },
        { time: '10:00 AM', title: 'Industry speaker sessions' },
        { time: '12:30 PM', title: 'Poster presentation competition' },
        { time: '2:30 PM', title: 'Panel discussion and student organization introductions' },
        { time: '4:00 PM', title: 'Awards and evening networking' }
      ],
      gallery: [
        { title: 'Conference Stage', category: 'Event recap', image: 'linear-gradient(135deg, #45f0d1, #1d4ed8)' },
        { title: 'Poster Competition', category: 'Student research', image: 'linear-gradient(135deg, #f8d36b, #ef476f)' },
        { title: 'Networking Session', category: 'Community', image: 'linear-gradient(135deg, #8b5cf6, #14b8a6)' }
      ]
    }
  ];

  projects: ProjectItem[] = [
    {
      id: 1,
      title: 'Clinical Triage Assistant',
      domain: 'Healthcare AI',
      category: 'Healthcare AI',
      techStack: ['Python', 'Angular', 'TensorFlow', 'FHIR'],
      description: 'A decision-support prototype for summarizing patient intake signals and routing cases responsibly.',
      details: 'The project explores explainable triage recommendations, structured clinical data handling, and human-in-the-loop review for safer care workflows.',
      contributors: ['Aisha Patel', 'Noah Chen', 'Maya Rivera'],
      github: 'https://github.com/',
      demo: 'https://example.com/'
    },
    {
      id: 2,
      title: 'Research Paper RAG Navigator',
      domain: 'RAG Systems',
      category: 'RAG Systems',
      techStack: ['LangChain', 'TypeScript', 'Vector DB', 'OpenAI API'],
      description: 'A retrieval system that helps students explore literature, citations, and experiment notes.',
      details: 'Includes citation-aware chunking, source-grounded answers, evaluation rubrics, and a clean interface for research groups.',
      contributors: ['Elena Brooks', 'Sam Wilson'],
      github: 'https://github.com/',
      demo: 'https://example.com/'
    },
    {
      id: 3,
      title: 'Autonomous Lab Rover',
      domain: 'Robotics',
      category: 'Robotics',
      techStack: ['ROS2', 'OpenCV', 'PyTorch', 'Jetson'],
      description: 'A small robotics platform for navigation, object detection, and lab inventory experiments.',
      details: 'The rover combines visual perception with path planning and is designed as a reusable teaching platform for robotics teams.',
      contributors: ['Jordan Kim', 'Priya Shah', 'Luis Gomez'],
      github: 'https://github.com/',
      demo: 'https://example.com/'
    },
    {
      id: 4,
      title: 'Molecular Candidate Ranker',
      domain: 'Drug Discovery',
      category: 'Drug Discovery',
      techStack: ['RDKit', 'Graph Neural Nets', 'FastAPI'],
      description: 'A graph-model experiment for ranking candidate molecules against target properties.',
      details: 'Students compare graph featurization strategies, uncertainty estimates, and screening workflows for early discovery research.',
      contributors: ['Nina Rao', 'Owen Lee'],
      github: 'https://github.com/',
      demo: 'https://example.com/'
    },
    {
      id: 5,
      title: 'Campus Vision Safety Monitor',
      domain: 'Computer Vision',
      category: 'Computer Vision',
      techStack: ['YOLO', 'OpenCV', 'Edge AI'],
      description: 'An edge-computing prototype for privacy-preserving occupancy and safety alerts.',
      details: 'The design uses anonymized scene understanding and local inference to explore responsible public-space sensing.',
      contributors: ['Fatima Noor', 'Ryan Clark'],
      github: 'https://github.com/',
      demo: 'https://example.com/'
    },
    {
      id: 6,
      title: 'Multi-Agent Study Planner',
      domain: 'AI Agents',
      category: 'AI Agents',
      techStack: ['TypeScript', 'Agent Graphs', 'Firebase'],
      description: 'A collaborative planning assistant that decomposes coursework goals into adaptive study workflows.',
      details: 'The project tests planning agents, calendar constraints, reflection loops, and student-controlled personalization.',
      contributors: ['Grace Hall', 'Ibrahim Khan'],
      github: 'https://github.com/',
      demo: 'https://example.com/'
    }
  ];

  team: TeamMember[] = [
    { name: 'Dr. Mira Collins', role: 'Faculty Mentor', group: 'Faculty Mentors', bio: 'Supports ethical AI research, grant alignment, and academic mentorship.', image: 'MC', linkedin: 'https://linkedin.com/', github: '', type: 'faculty', department: 'Computer Science and Engineering', website: 'https://example.com/' },
    { name: 'Aarav Mehta', role: 'President', group: 'President', bio: 'Leads SSAI strategy, partnerships, and cross-disciplinary AI initiatives.', image: 'AM', linkedin: 'https://linkedin.com/', github: 'https://github.com/', type: 'officer', isCurrent: true, yearsServed: '2025 - Present' },
    { name: 'Sophia Nguyen', role: 'Vice President', group: 'Vice President', bio: 'Coordinates organization operations, chapter programs, and member success.', image: 'SN', linkedin: 'https://linkedin.com/', github: 'https://github.com/', type: 'officer', isCurrent: true, yearsServed: '2025 - Present' },
    { name: 'Marcus Reed', role: 'Event Coordinator', group: 'Event Coordinators', bio: 'Designs workshops, speaker sessions, and conference-style experiences.', image: 'MR', linkedin: 'https://linkedin.com/', github: 'https://github.com/', type: 'officer', isCurrent: true, yearsServed: '2025 - Present' },
    { name: 'Leah Ortiz', role: 'Technical Lead', group: 'Technical Leads', bio: 'Mentors project teams in software architecture, MLOps, and deployment.', image: 'LO', linkedin: 'https://linkedin.com/', github: 'https://github.com/', type: 'officer', isCurrent: false, yearsServed: '2024 - 2025' },
    { name: 'Dev Shah', role: 'Research Lead', group: 'Research Leads', bio: 'Guides literature review, reproducible experiments, and publication readiness.', image: 'DS', linkedin: 'https://linkedin.com/', github: 'https://github.com/', type: 'officer', isCurrent: false, yearsServed: '2024 - 2025' }
  ];

  readonly gallery: GalleryItem[] = [
    { title: 'AI Research Showcase', category: 'Event photos', image: 'linear-gradient(135deg, #45f0d1, #0f172a)' },
    { title: 'Hackathon Poster', category: 'Posters', image: 'linear-gradient(135deg, #8b5cf6, #111827)' },
    { title: 'Workshop Lab', category: 'Workshops', image: 'linear-gradient(135deg, #38bdf8, #1f2937)' },
    { title: 'Robotics Demo', category: 'Research activities', image: 'linear-gradient(135deg, #f8d36b, #0f766e)' },
    { title: 'Speaker Session', category: 'Event photos', image: 'linear-gradient(135deg, #ef476f, #312e81)' },
    { title: 'Project Sprint', category: 'Workshops', image: 'linear-gradient(135deg, #14b8a6, #7c3aed)' }
  ];

  galleryCollections: GalleryCollection[] = [
    {
      id: 1,
      title: 'AI Horizons 2026',
      eventDate: '2026-04-25',
      coverImage: 'linear-gradient(135deg, #45f0d1, #2563eb)',
      description: 'Conference photos, research showcases, and networking moments from AI Horizons 2026.',
      photos: [
        { title: 'Conference Stage', image: 'linear-gradient(135deg, #45f0d1, #1d4ed8)' },
        { title: 'Poster Competition', image: 'linear-gradient(135deg, #f8d36b, #ef476f)' },
        { title: 'Networking Session', image: 'linear-gradient(135deg, #8b5cf6, #14b8a6)' }
      ]
    }
  ];

  readonly testimonials: Testimonial[] = [
    { quote: 'SSAI helped me move from curiosity to publishable AI research with a team that cared about rigor.', name: 'Priya S.', role: 'Research Member' },
    { quote: 'The workshops feel like a bridge between class theory and industry-ready engineering practice.', name: 'Daniel K.', role: 'ML Intern' },
    { quote: 'It is one of the strongest student communities for thoughtful, applied AI collaboration.', name: 'Dr. Lena Morris', role: 'Faculty Advisor' }
  ];

  readonly faqs = [
    { question: 'Who can join SSAI?', answer: 'Students from any major who are interested in AI research, software, ethics, design, robotics, or outreach are welcome.' },
    { question: 'Do I need AI experience?', answer: 'No. SSAI supports beginners through workshops while also offering advanced research and project tracks.' },
    { question: 'Can industry partners collaborate?', answer: 'Yes. Partners can support speaker sessions, projects, mentorship, sponsorships, and internships.' }
  ];

  constructor() {
    void this.loadEditableData();
  }

  addTeamMember(member: TeamMember): void {
    this.team = [...this.team, member];
    this.markSaved('team');
  }

  updateTeamMember(index: number, member: TeamMember): void {
    this.team = this.team.map((item, itemIndex) => itemIndex === index ? member : item);
    this.markSaved('team');
  }

  deleteTeamMember(index: number): void {
    this.team = this.team.filter((_, itemIndex) => itemIndex !== index);
    this.markSaved('team');
  }

  toggleOfficerStatus(index: number): void {
    this.team = this.team.map((member, itemIndex) => itemIndex === index ? {
      ...member,
      type: 'officer',
      isCurrent: !(member.isCurrent ?? true)
    } : member);
    this.markSaved('team');
  }

  addEvent(event: EventItem): void {
    const id = this.nextId(this.events);
    this.events = [...this.events, this.normalizeEvent({ ...event, id })];
    this.markSaved('events');
  }

  updateEvent(id: number, event: EventItem): void {
    this.events = this.events.map((item) => item.id === id ? this.normalizeEvent({ ...event, id }) : item);
    this.markSaved('events');
  }

  updateEventPage(id: number, page: NonNullable<EventItem['page']>): void {
    this.events = this.events.map((event) => event.id === id ? { ...event, page } : event);
    this.markSaved('events');
  }

  deleteEvent(id: number): void {
    this.events = this.events.filter((item) => item.id !== id);
    this.markSaved('events');
  }

  addProject(project: ProjectItem): void {
    this.projects = [...this.projects, { ...project, id: this.nextId(this.projects) }];
    this.markSaved('projects');
  }

  updateProject(id: number, project: ProjectItem): void {
    this.projects = this.projects.map((item) => item.id === id ? { ...project, id } : item);
    this.markSaved('projects');
  }

  deleteProject(id: number): void {
    this.projects = this.projects.filter((item) => item.id !== id);
    this.markSaved('projects');
  }

  addGallery(collection: GalleryCollection): void {
    this.galleryCollections = [...this.galleryCollections, { ...collection, id: this.nextId(this.galleryCollections), photos: collection.photos ?? [] }];
    this.markSaved('galleryCollections');
  }

  updateGallery(id: number, collection: GalleryCollection): void {
    this.galleryCollections = this.galleryCollections.map((item) => item.id === id ? { ...collection, id } : item);
    this.markSaved('galleryCollections');
  }

  deleteGallery(id: number): void {
    this.galleryCollections = this.galleryCollections.filter((item) => item.id !== id);
    this.markSaved('galleryCollections');
  }

  addGalleryPhotos(id: number, photos: GalleryPhoto[]): void {
    this.galleryCollections = this.galleryCollections.map((item) => item.id === id ? { ...item, photos: [...item.photos, ...photos] } : item);
    this.markSaved('galleryCollections');
  }

  deleteGalleryPhoto(id: number, index: number): void {
    this.galleryCollections = this.galleryCollections.map((item) => item.id === id ? { ...item, photos: item.photos.filter((_, photoIndex) => photoIndex !== index) } : item);
    this.markSaved('galleryCollections');
  }

  moveGalleryPhoto(id: number, index: number, direction: number): void {
    this.galleryCollections = this.galleryCollections.map((item) => {
      if (item.id !== id) return item;
      const photos = [...item.photos];
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= photos.length) return item;
      [photos[index], photos[nextIndex]] = [photos[nextIndex], photos[index]];
      return { ...item, photos };
    });
    this.markSaved('galleryCollections');
  }

  exportJson(filename: string, data: unknown): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  clearEditableCache(): void {
    localStorage.removeItem(this.editableStorageKey);
    localStorage.setItem(this.editableResetKey, this.editableResetVersion);
    this.saveMessage.set('CMS editable content cache cleared. Refresh the page to reload clean data.');
  }

  private async loadEditableData(): Promise<void> {
    const localCache = this.readStoredEditableData();
    const [team, events, projects, galleries, siteContent] = await Promise.all([
      this.fetchJson<TeamMember[]>('/assets/data/leadership.json'),
      this.fetchJson<EventItem[]>('/assets/data/events.json'),
      this.fetchJson<ProjectItem[]>('/assets/data/projects.json'),
      this.fetchJson<GalleryCollection[]>('/assets/data/gallery.json'),
      this.fetchJson<SiteContent>('/assets/data/site-content.json')
    ]);

    let loadedLiveData = false;
    if (team) {
      this.team = team.map((member) => this.normalizeTeamMember(member));
      loadedLiveData = true;
    }
    if (events) {
      this.events = events.map((event) => this.normalizeEvent(event));
      loadedLiveData = true;
    }
    if (projects) {
      this.projects = projects;
      loadedLiveData = true;
    }
    if (galleries) {
      this.galleryCollections = galleries;
      loadedLiveData = true;
    }
    if (siteContent) {
      this.siteContent = this.mergeSiteContent(siteContent);
      loadedLiveData = true;
    }
    if (localCache && (!loadedLiveData || this.shouldPreferLocalCache(localCache))) {
      this.applyEditableData(localCache);
      this.saveMessage.set('Using this browser backup because live CMS data could not be loaded.');
      if (loadedLiveData) {
        this.saveMessage.set(localCache.publishState === 'published'
          ? 'Showing your latest browser copy while GitHub content catches up.'
          : 'Showing your saved browser copy. Public CMS publish is still pending or failed.');
      }
    }
    this.version.update((value) => value + 1);
  }

  private loadStoredEditableData(): boolean {
    const stored = this.readStoredEditableData();
    if (!stored) return false;
    this.applyEditableData(stored);
    this.version.update((value) => value + 1);
    return true;
  }

  private readStoredEditableData(): EditableCache | null {
    try {
      if (localStorage.getItem(this.editableResetKey) !== this.editableResetVersion) {
        localStorage.removeItem(this.editableStorageKey);
        localStorage.setItem(this.editableResetKey, this.editableResetVersion);
        return null;
      }
      const stored = JSON.parse(localStorage.getItem(this.editableStorageKey) || 'null') as Partial<EditableCache> | null;
      if (!stored) return null;
      if (!stored.team && !stored.events && !stored.projects && !stored.galleryCollections && !stored.siteContent) return null;
      return {
        team: stored.team ?? this.team,
        events: stored.events ?? this.events,
        projects: stored.projects ?? this.projects,
        galleryCollections: stored.galleryCollections ?? this.galleryCollections,
        siteContent: stored.siteContent ? this.mergeSiteContent(stored.siteContent) : this.siteContent,
        savedAt: stored.savedAt ?? 0,
        publishState: stored.publishState ?? 'failed'
      };
    } catch {
      localStorage.removeItem(this.editableStorageKey);
      return null;
    }
  }

  private applyEditableData(stored: EditableDataSnapshot): void {
    this.team = stored.team.map((member) => this.normalizeTeamMember(member));
    this.events = stored.events.map((event) => this.normalizeEvent(event));
    this.projects = stored.projects;
    this.galleryCollections = stored.galleryCollections;
    this.siteContent = this.mergeSiteContent(stored.siteContent);
  }

  private shouldPreferLocalCache(cache: EditableCache): boolean {
    if (cache.publishState !== 'published') return true;
    return Date.now() - cache.savedAt < this.publishedCacheGraceMs && this.hasLocalDifferences(cache);
  }

  private hasLocalDifferences(cache: EditableDataSnapshot): boolean {
    return JSON.stringify(this.editableSnapshot(cache)) !== JSON.stringify(this.editableSnapshot(this.currentEditableData()));
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(this.liveContentUrl(url), { cache: 'no-store' });
      if (response.ok) return await response.json() as T;
      const fallback = await fetch(url, { cache: 'no-store' });
      return fallback.ok ? await fallback.json() as T : null;
    } catch {
      try {
        const fallback = await fetch(url, { cache: 'no-store' });
        return fallback.ok ? await fallback.json() as T : null;
      } catch {
        return null;
      }
    }
  }

  private liveContentUrl(url: string): string {
    if (!url.startsWith('/assets/data/')) return url;
    return `https://raw.githubusercontent.com/sesha456/SSAI_Website/main/public${url}?t=${Date.now()}`;
  }

  private nextId(items: Array<{ id: number }>): number {
    return Math.max(0, ...items.map((item) => item.id)) + 1;
  }

  private normalizeTeamMember(member: TeamMember): TeamMember {
    const type = member.type ?? (member.role.toLowerCase().includes('faculty') ? 'faculty' : 'officer');
    return {
      ...member,
      type,
      isCurrent: type === 'faculty' ? undefined : member.isCurrent ?? true,
      yearsServed: type === 'faculty' ? member.yearsServed : member.yearsServed ?? '2025 - Present',
      group: member.group || member.role
    };
  }

  private normalizeEvent(event: EventItem): EventItem {
    const eventType = event.eventType || this.inferEventType(event);
    return {
      ...event,
      status: event.status || this.inferStatus(event.date),
      eventType,
      slug: event.slug || this.slugify(event.title),
      registrationLink: event.registrationLink || `mailto:events@ssai.org?subject=Register%20for%20${encodeURIComponent(event.title)}`,
      page: {
        about: event.page?.about || event.description,
        highlights: event.page?.highlights ?? event.highlights?.map((title) => ({ icon: 'stars', title, description: '' })) ?? [],
        speakers: event.page?.speakers ?? event.speakers?.map((name) => ({ name, designation: '', organization: '', bio: '', image: this.initials(name), linkedin: '' })) ?? [],
        gallery: event.page?.gallery ?? [],
        sponsors: event.page?.sponsors ?? [],
        videos: event.page?.videos ?? [],
        customSections: event.page?.customSections ?? [],
        sectionOrder: event.page?.sectionOrder ?? this.defaultSectionOrder(eventType),
        enabledSections: { ...this.defaultEnabledSections(eventType), ...(event.page?.enabledSections ?? {}) }
      }
    };
  }

  private inferStatus(date: string): EventItem['status'] {
    const eventTime = new Date(`${date}T23:59:59`).getTime();
    return Number.isFinite(eventTime) && eventTime < Date.now() ? 'Past' : 'Upcoming';
  }

  private inferEventType(event: EventItem): NonNullable<EventItem['eventType']> {
    if (event.category === 'Workshop') return 'Workshop';
    if (event.category === 'Competition') return event.title.toLowerCase().includes('hackathon') ? 'Hackathon' : 'Competition';
    if (event.category === 'Networking') return 'Networking Event';
    if (event.category === 'Research') return 'Research Showcase';
    return 'Custom Event';
  }

  private defaultSectionOrder(eventType: NonNullable<EventItem['eventType']>): NonNullable<EventItem['page']>['sectionOrder'] {
    const map: Record<NonNullable<EventItem['eventType']>, string[]> = {
      Conference: ['about', 'highlights', 'speakers', 'agenda', 'sponsors', 'gallery', 'videos', 'registration'],
      Workshop: ['about', 'instructors', 'learningOutcomes', 'resources', 'gallery', 'registration'],
      Seminar: ['about', 'speakers', 'gallery'],
      'Guest Lecture': ['about', 'speakers', 'gallery', 'registration'],
      'Research Showcase': ['about', 'posters', 'presenters', 'awards', 'gallery'],
      Hackathon: ['about', 'tracks', 'rules', 'judges', 'prizes', 'sponsors', 'registration', 'gallery'],
      'Networking Event': ['about', 'highlights', 'speakers', 'gallery', 'registration'],
      Webinar: ['about', 'speakers', 'resources', 'videos', 'registration'],
      Competition: ['about', 'rules', 'judges', 'prizes', 'sponsors', 'gallery', 'registration'],
      'Custom Event': ['about', 'highlights', 'speakers', 'gallery', 'customSections']
    };
    return map[eventType];
  }

  private defaultEnabledSections(eventType: NonNullable<EventItem['eventType']>): NonNullable<EventItem['page']>['enabledSections'] {
    return Object.fromEntries((this.defaultSectionOrder(eventType) ?? []).map((section) => [section, true])) as NonNullable<EventItem['page']>['enabledSections'];
  }

  private slugify(value: string): string {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `event-${Date.now()}`;
  }

  private initials(value: string): string {
    return value.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }

  private markSaved(sections: EditableSection | EditableSection[]): void {
    (Array.isArray(sections) ? sections : [sections]).forEach((section) => this.dirtySections.add(section));
    this.saveMessage.set('Saving changes to the public CMS...');
    this.version.update((value) => value + 1);
    this.publishQueue = this.publishQueue
      .then(() => this.persistEditableData())
      .catch(() => undefined);
  }

  updateSiteContent(next: SiteContent): void {
    this.siteContent = this.mergeSiteContent(next);
    this.markSaved('siteContent');
  }

  updateHero(key: 'eventsHero' | 'pastEventsHero' | 'projectsHero' | 'leadershipHero', value: SiteContent[typeof key]): void {
    this.siteContent = { ...this.siteContent, [key]: value };
    this.markSaved('siteContent');
  }

  private async persistEditableData(): Promise<void> {
    const data = this.currentEditableData();
    const sections = this.consumeDirtySections();
    this.writeStoredEditableData(data, 'pending');
    try {
      await Promise.all(this.publishTasks(sections));
      this.writeStoredEditableData(data, 'published');
      this.saveMessage.set('Changes published. Refresh another device to see the update.');
    } catch (error) {
      console.error('CMS publish failed', error);
      this.writeStoredEditableData(data, 'failed');
      this.saveMessage.set(`Saved only on this browser. Public CMS publish failed: ${this.errorMessage(error)}`);
    }
  }

  private consumeDirtySections(): Set<EditableSection> {
    const sections = new Set(this.dirtySections);
    this.dirtySections.clear();
    if (sections.size) return sections;
    return new Set<EditableSection>(['team', 'events', 'projects', 'galleryCollections', 'siteContent']);
  }

  private publishTasks(sections: Set<EditableSection>): Array<Promise<void>> {
    const tasks: Array<Promise<void>> = [];
    if (sections.has('team')) tasks.push(this.github.saveJson('public/assets/data/leadership.json', this.team));
    if (sections.has('events')) tasks.push(this.github.saveJson('public/assets/data/events.json', this.events));
    if (sections.has('projects')) tasks.push(this.github.saveJson('public/assets/data/projects.json', this.projects));
    if (sections.has('galleryCollections')) tasks.push(this.github.saveJson('public/assets/data/gallery.json', this.galleryCollections));
    if (sections.has('siteContent')) tasks.push(this.github.saveJson('public/assets/data/site-content.json', this.siteContent));
    return tasks;
  }

  private currentEditableData(): EditableDataSnapshot {
    return {
      team: this.team,
      events: this.events,
      projects: this.projects,
      galleryCollections: this.galleryCollections,
      siteContent: this.siteContent
    };
  }

  private writeStoredEditableData(data: EditableDataSnapshot, publishState: EditablePublishState): void {
    localStorage.setItem(this.editableStorageKey, JSON.stringify({
      ...data,
      savedAt: Date.now(),
      publishState
    } satisfies EditableCache));
  }

  private editableSnapshot(data: EditableDataSnapshot): EditableDataSnapshot {
    return {
      team: data.team,
      events: data.events.map((event) => this.normalizeEvent(event)),
      projects: data.projects,
      galleryCollections: data.galleryCollections,
      siteContent: this.mergeSiteContent(data.siteContent)
    };
  }

  private mergeSiteContent(value: Partial<SiteContent>): SiteContent {
    return {
      ...this.siteContent,
      ...value,
      aboutHero: { ...this.siteContent.aboutHero, ...value.aboutHero },
      aboutFocus: { ...this.siteContent.aboutFocus, ...value.aboutFocus },
      aboutTimeline: { ...this.siteContent.aboutTimeline, ...value.aboutTimeline },
      eventsHero: { ...this.siteContent.eventsHero, ...value.eventsHero },
      pastEventsHero: { ...this.siteContent.pastEventsHero, ...value.pastEventsHero },
      projectsHero: { ...this.siteContent.projectsHero, ...value.projectsHero },
      leadershipHero: { ...this.siteContent.leadershipHero, ...value.leadershipHero },
      aboutCards: value.aboutCards ?? this.siteContent.aboutCards
    };
  }

  private errorMessage(error: unknown): string {
    if (!(error instanceof Error) || !error.message) {
      return 'check GitHub CMS/Vercel token settings.';
    }
    if (error.message.includes('expected') && error.message.includes('but expected')) {
      return 'GitHub had a newer copy of the file. Your change is saved in this browser; edit/save once more to publish it.';
    }
    return error.message;
  }
}
