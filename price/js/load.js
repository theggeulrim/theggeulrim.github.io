/* 가격 원본은 홈페이지(theggeulrim.com/) 하나: 홈페이지 index.html 안의 OS_DATA를 그대로 읽어 씀.
   홈페이지 단가를 고치면 이 화면도 같이 바뀜. 못 읽으면 가격을 보여주지 않음(옛 가격 노출 방지). */
(function () {
    var MARK = 'var OS_DATA=';
    function fail() {
        document.getElementById('app').innerHTML =
            '<div class="empty" style="padding:80px 20px">가격을 불러오지 못했어요.<br>잠시 뒤 다시 열어 주세요.' +
            '<div class="cta" style="max-width:260px;margin:20px auto 0"><a class="btn btn-kakao" href="http://pf.kakao.com/_xlyGxin/chat">카톡으로 가격 문의</a></div></div>';
    }
    var d = new Date(Date.now() + 9 * 3600 * 1000);   // 한국 시간
    window.PRICE_DATE = d.toISOString().slice(0, 10);
    fetch('/', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw 0; return r.text(); })
        .then(function (h) {
            var i = h.indexOf(MARK);
            if (i < 0) throw 0;
            var j = h.indexOf('</script>', i);
            window.OS_DATA = JSON.parse(h.slice(i + MARK.length, j).trim().replace(/;$/, ''));
            if (!window.OS_DATA.models || !window.OS_DATA.ag) throw 0;
            var s = document.createElement('script');
            s.src = 'js/app.js?v=1109';
            document.body.appendChild(s);
        })
        .catch(fail);
})();
