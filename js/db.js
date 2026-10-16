/* 오늘폰 데이터 계층 — Supabase 연결
   - 고객 화면: 로그인 없음. live_deals 뷰·fee_policy 읽기 + submit_app / my_apps_info / report_app / confirm_app 함수만 씀
   - 파트너스: 이메일 로그인. RLS 가 자기 판매점 것만 보여줌 (운영자는 전부)
   - 화면 코드는 예전 데모와 같은 DB.* 이름을 씀. 읽기는 메모리 캐시(S)에서 동기로, 쓰기는 Promise 로 {ok, msg} 돌려줌
   - 키는 publishable(공개용)만 넣음. service_role 키는 절대 여기 넣지 않음 */
(function () {
    var URL_ = 'https://pqgkcrxmxmwxziqbafeb.supabase.co';
    var KEY_ = 'sb_publishable_1w8vfDBJTNh_6QheCX2_Bw_C9Lep6zR';
    var MODE = window.DB_MODE || 'customer';           // 'customer' | 'partner'
    var MY = 'oneulphone.my2';                          // 고객 기기에 저장: [{id, token}]
    var KST = 9 * 3600e3;
    var sb = window.supabase.createClient(URL_, KEY_, { auth: { persistSession: MODE === 'partner', autoRefreshToken: MODE === 'partner' } });

    function kstNow() { return new Date(Date.now() + KST); }
    function today(off) { var d = new Date(Date.now() + KST - (off || 0) * 864e5); return d.toISOString().slice(0, 10); }
    function kstHour() { return kstNow().getUTCHours() + kstNow().getUTCMinutes() / 60; }
    function kstStr(iso) { return iso ? new Date(Date.parse(iso) + KST).toISOString().slice(0, 19) + '+09:00' : ''; }
    function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    // DB 오류 문구 → 화면용. 함수에서 raise 한 한국어 문구는 그대로 보여줌
    function msgOf(err) {
        var m = (err && (err.message || err.error_description)) || '';
        if (/[가-힣]/.test(m)) return m.replace(/^.*?: /, '');
        if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요';
        if (/Email not confirmed/i.test(m)) return '메일함의 확인 링크를 먼저 눌러주세요';
        if (/already registered/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요';
        if (/Password should be/i.test(m)) return '비밀번호는 6자 이상이어야 해요';
        if (/rate limit/i.test(m)) return '요청이 많아 잠시 막혔어요. 잠시 뒤 다시 해주세요';
        if (/Failed to fetch|NetworkError/i.test(m)) return '인터넷 연결을 확인해 주세요';
        if (/duplicate key.*biz_no/i.test(m)) return '이미 등록된 사업자번호예요';
        if (/row-level security|permission denied/i.test(m)) return '권한이 없어요';
        return m || '저장하지 못했어요. 다시 해주세요';
    }

    /* ---------- 과금 정책 (fee_policy 테이블 값으로 덮어씀) ---------- */
    var FEE = { std: 50000, launch: 30000, launchEnd: '2027-01-31' };
    var CONFIRM_DAYS = 7, REPLY_HOURS = 2;
    function feeOn(day) { return day && day <= FEE.launchEnd ? FEE.launch : FEE.std; }
    function openedDay(a) { return new Date(Date.parse(a.opened_at || a.created_at) + KST).toISOString().slice(0, 10); }
    function appFee(a) { return a.status === '개통완료' ? feeOn(openedDay(a)) : 0; }
    function confirmDue(a) { return a.status === '개통완료' || Date.now() - Date.parse(a.created_at) >= CONFIRM_DAYS * 864e5; }
    function mismatch(a) { return (a.confirm === 'yes' && a.status !== '개통완료') || (a.confirm === 'no' && a.status === '개통완료'); }
    function overdue(a) { return a.status === '신규' && Date.now() - Date.parse(a.created_at) > REPLY_HOURS * 3600e3; }
    var NO_COND = { addons: [], card: false, bundle: false, giveBack: false, insurance: false };

    /* ---------- 캐시 ---------- */
    var S = { dealers: [], stores: [], sheets: [], apps: [] };
    var AUTH = { user: null, dealerId: null, role: null, admin: false };
    var extraStores = {};   // 고객 신청내역용: 시세가 내려가 live_deals 에 없는 매장 정보

    // DB 행 → 화면 객체 (same_day ↔ sameDay)
    function toStore(r) {
        return { id: r.id || r.store_id, dealer_id: r.dealer_id, name: r.name, sido: r.sido, sigungu: r.sigungu, addr: r.addr, lat: r.lat, lng: r.lng,
            photo: r.photo || '', phone: r.phone || '', hours: r.hours || '', visit: !!r.visit, delivery: !!r.delivery, sameDay: !!r.same_day,
            active: r.active !== false, online: !r.visit && !!r.delivery };
    }
    function toSheet(r) { return { id: r.id, store_id: r.store_id, date: r.date, rows: r.rows || {}, conds: r.conds || NO_COND, submitted_at: kstStr(r.submitted_at) }; }
    function storeRow(s) {
        return { dealer_id: s.dealer_id, name: s.name, sido: s.sido, sigungu: s.sigungu, addr: s.addr, lat: s.lat == null ? null : s.lat, lng: s.lng == null ? null : s.lng,
            photo: s.photo || null, phone: s.phone || null, hours: s.hours || null, visit: !!s.visit, delivery: !!s.delivery, same_day: !!s.sameDay, active: s.active !== false };
    }

    function loadFee() {
        return sb.from('fee_policy').select('*').eq('id', 1).maybeSingle().then(function (r) {
            if (r.data) { FEE.std = r.data.std; FEE.launch = r.data.launch; FEE.launchEnd = r.data.launch_end; REPLY_HOURS = r.data.reply_hours; CONFIRM_DAYS = r.data.confirm_days; DB.REPLY_HOURS = REPLY_HOURS; }
        });
    }

    /* ---------- 고객 ---------- */
    function loadLive() {
        return sb.from('live_deals').select('*').then(function (r) {
            if (r.error) throw r.error;
            var ds = {}, stores = [], sheets = [];
            (r.data || []).forEach(function (x) {
                ds[x.dealer_id] = ds[x.dealer_id] || { id: x.dealer_id, name: x.dealer_name, badge: x.badge, status: 'approved' };
                var st = toStore(x); st.dealer_id = x.dealer_id; stores.push(st);
                sheets.push({ id: x.sheet_id, store_id: x.store_id, date: x.date, rows: x.rows || {}, conds: x.conds || NO_COND, submitted_at: kstStr(x.submitted_at) });
            });
            S.dealers = Object.keys(ds).map(function (k) { return ds[k]; });
            S.stores = stores; S.sheets = sheets;
        });
    }
    function myTokens() { return lsGet(MY, []).map(function (x) { return x.token; }); }
    function loadMy() {
        var t = myTokens();
        if (!t.length) { S.apps = []; return Promise.resolve(); }
        return sb.rpc('my_apps_info', { tokens: t }).then(function (r) {
            if (r.error) throw r.error;
            S.apps = (r.data || []).map(function (a) {
                extraStores[a.store_id] = { id: a.store_id, name: a.store_name, phone: a.store_phone, photo: a.store_photo || '', visit: true, active: true };
                return a;
            });
        });
    }
    function tokenOf(id) { var x = lsGet(MY, []).filter(function (y) { return y.id === id; })[0]; return x && x.token; }
    function addApp(a) {
        return sb.rpc('submit_app', { a: a }).then(function (r) {
            if (r.error) return { ok: false, msg: msgOf(r.error) };
            var row = Array.isArray(r.data) ? r.data[0] : r.data;
            var my = lsGet(MY, []); my.unshift({ id: row.id, token: row.token }); lsSet(MY, my);
            return loadMy().then(function () { return { ok: true, id: row.id }; }, function () { return { ok: true, id: row.id }; });
        }, function (e) { return { ok: false, msg: msgOf(e) }; });
    }
    function reportApp(id) {
        var t = tokenOf(id); if (!t) return Promise.resolve({ ok: false, msg: '이 기기에서 한 신청이 아니에요' });
        return sb.rpc('report_app', { t: t }).then(function (r) { return r.error ? { ok: false, msg: msgOf(r.error) } : loadMy().then(function () { return { ok: true }; }); });
    }
    function confirmApp(id, v) {
        var t = tokenOf(id); if (!t) return Promise.resolve({ ok: false, msg: '이 기기에서 한 신청이 아니에요' });
        return sb.rpc('confirm_app', { t: t, v: v }).then(function (r) { return r.error ? { ok: false, msg: msgOf(r.error) } : loadMy().then(function () { return { ok: true }; }); });
    }

    /* ---------- 파트너스: 로그인 ---------- */
    function loadAuth() {
        return sb.auth.getSession().then(function (r) {
            var u = r.data && r.data.session && r.data.session.user;
            AUTH.user = u || null; AUTH.dealerId = null; AUTH.role = null; AUTH.admin = false;
            if (!u) return;
            return Promise.all([
                sb.from('dealer_users').select('dealer_id, role').eq('user_id', u.id).maybeSingle(),
                sb.rpc('is_admin')
            ]).then(function (x) {
                if (x[0].data) { AUTH.dealerId = x[0].data.dealer_id; AUTH.role = x[0].data.role; }
                AUTH.admin = x[1].data === true;
            });
        });
    }
    function signIn(email, pw) {
        return sb.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
            if (r.error) return { ok: false, msg: msgOf(r.error) };
            return refresh().then(function () { return { ok: true }; });
        });
    }
    function signUp(email, pw) {
        var back = location.href.split('#')[0];
        return sb.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: back } }).then(function (r) {
            if (r.error) return { ok: false, msg: msgOf(r.error) };
            if (r.data.session) return refresh().then(function () { return { ok: true, in: true }; });
            return { ok: true, in: false };   // 메일 확인 필요
        });
    }
    function signOut() {
        return sb.auth.signOut().then(function () { S = { dealers: [], stores: [], sheets: [], apps: [] }; AUTH.user = null; AUTH.dealerId = null; AUTH.admin = false; AUTH.role = null; });
    }

    /* ---------- 파트너스: 읽기 ---------- */
    function loadPartner() {
        if (!AUTH.user) { S = { dealers: [], stores: [], sheets: [], apps: [] }; return Promise.resolve(); }
        var since = new Date(Date.now() - 120 * 864e5).toISOString();   // 신청은 최근 4개월
        return Promise.all([
            sb.from('dealers').select('*').order('created_at'),
            sb.from('stores').select('*').order('created_at'),
            sb.from('sheets').select('*').gte('date', today(1)),
            sb.from('apps').select('*').gte('created_at', since).order('created_at', { ascending: false }),
            sb.from('app_log').select('app_id, status, by_name, at').gte('at', since).order('at')
        ]).then(function (x) {
            x.forEach(function (r) { if (r.error) throw r.error; });
            var logs = {};
            x[4].data.forEach(function (l) { (logs[l.app_id] = logs[l.app_id] || []).push({ t: l.at, s: l.status, by: l.by_name || '' }); });
            S = {
                dealers: x[0].data.map(function (d) { d.joined = (d.created_at || '').slice(0, 10); return d; }),
                stores: x[1].data.map(toStore),
                sheets: x[2].data.map(toSheet),
                apps: x[3].data.map(function (a) { a.log = logs[a.id] || []; return a; })
            };
        });
    }

    /* ---------- 파트너스: 쓰기 ---------- */
    function updateApp(id, patch) {
        var a = S.apps.filter(function (x) { return x.id === id; })[0];
        if (!a) return Promise.resolve({ ok: false, msg: '신청을 찾을 수 없어요' });
        var old = {}; Object.keys(patch).forEach(function (k) { old[k] = a[k]; a[k] = patch[k]; });   // 화면 먼저 반영
        var row = {}; ['status', 'memo', 'visit_date'].forEach(function (k) { if (k in patch) row[k] = patch[k]; });
        return sb.from('apps').update(row).eq('id', id).select('id, status, opened_at, first_contact_at').then(function (r) {
            if (r.error || !r.data || !r.data.length) { Object.keys(old).forEach(function (k) { a[k] = old[k]; }); return { ok: false, msg: r.error ? msgOf(r.error) : '권한이 없어요' }; }
            Object.assign(a, r.data[0]);
            if ('status' in patch && patch.status !== old.status) a.log = (a.log || []).concat([{ t: new Date().toISOString(), s: patch.status, by: (dealer(AUTH.dealerId) || {}).name || '운영자' }]);
            return { ok: true };
        });
    }
    function canSubmit() { var h = kstHour(); return h >= 10 && h < 20; }
    function saveSheet(storeId, rows, conds) {
        // 시간·조건 검사는 DB 트리거(guard_sheet)가 최종 판단. 여기선 미리 안내만
        if (!canSubmit() && !AUTH.admin) return Promise.resolve({ ok: false, msg: '시세 등록은 오전 10시 ~ 오후 8시에만 할 수 있어요.' });
        return sb.from('sheets').upsert({ store_id: storeId, date: today(), rows: rows, conds: conds }, { onConflict: 'store_id,date' }).select().then(function (r) {
            if (r.error) return { ok: false, msg: msgOf(r.error) };
            var sh = toSheet(r.data[0]);
            S.sheets = S.sheets.filter(function (x) { return !(x.store_id === storeId && x.date === sh.date); }).concat([sh]);
            return { ok: true, sheet: sh };
        });
    }
    function copySheet(fromStoreId, toIds) {
        var src = latestSheet(fromStoreId);
        if (!src) return Promise.resolve({ ok: false, msg: '복사할 시세표가 없어요.' });
        var n = 0;
        return toIds.reduce(function (p, id) {
            return p.then(function (r) { if (r && !r.ok) return r; return saveSheet(id, src.rows, src.conds).then(function (x) { if (x.ok) n++; return x; }); });
        }, Promise.resolve(null)).then(function (r) { return r && !r.ok ? { ok: false, msg: r.msg + (n ? ' (' + n + '곳은 복사됨)' : '') } : { ok: true, n: n }; });
    }
    function saveStore(st) {
        var row = storeRow(st);
        var q = st.id ? sb.from('stores').update(row).eq('id', st.id).select() : sb.from('stores').insert(row).select();
        return q.then(function (r) {
            if (r.error || !r.data || !r.data.length) return { ok: false, msg: r.error ? msgOf(r.error) : '권한이 없어요' };
            var s = toStore(r.data[0]);
            var i = S.stores.findIndex(function (x) { return x.id === s.id; });
            if (i < 0) S.stores.push(s); else S.stores[i] = s;
            return { ok: true, store: s };
        });
    }
    function setDealerStatus(id, status) {
        return sb.from('dealers').update({ status: status }).eq('id', id).select('id, status').then(function (r) {
            if (r.error || !r.data || !r.data.length) return { ok: false, msg: r.error ? msgOf(r.error) : '권한이 없어요' };
            dealer(id).status = status; return { ok: true };
        });
    }
    function joinDealer(p) {
        return sb.rpc('join_dealer', { p: p }).then(function (r) {
            if (r.error) return { ok: false, msg: msgOf(r.error) };
            return refresh().then(function () { return { ok: true }; });
        });
    }
    function linkUser(email, dealerId, role) {
        return sb.rpc('link_user', { p_email: email, p_dealer: dealerId, p_role: role || 'staff' }).then(function (r) {
            return r.error ? { ok: false, msg: msgOf(r.error) } : { ok: true };
        });
    }

    /* ---------- 실시간: 새 신청·상태 변경 ---------- */
    var chan = null;
    function listen(cb) {
        if (chan) sb.removeChannel(chan);
        if (!AUTH.user) return;
        chan = sb.channel('apps-' + AUTH.user.id)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'apps' }, function (ev) { cb(ev); })
            .subscribe();
    }

    /* ---------- 조회 (동기, 캐시) ---------- */
    function dealer(id) { return S.dealers.filter(function (d) { return d.id === id; })[0]; }
    function store(id) { return S.stores.filter(function (d) { return d.id === id; })[0] || extraStores[id]; }
    function latestSheet(storeId) {
        var t0 = today(), t1 = today(1), best = null;
        S.sheets.forEach(function (sh) {
            if (sh.store_id !== storeId || (sh.date !== t0 && sh.date !== t1)) return;
            if (!best || sh.date > best.date || (sh.date === best.date && sh.submitted_at > best.submitted_at)) best = sh;
        });
        return best;
    }
    function deals(mode) {
        var out = [];
        S.stores.forEach(function (st) {
            if (!st.active) return;
            var d = dealer(st.dealer_id);
            if (!d || d.status !== 'approved') return;
            if (mode === 'online' && !st.delivery) return;
            if (mode === 'near' && !st.visit) return;
            var sh = latestSheet(st.id);
            if (sh) out.push({ store: st, dealer: d, sheet: sh, fresh: sh.date === today() });
        });
        return out;
    }

    function refresh() {
        if (MODE === 'partner') return loadAuth().then(loadPartner);
        return Promise.all([loadLive(), loadMy()]);
    }
    var ready = Promise.all([loadFee().catch(function () {}), refresh()]);

    var DB = window.DB = {
        mode: MODE, sb: sb, ready: ready, refresh: refresh, loadMy: loadMy, loadLive: loadLive,
        load: function () { return S; }, get state() { return S; }, get auth() { return AUTH; },
        dealer: dealer, store: store, deals: deals, latestSheet: latestSheet,
        addApp: addApp, reportApp: reportApp, confirmApp: confirmApp,
        signIn: signIn, signUp: signUp, signOut: signOut, joinDealer: joinDealer, linkUser: linkUser, setDealerStatus: setDealerStatus, listen: listen,
        updateApp: updateApp, saveSheet: saveSheet, copySheet: copySheet, saveStore: saveStore,
        canSubmit: canSubmit, today: today, FEE: FEE, appFee: appFee, openedDay: openedDay, msgOf: msgOf,
        confirmDue: confirmDue, mismatch: mismatch, overdue: overdue, REPLY_HOURS: REPLY_HOURS, kstHour: kstHour, NO_COND: NO_COND
    };
})();
