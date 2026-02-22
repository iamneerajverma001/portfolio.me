// Smooth scrolling and nav toggle
document.addEventListener('DOMContentLoaded', ()=>{
  const navLinksEl = document.getElementById('nav-links');
  const links = document.querySelectorAll('.nav-links a');
  const toggle = document.getElementById('nav-toggle');

  function stripInlineBackgroundDeclarations(styleValue){
    const raw = String(styleValue || '').trim();
    if(!raw) return '';

    const declarations = raw
      .split(';')
      .map((part)=>part.trim())
      .filter(Boolean);

    const kept = declarations.filter((declaration)=>{
      const prop = declaration.split(':')[0].trim().toLowerCase();
      return !(prop === 'background' || prop === 'background-color' || prop === 'background-image');
    });

    return kept.join('; ');
  }

  function normalizeResearchBackgroundArtifacts(){
    const research = document.getElementById('research');
    if(!research) return;

    const shouldSkipNode = (node)=>{
      if(!node || !node.classList) return false;
      if(node.classList.contains('timeline-support-badge')) return true;
      if(node.closest && node.closest('.timeline-support-badge')) return true;
      if(node.classList.contains('research-support-popup')) return true;
      if(node.closest && node.closest('.research-support-popup')) return true;
      return false;
    };

    const sanitizeNodeStyle = (node)=>{
      if(!node || !node.getAttribute || shouldSkipNode(node)) return;
      const styleAttr = node.getAttribute('style') || '';
      if(!styleAttr) return;

      const cleaned = stripInlineBackgroundDeclarations(styleAttr);
      if(cleaned === styleAttr.trim()) return;

      if(cleaned){
        node.setAttribute('style', cleaned);
      } else {
        node.removeAttribute('style');
      }
    };

    const sanitizeTree = (root)=>{
      if(!root || !root.querySelectorAll) return;
      sanitizeNodeStyle(root);
      root.querySelectorAll('[style]').forEach((node)=>sanitizeNodeStyle(node));
    };

    sanitizeTree(research);

    if(!research.dataset.bgObserverBound){
      let scheduled = false;
      const pendingNodes = new Set();

      const flushSanitization = ()=>{
        scheduled = false;
        pendingNodes.forEach((node)=>sanitizeTree(node));
        pendingNodes.clear();
      };

      const scheduleNode = (node)=>{
        if(!node || !node.nodeType || node.nodeType !== 1) return;
        pendingNodes.add(node);
        if(scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(flushSanitization);
      };

      const observer = new MutationObserver((mutations)=>{
        mutations.forEach((mutation)=>{
          if(mutation.type === 'attributes') {
            scheduleNode(mutation.target);
            return;
          }

          mutation.addedNodes.forEach((node)=>scheduleNode(node));
        });
      });

      observer.observe(research, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
      });

      research.dataset.bgObserverBound = 'true';
    }
  }

  // Helper to close mobile nav
  function closeNav(){
    navLinksEl.classList.remove('open');
    toggle.setAttribute('aria-expanded','false');
  }

  // Smooth scroll + set active
  links.forEach(a=>{
    a.addEventListener('click', (e)=>{
      e.preventDefault();
      links.forEach(x=>x.classList.remove('active'));
      a.classList.add('active');
      const target = document.querySelector(a.getAttribute('href'));
      if(target){
        target.scrollIntoView({behavior:'smooth',block:'start'});
      }
      // close mobile nav (if open)
      closeNav();
      // return focus to the link for accessibility
      a.focus({preventScroll:true});
    })
  });

  // Mobile toggle behavior with aria
  toggle.addEventListener('click', ()=>{
    const open = navLinksEl.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(open){
      // move focus into nav
      const first = navLinksEl.querySelector('a');
      if(first) first.focus();
    }
  })

  // Close nav with Escape key
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      closeNav();
      toggle.focus();
    }
  })

  // highlight on scroll (IntersectionObserver)
  const sections = document.querySelectorAll('main section');
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      const id = entry.target.id;
      const navA = document.querySelector('.nav-links a[href="#'+id+'"]');
      if(entry.isIntersecting){
        links.forEach(x=>x.classList.remove('active'));
        if(navA) navA.classList.add('active');
      }
    })
  },{threshold:0.5,rootMargin:'-10% 0% -40% 0%'});
  sections.forEach(s=>observer.observe(s));

  function resolveProjectHref(projectEl){
    const fromWrapper = projectEl.closest('.project-link');
    const href = ((fromWrapper && fromWrapper.getAttribute('href')) || (projectEl.getAttribute && projectEl.getAttribute('href')) || projectEl.getAttribute('data-project-href') || '').trim();
    if (href && href !== '#') return href;

    const title = (projectEl.querySelector('h3')?.textContent || '').toLowerCase();
    if (title.includes('fpga') || title.includes('2-bit cpu') || title.includes('2‑bit cpu')) return 'projects/fpga-learning-board.html';
    if (title.includes('citypulse') || title.includes('traffic intelligence')) return 'projects/citypulse-traffic-intelligence.html';
    if (title.includes('gram jyoti') || title.includes('renewable energy monitoring')) return 'projects/gram-jyoti-renewable-monitoring.html';
    if (title.includes('pragyan rover')) return 'projects/pragyan-rover.html';
    return '';
  }

  function remapProjectLinks(){
    document.querySelectorAll('.projects-grid .project-link').forEach((projectEl)=>{
      const fixedHref = resolveProjectHref(projectEl);
      if (fixedHref && projectEl.setAttribute) {
        projectEl.setAttribute('href', fixedHref);
        const card = projectEl.querySelector('.card');
        if (card) card.setAttribute('data-project-href', fixedHref);
      }
    });
  }

  function ensureFooterContactVisibility(){
    const footer = document.querySelector('.site-footer');
    if(!footer) return;

    const unhideSelectors = ['.contact-info', '.footer-cta', '.contact-actions', '.social'];
    unhideSelectors.forEach((selector)=>{
      footer.querySelectorAll(selector).forEach((node)=>{
        node.classList.remove('admin-section-hidden');
        if(!node.style) return;
        if(node.style.display === 'none') node.style.removeProperty('display');
        if(node.style.visibility === 'hidden') node.style.removeProperty('visibility');
        if(node.style.opacity === '0') node.style.removeProperty('opacity');
      });
    });

    const actions = footer.querySelector('.contact-actions');
    if(actions){
      const normalizeContactButton = (anchor, fallbackText)=>{
        if(!anchor) return;
        anchor.classList.add('btn', 'neutral', 'footer-btn');
        const plainText = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
        if(!plainText) anchor.textContent = fallbackText;
        anchor.style.setProperty('color', '#ffffff', 'important');
        anchor.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
        anchor.style.setProperty('background', 'rgba(255,255,255,0.2)', 'important');
        anchor.style.setProperty('border', '1px solid rgba(255,255,255,0.45)', 'important');
        anchor.style.setProperty('opacity', '1', 'important');
        anchor.style.setProperty('visibility', 'visible', 'important');
      };

      const hasMail = !!actions.querySelector('a[href^="mailto:"]');
      const hasTel = !!actions.querySelector('a[href^="tel:"]');

      if(!hasMail){
        const mail = document.createElement('a');
        mail.href = 'mailto:er_neerajverma@outlook.com';
        mail.className = 'btn neutral footer-btn';
        mail.textContent = 'Email Me';
        actions.appendChild(mail);
      }

      if(!hasTel){
        const phone = document.createElement('a');
        phone.href = 'tel:+919324140772';
        phone.className = 'btn neutral footer-btn';
        phone.textContent = 'Call Me';
        actions.appendChild(phone);
      }

      const mailAnchor = actions.querySelector('a[href^="mailto:"]');
      const telAnchor = actions.querySelector('a[href^="tel:"]');
      normalizeContactButton(mailAnchor, 'Email Me');
      normalizeContactButton(telAnchor, 'Call Me');
    }

    if(!footer.dataset.contactGuardBound){
      const observer = new MutationObserver(()=>{
        window.requestAnimationFrame(()=>{
          const guardFooter = document.querySelector('.site-footer');
          if(!guardFooter) return;

          const guardActions = guardFooter.querySelector('.contact-actions');
          if(!guardActions) return;

          const mailAnchor = guardActions.querySelector('a[href^="mailto:"]');
          const telAnchor = guardActions.querySelector('a[href^="tel:"]');
          if(mailAnchor){
            mailAnchor.classList.add('btn', 'neutral', 'footer-btn');
            if(!(mailAnchor.textContent || '').trim()) mailAnchor.textContent = 'Email Me';
          }
          if(telAnchor){
            telAnchor.classList.add('btn', 'neutral', 'footer-btn');
            if(!(telAnchor.textContent || '').trim()) telAnchor.textContent = 'Call Me';
          }
        });
      });

      observer.observe(footer, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
      footer.dataset.contactGuardBound = 'true';
    }
  }

  function isRemoveModeActive(){
    return !!document.querySelector('#admin-remove-item.active-remove');
  }

  function initMotionEnhancements(){
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(prefersReducedMotion) return;

    const revealTargets = Array.from(document.querySelectorAll(
      'main > section, .projects-grid .project-link, .skills-grid .skill, .timeline li, .footer-inner > *'
    ));

    if(!revealTargets.length) return;

    revealTargets.forEach((node)=>node.classList.add('motion-reveal'));

    const applyStagger = (selector, stepMs, maxDelayMs) => {
      const nodes = Array.from(document.querySelectorAll(selector));
      nodes.forEach((node, index) => {
        const delay = Math.min(index * stepMs, maxDelayMs);
        node.style.transitionDelay = `${delay}ms`;
      });
    };

    applyStagger('main > section', 40, 140);
    applyStagger('.projects-grid .project-link', 45, 180);
    applyStagger('.skills-grid .skill', 28, 200);
    applyStagger('.timeline li', 32, 220);
    applyStagger('.footer-inner > *', 60, 120);

    const revealObserver = new IntersectionObserver((entries, obs)=>{
      entries.forEach((entry)=>{
        if(!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        entry.target.style.transitionDelay = '0ms';
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

    revealTargets.forEach((node)=>revealObserver.observe(node));
  }

  normalizeResearchBackgroundArtifacts();
  initMotionEnhancements();
  ensureFooterContactVisibility();
  window.setTimeout(ensureFooterContactVisibility, 250);
  window.setTimeout(ensureFooterContactVisibility, 1200);
  window.addEventListener('load', ensureFooterContactVisibility, { once: true });

  remapProjectLinks();

  document.addEventListener('click', (e)=>{
    const projectEl = e.target.closest('.projects-grid .project-link, .projects-grid .card');
    if (!projectEl) return;
    if (e.target.closest('.admin-edit-project-btn')) return;
    if (document.documentElement.classList.contains('admin-mode') && isRemoveModeActive()) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const targetHref = resolveProjectHref(projectEl);
    if (!targetHref) return;

    e.preventDefault();
    e.stopPropagation();
    window.location.href = targetHref;
  }, true);
});