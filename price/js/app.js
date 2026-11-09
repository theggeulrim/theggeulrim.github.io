/* LGU+ 핫딜센터 오늘 시세 — 시안 (market/v3)
   가격 계산은 홈페이지(_rebuild_src/shop.js)와 같은 식: 출고가 − 공시지원금 − 대리점 지원금 = 할부원금(0원 아래로 안 내려감)
   데이터: js/data.js = 라이브 홈페이지 OS_DATA 복사본, js/stores.js = 매장 24곳 */
(function () {
    'use strict';
    var D = window.OS_DATA, STORES = window.SEED_STORES || [];
    var BRAND = 'LGU+ 핫딜센터';
    var IMG = 'https://theggeulrim.com/';
    var KAKAO_CHAT = 'http://pf.kakao.com/_xlyGxin/chat';
    var KAKAO_ADD = 'http://pf.kakao.com/_xlyGxin';
    var VISIT = 'https://theggeulrim.com/#visit';
    var API = 'https://www.lguplus.com/uhdc/fo/prdv/mdlbsufu/v2/mdlb-sufu-list?onlnOrdrPsblEposDivsCd=Y&shwd=&sortOrd=00&urcWlcmAplyDivsCd=NONE&pageNo=1&rowSize=300';
    var RATE = 0.059 / 12;
    var TYPE_NM = { '2': '번호이동', '1': '기기변경' };
    var PLAN_85 = 'LPZ1006510', PLAN_115 = 'LPZ1007251';
    var FIX_SUB = { ip17: 1, ip17pr: 1 };   // 홈페이지와 동일: 아이폰17·17 Pro 공시 번이 55만·기변 45만 고정

    D.plans = D.plans.filter(function (p) { return p.code !== 'LPZ1008098'; });
    D.plans.forEach(function (p) { p.name = p.name.replace(/^(넷플릭스|유튜브프리미엄)\s+/, ''); });
    var planMap = {}, modelMap = {};
    D.plans.forEach(function (p) { planMap[p.code] = p; });
    D.models.forEach(function (m) { modelMap[m.id] = m; });

    var $ = function (s, el) { return (el || document).querySelector(s); };
    var won = function (n) { return Math.round(n).toLocaleString('ko-KR'); };
    var f10 = function (n) { return Math.floor(n / 10) * 10; };
    function man(n) {
        if (n <= 0) return '0원';
        var v = Math.round(n / 1000) / 10;
        return (v % 1 ? v.toFixed(1) : v) + '만원';
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

    /* ---------- 지역 ---------- */
    var REGIONS = [
        { id: 'gwanak', nm: '관악·동작', test: /관악구|동작구/ },
        { id: 'ydp', nm: '금천·영등포', test: /금천구|영등포구/ },
        { id: 'gangseo', nm: '강서', test: /강서구/ },
        { id: 'anyang', nm: '안양', test: /안양시/ },
        { id: 'suwon', nm: '수원', test: /수원시/ },
        { id: 'dlv', nm: '택배 (전국)', test: null }
    ];
    STORES.forEach(function (s) { s.img = IMG + String(s.photo || '').split('/').pop(); });
    function storesOf(rid) {
        var r = REGIONS.filter(function (x) { return x.id === rid; })[0];
        if (!r || !r.test) return [];
        return STORES.filter(function (s) { return r.test.test(s.sigungu); });
    }
    var region = lsGet('tg.region', 'gwanak');

    /* ---------- 공시지원금 (공식몰 실시간 → 실패 시 스냅샷) ---------- */
    var live = {}, liveTime = null, pending = {};
    function fetchSubsidy(type, plan) {
        var key = type + '|' + plan;
        if (live[key] || pending[key]) return;
        pending[key] = 1;
        fetch(API + '&urcHphnEntrPsblKdCd=' + type + '&urcMblPpCd=' + plan, { credentials: 'omit' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                var list = (j && j.dvicMdlbSufuDtoList) || [];
                if (!list.length) return;
                var v = {};
                list.forEach(function (x) { v[x.urcTrmMdlCd] = Number(x.basicPlanPuanSuptAmt) || 0; });
                live[key] = v; liveTime = Date.now();
                render();
            })
            .catch(function () {})
            .then(function () { delete pending[key]; });
    }
    function tierOf(plan) { var f = planMap[plan].fee; return f >= 115000 ? '115' : f >= 85000 ? '85' : null; }
    function capOf(m, cap) { return m.caps.filter(function (x) { return x.c === cap; })[0]; }
    function carrierAmt(m, cap, type, plan) {
        if (FIX_SUB[m.id] && tierOf(plan)) return type === '2' ? 550000 : 450000;
        var c = capOf(m, cap);
        if (c && c.code) {
            var lv = live[type + '|' + plan];
            if (lv && lv[c.code] != null) return lv[c.code];
            var sn = D.snap[type] && D.snap[type][plan];
            if (sn && sn[c.code] != null) return sn[c.code];
        }
        var t = tierOf(plan) || '85';
        var fb = D.fb[type] && D.fb[type][t] && D.fb[type][t][m.id];
        return fb && fb[cap] != null ? fb[cap] : 0;
    }
    function agencyAmt(m, cap, type, plan) {
        var t = tierOf(plan);
        if (!t) return 0;
        var a = D.ag[type] && D.ag[type][t] && D.ag[type][t][m.id];
        return a && a[cap] ? a[cap] : 0;
    }
    function inst(prin, n) {
        if (!n || prin <= 0) return { m: 0, fee: 0 };
        var ex = prin * RATE / (1 - Math.pow(1 + RATE, -n));
        return { m: f10(ex), fee: Math.max(0, f10(ex * n - prin)) };
    }
    function quote(m, cap, type, plan, dc, n, after) {
        var c = capOf(m, cap), p = planMap[plan];
        var p2 = after && planMap[after] && planMap[after].fee < p.fee && planMap[after].fee >= 47000 ? planMap[after] : null;
        // 홈페이지와 동일: 7개월째 요금제를 안 골랐으면 47,000원 이상 가장 낮은 요금제로 바꾼다고 보고 비교
        var low = null; D.plans.forEach(function (x) { if (x.fee >= 47000 && (!low || x.fee < low.fee)) low = x; });
        var pc = p2 || (p.fee > 47000 ? low : null);
        var retail = c.retail, sub = carrierAmt(m, cap, type, plan), ag = agencyAmt(m, cap, type, plan);
        function one(kind) {
            var prin = Math.max(0, retail - (kind === 'sub' ? sub : 0) - ag);
            var i = inst(prin, n);
            var sel = kind === 'sel' ? p.sel : 0, planM = p.fee - sel;
            var sel2 = p2 ? (kind === 'sel' ? p2.sel : 0) : sel, planM2 = p2 ? p2.fee - sel2 : planM;
            return {
                kind: kind, prin: prin, devM: i.m, fee: i.fee, sel: sel, planM: planM, planM2: planM2,
                total: i.m + planM, total2: i.m + planM2,
                cost24: prin + i.fee + planM * 6 + planM2 * 18,
                costC: prin + i.fee + planM * 6 + (pc ? pc.fee - (kind === 'sel' ? pc.sel : 0) : planM) * 18,
                subUsed: kind === 'sub' ? Math.min(sub, retail) : 0,
                agUsed: Math.min(ag, Math.max(0, retail - (kind === 'sub' ? sub : 0)))
            };
        }
        var a = one('sub'), b = one('sel');
        var best = b.costC < a.costC ? 'sel' : 'sub';
        var pick = dc === 'auto' ? best : dc;
        return { retail: retail, sub: sub, ag: ag, plan: p, plan2: p2, s: a, l: b, best: best, r: pick === 'sub' ? a : b };
    }
    function priced(m) { return m.caps.some(function (c) { return c.retail > 0 && !c.sold; }); }
    function openCaps(m) { return m.caps.filter(function (c) { return c.retail > 0 && !c.sold; }); }
    // 기종 최저 할부원금 (공시지원금 기준)
    function lowest(m, type, plan) {
        var best = null;
        openCaps(m).forEach(function (c) {
            var q = quote(m, c.c, type, plan, 'sub', 24);
            if (!best || q.r.prin < best.prin) best = { cap: c.c, prin: q.r.prin, retail: q.retail, sub: q.sub };
        });
        return best;
    }
    function lowestAll(m) {
        var best = null;
        ['2', '1'].forEach(function (t) {
            [PLAN_85, PLAN_115].forEach(function (p) {
                var x = lowest(m, t, p);
                if (x && (!best || x.prin < best.prin)) { best = x; best.type = t; best.plan = p; }
            });
        });
        return best;
    }
    function off(x) { return x.retail ? Math.round((x.retail - x.prin) / x.retail * 100) : 0; }

    /* ---------- 분류 ---------- */
    var CATS = {
        galaxy: { nm: '갤럭시', sub: 'S26 시리즈', ids: ['s26', 's26p', 's26u'], img: 's26.png' },
        fold: { nm: '폴더블', sub: '플립8 / 폴드8', ids: ['flip8', 'fold8w', 'fold8u'], img: 'zflip8.png' },
        iphone: { nm: '아이폰', sub: '18 Pro / 17', ids: ['ip18pr', 'ip18pm', 'duo', 'ip17', 'ip17pr', 'ip17pm'], img: 'ip18pro.png' },
        past: { nm: '지난 모델', sub: '아이폰 16 Pro', ids: ['ip16pr', 'ip16pm'], img: '16pr.png' }
    };
    function catOf(id) { for (var k in CATS) if (CATS[k].ids.indexOf(id) >= 0) return k; return 'galaxy'; }

    /* ---------- 공용 조각 ---------- */
    var KICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.5.1 1 .1 1.5.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg>';
    function header(back) {
        $('#hd').innerHTML = (back
            ? '<a class="back" href="' + back + '"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>뒤로</a>'
            : '<a class="brand" href="#/"><em>LGU+</em> 핫딜센터</a>') +
            '<a class="kbtn" href="' + KAKAO_ADD + '" target="_blank" rel="noopener">' + KICON + '카톡 알림</a>';
    }
    function tab(t) {
        [].forEach.call(document.querySelectorAll('#tabbar a'), function (a) { a.classList.toggle('on', a.getAttribute('data-t') === t); });
        $('#tabbar').style.display = t ? '' : 'none';
    }
    function dateTxt() { var s = PRICE_DATE.split('-'); return s[1] + '.' + s[2]; }
    function footer() {
        return '<footer class="ft"><b>' + BRAND + '</b><br>상호 주식회사 더끌림컴퍼니 · 대표 이민진<br>사업자등록번호 192-88-01136<br>주소 서울특별시 관악구 난곡로 194, 1층(신림동)<br>' +
            '대표 번호 070-4007-7776 · 상담 카카오톡 채널 \'LGU+더끌림컴퍼니\'<br><br>' +
            '표시 가격은 ' + dateTxt() + ' 기준 LG U+ 공시지원금과 당사 지원금을 반영한 할부원금이에요. 공시지원금이 바뀌면 가격도 바뀔 수 있어요.<br>© 2026 주식회사 더끌림컴퍼니</footer>';
    }
    function favs() { return lsGet('tg.favs', []); }
    function toggleFav(id) { var f = favs(), i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); lsSet('tg.favs', f); }

    /* ---------- 홈 ---------- */
    function regionChips() {
        return '<div class="chips" id="regionChips">' + REGIONS.map(function (r) {
            return '<button class="chip' + (r.id === region ? ' on' : '') + '" data-region="' + r.id + '">' + r.nm + '</button>';
        }).join('') + '</div>';
    }
    function regionInfo() {
        if (region === 'dlv') return '<p class="region-info">매장 방문 없이 <b>택배로 전국 개통</b>해요. 신청서 작성부터 배송까지 카톡으로 안내해 드려요.</p>';
        var s = storesOf(region);
        return '<p class="region-info">이 지역 <b>더끌림컴퍼니 매장 ' + s.length + '곳</b> · ' + s.slice(0, 3).map(function (x) { return x.name; }).join(', ') + (s.length > 3 ? ' 외 ' + (s.length - 3) + '곳' : '') + '</p>';
    }
    function top5() {
        var list = D.models.filter(priced).map(function (m) {
            var x = lowest(m, '2', PLAN_85);
            return x && { m: m, x: x };
        }).filter(Boolean);
        list.sort(function (a, b) { return off(b.x) - off(a.x) || a.x.prin - b.x.prin; });
        return list.slice(0, 5);
    }
    function home() {
        header(); tab('home');
        var storeN = STORES.length;
        var h = '<section class="hero fade">' +
            '<span class="pill"><i></i>' + dateTxt() + ' 오늘 시세 반영</span>' +
            '<h1>LG U+ 휴대폰,<br>오늘 <em>얼마</em>인지<br>먼저 보고 오세요.</h1>' +
            '<p>출고가에서 공시지원금과 매장 지원금을 뺀 할부원금, 2년 동안 내는 총액까지 그대로 보여드려요.</p>' +
            '<div class="cta"><a class="btn btn-dark" href="#/cat/galaxy">시세 보러 가기</a><a class="btn btn-line" href="#/subsidy">오늘 공시지원금</a></div>' +
            '<div class="stats"><div><b>' + storeN + '곳</b><span>서울·경기 매장</span></div><div><b>24개월</b><span>총 납입금 계산</span></div><div><b>전국</b><span>택배 개통</span></div></div>' +
            '</section>';
        h += '<div class="banners fade">' +
            '<a class="box bn" href="#/stores?r=dlv"><div class="bn-ic g">📦</div><div class="bn-t"><small>택배 개통</small><b>매장 안 가도 집에서 받아요</b></div><span class="arr">›</span></a>' +
            '<a class="box bn" href="' + KAKAO_ADD + '" target="_blank" rel="noopener"><div class="bn-ic p">🔔</div><div class="bn-t"><small>가격 알림</small><b>가격이 내려가면 카톡으로 알려드려요</b></div><span class="arr">›</span></a>' +
            '</div>';
        h += '<section class="sec"><div class="sec-h"><h2>어디서 사시나요?</h2><a href="#/stores">매장 전체</a></div>' + regionChips() + '<div id="regionInfo">' + regionInfo() + '</div></section>';
        h += '<section class="sec"><div class="sec-h"><h2>어떤 휴대폰을 찾으세요?</h2></div><div class="cats">' +
            Object.keys(CATS).map(function (k) {
                var c = CATS[k];
                return '<a class="cat" href="#/cat/' + k + '"><b>' + c.nm + '</b><small>' + c.sub + '</small><span class="go">›</span><img src="' + IMG + c.img + '" alt="" loading="lazy"></a>';
            }).join('') +
            '<a class="cat" href="#/stores?r=dlv"><b>택배 개통</b><small>전국 비대면</small><span class="go">›</span><span class="ico">📦</span></a>' +
            '<a class="cat" href="#/stores"><b>매장 찾기</b><small>서울·경기 ' + storeN + '곳</small><span class="go">›</span><span class="ico">📍</span></a>' +
            '</div>' +
            '<a class="box sub-card" href="#/subsidy"><div><small>LG U+ 발표</small><b>오늘의 공시지원금</b><span>기종·요금제별 한눈에 보기</span></div><span style="color:var(--grey);font-size:22px">›</span></a></section>';
        h += '<section class="sec"><div class="sec-h"><h2>오늘 할인율 TOP 5</h2></div><div class="box rank">' +
            top5().map(function (o, i) {
                return '<a class="rk" href="#/phone/' + o.m.id + '"><span class="rk-n">' + (i + 1) + '</span><img src="' + IMG + o.m.img + '" alt="" loading="lazy">' +
                    '<div class="rk-t"><b>' + esc(o.m.name) + '</b><small>번호이동 · ' + o.x.cap + '</small></div>' +
                    '<div class="rk-p"><b>' + man(o.x.prin) + '</b><small>할인 ' + off(o.x) + '%</small></div></a>';
            }).join('') +
            '</div><p class="note">5G 데이터플랜 MAX(월 85,000원) 번호이동 기준 할부원금이에요. 내 조건은 기종을 눌러 계산해 보세요.</p></section>';
        h += '<section class="sec"><div class="sec-h"><h2>구매 꿀팁</h2></div><div class="box tips">' +
            TIPS.map(function (t, i) { return '<button class="tip" data-tip="' + i + '"><i>0' + (i + 1) + '</i>' + t.q + '</button>'; }).join('') + '</div></section>';
        h += '<section class="sec"><div class="sec-h"><h2>자주 묻는 질문</h2></div><div class="box faq">' +
            FAQ.map(function (f) { return '<details><summary>' + f.q + '</summary><p>' + f.a + '</p></details>'; }).join('') + '</div></section>';
        h += '<section class="sec"><div class="sec-h"><h2>기종별 오늘 시세</h2></div><div class="links">' +
            Object.keys(CATS).map(function (k) {
                return '<h3>' + CATS[k].nm + '</h3>' + CATS[k].ids.filter(function (id) { return modelMap[id] && priced(modelMap[id]); })
                    .map(function (id) { return '<a href="#/phone/' + id + '">' + esc(modelMap[id].name) + '</a>'; }).join('');
            }).join('') + '</div></section>';
        h += footer();
        return h;
    }

    var TIPS = [
        { q: '할부원금이 뭔가요?', a: ['출고가에서 공시지원금과 매장 지원금을 뺀 금액이에요. 실제로 할부로 나눠 내는 기기값이 이 금액이에요.', '할부원금이 0원이면 기기값은 내지 않고 요금만 내요.'] },
        { q: '공시지원금 vs 선택약정', a: ['공시지원금: 통신사가 기기값을 한 번에 깎아줘요.', '선택약정: 기기값 할인 대신 매달 요금을 25% 깎아줘요.', '기종 화면의 계산기에서 \'더 싼 쪽\'을 고르면 2년 총액이 적은 쪽으로 자동 계산해요.'] },
        { q: '2년 총 납입금 보는 법', a: ['할부원금 + 할부 수수료 + 24개월 요금을 모두 더한 금액이에요.', '7개월째부터 요금제를 바꿀 계획이면 계산기에서 \'7개월째 요금제\'를 골라 보세요.'] },
        { q: '개통 전 꼭 확인할 것', a: ['가입 요금제는 181일(약 6개월) 유지 조건이 있어요.', '지금 쓰는 통신사 약정·할부가 남았는지 확인해 주세요.', '가족 결합·카드 할인은 상담 때 따로 안내해 드려요.'] },
        { q: '택배 개통은 어떻게 하나요?', a: ['카톡으로 상담 → 신청서 작성 → 택배 수령 → 개통 순서예요.', '신분증 확인과 신청서 작성은 카톡으로 안내해 드려요.'] }
    ];
    var FAQ = [
        { q: '이 가격은 어디 기준인가요?', a: '더끌림컴퍼니 홈페이지와 같은 기준이에요. LG U+ 공시지원금이 바뀌면 할부원금도 같이 바뀌어요.' },
        { q: '매장에 가면 같은 가격으로 살 수 있나요?', a: '방문 전에 카톡으로 원하는 기종과 매장을 알려주시면 재고와 가격을 확인해 드려요.' },
        { q: '신규가입도 되나요?', a: '지금은 번호이동과 기기변경만 받고 있어요.' },
        { q: '택배로도 개통되나요?', a: '네, 전국 어디서든 택배로 받아서 개통할 수 있어요.' }
    ];

    /* ---------- 분류 목록 ---------- */
    function catPage(k) {
        var c = CATS[k] || CATS.galaxy;
        header('#/'); tab('home');
        var h = '<section class="sec fade"><div class="sec-h"><h2>' + c.nm + ' 오늘 시세</h2><span>' + dateTxt() + ' 기준</span></div>';
        h += '<div class="chips" style="margin-bottom:16px">' + Object.keys(CATS).map(function (x) {
            return '<a class="chip' + (x === k ? ' on' : '') + '" style="display:flex;align-items:center" href="#/cat/' + x + '">' + CATS[x].nm + '</a>';
        }).join('') + '</div><div class="grid">';
        c.ids.forEach(function (id) {
            var m = modelMap[id];
            if (!m) return;
            if (!priced(m)) {
                h += '<a class="pc" href="' + KAKAO_CHAT + '" target="_blank" rel="noopener"><span class="tag g">입고 문의</span><div class="pc-img"><img src="' + IMG + m.img + '" alt="" loading="lazy"></div><b>' + esc(m.name) + '</b><small>가격은 상담으로 안내</small></a>';
                return;
            }
            var x = lowestAll(m);
            h += '<a class="pc" href="#/phone/' + id + '">' + (m.pre ? '<span class="tag">사전예약</span>' : x.prin === 0 ? '<span class="tag">할부원금 0원</span>' : '') +
                '<div class="pc-img"><img src="' + IMG + m.img + '" alt="" loading="lazy"></div><b>' + esc(m.name) + '</b>' +
                '<small>출고가 ' + won(x.retail) + '원</small><div class="pr"><em>' + off(x) + '%</em>' + man(x.prin) + '</div></a>';
        });
        h += '</div><p class="note">기종별 가장 낮은 할부원금이에요(번호이동·기기변경, 85·115 요금제 중 최저).</p></section>' + footer();
        return h;
    }

    /* ---------- 기종 상세 ---------- */
    var cs = { id: null, type: '2', cap: null, plan: PLAN_85, dc: 'auto', n: 24, after: '' };
    function phonePage(id) {
        var m = modelMap[id];
        if (!m || !priced(m)) { location.hash = '#/'; return ''; }
        if (cs.id !== id) { cs = { id: id, type: '2', cap: openCaps(m)[0].c, plan: PLAN_85, dc: 'auto', n: 24, after: '' }; }
        fetchSubsidy('2', PLAN_85); fetchSubsidy('1', PLAN_85); fetchSubsidy('2', PLAN_115); fetchSubsidy('1', PLAN_115);
        if (cs.plan !== PLAN_85 && cs.plan !== PLAN_115) fetchSubsidy(cs.type, cs.plan);
        header('#/cat/' + catOf(id)); tab(null);
        var best = lowestAll(m);
        var h = '<div class="mh fade"><img src="' + IMG + m.img + '" alt=""><div><h1>' + esc(m.name) + '<br>오늘 시세</h1><small><i></i>' + dateTxt() + ' 오늘 · ' + (liveTime ? '공시지원금 실시간 반영' : '공시지원금 ' + D.snapDate.slice(5).replace('-', '.') + ' 기준') + '</small></div></div>';
        h += '<div class="hl fade"><small>오늘 가장 낮은 할부원금</small><b>' + man(best.prin) + '</b><span>' + TYPE_NM[best.type] + ' · ' + planMap[best.plan].name + ' · ' + best.cap + ' · 출고가 대비 ' + off(best) + '% 할인</span></div>';
        h += '<div class="acts"><button id="favBtn" class="' + (favs().indexOf(id) >= 0 ? 'on' : '') + '">' + (favs().indexOf(id) >= 0 ? '♥ 찜함' : '♡ 찜하기') + '</button><button id="shareBtn">공유하기</button><a href="' + KAKAO_ADD + '" target="_blank" rel="noopener">🔔 가격 알림</a></div>';
        // 가입유형·요금제별
        h += '<section class="sec"><div class="sec-h"><h2>조건별 오늘 최저</h2></div><div class="box tbox"><table class="tbl"><thead><tr><th>가입 조건</th><th class="r">할부원금</th><th class="r">공시지원금</th></tr></thead><tbody>';
        ['2', '1'].forEach(function (t) {
            [PLAN_85, PLAN_115].forEach(function (p) {
                var x = lowest(m, t, p);
                h += '<tr><td><b style="font-size:14.5px">' + TYPE_NM[t] + '</b><small>' + (p === PLAN_85 ? '월 85,000원' : '월 115,000원') + ' · ' + x.cap + '</small></td><td class="r"><b>' + man(x.prin) + '</b><small>출고가 ' + man(x.retail) + '</small></td><td class="r">' + man(x.sub) + '</td></tr>';
            });
        });
        h += '</tbody></table></div>';
        var caps = openCaps(m);
        if (caps.length > 1) {
            h += '<p class="note">용량별 최저: ' + caps.map(function (c) {
                var lo = null;
                ['2', '1'].forEach(function (t) { [PLAN_85, PLAN_115].forEach(function (p) { var q = quote(m, c.c, t, p, 'sub', 24).r.prin; if (lo == null || q < lo) lo = q; }); });
                return c.c + ' ' + man(lo);
            }).join(' · ') + '</p>';
        }
        h += '</section>';
        // 계산기
        h += '<section class="sec"><div class="sec-h"><h2>내 조건으로 2년 총액</h2></div><div class="box calc" id="calc">' + calcHtml(m) + '</div></section>';
        // 매장
        var rs = storesOf(region === 'dlv' ? 'gwanak' : region);
        h += '<section class="sec"><div class="sec-h"><h2>가까운 매장</h2><a href="#/stores">전체 ' + STORES.length + '곳</a></div>' + regionChips() +
            '<div class="box" style="padding:0 18px;margin-top:12px" id="storeBox">' + storeListHtml(region) + '</div></section>';
        // 같은 분류
        h += '<section class="sec"><div class="sec-h"><h2>같은 분류 다른 기종</h2></div><div class="links">' +
            CATS[catOf(id)].ids.filter(function (x) { return x !== id && modelMap[x] && priced(modelMap[x]); }).map(function (x) { return '<a href="#/phone/' + x + '">' + esc(modelMap[x].name) + '</a>'; }).join('') + '</div></section>';
        h += footer();
        h += '<div class="sticky"><a class="btn btn-kakao" href="' + KAKAO_CHAT + '" target="_blank" rel="noopener">카톡으로 이 가격 상담</a><a class="btn btn-dark" href="' + VISIT + '" target="_blank" rel="noopener">방문 예약</a></div>';
        return h;
    }
    function storeListHtml(rid) {
        if (rid === 'dlv') return '<div class="store"><div style="font-size:30px">📦</div><div><b>더끌림컴퍼니 온라인센터</b><small>전국 택배 개통 · 카톡으로 신청서 안내</small></div><a href="' + KAKAO_CHAT + '" target="_blank" rel="noopener">카톡</a></div>';
        return storesOf(rid).map(function (s) {
            return '<div class="store"><img src="' + s.img + '" alt="" loading="lazy"><div><b>' + esc(s.name) + '</b><small>' + esc(s.addr) + '</small></div>' +
                '<a href="https://map.naver.com/p/search/' + encodeURIComponent('LG U+ 더끌림컴퍼니 ' + s.name) + '" target="_blank" rel="noopener">지도</a></div>';
        }).join('');
    }
    function seg(name, opts, cur) {
        return '<div class="seg" data-seg="' + name + '">' + opts.map(function (o) { return '<button data-v="' + o[0] + '" class="' + (String(o[0]) === String(cur) ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>';
    }
    function calcHtml(m) {
        var q = quote(m, cs.cap, cs.type, cs.plan, cs.dc, cs.n, cs.after);
        var r = q.r;
        var plans = D.plans.filter(function (p) { return p.fee >= 47000; });
        var h = '<div class="field"><label>가입 유형</label>' + seg('type', [['2', '번호이동'], ['1', '기기변경']], cs.type) + '</div>';
        if (openCaps(m).length > 1) h += '<div class="field"><label>용량</label>' + seg('cap', openCaps(m).map(function (c) { return [c.c, c.c]; }), cs.cap) + '</div>';
        h += '<div class="field"><label>할인 방식</label>' + seg('dc', [['auto', '더 싼 쪽'], ['sub', '공시지원금'], ['sel', '선택약정']], cs.dc) + '</div>';
        h += '<div class="field"><label>가입 요금제 <span style="font-weight:400">(181일 유지)</span></label><select data-sel="plan">' + plans.map(function (p) {
            return '<option value="' + p.code + '"' + (p.code === cs.plan ? ' selected' : '') + '>' + esc(p.name) + ' · 월 ' + won(p.fee) + '원</option>';
        }).join('') + '</select></div>';
        h += '<div class="field"><label>7개월째부터 쓸 요금제</label><select data-sel="after"><option value="">바꾸지 않음</option>' + plans.filter(function (p) { return p.fee < planMap[cs.plan].fee; }).map(function (p) {
            return '<option value="' + p.code + '"' + (p.code === cs.after ? ' selected' : '') + '>' + esc(p.name) + ' · 월 ' + won(p.fee) + '원</option>';
        }).join('') + '</select></div>';
        h += '<div class="field"><label>할부 개월</label><select data-sel="n">' + [0, 12, 24, 30, 36, 48].map(function (n) {
            return '<option value="' + n + '"' + (n === cs.n ? ' selected' : '') + '>' + (n ? n + '개월' : '일시불') + '</option>';
        }).join('') + '</select></div>';
        if (!tierOf(cs.plan)) h += '<p class="note">85,000원 아래 요금제는 매장 지원금이 없어요.</p>';
        h += '<div class="res"><dl><dt>출고가</dt><dd>' + won(q.retail) + '원</dd>' +
            (r.kind === 'sub' ? '<dt>공시지원금</dt><dd class="dc">-' + won(r.subUsed) + '원</dd>' : '') +
            (r.agUsed ? '<dt>매장 지원금</dt><dd class="dc">-' + won(r.agUsed) + '원</dd>' : '') +
            '<dt><b>할부원금</b></dt><dd><b>' + won(r.prin) + '원</b></dd>' +
            '<dt>월 할부금' + (cs.n ? ' (' + cs.n + '개월)' : '') + '</dt><dd>' + won(r.devM) + '원</dd>' +
            '<dt>월 요금' + (r.kind === 'sel' ? ' (선택약정 25%)' : '') + '</dt><dd>' + won(r.planM) + '원</dd></dl>' +
            '<div class="sum"><span>매달 내는 돈' + (q.plan2 ? ' (1~6개월)' : '') + '</span><b>' + won(r.total) + '원</b></div>' +
            (q.plan2 ? '<div class="tot"><span>7개월째부터</span><span>' + won(r.total2) + '원</span></div>' : '') +
            '<div class="tot"><span>2년 총 납입금</span><span><b>' + won(r.cost24) + '원</b></span></div>' +
            (cs.dc === 'auto' ? '<div class="tot"><span>적용한 할인</span><span>' + (q.best === 'sub' ? '공시지원금' : '선택약정') + '</span></div>' : '') +
            '</div><p class="note">할부 수수료 연 5.9% 기준. 부가서비스·결합 할인은 빠진 금액이에요.</p>';
        return h;
    }

    /* ---------- 공시지원금 ---------- */
    var sv = { type: '2', plan: PLAN_85 };
    function subsidyPage() {
        fetchSubsidy(sv.type, sv.plan);
        header(); tab('subsidy');
        var h = '<section class="sec fade"><div class="sec-h"><h2>오늘의 공시지원금</h2><span>LG U+ 발표</span></div>' +
            '<div class="field" style="margin-top:0">' + seg('stype', [['2', '번호이동'], ['1', '기기변경']], sv.type) + '</div>' +
            '<div class="field">' + seg('splan', [[PLAN_85, '월 85,000원'], [PLAN_115, '월 115,000원']], sv.plan) + '</div>' +
            '<div class="box tbox" style="margin-top:16px"><table class="tbl subtbl"><thead><tr><th>기종</th><th class="r">출고가</th><th class="r">공시지원금</th><th class="r">할부원금</th></tr></thead><tbody>';
        D.models.filter(priced).forEach(function (m) {
            openCaps(m).slice(0, 1).forEach(function (c) {
                var q = quote(m, c.c, sv.type, sv.plan, 'sub', 24);
                h += '<tr><td><a href="#/phone/' + m.id + '"><b style="font-size:14px">' + esc(m.name) + '</b><small>' + c.c + '</small></a></td><td class="r">' + man(q.retail) + '</td><td class="r">' + man(q.sub) + '</td><td class="r"><b style="font-size:14.5px">' + man(q.r.prin) + '</b></td></tr>';
            });
        });
        h += '</tbody></table></div><p class="note">' + (liveTime ? 'LG U+ 공식몰 실시간 값' : '공시지원금 ' + D.snapDate.slice(5).replace('-', '.') + ' 기준 값') + '이에요. 할부원금은 매장 지원금까지 뺀 금액이에요.</p></section>' + footer();
        return h;
    }

    /* ---------- 매장 ---------- */
    function storesPage(rid) {
        if (rid) { region = rid; lsSet('tg.region', rid); }
        header(); tab('stores');
        return '<section class="sec fade"><div class="sec-h"><h2>더끌림컴퍼니 매장</h2><span>' + STORES.length + '곳</span></div>' + regionChips() +
            '<div class="box" style="padding:0 18px;margin-top:12px" id="storeBox">' + storeListHtml(region) + '</div>' +
            '<div class="cta"><a class="btn btn-kakao" href="' + KAKAO_CHAT + '" target="_blank" rel="noopener">카톡 상담</a><a class="btn btn-dark" href="' + VISIT + '" target="_blank" rel="noopener">방문 예약</a></div></section>' + footer();
    }

    /* ---------- 찜 ---------- */
    function favsPage() {
        header(); tab('favs');
        var f = favs().filter(function (id) { return modelMap[id] && priced(modelMap[id]); });
        var h = '<section class="sec fade"><div class="sec-h"><h2>찜한 기종</h2></div>';
        if (!f.length) h += '<div class="empty">아직 찜한 기종이 없어요.<br>기종 화면에서 ♡를 눌러 보세요.<div class="cta" style="max-width:240px;margin:20px auto 0"><a class="btn btn-dark" href="#/cat/galaxy">시세 보러 가기</a></div></div>';
        else h += '<div class="grid">' + f.map(function (id) {
            var m = modelMap[id], x = lowestAll(m);
            return '<a class="pc" href="#/phone/' + id + '"><div class="pc-img"><img src="' + IMG + m.img + '" alt=""></div><b>' + esc(m.name) + '</b><small>출고가 ' + won(x.retail) + '원</small><div class="pr"><em>' + off(x) + '%</em>' + man(x.prin) + '</div></a>';
        }).join('') + '</div>';
        return h + '</section>' + footer();
    }

    /* ---------- 라우터 ---------- */
    function route() {
        var hsh = location.hash.replace(/^#/, '') || '/';
        var parts = hsh.split('?'), path = parts[0].split('/').filter(Boolean), qs = {};
        (parts[1] || '').split('&').forEach(function (kv) { var a = kv.split('='); if (a[0]) qs[a[0]] = decodeURIComponent(a[1] || ''); });
        if (path[0] === 'phone') return phonePage(path[1]);
        if (path[0] === 'cat') return catPage(path[1]);
        if (path[0] === 'subsidy') return subsidyPage();
        if (path[0] === 'stores') return storesPage(qs.r);
        if (path[0] === 'favs') return favsPage();
        return home();
    }
    var lastHash = null;
    function render() {
        var y = window.scrollY;
        var html = route();
        if (html) $('#app').innerHTML = html;
        if (lastHash === location.hash) window.scrollTo(0, y); else window.scrollTo(0, 0);
        lastHash = location.hash;
        document.title = (cs.id && location.hash.indexOf('#/phone/') === 0 ? modelMap[cs.id].name + ' 오늘 시세 · ' : '') + BRAND + ' 오늘 시세';
    }
    function sheet(t) {
        $('#sheetIn').innerHTML = '<h3>' + t.q + '</h3><ul>' + t.a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul><button class="btn btn-dark" data-close>확인</button>';
        $('#sheet').classList.add('on');
    }

    document.addEventListener('click', function (e) {
        var t = e.target.closest('[data-region]');
        if (t) {
            region = t.getAttribute('data-region'); lsSet('tg.region', region);
            [].forEach.call(document.querySelectorAll('[data-region]'), function (b) { b.classList.toggle('on', b === t); });
            if ($('#regionInfo')) $('#regionInfo').innerHTML = regionInfo();
            if ($('#storeBox')) $('#storeBox').innerHTML = storeListHtml(region);
            return;
        }
        t = e.target.closest('[data-tip]');
        if (t) { sheet(TIPS[+t.getAttribute('data-tip')]); return; }
        if (e.target.closest('[data-close]') || e.target.id === 'sheet') { $('#sheet').classList.remove('on'); return; }
        t = e.target.closest('.seg button');
        if (t) {
            var name = t.parentNode.getAttribute('data-seg'), v = t.getAttribute('data-v');
            if (name === 'stype') { sv.type = v; render(); return; }
            if (name === 'splan') { sv.plan = v; render(); return; }
            cs[name] = v;
            if (name === 'type') fetchSubsidy(cs.type, cs.plan);
            $('#calc').innerHTML = calcHtml(modelMap[cs.id]);
            return;
        }
        if (e.target.closest('#favBtn')) { toggleFav(cs.id); render(); return; }
        if (e.target.closest('#shareBtn')) {
            var url = location.href, title = modelMap[cs.id].name + ' 오늘 시세';
            if (navigator.share) navigator.share({ title: title, url: url }).catch(function () {});
            else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { e.target.closest('#shareBtn').textContent = '링크 복사됨'; });
        }
    });
    document.addEventListener('change', function (e) {
        var s = e.target.getAttribute('data-sel');
        if (!s) return;
        cs[s] = s === 'n' ? +e.target.value : e.target.value;
        if (s === 'plan') { if (cs.after && planMap[cs.after].fee >= planMap[cs.plan].fee) cs.after = ''; fetchSubsidy(cs.type, cs.plan); }
        $('#calc').innerHTML = calcHtml(modelMap[cs.id]);
    });
    window.addEventListener('hashchange', render);
    render();
})();
