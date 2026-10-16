/* 오늘폰 견적 엔진 — 홈페이지(_renewal_src/shop.js) 계산식을 그대로 옮김
   공시지원금: LG U+ 공식몰 API 실시간 → 실패 시 catalog.js 스냅샷 → 단가표 값
   대리점 지원금: 입점 대리점이 시세표로 등록한 값 (모델|용량|가입유형|요금구간) */
(function () {
    var D = window.OS_DATA;
    var API = 'https://www.lguplus.com/uhdc/fo/prdv/mdlbsufu/v2/mdlb-sufu-list?onlnOrdrPsblEposDivsCd=Y&shwd=&sortOrd=00&urcWlcmAplyDivsCd=NONE&pageNo=1&rowSize=300';
    var RATE = 0.059 / 12;

    D.plans = D.plans.filter(function (p) { return p.code !== 'LPZ1008098'; });
    D.plans.forEach(function (p) { p.name = p.name.replace(/^(넷플릭스|유튜브프리미엄)\s+/, ''); });
    var planMap = {}, modelMap = {};
    D.plans.forEach(function (p) { planMap[p.code] = p; });
    D.models.forEach(function (m) { modelMap[m.id] = m; m.imgUrl = 'https://theggeulrim.github.io/' + m.img; });

    var live = {}, liveTime = null, pending = {}, listeners = [];
    var f10 = function (n) { return Math.floor(n / 10) * 10; };

    function ssGet(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } }
    function ssSet(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

    function fetchSubsidy(type, plan, cb) {
        var key = type + '|' + plan;
        if (live[key]) { cb && cb(); return; }
        var cached = ssGet('ofSub:' + key);
        if (cached && Date.now() - cached.t < 30 * 60000) {
            live[key] = cached.v; liveTime = liveTime || cached.t; cb && cb(); return;
        }
        if (pending[key]) { pending[key].push(cb); return; }
        pending[key] = [cb];
        fetch(API + '&urcHphnEntrPsblKdCd=' + type + '&urcMblPpCd=' + plan, { credentials: 'omit' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                var list = (j && j.dvicMdlbSufuDtoList) || [];
                if (!list.length) throw new Error('empty');
                var v = {};
                list.forEach(function (x) { v[x.urcTrmMdlCd] = Number(x.basicPlanPuanSuptAmt) || 0; });
                live[key] = v; liveTime = Date.now();
                ssSet('ofSub:' + key, { t: liveTime, v: v });
            })
            .catch(function () {})
            .then(function () {
                var cbs = pending[key]; delete pending[key];
                cbs.forEach(function (f) { f && f(); });
                listeners.forEach(function (f) { f(); });
            });
    }

    function tierOf(plan) {
        var fee = planMap[plan].fee;
        return fee >= 115000 ? '115' : fee >= 85000 ? '85' : null;
    }
    function capOf(m, cap) { return m.caps.filter(function (x) { return x.c === cap; })[0]; }

    // 통신사 공시지원금
    function carrierAmt(m, cap, type, plan) {
        var c = capOf(m, cap);
        if (c && c.code) {
            var lv = live[type + '|' + plan];
            if (lv && lv[c.code] != null) return lv[c.code];
            var sn = D.snap[type] && D.snap[type][plan];
            if (sn && sn[c.code] != null) return sn[c.code];
        }
        var kd = type === '3' ? '1' : type;
        var t = tierOf(plan) || '85';
        var fb = D.fb[kd] && D.fb[kd][t] && D.fb[kd][t][m.id];
        return fb && fb[cap] != null ? fb[cap] : 0;
    }

    // 시세표 키: 모델|용량|가입유형(1 기변·2 번이)|요금구간(85·115). 신규가입은 기변 값 사용
    function rowKey(id, cap, type, tier) { return id + '|' + cap + '|' + (type === '3' ? '1' : type) + '|' + tier; }
    function dealerAmt(sheet, m, cap, type, plan) {
        var t = tierOf(plan);
        if (!t || !sheet) return null;
        var v = sheet.rows[rowKey(m.id, cap, type, t)];
        return v == null || v === '' ? null : Number(v);
    }

    function inst(prin, n) {
        if (!n || prin <= 0) return { m: 0, fee: 0 };
        var ex = prin * RATE / (1 - Math.pow(1 + RATE, -n));
        return { m: f10(ex), fee: Math.max(0, f10(ex * n - prin)) };
    }

    // ag: 대리점 지원금, after: 7개월째부터 쓸 요금제 코드
    function quote(m, cap, type, plan, ag, dc, n, after, addonM) {
        var c = capOf(m, cap);
        var p = planMap[plan];
        var p2 = after && planMap[after] && planMap[after].fee < p.fee && planMap[after].fee >= 47000 ? planMap[after] : null;
        var retail = c.retail, sub = carrierAmt(m, cap, type, plan);
        ag = ag || 0;
        addonM = addonM || 0;   // 부가서비스 유지 기간 총액
        function one(kind) {
            var prin = Math.max(0, retail - (kind === 'sub' ? sub : 0) - ag);
            var i = inst(prin, n);
            var sel = kind === 'sel' ? p.sel : 0;
            var planM = p.fee - sel;
            var sel2 = p2 ? (kind === 'sel' ? p2.sel : 0) : sel;
            var planM2 = p2 ? p2.fee - sel2 : planM;
            return {
                kind: kind, prin: prin, devM: i.m, fee: i.fee, sel: sel, planM: planM, planM2: planM2,
                total: i.m + planM, total2: i.m + planM2,
                cost24: prin + i.fee + planM * 6 + planM2 * 18 + addonM,
                subUsed: kind === 'sub' ? Math.min(sub, retail) : 0,
                agUsed: Math.min(ag, Math.max(0, retail - (kind === 'sub' ? sub : 0)))
            };
        }
        var a = one('sub'), b = one('sel');
        var best = b.cost24 < a.cost24 ? 'sel' : 'sub';
        var pick = dc === 'auto' ? best : dc;
        return { retail: retail, sub: sub, ag: ag, plan: p, plan2: p2, s: a, l: b, best: best, r: pick === 'sub' ? a : b };
    }

    window.Engine = {
        D: D, planMap: planMap, modelMap: modelMap, tierOf: tierOf, capOf: capOf, rowKey: rowKey,
        carrierAmt: carrierAmt, dealerAmt: dealerAmt, quote: quote, inst: inst, fetchSubsidy: fetchSubsidy,
        onLive: function (f) { listeners.push(f); },
        liveTime: function () { return liveTime; },
        won: function (n) { return Math.round(n).toLocaleString('ko-KR'); },
        man: function (n) { var v = Math.round(n / 1000) / 10; return (v % 1 ? v.toFixed(1) : v) + '만'; },
        TYPE_NM: { '1': '기기변경', '2': '번호이동', '3': '신규가입' },
        PLAN_BY_TIER: { '115': 'LPZ1007251', '85': 'LPZ1006510' },
        AFTER_DEFAULT: 'LPZ1006519'
    };
})();
