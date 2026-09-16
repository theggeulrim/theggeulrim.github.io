# -*- coding: utf-8 -*-
"""U+핫딜센터 정보 페이지 생성기
   실행:  python3 tools/build_site.py
   - data/stores.json (영업시간·주차 직접 입력) 과 data/reviews.json (실제 후기) 를 읽어
     매장/후기/시세/가이드/FAQ 페이지와 sitemap.xml 을 다시 만든다.
"""
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import site_data as D
import site_render as R
from site_data import COMPANY as C, BRAND_LINE, ORIGIN
import content_guides as G
import content_faq as F
import build_admin

BASE = D.BASE
TODAY = datetime.date.today().isoformat()
PAGES = []          # (path, lastmod, priority, changefreq)

def _old_lastmods():
    """기존 sitemap.xml 의 lastmod — 내용이 바뀌지 않은 페이지는 날짜를 그대로 둔다"""
    import re
    p = os.path.join(BASE, "sitemap.xml")
    if not os.path.exists(p):
        return {}
    s = open(p, encoding="utf-8").read()
    return dict(re.findall(r"<loc>" + re.escape(ORIGIN) + r"([^<]*)</loc>\s*<lastmod>([^<]+)</lastmod>", s))

OLD_LASTMOD = _old_lastmods()


def write(path, html_text, prio="0.7", freq="weekly", lastmod=None):
    full = os.path.join(BASE, path.lstrip("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    unchanged = (os.path.exists(full)
                 and open(full, encoding="utf-8").read() == html_text)
    with open(full, "w", encoding="utf-8") as f:
        f.write(html_text)
    url = "/" + path.lstrip("/")
    if url.endswith("index.html"):
        url = url[:-len("index.html")]
    if lastmod is None:
        lastmod = OLD_LASTMOD.get(url, TODAY) if unchanged else TODAY
    PAGES.append((url, lastmod, prio, freq))
    print("  ✓", url)


def page(title, desc, path, body, crumbs, extra_graph=None, article=None, robots=None):
    kw = {"extra_graph": extra_graph, "crumbs": crumbs, "article": article}
    if robots:
        kw["robots"] = robots
    return R.head(title, desc, path, **kw) + R.crumb_html(crumbs) + body + R.footer()


def masked(name):
    name = (name or "").strip()
    if not name:
        return "구매 고객"
    return name[0] + "*" * max(1, len(name) - 1)


# ============================================================ 가이드 5종
def build_guides(P):
    print("[가이드]")
    slugs = {g["slug"]: g for g in G.GUIDES}
    for g in G.GUIDES:
        body_html = g["body"](P).replace("__BRAND_BOX__", G.brand_box())
        faq_html = "".join(
            '<details class="faq"><summary>' + R.esc(q) + '</summary><div class="a"><p>'
            + R.esc(a) + "</p></div></details>"
            for q, a in g["faq"])
        rel = "".join(
            '<li><a href="/%s/">%s</a></li>' % (o["slug"], R.esc(o["h1"]))
            for o in G.GUIDES if o["slug"] != g["slug"])
        body = (
            '<main class="wrap"><article>'
            '<h1 class="page-title">' + R.esc(g["h1"]) + "</h1>"
            '<p class="lead">' + R.esc(g["lead"]) + "</p>"
            '<p class="meta">' + BRAND_LINE + " · 최종 업데이트 " + TODAY + "</p>"
            + body_html
            + "<h2>자주 묻는 질문</h2>" + faq_html
            + G.DISCLAIMER
            + R.cta()
            + '<aside class="rel"><h2>함께 보면 좋은 글</h2><ul>' + rel
            + '<li><a href="/prices/">오늘 기준 전체 시세표</a></li>'
            + '<li><a href="/stores/">서울·경기 23개 직영점 안내</a></li></ul></aside>'
            "</article></main>")
        article = {
            "@type": "Article",
            "headline": g["h1"],
            "description": g["desc"],
            "inLanguage": "ko-KR",
            "datePublished": "2026-09-16",
            "dateModified": TODAY,
            "author": {"@id": R.ORG_ID},
            "publisher": {"@id": R.ORG_ID},
            "mainEntityOfPage": ORIGIN + "/" + g["slug"] + "/",
        }
        write("/" + g["slug"] + "/index.html",
              page(g["title"], g["desc"], "/" + g["slug"] + "/", body,
                   [("홈", "/"), ("가이드", None), (g["h1"], None)],
                   extra_graph=[R.faq_node(g["faq"])], article=article),
              prio="0.9")


# ============================================================ 시세표
def build_prices(P):
    print("[시세표]")
    tabs = [("mnp-85", "번호이동 · 85요금제"), ("mnp-115", "번호이동 · 115요금제"),
            ("chg-85", "기기변경 · 85요금제"), ("chg-115", "기기변경 · 115요금제")]
    nav = '<div class="cta-row">' + "".join(
        '<a class="btn btn-line" href="#%s">%s</a>' % (k, n) for k, n in tabs if k in P) + "</div>"
    blocks = ""
    for k, n in tabs:
        if k not in P:
            continue
        blocks += "<h2 id=\"%s-h\">%s</h2>" % (k, n) + R.price_table(P[k], anchor=k)
    updated = max(t["updated"] for t in P.values())
    body = (
        '<main class="wrap-wide"><article>'
        '<h1 class="page-title">LG유플러스 휴대폰 시세표 (오늘 기준 할부원금)</h1>'
        '<p class="lead">아이폰18 Pro·Pro Max, 갤럭시 Z 폴드8·플립8, 아이폰17, 갤럭시S26 등 모델별 '
        '출고가 · 이통사 지원금 · 대리점 지원금 · 할부원금을 이미지가 아닌 텍스트로 공개합니다.</p>'
        '<p class="meta">' + BRAND_LINE + " · 가격 최종 확인 " + updated + "</p>"
        '<div class="callout"><p><strong>표시 기준</strong> — 아래 모든 금액은 단말기 '
        '<strong>할부원금</strong>이며 통신요금은 별도입니다. 해당 요금제를 6개월 유지하는 조건이고, '
        '<strong>부가서비스 가입 · 제휴카드 결합 · 중고폰 반납 조건은 없습니다.</strong> '
        '이통사 지원금 대신 선택약정 25% 요금할인을 선택할 수 있습니다.</p></div>'
        + nav + blocks
        + G.DISCLAIMER + R.cta("이 조건으로 가능한지 확인하기")
        + '<aside class="rel"><h2>가격을 비교하기 전에 읽어보세요</h2><ul>'
        '<li><a href="/lg-uplus-cheap-phone/">LG유플러스 휴대폰 싸게 사는 곳? 비교할 때 볼 7가지</a></li>'
        '<li><a href="/lg-uplus-phone-deals/">휴대폰 성지 시세표 읽는 법</a></li>'
        '<li><a href="/lg-uplus-number-porting/">번호이동 혜택 총정리</a></li>'
        '<li><a href="/lg-uplus-device-change/">기기변경 혜택 총정리</a></li></ul></aside>'
        "</article></main>")
    write("/prices/index.html",
          page("LG유플러스 휴대폰 시세표 · 모델별 할부원금 | U+핫딜센터",
               "LG유플러스 번호이동·기기변경 및 85·115요금제 기준 모델별 출고가, 이통사 지원금, 대리점 지원금, 할부원금을 텍스트로 공개합니다. 부가서비스·제휴카드·중고폰 반납 조건 없음.",
               "/prices/", body,
               [("홈", "/"), ("시세표", None)],
               extra_graph=R.product_nodes(P["mnp-85"])),
          prio="1.0", freq="daily")


# ============================================================ 매장
def naver_map(addr):
    import urllib.parse
    return "https://map.naver.com/p/search/" + urllib.parse.quote(addr)


def build_stores(reviews):
    print("[매장]")
    stores = D.stores()
    by_store = {}
    for r in reviews:
        by_store.setdefault(r.get("store", ""), []).append(r)

    # 목록 페이지
    cards = ""
    for group, slugs in D.REGION_GROUPS:
        cards += "<h2>" + group + "</h2><div class=\"grid\">"
        for s in [x for x in stores if x["slug"] in slugs]:
            cards += (
                '<div class="card"><a href="/store/' + s["slug"] + '/">'
                '<img src="' + s["photo"] + '" alt="U+핫딜센터 ' + s["name"]
                + " 매장 사진 - " + s["address"] + '" loading="lazy" width="640" height="360"></a>'
                '<div class="card-body"><h3><a href="/store/' + s["slug"] + '/">'
                + s["name"] + "</a></h3><p>" + s["address"] + "</p></div></div>")
        cards += "</div>"
    body = (
        '<main class="wrap-wide"><article>'
        '<h1 class="page-title">U+핫딜센터 직영점 안내 (서울·경기 23곳)</h1>'
        '<p class="lead">' + BRAND_LINE + " 아래 매장은 모두 직접 운영하는 직영점입니다.</p>"
        '<p class="meta">대표번호 ' + C["tel"] + " · 전국 우체국 택배 개통도 함께 운영합니다.</p>"
        + cards + R.cta("가까운 매장으로 방문 상담 예약하기") +
        '<aside class="rel"><h2>방문 전에 확인하세요</h2><ul>'
        '<li><a href="/prices/">오늘 기준 모델별 할부원금 시세표</a></li>'
        '<li><a href="/faq/">자주 묻는 질문 — 준비물·개통 절차</a></li></ul></aside>'
        "</article></main>")
    write("/stores/index.html",
          page("U+핫딜센터 직영점 23곳 안내 | 더끌림컴퍼니 LG유플러스 공식인증 대리점",
               "서울 관악·동작·영등포·강서·금천, 경기 안양·수원의 U+핫딜센터(더끌림컴퍼니) 직영점 23곳 주소와 상담 방법을 안내합니다.",
               "/stores/", body, [("홈", "/"), ("매장 안내", None)]),
          prio="0.9")

    # 매장별 페이지
    for s in stores:
        rv = by_store.get(s["slug"], [])
        rv_html = ""
        for r in rv[:20]:
            rv_html += review_card(r, show_store=False)
        if not rv_html:
            rv_html = ('<p class="empty">이 매장에서 개통하신 고객님의 후기를 등록하고 있습니다. '
                       '실제 개통 고객의 동의를 받은 후기만 게시합니다.</p>')
        hours = s["hours"] or "매장별로 상이합니다. 방문 전 대표번호(" + C["tel"] + ")로 확인해 주세요."
        parking = s["parking"] or "매장 위치에 따라 다릅니다. 방문 전 문의해 주세요."
        title = "LG유플러스 " + s["name"] + " | U+핫딜센터 더끌림컴퍼니"
        desc = ("U+핫딜센터 " + s["name"] + " 안내 — " + s["address"]
                + ". LG유플러스 공식인증 대리점 더끌림컴퍼니 직영점. 번호이동·기기변경 상담, 방문 예약, 매장 개통후기.")
        local = {
            "@type": "MobilePhoneStore",
            "@id": ORIGIN + "/store/" + s["slug"] + "/#store",
            "name": "U+핫딜센터 " + s["name"],
            "alternateName": "더끌림컴퍼니 " + s["name"],
            "description": "LG유플러스 공식인증 대리점 U+핫딜센터(주식회사 더끌림컴퍼니) " + s["name"]
                           + ". " + s["landmark"] + ". 번호이동·기기변경 상담 및 개통.",
            "url": ORIGIN + "/store/" + s["slug"] + "/",
            "image": ORIGIN + s["photo"],
            "telephone": C["tel_intl"],
            "address": {"@type": "PostalAddress", "streetAddress": s["street"],
                        "addressLocality": s["locality"], "addressRegion": s["region"],
                        "addressCountry": "KR"},
            "hasMap": naver_map(s["address"]),
            "parentOrganization": {"@id": R.ORG_ID},
            "priceRange": "₩₩",
            "currenciesAccepted": "KRW",
        }
        if s["hours"]:
            local["openingHours"] = s["hours"]
        if rv:
            local["review"] = [review_node(r) for r in rv[:20]]
        body = (
            '<main class="wrap"><article>'
            '<h1 class="page-title">LG유플러스 ' + s["name"] + " | U+핫딜센터</h1>"
            '<p class="lead">' + s["landmark"] + "에 있는 U+핫딜센터 " + s["name"]
            + "입니다. " + BRAND_LINE + "</p>"
            '<img src="' + s["photo"] + '" alt="U+핫딜센터 ' + s["name"] + " 매장 외관 - "
            + s["address"] + '" width="1280" height="720" style="border-radius:14px;margin:18px 0">'
            "<h2>매장 정보</h2>"
            '<table class="kv"><tbody>'
            "<tr><th>매장명</th><td>U+핫딜센터 " + s["name"] + " (주식회사 더끌림컴퍼니 직영)</td></tr>"
            "<tr><th>주소</th><td>" + s["address"] + "</td></tr>"
            '<tr><th>전화</th><td><a href="tel:' + C["tel"] + '">' + C["tel"] + "</a></td></tr>"
            "<tr><th>영업시간</th><td>" + hours + "</td></tr>"
            "<tr><th>주차</th><td>" + parking + "</td></tr>"
            '<tr><th>지도</th><td><a href="' + naver_map(s["address"]) + '" target="_blank" rel="noopener">네이버 지도에서 ' + s["name"] + " 위치 보기</a></td></tr>"
            '<tr><th>상담 방법</th><td>매장 방문 · <a href="' + C["kakao"] + '" target="_blank" rel="noopener">카카오톡 1:1 상담</a> · 전화 상담 · 전국 우체국 택배 개통</td></tr>'
            "<tr><th>취급 업무</th><td>LG유플러스 번호이동 · 기기변경 · 신규가입, 요금제 상담, 인터넷·IPTV 결합 상담</td></tr>"
            "</tbody></table>"
            '<div class="cta-row">'
            '<a class="btn btn-fill" href="' + C["reserve"] + '" target="_blank" rel="noopener">매장 방문 예약</a>'
            '<a class="btn btn-kakao" href="' + C["kakao"] + '" target="_blank" rel="noopener">💬 카카오톡 1:1 상담</a>'
            '<a class="btn btn-line" href="tel:' + C["tel"] + '">📞 ' + C["tel"] + "</a></div>"
            "<h2>" + s["name"] + " 개통후기</h2>" + rv_html
            + "<h2>오늘 기준 가격</h2>"
            '<p>모델별 출고가 · 지원금 · 할부원금은 전 매장 동일 기준으로 안내합니다. '
            '<a href="/prices/">시세표에서 확인</a>하실 수 있으며, 재고는 매장별로 다를 수 있어 방문 전 문의를 권장합니다.</p>'
            + G.DISCLAIMER
            + '<aside class="rel"><h2>다른 매장 보기</h2><ul>'
            + "".join('<li><a href="/store/%s/">%s — %s</a></li>' % (o["slug"], o["name"], o["address"])
                      for o in stores if o["slug"] != s["slug"] and o["locality"] == s["locality"])
            + '<li><a href="/stores/">전체 23개 직영점 목록</a></li></ul></aside>'
            "</article></main>")
        write("/store/" + s["slug"] + "/index.html",
              page(title, desc, "/store/" + s["slug"] + "/", body,
                   [("홈", "/"), ("매장 안내", "/stores/"), (s["name"], None)],
                   extra_graph=[local]),
              prio="0.8")


# ============================================================ 후기
def review_card(r, show_store=True):
    store = D.store_by_slug().get(r.get("store", ""))
    tags = '<span class="tag">' + R.esc(r.get("type", "개통")) + "</span>"
    if show_store and store:
        tags += ' <span class="tag gray"><a href="/store/' + store["slug"] + '/">' + store["name"] + "</a></span>"
    cond = r.get("condition", "")
    return ('<div class="rv"><div class="rv-head"><span class="rv-model">'
            + R.esc(r.get("model", "")) + "</span>" + tags + "</div>"
            '<p class="rv-meta">' + R.esc(r.get("date", "")) + " · "
            + R.esc(masked(r.get("name", ""))) + " 고객님"
            + (" · " + R.esc(store["name"]) if (store and not show_store) else "")
            + (" · 구매조건: " + R.esc(cond) if cond else "") + "</p>"
            '<p class="rv-body">' + R.esc(r.get("body", "")) + "</p></div>")


def review_node(r):
    return {
        "@type": "Review",
        "itemReviewed": {"@id": R.ORG_ID},
        "author": {"@type": "Person", "name": masked(r.get("name", ""))},
        "datePublished": r.get("date", ""),
        "name": r.get("model", "") + " " + r.get("type", "") + " 개통후기",
        "reviewBody": r.get("body", ""),
    }


def build_reviews(reviews):
    print("[후기]")
    if reviews:
        lst = "".join(review_card(r) for r in reviews)
        count_line = "현재 " + str(len(reviews)) + "건의 개통후기가 등록되어 있습니다."
    else:
        lst = ('<p class="empty">아직 등록된 텍스트 후기가 없습니다. 실제 개통 고객의 동의를 받은 후기만 '
               "게시하며, 등록되는 대로 구매일·모델·가입유형·구매지점·구매조건과 함께 공개합니다.</p>")
        count_line = "실제 개통 고객의 동의를 받은 후기만 게시합니다."
    body = (
        '<main class="wrap"><article>'
        '<h1 class="page-title">U+핫딜센터 실제 개통후기</h1>'
        '<p class="lead">구매일 · 구매모델 · 번호이동/기기변경 · 구매지점 · 구매조건까지 함께 공개합니다. '
        "고객 동의를 받은 실제 후기만 등록하며, 개인정보는 표시하지 않습니다.</p>"
        '<p class="meta">' + count_line + " · 최종 업데이트 " + TODAY + "</p>"
        + lst
        + '<div class="callout"><p><strong>후기 작성 안내</strong> — U+핫딜센터에서 개통하신 고객님은 '
        '카카오톡 1:1 상담으로 후기를 보내주시면 동의 확인 후 게시합니다. 특정 문구를 지정해 드리거나 '
        "대가를 조건으로 후기를 요청하지 않습니다.</p></div>"
        + R.cta()
        + '<aside class="rel"><h2>후기와 함께 확인하세요</h2><ul>'
        '<li><a href="/prices/">오늘 기준 모델별 할부원금</a></li>'
        '<li><a href="/stores/">후기에 나오는 직영점 23곳</a></li></ul></aside>'
        "</article></main>")
    extra = [{"@type": "ItemList", "name": "U+핫딜센터 개통후기",
              "numberOfItems": len(reviews),
              "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": review_node(r)}
                                  for i, r in enumerate(reviews)]}] if reviews else None
    write("/reviews/index.html",
          page("U+핫딜센터 실제 개통후기 | 더끌림컴퍼니 LG유플러스 공식인증 대리점",
               "U+핫딜센터에서 실제로 개통하신 고객 후기 — 구매일, 모델, 번호이동/기기변경, 구매지점, 구매조건을 함께 공개합니다.",
               "/reviews/", body, [("홈", "/"), ("개통후기", None)], extra_graph=extra),
          prio="0.9")


# ============================================================ FAQ
def build_faq():
    print("[FAQ]")
    blocks = ""
    for cat, items in F.faq_by_category():
        blocks += "<h2>" + cat + "</h2>"
        for q, a in items:
            blocks += ('<details class="faq"><summary>' + R.esc(q) + '</summary><div class="a"><p>'
                       + R.esc(a) + "</p></div></details>")
    flat = F.faq_flat()
    body = (
        '<main class="wrap"><article>'
        '<h1 class="page-title">자주 묻는 질문 (' + str(len(flat)) + "개)</h1>"
        '<p class="lead">가격 조건, 번호이동·기기변경, 개통 방법, 회사 정보까지 실제 상담에서 가장 많이 '
        "받는 질문을 정리했습니다.</p>"
        '<p class="meta">' + BRAND_LINE + " · 최종 업데이트 " + TODAY + "</p>"
        + blocks + G.DISCLAIMER + R.cta("질문이 더 있으면 1:1로 물어보기")
        + '<aside class="rel"><h2>관련 안내</h2><ul>'
        '<li><a href="/prices/">오늘 기준 시세표</a></li>'
        '<li><a href="/company/">U+핫딜센터·더끌림컴퍼니 회사 정보</a></li>'
        '<li><a href="/stores/">직영점 23곳</a></li></ul></aside>'
        "</article></main>")
    write("/faq/index.html",
          page("LG유플러스 휴대폰 구매 자주 묻는 질문 | U+핫딜센터",
               "할부원금, 부가서비스·제휴카드 조건, 번호이동과 기기변경 차이, 택배 개통, 공식인증 대리점 확인까지 실제 상담에서 많이 받는 질문 "
               + str(len(flat)) + "개를 정리했습니다.",
               "/faq/", body, [("홈", "/"), ("자주 묻는 질문", None)],
               extra_graph=[R.faq_node(flat)]),
          prio="0.8")


# ============================================================ 회사소개
def build_company():
    print("[회사소개]")
    stores = D.stores()
    body = (
        '<main class="wrap"><article>'
        '<h1 class="page-title">U+핫딜센터 회사 정보</h1>'
        '<p class="lead">' + BRAND_LINE + "</p>"
        '<p class="meta">최종 업데이트 ' + TODAY + "</p>"
        "<h2>사업자 정보</h2>"
        '<table class="kv"><tbody>'
        "<tr><th>상호</th><td>주식회사 더끌림컴퍼니</td></tr>"
        "<tr><th>브랜드</th><td>U+핫딜센터 (유플러스 핫딜)</td></tr>"
        "<tr><th>대표자</th><td>" + C["ceo"] + "</td></tr>"
        "<tr><th>사업자등록번호</th><td>" + C["bizno"] + "</td></tr>"
        "<tr><th>본사 주소</th><td>" + C["addr_full"] + "</td></tr>"
        '<tr><th>고객센터</th><td><a href="tel:' + C["tel"] + '">' + C["tel"] + "</a> (대표번호)</td></tr>"
        '<tr><th>온라인 상담</th><td><a href="' + C["kakao"] + '" target="_blank" rel="noopener">카카오톡 1:1 상담</a></td></tr>'
        "<tr><th>사업 구분</th><td>LG유플러스 공식인증 대리점</td></tr>"
        "<tr><th>운영 지점</th><td>서울·경기 " + str(len(stores)) + "개 직영점</td></tr>"
        "<tr><th>서비스 지역</th><td>서울·경기 매장 방문 개통, 전국 우체국 택배 개통</td></tr>"
        "</tbody></table>"
        "<h2>이름이 여러 개인 이유</h2>"
        "<p>온라인에서는 <strong>U+핫딜센터</strong> 또는 <strong>유플러스 핫딜</strong>이라는 이름으로, "
        "계약·세금계산서 등 사업자 명의로는 <strong>주식회사 더끌림컴퍼니</strong>를 사용합니다. "
        "세 이름은 모두 같은 사업자를 가리키며, 사업자등록번호는 " + C["bizno"] + "로 동일합니다.</p>"
        '<div class="callout"><p>U+핫딜센터 = 유플러스 핫딜 = 주식회사 더끌림컴퍼니가 운영하는 '
        "LG유플러스 공식인증 대리점</p></div>"
        "<h2>무엇을 하는 회사인가요</h2>"
        "<ul>"
        "<li>LG유플러스 휴대폰 번호이동 · 기기변경 · 신규가입 상담 및 개통</li>"
        "<li>모델별 출고가 · 공시지원금 · 대리점 지원금 · 할부원금 안내</li>"
        "<li>요금제, 인터넷·IPTV 결합, 가족결합 상담</li>"
        "<li>서울·경기 직영점 방문 개통 및 전국 우체국 택배 개통</li>"
        "</ul>"
        "<h2>가격을 안내하는 원칙</h2>"
        "<p>휴대폰 가격을 안내할 때 <strong>가입유형(번호이동·기기변경), 요금제와 유지기간, 부가서비스, "
        "제휴카드, 중고폰 반납 조건</strong>을 함께 표시합니다. 현재 홈페이지에 공개된 금액은 부가서비스 가입, "
        "제휴카드 결합, 중고폰 반납 없이 적용되는 할부원금 기준이며, 기준일과 함께 "
        '<a href="/prices/">시세표</a>에 표시합니다.</p>'
        "<h2>직영점</h2>"
        "<p>" + " · ".join('<a href="/store/%s/">%s</a>' % (s["slug"], s["name"]) for s in stores) + "</p>"
        + R.cta()
        + "</article></main>")
    write("/company/index.html",
          page("U+핫딜센터 회사 정보 | 주식회사 더끌림컴퍼니 LG유플러스 공식인증 대리점",
               "U+핫딜센터(유플러스 핫딜)는 주식회사 더끌림컴퍼니가 운영하는 LG유플러스 공식인증 대리점입니다. 대표자, 사업자등록번호, 본사 주소, 고객센터, 23개 직영점 정보를 안내합니다.",
               "/company/", body, [("홈", "/"), ("회사 정보", None)]),
          prio="0.8")


# ============================================================ 404 / sitemap
def build_404():
    print("[404]")
    body = ('<main class="wrap"><article>'
            '<h1 class="page-title">요청하신 페이지를 찾을 수 없습니다</h1>'
            '<p class="lead">주소가 변경되었거나 삭제된 페이지입니다. 아래에서 필요한 정보를 찾아보세요.</p>'
            '<ul><li><a href="/">홈 — 오늘의 특가</a></li>'
            '<li><a href="/prices/">모델별 시세표</a></li>'
            '<li><a href="/stores/">직영점 23곳</a></li>'
            '<li><a href="/faq/">자주 묻는 질문</a></li>'
            '<li><a href="/company/">회사 정보</a></li></ul>'
            + R.cta() + "</article></main>")
    html_text = page("페이지를 찾을 수 없습니다 | U+핫딜센터", "요청하신 페이지를 찾을 수 없습니다.",
                     "/404.html", body, [("홈", "/"), ("404", None)], robots="noindex, follow")
    full = os.path.join(BASE, "404.html")
    with open(full, "w", encoding="utf-8") as f:
        f.write(html_text)
    print("  ✓ /404.html")


def build_sitemap():
    print("[sitemap]")
    urls = [("/", OLD_LASTMOD.get("/", TODAY), "1.0", "daily"),
            ("/earlybird/ip18pro/", OLD_LASTMOD.get("/earlybird/ip18pro/", TODAY), "0.9", "daily")]
    urls += [u for u in PAGES]
    seen, rows = set(), []
    for loc, mod, prio, freq in urls:
        if loc in seen:
            continue
        seen.add(loc)
        rows.append("  <url>\n    <loc>" + ORIGIN + loc + "</loc>\n"
                    "    <lastmod>" + mod + "</lastmod>\n"
                    "    <changefreq>" + freq + "</changefreq>\n"
                    "    <priority>" + prio + "</priority>\n  </url>")
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(rows) + "\n</urlset>\n")
    with open(os.path.join(BASE, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(xml)
    print("  ✓ sitemap.xml —", len(rows), "URL")


def seed_data():
    """data/stores.json 이 없으면 기본값 생성 (영업시간·주차는 직접 입력)"""
    p = os.path.join(BASE, "data", "stores.json")
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        json.dump(D.stores(), open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("  ✓ data/stores.json 생성 (영업시간·주차 직접 입력용)")
    r = os.path.join(BASE, "data", "reviews.json")
    if not os.path.exists(r):
        json.dump([], open(r, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("  ✓ data/reviews.json 생성 (실제 후기 입력용)")
    n = os.path.join(BASE, ".nojekyll")
    if not os.path.exists(n):
        open(n, "w").close()
        print("  ✓ .nojekyll 생성")


def main():
    seed_data()
    P = {t["key"]: t for t in D.prices()}
    reviews = D.reviews()
    print("단가표", len(P), "종 / 후기", len(reviews), "건\n")
    build_prices(P)
    build_guides(P)
    build_stores(reviews)
    build_reviews(reviews)
    build_faq()
    build_admin.build(BASE)
    build_company()
    build_404()
    build_sitemap()
    print("\n완료: 총", len(PAGES), "페이지")


if __name__ == "__main__":
    main()
