(function () {
  const DYNAMIC_PROJECTS_KEY = 'portfolio_dynamic_projects';

  function safeParse(json) {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function loadProjects() {
    const raw = localStorage.getItem(DYNAMIC_PROJECTS_KEY);
    const parsed = safeParse(raw || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(value || '');
  }

  function initDynamicProjectPage() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || '';

    if (!id) {
      setText('dynamicProjectTitle', 'Project not found');
      setText('dynamicProjectMeta', 'Missing project id');
      return;
    }

    const projects = loadProjects();
    const project = projects[id];

    if (!project) {
      setText('dynamicProjectTitle', 'Project not found');
      setText('dynamicProjectMeta', 'This project id is not available');
      return;
    }

    document.title = `${project.title || 'Project'} — Details`;
    setText('dynamicProjectTitle', project.title || 'Project');
    setText('dynamicProjectMeta', `${project.tools || 'Tools'} • ${project.year || ''}`);

    setText('dynamicExplanation', project.explanation || `Add detailed explanation for ${project.title || 'this project'}.`);

    setText('dynamicReqHardware', project.requirements?.hardware || 'Add hardware requirements');
    setText('dynamicReqSoftware', project.requirements?.software || 'Add software requirements');
    setText('dynamicReqInputs', project.requirements?.inputs || 'Add input/configuration requirements');

    setText('dynamicOutcomeTechnical', project.outcome?.technical || 'Add technical outcome');
    setText('dynamicOutcomeImpact', project.outcome?.impact || 'Add impact outcome');
    setText('dynamicOutcomeFuture', project.outcome?.futureScope || 'Add future scope outcome');

    setText('dynamicScriptSnippet', project.scriptSnippet || `# ${project.title || 'Project'}\n# Add script steps here`);
    setText('dynamicImageNote', project.imageNote || `Add image file at: images/projects/${id}.jpg`);
    setText('dynamicVideoNote', project.videoNote || `Add video file at: videos/projects/${id}.mp4`);
  }

  initDynamicProjectPage();
})();
