/* 유입 경로 기록 (ChatGPT 등 AI 검색 유입 측정용) */
(function () {
  try {
    var p = new URLSearchParams(location.search);
    var src = p.get('utm_source') || '';
    var ref = document.referrer || '';
    if (!src && /chatgpt\.com|openai\.com|perplexity\.ai|copilot\.microsoft|gemini\.google|claude\.ai/i.test(ref)) {
      src = ref.replace(/^https?:\/\//, '').split('/')[0];
    }
    if (src) {
      var rec = { source: src, medium: p.get('utm_medium') || '', campaign: p.get('utm_campaign') || '',
                  landing: location.pathname, referrer: ref, ts: new Date().toISOString() };
      localStorage.setItem('uhd_first_touch', localStorage.getItem('uhd_first_touch') || JSON.stringify(rec));
      sessionStorage.setItem('uhd_last_touch', JSON.stringify(rec));
      if (typeof fbq === 'function') { fbq('trackCustom', 'AISearchVisit', rec); }
    }
  } catch (e) {}
})();
