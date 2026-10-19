/* LGU+더끌림컴퍼니 파트너스 — 입점 대리점용 콘솔
   #/online  온라인 접수 (택배)  ·  #/visit 방문 접수 — 모요파트너스처럼 창구를 나눔
   #/price   오늘 시세 등록 (할부원금 입력 → 대리점 지원금으로 저장, 10~20시)
   #/stores  매장 관리      #/settle 정산
   #/admin   운영자: 입점 심사·가격 상이 신고 */
(function () {
    var E = window.Engine, D = E.D, won = E.won;
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var STATUS = ['신규', '연락완료', '방문예정', '서류작성', '배송시작', '개통완료', '취소'];
    var ST_TAG = { '신규': 'b', '연락완료': '', '방문예정': 'y', '서류작성': '', '배송시작': 'y', '개통완료': 'g', '취소': 'r' };
    var CUR = { SKT: 'SKT', KT: 'KT', LGU: 'LG U+', MVNO: '알뜰폰' };
    var MODELS = D.models.filter(function (m) { return !m.pre && m.caps.some(function (c) { return c.retail > 0 && !c.sold; }); });
    var COLS = [['2', '85', '번호이동 85'], ['2', '115', '번호이동 115'], ['1', '85', '기기변경 85'], ['1', '115', '기기변경 115']];

    var S = DB.state, booted = false, busy = false;
    var ui = { chan: 'online', status: '전체', store: '', period: '7', q: '', priceStore: '', draft: null, draftFor: '', conds: null, signup: false };

    function photo(p) { return !p ? '' : /^(https?:|data:)/.test(p) ? p : '../' + p; }
    function me() { return DB.auth.dealerId ? DB.dealer(DB.auth.dealerId) : null; }
    function isAdmin() { return DB.auth.admin; }
    function isOwner() { return DB.auth.role === 'owner'; }
    // 저장 버튼 두 번 눌림 방지 + 결과 토스트
    function run(p, okMsg, after) {
        if (busy) return; busy = true;
        return p.then(function (r) {
            busy = false;
            if (!r || !r.ok) { toast((r && r.msg) || '저장하지 못했어요'); render(); return; }
            if (after) after(r);
            render(); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
        }, function (e) { busy = false; toast(DB.msgOf(e)); render(); });
    }
    function myStores() { var d = me(); return d ? S.stores.filter(function (s) { return s.dealer_id === d.id; }) : []; }
    function myApps() { var d = me(); return d ? S.apps.filter(function (a) { return a.dealer_id === d.id; }) : []; }
    function toast(t) { var el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('on'); }, 2200); }
    function modal(html) { $('modal').innerHTML = html; $('dim').classList.add('on'); }
    function close() { $('dim').classList.remove('on'); }
    function fmtT(iso) { var d = new Date(iso); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    function mdl(id) { return E.modelMap[id] || { name: id }; }

    /* ---------- 로그인 · 입점 신청 ---------- */
    function vLogin() {
        var su = ui.signup;
        return '<div class="login"><div class="logo">LGU+<b>더끌림컴퍼니</b><small>파트너스</small></div>' +
            '<div class="card"><b>' + (su ? '계정 만들기' : '로그인') + '</b><p class="desc">' + (su ? '대표·직원 모두 각자 이메일로 계정을 만들어요. 직원은 만든 뒤 대표에게 이메일을 알려주면 판매점에 연결돼요.' : '판매점 대표·직원 계정으로 들어와요.') + '</p>' +
            '<label class="fl">이메일</label><input class="in" id="lEmail" type="email" autocomplete="username" style="width:100%">' +
            '<label class="fl">비밀번호' + (su ? ' (6자 이상)' : '') + '</label><input class="in" id="lPw" type="password" autocomplete="' + (su ? 'new-password' : 'current-password') + '" style="width:100%">' +
            '<div class="row" style="margin-top:12px"><button class="btn pri" data-act="' + (su ? 'signup' : 'signin') + '">' + (su ? '계정 만들기' : '로그인') + '</button><div class="sp"></div>' +
            '<a href="#" data-act="toggleSignup">' + (su ? '이미 계정이 있어요' : '계정이 없어요') + '</a></div></div>' +
            '<div class="card"><b>아직 입점 전이신가요?</b><p class="desc">지금은 LG U+ 판매점만 받아요. 계정을 만들고 로그인하면 입점 신청서를 낼 수 있어요. 심사는 영업일 1~2일 걸려요.</p>' + feeBox() + '</div></div>';
    }
    function vNoDealer() {
        var email = DB.auth.user ? DB.auth.user.email : '';
        return '<div class="login"><div class="logo">LGU+<b>더끌림컴퍼니</b><small>파트너스</small></div>' +
            '<div class="card"><b>연결된 판매점이 없어요</b><p class="desc"><b>' + esc(email) + '</b> 으로 로그인했어요.</p>' +
            '<p class="desc">· 판매점 <b>직원</b>이면: 대표에게 이 이메일을 알려주세요. 대표가 매장 관리 → 직원 계정 연결에서 넣으면 바로 들어올 수 있어요.<br>' +
            '· 판매점 <b>대표</b>이고 처음이면: 아래에서 입점 신청을 해주세요.</p>' + feeBox() +
            '<div class="row" style="margin-top:12px"><button class="btn pri" data-act="join">입점 신청하기</button><button class="btn" data-act="recheck">연결됐는지 다시 확인</button><div class="sp"></div><a href="#" data-act="logout">로그아웃</a></div></div></div>';
    }
    function feeBox() {
        var F = DB.FEE;
        return '<div class="kv" style="margin-top:8px"><div><span>런칭가 (~' + F.launchEnd.slice(2).replace(/-/g, '.') + ' 개통분)</span><b>' + won(F.launch) + '원</b></div>' +
            '<div><span>정가</span><b>' + won(F.std) + '원</b></div></div>' +
            '<p class="desc">개통완료 건당 · VAT 별도 · 매장 수 무제한 · 가입비·월 고정비 없음. 신청만 들어오고 취소·미개통된 건은 0원이에요.</p>';
    }
    function joinModal() {
        modal('<h3>입점 신청</h3>' +
            '<label class="fl">상호</label><input class="in" id="jName" placeholder="예: ○○모바일">' +
            '<label class="fl">사업자등록번호</label><input class="in" id="jBiz" placeholder="000-00-00000" inputmode="numeric">' +
            '<label class="fl">대표자 · 담당자 연락처</label><div class="row"><input class="in" id="jCeo" placeholder="대표자명" style="flex:1"><input class="in" id="jTel" placeholder="010-0000-0000" style="flex:1"></div>' +
            '<label class="fl">통신사</label><input class="in" value="LG U+ (SKT·KT 판매점은 다음 단계에서 받아요)" disabled>' +
            '<label class="fl">요금</label>' + feeBox() +
            '<label class="fl">서류</label><p class="desc" style="margin:0">사업자등록증 · 사전승낙서 · 정산 통장 사본은 신청 후 운영팀이 연락드려 받아요.</p>' +
            '<label class="fl">입점 조건</label><div class="desc" style="margin:0">' +
            '· 카드·결합·기기반납 조건이 붙은 가격은 올릴 수 없어요<br>· 부가서비스는 이름·월 요금·유지 기간을 적어야 해요<br>' +
            '· 새 신청은 영업시간 기준 ' + DB.REPLY_HOURS + '시간 안에 첫 연락해요<br>· 개통하면 7일 안에 개통완료로 바꿔요. 신청 7일 뒤 고객에게 개통 여부를 확인하고, 판매점 상태와 3번 다르면 노출이 중지돼요<br>' +
            '· 등록 가격과 다르게 안내한 신고가 3번 확인되면 노출이 중지돼요</div>' +
            '<label class="ck"><input type="checkbox" id="jOk"> 위 입점 조건과 요금에 동의해요.</label>' +
            '<div class="ft"><button class="btn" data-act="close">취소</button><button class="btn pri" data-act="joinSubmit">신청</button></div>');
    }
    function joinSubmit() {
        var name = $('jName').value.trim(), biz = $('jBiz').value.replace(/\D/g, '');
        if (!name) return toast('상호를 적어주세요');
        if (biz.length !== 10) return toast('사업자등록번호 10자리를 확인해주세요');
        if (!$('jOk').checked) return toast('운영 정책 동의가 필요해요');
        var tel = $('jTel').value.trim();
        if (!tel) return toast('연락처를 적어주세요');
        run(DB.joinDealer({ name: name, biz_no: biz.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3'), ceo: $('jCeo').value.trim(), phone: tel }),
            '신청됐어요. 서류 확인 후 승인되면 시세 등록을 할 수 있어요', close);
    }

    /* ---------- 공통 틀 ---------- */
    function shell(view, body) {
        var d = me(), nw = function (m) { return myApps().filter(function (a) { return a.status === '신규' && a.method === m; }).length; };
        var items = (d && d.status === 'approved' ? [['online', '온라인 접수', nw('delivery')], ['visit', '방문 접수', nw('visit')], ['price', '오늘 시세 등록'], ['stores', '매장 관리'], ['settle', '정산']] : [])
            .concat(isAdmin() ? [['admin', '입점 심사 · 신고']] : []);
        var pend = S.dealers.filter(function (x) { return x.status === 'pending'; }).length;
        return '<div class="app"><aside class="side"><div class="logo">LGU+<b>더끌림컴퍼니</b><small>파트너스</small></div>' +
            '<div class="who"><b>' + (d ? esc(d.name) : '더끌림컴퍼니 운영자') + '</b><span>' + (d ? esc(d.badge) + (d.status !== 'approved' ? ' · 심사중' : '') : '관리자') + '</span></div>' +
            '<nav class="nav">' + items.map(function (it) {
                var badge = it[2] ? '<i>' + it[2] + '</i>' : it[0] === 'admin' && pend ? '<i>' + pend + '</i>' : '';
                return '<a href="#/' + it[0] + '" class="' + (view === it[0] ? 'on' : '') + '">' + it[1] + badge + '</a>';
            }).join('') + '</nav>' +
            '<div class="bot"><a href="https://theggeulrim.com/" target="_blank">홈페이지 열기 ↗</a><span style="font-size:12px;color:var(--ink3)">' + esc(DB.auth.user.email) + '</span><a href="#" data-act="logout">로그아웃</a></div></aside>' +
            '<main class="main">' + body + '</main></div>';
    }

    /* ---------- 온라인 접수 · 방문 접수 ---------- */
    function chanApps() { var m = ui.chan === 'visit' ? 'visit' : 'delivery'; return myApps().filter(function (a) { return a.method === m; }); }
    function route(a) { return a.sheet_id ? '가격비교' : '홈페이지'; }   // 홈페이지(theggeulrim.com) 신청은 시세표 없이 들어옴
    function filteredApps() {
        var since = ui.period === 'all' ? 0 : Date.now() - (ui.period === '1' ? 1 : 7) * 864e5;
        var q = ui.q.replace(/-/g, '');
        return chanApps().filter(function (a) {
            if (ui.status !== '전체' && a.status !== ui.status) return false;
            if (ui.store && a.store_id !== ui.store) return false;
            if (since && new Date(a.created_at).getTime() < since) return false;
            if (q && (a.name + a.phone.replace(/-/g, '') + a.id).indexOf(q) < 0) return false;
            return true;
        }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
    }
    function vApps() {
        var all = chanApps(), list = filteredApps(), vis = ui.chan === 'visit';
        var cnt = { '전체': all.length };
        STATUS.forEach(function (s) { cnt[s] = all.filter(function (a) { return a.status === s; }).length; });
        var stores = myStores();
        var h = '<div class="row"><div class="h1">' + (vis ? '방문 접수<small>매장 방문 예약 — 방문예정일 전에 연락해주세요</small>' : '온라인 접수<small>택배 개통 신청 — 홈페이지·가격비교에서 들어온 건</small>') + '</div><div class="sp"></div>' +
            '<button class="btn" data-act="csv">엑셀(CSV) 받기</button></div>' +
            '<div class="card"><div class="row"><div class="seg">' + ['전체'].concat(STATUS).map(function (s) {
                return '<button data-st="' + s + '" class="' + (ui.status === s ? 'on' : '') + '">' + s + '<em>' + cnt[s] + '</em></button>';
            }).join('') + '</div><div class="sp"></div>' +
            '<select class="sel" id="fStore"><option value="">전체 매장</option>' + stores.map(function (s) { return '<option value="' + s.id + '"' + (ui.store === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select>' +
            '<select class="sel" id="fPeriod">' + [['1', '오늘'], ['7', '최근 7일'], ['all', '전체 기간']].map(function (p) { return '<option value="' + p[0] + '"' + (ui.period === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select>' +
            '<input class="in" id="fQ" placeholder="이름·번호·접수번호" value="' + esc(ui.q) + '" style="width:160px"></div>';
        h += '<div class="tw"><table><thead><tr><th>접수번호</th><th>신청 시각</th><th>매장명</th>' + (vis ? '<th>방문예정일</th>' : '') + '<th>고객명</th><th>휴대폰</th><th>현재 통신사</th><th>유형</th><th>할인유형</th><th>신청경로</th><th>기종</th><th>용량</th><th>색상</th><th class="num">할부원금</th><th>상태</th><th>메모</th></tr></thead><tbody>';
        if (!list.length) h += '<tr><td colspan="' + (vis ? 16 : 15) + '" style="text-align:center;color:var(--ink3);padding:40px">조건에 맞는 신청이 없어요</td></tr>';
        list.forEach(function (a) {
            var s = DB.store(a.store_id) || {};
            h += '<tr class="' + (a.status === '신규' ? 'new' : '') + '"><td><a href="#" data-detail="' + a.id + '"><b>' + a.id + '</b></a>' + (a.reported ? ' <span class="tag r">가격 상이 신고</span>' : '') +
                (DB.overdue(a) ? ' <span class="tag y">' + DB.REPLY_HOURS + '시간 넘게 미연락</span>' : '') +
                (DB.mismatch(a) ? ' <span class="tag r">고객 확인과 다름</span>' : '') + '</td>' +
                '<td>' + fmtT(a.created_at) + '</td><td>' + esc(s.name || '') + '</td>' +
                (vis ? '<td>' + esc(a.visit_date) + '</td>' : '') +
                '<td>' + esc(a.name) + '</td><td><a href="tel:' + esc(a.phone) + '">' + esc(a.phone) + '</a></td><td>' + (CUR[a.cur] || '') + '</td>' +
                '<td>' + E.TYPE_NM[a.type] + '</td><td>' + (a.dc === 'sel' ? '선택약정' : '공시지원금') + '</td>' +
                '<td>' + route(a) + '</td><td>' + esc(mdl(a.model).name) + '</td><td>' + esc(a.cap) + '</td><td>' + esc(a.color || '-') + '</td>' +
                '<td class="num">' + (a.price != null ? won(a.price) : '-') + '</td>' +
                '<td><select class="sel" data-status="' + a.id + '">' + STATUS.map(function (x) { return '<option' + (x === a.status ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></td>' +
                '<td><input class="in memo" data-memo="' + a.id + '" value="' + esc(a.memo) + '" placeholder="ㅅㅂ·ㅂㅈ·문발"></td></tr>';
        });
        h += '</tbody></table></div><p class="desc" style="margin-top:10px">개통완료로 바꾼 건만 정산 대상이에요. 신청 7일 뒤 고객에게 개통 여부를 확인해서, 상태와 다르면 \'고객 확인과 다름\'이 붙어요. 새 신청은 ' + DB.REPLY_HOURS + '시간 안에 연락해주세요.</p></div>';
        return h;
    }
    function detailModal(id) {
        var a = S.apps.filter(function (x) { return x.id === id; })[0]; if (!a) return;
        var s = DB.store(a.store_id) || {}, p = E.planMap[a.plan];
        modal('<h3>' + a.id + ' · ' + esc(a.name) + '</h3>' +
            '<table><tbody>' + [['매장', s.name], ['받는 방법', a.method === 'delivery' ? '택배' : '매장 방문 · ' + a.visit_date], ['연락처', a.phone],
                ['현재 통신사', CUR[a.cur]], ['모델', mdl(a.model).name + ' ' + a.cap + (a.color ? ' · ' + a.color : '')],
                ['가입 유형', E.TYPE_NM[a.type] + ' · ' + (a.dc === 'sel' ? '선택약정' : '공시지원금') + ' · 24개월'], ['요금제', p ? p.name + ' (' + won(p.fee) + '원)' : a.plan],
                ['출고가', a.retail ? won(a.retail) + '원' : '-'], ['공시 / 대리점', a.sub != null ? won(a.sub) + ' / ' + won(a.ag) + '원' : '-'],
                ['할부원금', a.price != null ? won(a.price) + '원' : '-'], ['시세 기준', a.fresh === false ? '전일 시세' : '오늘 시세']
            ].map(function (r) { return '<tr><td style="color:var(--ink3)">' + r[0] + '</td><td><b>' + esc(r[1]) + '</b></td></tr>'; }).join('') + '</tbody></table>' +
            (a.reported ? '<p class="tag r" style="margin-top:10px">고객이 "가격이 달라요" 신고 — 운영자가 확인 중</p>' : '') +
            '<label class="fl">진행 기록</label><div class="log">' + (a.log || []).map(function (l) { return fmtT(l.t) + ' · ' + esc(l.s) + (l.by ? ' (' + esc(l.by) + ')' : ''); }).join('<br>') + '</div>' +
            '<div class="ft"><button class="btn pri" data-act="close">닫기</button></div>');
    }
    function csv() {
        var head = ['접수번호', '신청시각', '매장명', '방문예정일', '고객명', '휴대폰', '현재통신사', '유형', '할인유형', '신청경로', '기종', '용량', '색상', '할부원금', '상태', '메모'];
        var rows = filteredApps().map(function (a) {
            var s = DB.store(a.store_id) || {};
            return [a.id, fmtT(a.created_at), s.name, a.method === 'delivery' ? '택배' : a.visit_date, a.name, a.phone, CUR[a.cur], E.TYPE_NM[a.type],
                a.dc === 'sel' ? '선택약정' : '공시지원금', route(a), mdl(a.model).name, a.cap, a.color, a.price, a.status, a.memo];
        });
        var txt = '﻿' + [head].concat(rows).map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
        var el = document.createElement('a');
        el.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv' }));
        el.download = '더끌림_접수_' + DB.today() + '.csv'; el.click();
    }

    /* ---------- 오늘 시세 등록 ---------- */
    function sub(m, cap, kd, t) { return E.carrierAmt(m, cap, kd, E.PLAN_BY_TIER[t]); }
    function loadDraft() {
        if (ui.draftFor === ui.priceStore && ui.draft) return;
        var sh = DB.latestSheet(ui.priceStore);
        ui.draft = sh ? JSON.parse(JSON.stringify(sh.rows)) : {};
        ui.conds = sh ? JSON.parse(JSON.stringify(sh.conds)) : JSON.parse(JSON.stringify(DB.NO_COND));
        ui.base = sh ? sh.rows : {};
        ui.draftFor = ui.priceStore;
    }
    // 다른 판매점의 같은 칸 최저 할부원금 (모두의성지처럼 경쟁 가격을 보면서 입력)
    function marketMin() {
        var d = me(), out = {};
        DB.deals('all').forEach(function (x) {
            if (x.dealer.id === d.id) return;
            Object.keys(x.sheet.rows).forEach(function (k) {
                var p = k.split('|'), m = E.modelMap[p[0]]; if (!m) return;
                var c = E.capOf(m, p[1]); if (!c || !c.retail) return;
                var prin = Math.max(0, c.retail - sub(m, p[1], p[2], p[3]) - Number(x.sheet.rows[k]));
                if (out[k] == null || prin < out[k].v) out[k] = { v: prin, who: x.store.name };
            });
        });
        return out;
    }
    function countdown() {
        var h = DB.kstHour();
        if (h < 10) return '오전 10시부터 등록할 수 있어요';
        if (h >= 20) return '오늘 등록은 마감됐어요 (내일 오전 10시부터)';
        var left = Math.round((20 - h) * 60);
        return '오늘 마감까지 <span class="cd">' + Math.floor(left / 60) + '시간 ' + (left % 60) + '분</span>';
    }
    function vPrice() {
        var stores = myStores();
        if (!stores.length) return '<div class="h1">오늘 시세 등록</div><div class="card">먼저 매장 관리에서 매장을 추가해주세요.</div>';
        if (!ui.priceStore || !stores.some(function (s) { return s.id === ui.priceStore; })) ui.priceStore = stores[0].id;
        loadDraft();
        var st = DB.store(ui.priceStore), sh = DB.latestSheet(ui.priceStore), mk = marketMin();
        var state = !sh ? '<span class="tag r">미등록 · 고객에게 안 보여요</span>' : sh.date === DB.today() ?
            '<span class="tag g">오늘 시세 노출 중 · ' + sh.submitted_at.slice(11, 16) + ' 등록</span>' : '<span class="tag y">전일 시세 노출 중 · 오늘 등록하면 "오늘 시세" 배지</span>';
        var lt = E.liveTime();
        var h = '<div class="row"><div class="h1">오늘 시세 등록</div><div class="sp"></div><span>' + countdown() + '</span></div>' +
            '<p class="desc">할부원금(공시지원금 받고 24개월 할부 기준)을 입력하면 대리점 지원금으로 바꿔 저장해요. 공시지원금이 바뀌면 고객 가격도 같이 움직여요. 빈칸 = 취급 안 함.</p>' +
            '<div class="card"><div class="row"><select class="sel" id="pStore">' + stores.map(function (s) { return '<option value="' + s.id + '"' + (s.id === ui.priceStore ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select>' +
            state + '<div class="sp"></div><span class="desc">공시지원금 ' + (lt ? 'LG U+ 공식몰 ' + new Date(lt).toTimeString().slice(0, 5) + ' 기준' : '스냅샷 기준') + '</span></div>' +
            '<div class="row" style="margin-top:12px"><button class="btn" data-act="reload">마지막 시세 다시 불러오기</button><button class="btn" data-act="bulk">일괄 ±</button>' +
            '<button class="btn" data-act="copy">다른 매장에 복사</button><div class="sp"></div>' +
            '<button class="btn pri" data-act="submit">이 매장 시세 등록</button></div></div>';
        // 조건
        var c = ui.conds;
        h += '<div class="card"><b>가격 조건</b><span class="desc"> — 고객 화면 "숨은 조건" 칸에 그대로 나가요</span>' +
            '<div class="row" style="margin-top:10px">' + (c.addons || []).map(function (a, i) {
                return '<span class="tag y">' + esc(a.name) + ' ' + won(a.fee) + '원×' + a.months + '개월 <a href="#" data-rmaddon="' + i + '">✕</a></span>';
            }).join('') + '<input class="in" id="adName" placeholder="부가서비스명" style="width:140px"><input class="in" id="adFee" placeholder="월 요금" inputmode="numeric" style="width:90px">' +
            '<input class="in" id="adMon" placeholder="유지 개월" inputmode="numeric" style="width:90px"><button class="btn sm" data-act="addAddon">추가</button></div>' +
            '<p class="desc" style="margin-top:8px">제휴카드 · 인터넷/TV 결합 · 기기 반납 조건 가격은 등록할 수 없어요 (운영 정책). 부가서비스는 유지 기간 요금이 고객 2년 총비용에 더해져요.</p></div>';
        // 시세표
        h += '<div class="tw pg"><table><thead><tr><th rowspan="2">모델</th><th rowspan="2">용량</th><th rowspan="2" class="num">출고가</th>' +
            COLS.map(function (c) { return '<th class="g" colspan="2">' + c[2] + '</th>'; }).join('') + '</tr><tr>' +
            COLS.map(function () { return '<th class="num g">공시</th><th class="num">할부원금</th>'; }).join('') + '</tr></thead><tbody>';
        MODELS.forEach(function (m) {
            m.caps.forEach(function (cp) {
                if (!cp.retail || cp.sold) return;
                h += '<tr><td class="mname">' + esc(m.name) + '</td><td>' + cp.c + '</td><td class="num">' + won(cp.retail) + '</td>';
                COLS.forEach(function (col) {
                    var k = E.rowKey(m.id, cp.c, col[0], col[1]), s = sub(m, cp.c, col[0], col[1]);
                    var ag = ui.draft[k], prin = ag == null || ag === '' ? '' : Math.max(0, cp.retail - s - Number(ag));
                    var chg = String(ag) !== String(ui.base[k]);
                    var mm = mk[k], hint = '';
                    if (mm) {
                        if (prin === '') hint = '<span class="hint">최저 ' + won(mm.v) + '</span>';
                        else if (prin > mm.v) hint = '<span class="hint lo" title="' + esc(mm.who) + '">최저보다 +' + won(prin - mm.v) + '</span>';
                        else hint = '<span class="hint win">최저가</span>';
                    }
                    h += '<td class="num gs">' + won(s) + '</td><td class="num"><input data-k="' + k + '" data-r="' + cp.retail + '" data-s="' + s + '" value="' + (prin === '' ? '' : won(prin)) + '"' + (chg ? ' class="chg"' : '') + '>' + hint + '</td>';
                });
                h += '</tr>';
            });
        });
        h += '</tbody></table></div><p class="desc" style="margin-top:8px">파란 칸 = 마지막 등록값에서 바꾼 칸. "최저" = 지금 노출 중인 다른 판매점 중 가장 싼 할부원금.</p>';
        return h;
    }
    function bulkModal() {
        modal('<h3>일괄 조정</h3><p class="desc">입력된 칸의 할부원금을 한꺼번에 올리거나 내려요 (빈칸은 그대로).</p>' +
            '<label class="fl">대상</label><select class="sel" id="bCol"><option value="all">전체</option>' + COLS.map(function (c, i) { return '<option value="' + i + '">' + c[2] + '</option>'; }).join('') + '</select>' +
            '<label class="fl">할부원금 변경 (원, 내리면 −)</label><input class="in" id="bAmt" placeholder="-10000" inputmode="numeric">' +
            '<div class="ft"><button class="btn" data-act="close">취소</button><button class="btn pri" data-act="bulkApply">적용</button></div>');
    }
    function bulkApply() {
        var amt = Number($('bAmt').value.replace(/[^\d-]/g, '')); if (!amt) return toast('금액을 적어주세요');
        var col = $('bCol').value, n = 0;
        Object.keys(ui.draft).forEach(function (k) {
            var p = k.split('|');
            if (col !== 'all' && (COLS[col][0] !== p[2] || COLS[col][1] !== p[3])) return;
            if (ui.draft[k] == null || ui.draft[k] === '') return;
            ui.draft[k] = Math.max(0, Number(ui.draft[k]) - amt); n++;   // 할부원금 +amt = 지원금 −amt
        });
        close(); render(); toast(n + '칸 조정했어요. 등록을 눌러야 반영돼요');
    }
    function submitSheet() {
        var nm = DB.store(ui.priceStore).name;
        run(DB.saveSheet(ui.priceStore, ui.draft, ui.conds), nm + ' 시세 등록 완료 · 고객 화면에 바로 반영', function () { ui.draftFor = ''; });
    }
    function copyModal() {
        var others = myStores().filter(function (s) { return s.id !== ui.priceStore; });
        modal('<h3>다른 매장에 복사</h3><p class="desc"><b>' + esc(DB.store(ui.priceStore).name) + '</b>의 마지막 등록 시세·조건을 그대로 덮어써요. 먼저 이 매장 시세를 등록한 뒤 복사하세요.</p>' +
            '<label class="ck"><input type="checkbox" id="cAll"> <b>전체 선택 (' + others.length + '곳)</b></label>' +
            '<div style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:4px 10px">' + others.map(function (s) {
                var sh = DB.latestSheet(s.id);
                return '<label class="ck"><input type="checkbox" class="cTo" value="' + s.id + '"> ' + esc(s.name) + ' <span class="desc">' + (sh ? (sh.date === DB.today() ? '오늘 ' + sh.submitted_at.slice(11, 16) : '전일') : '미등록') + '</span></label>';
            }).join('') + '</div>' +
            '<div class="ft"><button class="btn" data-act="close">취소</button><button class="btn pri" data-act="copyRun">복사</button></div>');
    }
    function copyRun() {
        var ids = Array.prototype.filter.call(document.querySelectorAll('.cTo'), function (x) { return x.checked; }).map(function (x) { return x.value; });
        if (!ids.length) return toast('복사할 매장을 고르세요');
        toast(ids.length + '곳 복사 중…');
        run(DB.copySheet(ui.priceStore, ids), function (r) { return r.n + '곳에 복사했어요'; }, close);
    }

    /* ---------- 매장 관리 ---------- */
    function vStores() {
        var list = myStores();
        return '<div class="row"><div class="h1">매장 관리<small>' + list.length + '곳</small></div><div class="sp"></div><button class="btn pri" data-act="addStore">매장 추가</button></div>' +
            '<p class="desc">매장 수 제한 없어요. 사진·주소는 "내 주변 특가"에 그대로 나가요. 끄면 고객 화면에서 바로 빠져요.</p>' +
            '<div class="stores">' + list.map(function (s) {
                var sh = DB.latestSheet(s.id);
                return '<div class="sc">' + (s.photo ? '<img src="' + esc(photo(s.photo)) + '" alt="">' : '<div class="ph">사진 없음</div>') +
                    '<div style="min-width:0;flex:1"><b>' + esc(s.name) + '</b><p>' + esc(s.addr) + '</p><p>' + esc(s.hours) + ' · ' + esc(s.phone) + '</p>' +
                    '<div class="row">' + (s.active ? '<span class="tag g">노출</span>' : '<span class="tag r">숨김</span>') +
                    (s.visit ? '<span class="tag">방문</span>' : '') + (s.delivery ? '<span class="tag">택배</span>' : '') + (s.sameDay ? '<span class="tag">당일 수령</span>' : '') +
                    (sh ? (sh.date === DB.today() ? '<span class="tag b">오늘 시세</span>' : '<span class="tag y">전일 시세</span>') : '<span class="tag r">시세 없음</span>') +
                    '</div><div class="row"><button class="btn sm" data-edit="' + s.id + '">수정</button><button class="btn sm" data-toggle="' + s.id + '">' + (s.active ? '숨기기' : '노출') + '</button></div></div></div>';
            }).join('') + '</div>' + (isOwner() || isAdmin() ? linkCard(me().id) : '');
    }
    // 직원 계정 연결: 직원이 먼저 파트너스에서 계정을 만들고, 대표가 그 이메일을 넣음
    function linkCard(dealerId, withPick) {
        return '<div class="card"><b>직원 계정 연결</b><p class="desc">직원이 먼저 파트너스에서 자기 이메일로 계정을 만든 뒤, 그 이메일을 여기 넣으면 이 판매점에 연결돼요. 직원은 접수 관리·시세 등록·매장 관리를 다 쓸 수 있어요.</p>' +
            '<div class="row">' + (withPick ? '<select class="sel" id="kDealer">' + S.dealers.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + '</option>'; }).join('') + '</select>' : '<input type="hidden" id="kDealer" value="' + dealerId + '">') +
            '<input class="in" id="kEmail" type="email" placeholder="직원 이메일" style="width:220px"><select class="sel" id="kRole"><option value="staff">직원</option><option value="owner">대표</option></select>' +
            '<button class="btn pri sm" data-act="linkUser">연결</button></div></div>';
    }
    function storeModal(id) {
        var s = id ? JSON.parse(JSON.stringify(DB.store(id))) : { dealer_id: me().id, name: '', sido: '서울특별시', sigungu: '', addr: '', phone: me().phone, hours: '10:00 ~ 21:00', photo: '', visit: true, delivery: false, sameDay: true, active: true };
        ui.editStore = s;
        var sidos = ['서울특별시', '경기도', '인천광역시', '부산광역시', '대구광역시', '대전광역시', '광주광역시', '울산광역시', '세종특별자치시', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도', '전국'];
        modal('<h3>' + (id ? '매장 수정' : '매장 추가') + '</h3>' +
            '<div class="row"><div id="sPh">' + (s.photo ? '<img src="' + esc(photo(s.photo)) + '" style="width:84px;height:84px;object-fit:cover;border-radius:8px">' : '') + '</div>' +
            '<label class="btn sm">매장 사진 올리기<input type="file" id="sFile" accept="image/*" hidden></label></div>' +
            '<label class="fl">매장명</label><input class="in" id="sName" value="' + esc(s.name) + '" placeholder="예: 신림역점">' +
            '<label class="fl">지역</label><div class="row"><select class="sel" id="sSido" style="flex:1">' + sidos.map(function (x) { return '<option' + (x === s.sido ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>' +
            '<input class="in" id="sGu" value="' + esc(s.sigungu) + '" placeholder="관악구 / 안양시 동안구" style="flex:1"></div>' +
            '<label class="fl">주소 (지도 연결에 그대로 써요)</label><input class="in" id="sAddr" value="' + esc(s.addr) + '">' +
            '<label class="fl">전화 · 영업시간</label><div class="row"><input class="in" id="sTel" value="' + esc(s.phone) + '" style="flex:1"><input class="in" id="sHours" value="' + esc(s.hours) + '" style="flex:1"></div>' +
            '<label class="ck"><input type="checkbox" id="sVisit"' + (s.visit ? ' checked' : '') + '> 매장 방문 개통 (내 주변 특가에 노출)</label>' +
            '<label class="ck"><input type="checkbox" id="sDel"' + (s.delivery ? ' checked' : '') + '> 택배 개통 (온라인 특가에 노출)</label>' +
            '<label class="ck"><input type="checkbox" id="sSame"' + (s.sameDay ? ' checked' : '') + '> 당일 수령 가능</label>' +
            '<p class="desc">좌표(내 위치 근처 정렬용)는 아직 자동으로 안 채워져요. 새 매장은 지역 선택으로만 검색돼요.</p>' +
            '<div class="ft"><button class="btn" data-act="close">취소</button><button class="btn pri" data-act="saveStore">저장</button></div>');
    }
    function readPhoto(file) {
        var fr = new FileReader();
        fr.onload = function () {
            var img = new Image();
            img.onload = function () {
                var k = Math.min(1, 320 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
                cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
                cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                ui.editStore.photo = cv.toDataURL('image/jpeg', .8);
                $('sPh').innerHTML = '<img src="' + ui.editStore.photo + '" style="width:84px;height:84px;object-fit:cover;border-radius:8px">';
            };
            img.src = fr.result;
        };
        fr.readAsDataURL(file);
    }
    function saveStore() {
        var s = ui.editStore;
        s.name = $('sName').value.trim(); s.sido = $('sSido').value; s.sigungu = $('sGu').value.trim(); s.addr = $('sAddr').value.trim();
        s.phone = $('sTel').value.trim(); s.hours = $('sHours').value.trim();
        s.visit = $('sVisit').checked; s.delivery = $('sDel').checked; s.sameDay = $('sSame').checked;
        if (!s.name || !s.addr) return toast('매장명과 주소는 꼭 적어주세요');
        if (!s.visit && !s.delivery) return toast('방문·택배 중 하나는 골라주세요');
        run(DB.saveStore(s), '저장했어요', close);
    }

    /* ---------- 정산 ---------- */
    function vSettle() {
        var d = me(), ym = DB.today().slice(0, 7);
        var apps = myApps().filter(function (a) { return a.created_at.slice(0, 7) === ym || (a.log || []).some(function (l) { return l.t.slice(0, 7) === ym; }); });
        var done = apps.filter(function (a) { return a.status === '개통완료'; });
        var fee = done.reduce(function (s, a) { return s + DB.appFee(a); }, 0);
        var by = {};
        apps.forEach(function (a) { var b = by[a.store_id] = by[a.store_id] || { n: 0, done: 0, cancel: 0, amt: 0 }; b.n++; if (a.status === '개통완료') { b.done++; b.amt += DB.appFee(a); } if (a.status === '취소') b.cancel++; });
        return '<div class="h1">정산<small>' + ym.replace('-', '년 ') + '월</small></div>' +
            '<p class="desc">개통완료 건당 ' + won(DB.FEE.launch) + '원(' + DB.FEE.launchEnd.replace(/-/g, '.') + '까지 개통분 런칭가) → 이후 ' + won(DB.FEE.std) + '원. VAT 별도, 취소·미개통은 0원. 매달 1일 전월분 세금계산서 발행.</p>' +
            '<div class="kv"><div><span>이번 달 신청</span><b>' + apps.length + '건</b></div><div><span>개통완료</span><b>' + done.length + '건</b></div>' +
            '<div><span>개통 전환율</span><b>' + (apps.length ? Math.round(done.length / apps.length * 100) : 0) + '%</b></div><div><span>예상 청구액</span><b>' + won(fee) + '원</b></div></div>' +
            '<div class="tw"><table><thead><tr><th>매장</th><th class="num">신청</th><th class="num">개통완료</th><th class="num">취소</th><th class="num">금액</th>' + '</tr></thead><tbody>' +
            Object.keys(by).map(function (id) {
                var b = by[id];
                return '<tr><td>' + esc((DB.store(id) || {}).name) + '</td><td class="num">' + b.n + '</td><td class="num">' + b.done + '</td><td class="num">' + b.cancel + '</td>' +
                    '<td class="num">' + won(b.amt) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
    }

    /* ---------- 운영자 ---------- */
    function vAdmin() {
        var rep = S.apps.filter(function (a) { return a.reported; });
        var h = '<div class="h1">입점 심사 · 신고</div><p class="desc">사업자등록증·사전승낙서 확인 후 승인하면 그 판매점 시세가 고객 화면에 나가요.</p>' +
            '<div class="tw"><table><thead><tr><th>판매점</th><th>사업자번호</th><th>대표 · 연락처</th><th>서류</th><th class="num">매장</th><th class="num">신청</th><th class="num">미연락</th><th class="num">확인 불일치</th><th>상태</th><th></th></tr></thead><tbody>' +
            S.dealers.map(function (d) {
                var ns = S.stores.filter(function (s) { return s.dealer_id === d.id; }).length, mine = S.apps.filter(function (a) { return a.dealer_id === d.id; }), na = mine.length,
                    nOver = mine.filter(DB.overdue).length, nMis = mine.filter(DB.mismatch).length;
                var tag = d.status === 'approved' ? '<span class="tag g">승인</span>' : d.status === 'pending' ? '<span class="tag y">심사 대기</span>' : '<span class="tag r">중지</span>';
                return '<tr><td><b>' + esc(d.name) + '</b>' + '' + '</td><td>' + esc(d.biz_no) + '</td><td>' + esc((d.ceo || '-') + ' · ' + d.phone) + '</td>' +
                    '<td>' + esc((d.docs || []).length ? d.docs.length + '개' : '-') + '</td>' +
                    '<td class="num">' + ns + '</td><td class="num">' + na + '</td><td class="num">' + nOver + '</td><td class="num">' + (nMis ? '<b style="color:var(--red)">' + nMis + '/3</b>' : '0') + '</td><td>' + tag + '</td><td>' +
                    (d.status !== 'approved' ? '<button class="btn sm pri" data-dst="' + d.id + '|approved">승인</button> ' : '') +
                    (d.status === 'approved' ? '<button class="btn sm red" data-dst="' + d.id + '|stopped">노출 중지</button>' : '') + '</td></tr>';
            }).join('') + '</tbody></table></div>';
        h += '<div class="card"><b>가격이 달라요 신고 ' + rep.length + '건</b><p class="desc">같은 판매점 신고 3건이 확인되면 노출 중지. 고객에게는 운영팀이 직접 연락.</p>' +
            (rep.length ? '<div class="tw"><table><thead><tr><th>접수번호</th><th>판매점 · 매장</th><th>모델</th><th class="num">신청 가격</th><th>상태</th></tr></thead><tbody>' + rep.map(function (a) {
                var s = DB.store(a.store_id) || {}, d = DB.dealer(a.dealer_id) || {};
                return '<tr><td>' + a.id + '</td><td>' + esc(d.name + ' · ' + s.name) + '</td><td>' + esc(mdl(a.model).name + ' ' + a.cap) + '</td><td class="num">' + won(a.price || 0) + '</td><td>' + esc(a.status) + '</td></tr>';
            }).join('') + '</tbody></table></div>' : '') + '</div>';
        return h + linkCard(null, true);
    }

    /* ---------- 라우팅 ---------- */
    function render() {
        S = DB.state;
        var root = $('root'), view = (location.hash.replace(/^#\/?/, '') || '').split('/')[0];
        if (!booted) { root.innerHTML = '<div class="login"><div class="logo">LGU+<b>더끌림컴퍼니</b><small>파트너스</small></div><div class="card">불러오는 중…</div></div>'; return; }
        if (!DB.auth.user) { root.innerHTML = vLogin(); document.title = 'LGU+더끌림컴퍼니 파트너스'; return; }
        var d = me();
        if (!d && !isAdmin()) { root.innerHTML = vNoDealer(); return; }
        if (d && d.status !== 'approved' && !isAdmin()) { root.innerHTML = shell(view, '<div class="h1">심사 중이에요</div><div class="card">서류 확인 후 승인되면 시세 등록·접수 관리를 쓸 수 있어요. 운영팀이 ' + esc(d.phone) + ' 으로 연락드려요.</div>'); return; }
        if (view === 'admin' && isAdmin()) { /* 운영자 화면 */ }
        else if (!d || d.status !== 'approved') view = 'admin';
        else if (['online', 'visit', 'price', 'stores', 'settle'].indexOf(view) < 0) view = 'online';
        if ((view === 'online' || view === 'visit') && ui.chan !== view) { ui.chan = view; ui.status = '전체'; }
        var y = window.scrollY;
        root.innerHTML = shell(view, { online: vApps, visit: vApps, price: vPrice, stores: vStores, settle: vSettle, admin: vAdmin }[view]());
        window.scrollTo(0, y);
        var n = myApps().filter(function (a) { return a.status === '신규'; }).length;
        document.title = (n ? '(' + n + ') ' : '') + 'LGU+더끌림컴퍼니 파트너스';
    }

    document.addEventListener('click', function (e) {
        var t = e.target.closest('[data-act],[data-st],[data-detail],[data-edit],[data-toggle],[data-dst],[data-rmaddon]');
        if (!t) { if (e.target === $('dim')) close(); return; }
        var ds = t.dataset;
        if (t.tagName === 'A') e.preventDefault();
        if (ds.st) { ui.status = ds.st; render(); return; }
        if (ds.detail) return detailModal(ds.detail);
        if (ds.edit) return storeModal(ds.edit);
        if (ds.toggle) { var s = Object.assign({}, DB.store(ds.toggle)); s.active = !s.active; run(DB.saveStore(s), s.active ? '고객 화면에 다시 보여요' : '고객 화면에서 숨겼어요'); return; }
        if (ds.dst) { var p = ds.dst.split('|'); run(DB.setDealerStatus(p[0], p[1]), p[1] === 'approved' ? '승인했어요 · 고객 화면에 노출돼요' : '노출을 중지했어요'); return; }
        if (ds.rmaddon != null) { ui.conds.addons.splice(+ds.rmaddon, 1); render(); return; }
        switch (ds.act) {
            case 'close': close(); break;
            case 'join': joinModal(); break;
            case 'joinSubmit': joinSubmit(); break;
            case 'logout': DB.signOut().then(function () { location.hash = ''; render(); }); break;
            case 'toggleSignup': ui.signup = !ui.signup; render(); break;
            case 'signin': case 'signup':
                var em = $('lEmail').value.trim(), pw = $('lPw').value;
                if (!/^\S+@\S+\.\S+$/.test(em)) return toast('이메일을 확인해주세요');
                if (pw.length < 6) return toast('비밀번호는 6자 이상이에요');
                if (busy) return; busy = true; t.disabled = true;
                (ds.act === 'signin' ? DB.signIn(em, pw) : DB.signUp(em, pw)).then(function (r) {
                    busy = false;
                    if (!r.ok) { t.disabled = false; return toast(r.msg); }
                    if (ds.act === 'signup' && !r.in) { ui.signup = false; render(); return toast('확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요'); }
                    afterLogin();
                });
                break;
            case 'recheck': DB.refresh().then(afterLogin); break;
            case 'linkUser':
                var ke = $('kEmail').value.trim();
                if (!/^\S+@\S+\.\S+$/.test(ke)) return toast('직원 이메일을 확인해주세요');
                run(DB.linkUser(ke, $('kDealer').value, $('kRole').value), ke + ' 연결했어요. 직원이 새로고침하면 들어와져요');
                break;
            case 'csv': csv(); break;
            case 'reload': ui.draftFor = ''; render(); toast('마지막 등록 시세를 불러왔어요'); break;
            case 'bulk': bulkModal(); break;
            case 'bulkApply': bulkApply(); break;
            case 'submit': submitSheet(); break;
            case 'copy': copyModal(); break;
            case 'copyRun': copyRun(); break;
            case 'addStore': storeModal(); break;
            case 'saveStore': saveStore(); break;
            case 'addAddon':
                var nm = $('adName').value.trim(), fee = Number($('adFee').value.replace(/\D/g, '')), mo = Number($('adMon').value.replace(/\D/g, ''));
                if (!nm || !fee || !mo) return toast('이름·월 요금·유지 개월을 다 적어주세요');
                ui.conds.addons = (ui.conds.addons || []).concat([{ name: nm, fee: fee, months: mo }]); render(); break;
        }
    });
    document.addEventListener('change', function (e) {
        var t = e.target, ds = t.dataset;
        if (ds.status) { run(DB.updateApp(ds.status, { status: t.value }), ds.status + ' → ' + t.value); return; }
        if (ds.memo) { DB.updateApp(ds.memo, { memo: t.value }).then(function (r) { if (!r.ok) toast('메모 저장 실패: ' + r.msg); }); return; }
        if (ds.k) {   // 할부원금 → 대리점 지원금
            var v = t.value.replace(/[^\d-]/g, '');
            if (v === '') delete ui.draft[ds.k];
            else ui.draft[ds.k] = Math.max(0, Number(ds.r) - Number(ds.s) - Number(v));
            render(); return;
        }
        if (t.id === 'fStore') { ui.store = t.value; render(); }
        else if (t.id === 'fPeriod') { ui.period = t.value; render(); }
        else if (t.id === 'pStore') { ui.priceStore = t.value; ui.draftFor = ''; render(); }
        else if (t.id === 'cAll') document.querySelectorAll('.cTo').forEach(function (x) { x.checked = t.checked; });
        else if (t.id === 'sFile' && t.files[0]) readPhoto(t.files[0]);
    });
    document.addEventListener('input', function (e) {
        if (e.target.id === 'fQ') { ui.q = e.target.value; clearTimeout(ui._q); ui._q = setTimeout(function () { render(); var q = $('fQ'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 300); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    // 새 신청·다른 직원의 상태 변경 실시간 반영 (Supabase Realtime)
    function typing() { return $('dim').classList.contains('on') || (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)); }
    var pendingRender = false;
    function onChange(ev) {
        DB.refresh().then(function () {
            if (ev.eventType === 'INSERT') { toast('새 신청이 들어왔어요 · ' + ev.new.id); }
            if (typing()) pendingRender = true; else render();
        });
    }
    document.addEventListener('focusout', function () { setTimeout(function () { if (pendingRender && !typing()) { pendingRender = false; render(); } }, 300); });
    function afterLogin() {
        if (location.hash.indexOf('access_token') >= 0) history.replaceState(null, '', location.pathname);
        DB.listen(onChange);
        if (!me() && isAdmin()) location.hash = '#/admin';
        render();
    }
    window.addEventListener('hashchange', render);

    ['1', '2'].forEach(function (kd) { ['85', '115'].forEach(function (t) { E.fetchSubsidy(kd, E.PLAN_BY_TIER[t]); }); });
    E.onLive(function () { if (location.hash.indexOf('price') >= 0) render(); });
    setInterval(function () { if (location.hash.indexOf('price') >= 0 && !typing()) render(); }, 60000);
    render();
    DB.ready.then(function () { booted = true; afterLogin(); }, function (e) { booted = true; render(); toast(DB.msgOf(e)); });
})();
