// =============================================
// NAV: scroll → hamburger
// =============================================
const navbar    = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('nav-links');

window.addEventListener('scroll', () => {
  const scrolled = window.scrollY > 80;
  navbar.classList.toggle('scrolled', scrolled);
  if (!scrolled) {
    navLinks.classList.remove('open');
    hamburger.classList.remove('open');
  }
});

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  hamburger.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.classList.remove('open');
  });
});

// =============================================
// HERO PARTICLE NETWORK
// =============================================
(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  const COUNT  = 60;
  const REACH  = 130;
  const GOLD   = '201, 168, 76';
  let particles = [];

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function makeParticle() {
    return {
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      r:  Math.random() * 1.4 + 0.5,
    };
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${GOLD}, 0.55)`;
      ctx.fill();
    }

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < REACH) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${GOLD}, ${(1 - d / REACH) * 0.18})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  resize();
  particles = Array.from({ length: COUNT }, makeParticle);
  tick();
})();

// =============================================
// SCROLL REVEAL (with grid stagger)
// =============================================
(function () {
  const targets = document.querySelectorAll([
    '.section-header',
    '.pillar-card', '.trio-card', '.phase-card',
    '.team-card', '.blog-card', '.milestone-item',
    '.df-flow-step', '.df-matters-card', '.df-closing',
    '.report-item', '.glossary-item', '.pmr-card',
    '.tech-stack-wrap',
  ].join(','));

  targets.forEach(el => {
    el.classList.add('reveal');
    // Stagger siblings inside a shared grid/list parent
    const siblings = [...el.parentElement.querySelectorAll(':scope > .reveal')];
    const idx = siblings.indexOf(el);
    if (idx > 0) el.style.transitionDelay = `${Math.min(idx, 6) * 0.08}s`;
  });

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -28px 0px' });

  targets.forEach(el => obs.observe(el));
})();

// =============================================
// ANIMATED STAT COUNTERS
// =============================================
(function () {
  const els = document.querySelectorAll('.stat-number');

  // Parse text → numeric value + suffix ("+", "%", etc.)
  els.forEach(el => {
    const raw    = el.textContent.trim();
    const suffix = raw.replace(/[\d.]/g, '');
    const value  = parseFloat(raw);
    el.dataset.target = value;
    el.dataset.suffix = suffix;
    el.textContent = '0' + suffix;
  });

  function run(el) {
    const target   = parseFloat(el.dataset.target);
    const suffix   = el.dataset.suffix || '';
    const duration = 1500;
    const start    = performance.now();

    function step(now) {
      const t      = Math.min((now - start) / duration, 1);
      const eased  = 1 - Math.pow(1 - t, 3);       // ease-out cubic
      el.textContent = Math.round(eased * target) + suffix;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        el.classList.add('done');
      }
    }
    requestAnimationFrame(step);
  }

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        run(e.target);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });

  els.forEach(el => obs.observe(el));
})();

// =============================================
// TECH STACK BADGE MODAL
// =============================================
(function () {
  const TOOLS = {
    'AFSIM': {
      icon: '🎯',
      desc: 'Advanced Framework for Simulation, Integration, and Modeling (AFSIM) is a DoD simulation environment developed by the Air Force Research Laboratory. It enables analysts and engineers to model, simulate, and analyze complex warfare scenarios across air, land, sea, space, and cyber domains.',
      url: 'https://dsiac.dtic.mil/models/afsim/',
      urlLabel: 'Learn more at dsiac.dtic.mil',
    },
    'Argo Workflows': {
      icon: '⚙️',
      desc: 'Argo Workflows is a Kubernetes-native workflow engine for orchestrating parallel jobs. It allows teams to define and run complex data pipelines, CI/CD flows, and ML workloads as directed acyclic graphs (DAGs) directly on Kubernetes clusters.',
      url: 'https://argoproj.github.io/workflows/',
      urlLabel: 'Learn more at argoproj.github.io',
    },
    'Cameo Systems Modeler': {
      icon: '🗂️',
      desc: 'Cameo Systems Modeler (by Dassault Systèmes No Magic) is the leading Model-Based Systems Engineering (MBSE) tool. It supports SysML and UML for designing complex systems, enabling CIM-ARC teams to capture architecture, requirements, and behavior in a single integrated model.',
      url: 'https://www.3ds.com/products/catia/no-magic/cameo-systems-modeler',
      urlLabel: 'Learn more at 3ds.com',
    },
    'neo4j': {
      icon: '🕸️',
      desc: 'Neo4j is the world\'s leading graph database. It stores data as nodes and relationships rather than rows and tables, making it ideal for representing complex, highly connected data such as system dependencies, entity networks, and knowledge graphs used across the data fabric.',
      url: 'https://neo4j.com',
      urlLabel: 'Learn more at neo4j.com',
    },
    'OpenSearch': {
      icon: '🔍',
      desc: 'OpenSearch is an open-source search and analytics engine (a community-driven fork of Elasticsearch) maintained by AWS. It powers full-text search, log analytics, and security monitoring, enabling fast discovery and observability across integrated data sources.',
      url: 'https://opensearch.org',
      urlLabel: 'Learn more at opensearch.org',
    },
    'Pydantic': {
      icon: '🐍',
      desc: 'Pydantic is a Python library for data validation and settings management using type annotations. It enforces data schemas at runtime, ensuring that data flowing between services and APIs conforms to expected structures — critical for reliable data fabric pipelines.',
      url: 'https://docs.pydantic.dev',
      urlLabel: 'Learn more at docs.pydantic.dev',
    },
    'Apache Spark': {
      icon: '⚡',
      desc: 'Apache Spark is a unified, open-source analytics engine for large-scale data processing. It supports batch processing, streaming, machine learning, and graph analytics, enabling the data fabric to transform and analyze massive datasets across distributed compute clusters.',
      url: 'https://spark.apache.org',
      urlLabel: 'Learn more at spark.apache.org',
    },
    'Azure Data Lake': {
      icon: '☁️',
      desc: 'Azure Data Lake Storage is Microsoft\'s massively scalable, cloud-native data lake for analytics workloads. It provides a hierarchical file system optimized for big data pipelines, supporting IC and DoD cloud environments including Azure Government and Azure Secret Cloud.',
      url: 'https://azure.microsoft.com/en-us/solutions/data-lake/',
      urlLabel: 'Learn more at azure.microsoft.com',
    },
    'LAVA': {
      icon: '🔒',
      desc: 'LAVA is the classified network infrastructure that hosts the initial CIM-ARC environment. It provides a secure, high-side compute and networking foundation for integrated IC and DoD data, with plans to migrate expanded capabilities to Microsoft Azure Secret Cloud.',
      url: null,
    },
    'Open Metadata': {
      icon: '🗄️',
      desc: 'OpenMetadata is an open-source metadata management platform for data discovery, observability, and governance. It provides a unified catalog of data assets — tables, pipelines, dashboards, and services — enabling teams to understand, trust, and govern data across the entire fabric.',
      url: 'https://open-metadata.org',
      urlLabel: 'Learn more at open-metadata.org',
    },
    'PostgreSQL': {
      icon: '🐘',
      desc: 'PostgreSQL is a powerful, open-source relational database renowned for its reliability, feature richness, and extensibility. It serves as a transactional backbone for structured data within the data fabric, supporting complex queries, JSONB documents, and enterprise-grade data integrity.',
      url: 'https://www.postgresql.org',
      urlLabel: 'Learn more at postgresql.org',
    },
  };

  const overlay  = document.getElementById('tool-modal');
  const closeBtn = document.getElementById('tool-modal-close');
  const iconEl   = document.getElementById('tool-modal-icon');
  const titleEl  = document.getElementById('tool-modal-title');
  const descEl   = document.getElementById('tool-modal-desc');
  const linkEl   = document.getElementById('tool-modal-link');

  if (!overlay) return;

  function openModal(key) {
    const data = TOOLS[key];
    if (!data) return;
    iconEl.textContent  = data.icon;
    titleEl.textContent = key;
    descEl.textContent  = data.desc;
    if (data.url) {
      linkEl.href        = data.url;
      linkEl.textContent = (data.urlLabel || 'Learn more') + ' →';
      linkEl.removeAttribute('hidden');
    } else {
      linkEl.setAttribute('hidden', '');
    }
    overlay.removeAttribute('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
    closeBtn.focus();
  }

  function closeModal() {
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.setAttribute('hidden', ''), { once: true });
  }

  document.querySelectorAll('.tech-stack-badge[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.tool));
  });

  closeBtn.addEventListener('click', closeModal);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) closeModal();
  });
})();

// =============================================
// DF FLOW STEP MODAL
// =============================================
(function () {
  const overlay   = document.getElementById('flow-modal');
  const closeBtn  = document.getElementById('flow-modal-close');
  const imgEl     = document.getElementById('flow-modal-img');
  const badgeEl   = document.getElementById('flow-modal-badge');
  const titleEl   = document.getElementById('flow-modal-title');
  const listEl    = document.getElementById('flow-modal-list');

  if (!overlay) return;

  function openFlowModal(step) {
    const img   = step.querySelector('.df-flow-photo img');
    const badge = step.querySelector('.df-flow-badge');
    const title = step.querySelector('h4');
    const items = step.querySelectorAll('.trio-list li');

    imgEl.src         = img ? img.src : '';
    imgEl.alt         = img ? img.alt : '';
    badgeEl.textContent = badge ? badge.textContent : '';
    titleEl.textContent = title ? title.textContent : '';
    listEl.innerHTML  = '';
    items.forEach(li => {
      const newLi = document.createElement('li');
      newLi.textContent = li.textContent;
      listEl.appendChild(newLi);
    });

    overlay.removeAttribute('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
    closeBtn.focus();
  }

  function closeFlowModal() {
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.setAttribute('hidden', ''), { once: true });
  }

  document.querySelectorAll('.df-flow-step').forEach(step => {
    step.addEventListener('click', () => openFlowModal(step));
  });

  closeBtn.addEventListener('click', closeFlowModal);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeFlowModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) closeFlowModal();
  });
})();
