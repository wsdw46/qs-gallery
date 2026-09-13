/*
 * 使用：主题按钮按 系统→浅色→深色 循环；隐私与版权通过独立导航页访问。
 * 长文章自动生成目录；正文添加 h2/h3/h4 可自定义目录标题。
 * 新照片：将文件与实际宽高加入 gallery-manifest.js；srcset 只填真实存在的缩略图。
 * 无框架、无构建步骤；index.html、anime.css、anime.js、gallery-manifest.js 和素材一同上传。
 */
(() => {
    'use strict';
    const $ = selector => document.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ready = false, scrollFrame = 0, currentPage = null, readingArticle = null;
    let tocTargets = [], counterFrame = 0, typeTimer = 0;
    let seenCounters = false, loaderDone = false;
    const enhancedImages = new WeakSet(), reveals = new WeakSet(), rippleTargets = new WeakSet();
    const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.remove('reveal-hidden');
            entry.target.classList.add('reveal-visible');
            revealObserver.unobserve(entry.target);
        });
    }, { threshold: .1 }) : null;

    function announce(message) { const live = $('#site-announcer'); if (live) live.textContent = message; }
    function enhance(root = document) {
        $$('img:not(#lightbox-img)', root).forEach(img => {
            if (img.closest('#lightbox') || enhancedImages.has(img)) return;
            enhancedImages.add(img); img.decoding = 'async';
            if (!img.alt) img.alt = img.closest('.link-card')?.querySelector('.link-name')?.textContent || '秋音的图片';
            if (!img.getAttribute('src')) return;
            img.classList.add('image-pending');
            const finish = () => {
                img.classList.remove('image-pending');
                img.classList.toggle('image-error', !img.naturalWidth);
                scheduleScroll();
            };
            img.addEventListener('load', finish, { once: true });
            img.addEventListener('error', finish, { once: true });
            if (img.complete) finish();
        });
        $$('.masonry-item,.about-photo', root).forEach(card => {
            card.tabIndex = 0; card.setAttribute('role', 'button');
            card.setAttribute('aria-label', '放大查看：' + (card.querySelector('img')?.alt || '图片'));
        });
        $$('img[onclick*="openLightbox"]', root).forEach(img => {
            img.tabIndex = 0; img.role = 'button'; img.setAttribute('aria-label', '放大查看文章配图');
        });
        $$('a[target="_blank"]', root).forEach(link => {
            link.rel = [...new Set((link.rel + ' noopener noreferrer').trim().split(/\s+/))].join(' ');
        });
        // Second generation: only gallery images reveal on scroll, without staggered delays.
        $$('.masonry-item', root).forEach(card => {
            if (reveals.has(card) || !revealObserver || reduced()) return;
            reveals.add(card); card.classList.add('reveal-hidden'); revealObserver.observe(card);
        });
        $$('.nav-item,.icon-container,.filter-btn,.tag-chip-home,.mobile-menu-item,.icon-btn', root).forEach(button => {
            if (rippleTargets.has(button)) return;
            rippleTargets.add(button); button.addEventListener('click', createRipple);
        });
    }
    function releaseImages(root) {
        $$('.reveal-hidden', root).forEach(card => revealObserver?.unobserve(card));
    }
    function animateCounters() {
        if (seenCounters) return; seenCounters = true;
        const stats = $$('.stat-num').map(node => ({ node, value: Number(node.textContent.replace(/\D/g, '')), suffix: node.textContent.replace(/[\d,]/g, '') }));
        stats.forEach(({ node, value, suffix }) => { node.setAttribute('aria-label', value + suffix); });
        if (reduced()) return;
        const start = performance.now();
        const tick = now => {
            const p = reduced() ? 1 : Math.min(1, (now - start) / 1150);
            stats.forEach(({ node, value, suffix }) => { node.textContent = Math.round(value * (1 - Math.pow(1 - p, 3))) + suffix; });
            if (p < 1 && currentPage?.id === 'page-about') counterFrame = requestAnimationFrame(tick);
            else stats.forEach(({ node, value, suffix }) => { node.textContent = value + suffix; });
        };
        counterFrame = requestAnimationFrame(tick);
    }
    function typeTitle() {
        const line = $('.bio-line2'); if (!line || line.dataset.typed) return;
        line.dataset.typed = 'true'; const text = line.textContent;
        if (reduced()) return;
        line.classList.add('typed-line'); line.setAttribute('aria-label', text); line.textContent = '';
        const reserve = document.createElement('span'); reserve.className = 'typed-reserve'; reserve.textContent = text;
        const visual = document.createElement('span'); visual.className = 'typed-visual';
        reserve.setAttribute('aria-hidden', 'true'); visual.setAttribute('aria-hidden', 'true'); line.append(reserve, visual);
        const letters = [...text]; let index = 0;
        const tick = () => {
            if (reduced() || currentPage?.id !== 'page-about') { visual.textContent = text; return; }
            visual.textContent = letters.slice(0, ++index).join('');
            if (index < letters.length) typeTimer = setTimeout(tick, 70);
        };
        tick();
    }
    function startLoader() {
        const loader = $('#site-loader'), bar = loader.querySelector('progress'), label = $('#loader-percent');
        const candidates = $$('#page-about img').filter(img => img.loading !== 'lazy');
        let completed = 1; const total = candidates.length + 1;
        const paint = () => { const p = Math.round(completed / total * 100); bar.value = p; label.textContent = p + '%'; };
        const finish = () => {
            if (loaderDone) return; loaderDone = true;
            bar.value = 100; label.textContent = '100%';
            setTimeout(() => {
                loader.classList.add('is-finished');
                if (currentPage?.id === 'page-about') { animateCounters(); typeTitle(); }
                setTimeout(() => { loader.hidden = true; }, reduced() ? 0 : 450);
            }, reduced() ? 0 : 150);
        };
        paint();
        if (reduced() || !candidates.length) { finish(); return; }
        candidates.forEach(img => {
            let settled = false;
            const done = () => { if (settled) return; settled = true; ++completed; paint(); if (completed >= total) finish(); };
            if (img.complete) done();
            else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
        });
        // 超时表示页面已可使用，慢资源继续在后台加载，绝不锁住页面。
        setTimeout(finish, 2200);
    }
    function scheduleScroll() {
        if (!ready || scrollFrame) return;
        scrollFrame = requestAnimationFrame(updateScroll);
    }
    function updateScroll() {
        scrollFrame = 0; const page = currentPage; if (!page) return;
        const total = Math.max(0, page.scrollHeight - page.clientHeight);
        const ratio = total ? Math.max(0, Math.min(1, page.scrollTop / total)) : 0;
        $('#site-scroll-progress span').style.transform = 'scaleX(' + ratio + ')';
        $('#site-scroll-progress').setAttribute('aria-valuenow', Math.round(ratio * 100));
        $('#back-to-top').classList.toggle('is-visible', page.scrollTop > 500);
        $('#back-to-top .ring-value').style.strokeDashoffset = 138.23 * (1 - ratio);
        if (page.id === 'page-about') document.documentElement.style.setProperty('--scroll-shift', (reduced() ? 0 : Math.min(90, page.scrollTop * .09)) + 'px');
        if (readingArticle) {
            $('#article-progress span').style.transform = 'scaleX(' + (total ? ratio : 1) + ')';
            $('#article-progress').setAttribute('aria-valuenow', Math.round((total ? ratio : 1) * 100));
            const top = page.getBoundingClientRect().top + 130;
            let selected = 0;
            tocTargets.forEach((target, index) => { if (target.getBoundingClientRect().top <= top) selected = index; });
            $$('#article-toc a').forEach((link, index) => {
                if (index === selected) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
            });
        }
    }
    function openArticle(article) {
        readingArticle = article;
        const content = article.querySelector('.article-text-full');
        const headings = $$('h2,h3,h4', content);
        tocTargets = headings.length ? headings : $$('p', content).filter(p => p.textContent.trim().length > 20);
        if (!tocTargets.length) tocTargets = [article.querySelector('.article-title')];
        const nav = $('#article-toc nav'); nav.replaceChildren();
        tocTargets.forEach((target, index) => {
            target.id ||= article.id + '-section-' + (index + 1);
            const link = document.createElement('a'); link.href = '#' + target.id;
            const text = target.textContent.trim(); link.textContent = headings.length ? text : (index + 1) + '. ' + text.slice(0, 14) + (text.length > 14 ? '…' : '');
            link.onclick = event => {
                event.preventDefault();
                const pageRect = currentPage.getBoundingClientRect();
                currentPage.scrollTo({ top: currentPage.scrollTop + target.getBoundingClientRect().top - pageRect.top - 110, behavior: reduced() ? 'auto' : 'smooth' });
                target.tabIndex = -1; target.focus({ preventScroll: true });
                if (innerWidth < 1500) $('#article-toc').open = false;
            };
            nav.append(link);
        });
        $('#article-toc').hidden = false; $('#article-toc').open = innerWidth >= 1500;
        $('#article-progress').hidden = false;
        article.querySelector('.article-title').tabIndex = -1;
        article.querySelector('.article-title').focus({ preventScroll: true });
        scheduleScroll();
    }
    function closeArticle() { readingArticle = null; tocTargets = []; $('#article-toc').hidden = true; $('#article-progress').hidden = true; scheduleScroll(); }
    function pageChanged(page, changed) {
        currentPage = page; document.documentElement.dataset.page = page.id.slice(5);
        if (!ready) return;
        enhance(page); scheduleScroll();
        if (page.id === 'page-about' && loaderDone) { animateCounters(); typeTitle(); }
        if (page.id !== 'page-chat') document.documentElement.classList.remove('keyboard-open');
        viewportChanged();
    }
    function viewportChanged() {
        const viewport = window.visualViewport;
        const height = viewport ? viewport.height : innerHeight;
        document.documentElement.style.setProperty('--chat-viewport-height', height + 'px');
        const keyboard = innerWidth <= 768 && document.activeElement?.id === 'chat-input' && innerHeight - height > 100;
        document.documentElement.classList.toggle('keyboard-open', keyboard);
        if (keyboard) $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
    }
    function initAccessibility() {
        $$('h1.page-title').forEach(title => title.tabIndex = -1);
        $$('.nav-item,.bottom-nav-item,.mobile-menu-item,.icon-btn,#writing-back-btn').forEach(button => {
            if (button.tagName !== 'BUTTON') { button.role = 'button'; button.tabIndex = 0; }
            button.setAttribute('aria-label', button.textContent.trim() || button.title || '打开菜单');
        });
        $$('.article-item').forEach((article, i) => {
            article.id ||= 'article-' + (i + 1);
            const header = article.querySelector('.article-header'); header.role = 'button'; header.tabIndex = 0;
            header.setAttribute('aria-label', '阅读：' + article.querySelector('.article-title').textContent);
            header.setAttribute('aria-expanded', 'false');
            const content = article.querySelector('.article-content-wrapper'); content.id = article.id + '-content';
            header.setAttribute('aria-controls', content.id);
        });
        $('#mobile-more-menu').inert = true;
        const more = $('[onclick="toggleMobileMenu()"]'); more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', 'mobile-more-menu');
        document.addEventListener('keydown', event => {
            const target = event.target;
            if (event.key === 'Escape') {
                if ($('#music-context-menu').style.display === 'flex') { hideMusicMenu(true); return; }
                if ($('#mobile-more-menu').classList.contains('active')) { removeMobileMenu(); more.focus(); return; }
                if (activeArticle && !$('#lightbox')?.classList.contains('active')) collapseArticle();
            }
            if (target.closest('.music-card') && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
                showContextMenu(event, Number(target.closest('.music-card').id.replace('music-card-', ''))); return;
            }
            if (target.closest('#music-context-menu') && ['ArrowDown','ArrowUp','Home','End','Tab'].includes(event.key)) {
                const items = $$('#music-context-menu [role="menuitem"]'); let index = items.indexOf(target);
                if (event.key === 'Tab') { hideMusicMenu(true); return; }
                event.preventDefault();
                index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                items[index].focus(); return;
            }
            if ((event.key === 'Enter' || event.key === ' ') && target.matches('[role="button"]') && target.tagName !== 'BUTTON') {
                event.preventDefault(); target.click();
            }
        });
        $('.skip-link').onclick = event => { event.preventDefault(); currentPage?.querySelector('h1')?.focus(); };
        const collapse = $('#model-info-toggle');
        collapse.onclick = () => {
            const show = collapse.getAttribute('aria-expanded') !== 'true';
            collapse.setAttribute('aria-expanded', String(show)); collapse.textContent = show ? '收起介绍 −' : '展开介绍 +';
            $('#model-desc').hidden = !show; $('.model-showcase-wrapper').classList.toggle('info-collapsed', !show);
        };
        if (innerWidth <= 768) collapse.click();
    }
    function init() {
        if (ready) return; ready = true;
        initAccessibility(); enhance();
        $$('.page-container').forEach(page => page.addEventListener('scroll', () => { if (page === currentPage) scheduleScroll(); }, { passive: true }));
        if ('ResizeObserver' in window) {
            const observer = new ResizeObserver(scheduleScroll);
            $$('.page-container,.article-list,.masonry-grid').forEach(element => observer.observe(element));
        }
        window.addEventListener('resize', () => { viewportChanged(); scheduleScroll(); }, { passive: true });
        window.visualViewport?.addEventListener('resize', viewportChanged, { passive: true });
        document.addEventListener('focusin', viewportChanged);
        document.addEventListener('focusout', () => setTimeout(viewportChanged, 0));
        $('#back-to-top').onclick = () => currentPage?.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
        document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('motion-paused', document.hidden));
        motionQuery.addEventListener('change', () => {
            if (!reduced()) return;
            revealObserver?.disconnect();
            $$('.reveal-hidden').forEach(card => card.classList.remove('reveal-hidden'));
            scheduleScroll();
        });
        pageChanged($('.page-container.active'), false); startLoader();
    }
    window.GalleryUI = { init, enhance, releaseImages, pageChanged, scheduleScroll, openArticle, closeArticle, announce };
})();
