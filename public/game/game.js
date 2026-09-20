// Progressive touches only: the page is complete without this file.
document.documentElement.dataset.js = '';
const reveal = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); } }, { rootMargin: '0px 0px -10% 0px' });
for (const el of document.querySelectorAll('.rv')) reveal.observe(el);
const dock = document.getElementById('dock'), hero = document.querySelector('.hero');
if (dock && hero) new IntersectionObserver(([e]) => dock.classList.toggle('show', !e.isIntersecting), { threshold: 0.05 }).observe(hero);
