# -*- coding: utf-8 -*-
"""공통 렌더러 — head / GNB / 푸터 / 구조화 데이터"""
import json, html
from site_data import COMPANY as C, BRAND_LINE, ORIGIN, stores

ORG_ID = ORIGIN + "/#organization"

NAV = [
    ("/", "홈"),
    ("/prices/", "시세표"),
    ("/lg-uplus-cheap-phone/", "싸게 사는 법"),
    ("/lg-uplus-number-porting/", "번호이동"),
    ("/lg-uplus-device-change/", "기기변경"),
    ("/iphone18-lguplus/", "아이폰18"),
    ("/stores/", "매장"),
    ("/reviews/", "개통후기"),
    ("/faq/", "FAQ"),
    ("/company/", "회사소개"),
]

def esc(s):
    return html.escape(s, quote=True)

def jsonld(obj):
    return ('<script type="application/ld+json">\n'
            + json.dumps(obj, ensure_ascii=False, indent=2)
            + '\n</script>')

def org_node():
    """더끌림컴퍼니 = U+핫딜센터 = 유플러스 핫딜 관계를 명시한 Organization"""
    return {
        "@type": ["Organization", "MobilePhoneStore"],
        "@id": ORG_ID,
        "name": "U+핫딜센터",
        "legalName": "주식회사 더끌림컴퍼니",
        "alternateName": ["유플러스 핫딜", "더끌림컴퍼니", "U+ 핫딜센터", "유플핫딜"],
        "description": BRAND_LINE + " 서울·경기 %d개 직영점과 온라인 상담 채널을 함께 운영합니다."
                       % C["store_count"],
        "url": ORIGIN + "/",
        "logo": ORIGIN + "/cert_mark.png",
        "image": ORIGIN + "/cert_mark.png",
        "telephone": C["tel_intl"],
        "email": "",
        "founder": {"@type": "Person", "name": C["ceo"]},
        "identifier": [{"@type": "PropertyValue", "name": "사업자등록번호", "value": C["bizno"]}],
        "address": {
            "@type": "PostalAddress",
            "streetAddress": C["addr_street"],
            "addressLocality": C["locality"],
            "addressRegion": C["region"],
            "addressCountry": "KR",
        },
        "areaServed": {"@type": "Country", "name": "대한민국"},
        "brand": {"@type": "Brand", "name": "U+핫딜센터", "alternateName": "유플러스 핫딜"},
        "knowsAbout": ["LG유플러스 번호이동", "LG유플러스 기기변경", "휴대폰 할부원금 비교",
                       "공시지원금", "선택약정 25% 요금할인", "휴대폰 택배개통"],
        "sameAs": ["https://hotdealcenter.co.kr/"],
        "priceRange": "₩₩",
    }

def crumb_node(items):
    """items: [(name, url|None)] — 마지막 항목 url 은 None 가능"""
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n,
             **({"item": ORIGIN + u} if u else {})}
            for i, (n, u) in enumerate(items)
        ],
    }

def faq_node(faqs):
    return {
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in faqs
        ],
    }

def head(title, desc, path, extra_graph=None, crumbs=None, og_image="/cert_mark.png",
         article=None, robots="index, follow, max-image-preview:large, max-snippet:-1"):
    graph = [org_node()]
    if crumbs:
        graph.append(crumb_node(crumbs))
    if article:
        graph.append(article)
    if extra_graph:
        graph.extend(extra_graph)
    canonical = ORIGIN + path
    return """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<meta name="author" content="주식회사 더끌림컴퍼니">
<meta name="robots" content="%(robots)s">
<link rel="canonical" href="%(canonical)s">
<meta property="og:type" content="%(ogtype)s">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="U+핫딜센터">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(canonical)s">
<meta property="og:image" content="%(ogimg)s">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="%(title)s">
<meta name="twitter:description" content="%(desc)s">
<meta name="twitter:image" content="%(ogimg)s">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css">
<link rel="stylesheet" href="/assets/uhd.css">
%(ld)s
<script src="/assets/uhd.js" defer></script>
</head>
<body>
%(gnb)s
""" % {
        "title": esc(title), "desc": esc(desc), "canonical": canonical,
        "ogimg": ORIGIN + og_image, "robots": robots,
        "ogtype": "article" if article else "website",
        "ld": jsonld({"@context": "https://schema.org", "@graph": graph}),
        "gnb": gnb(path),
    }

def gnb(path):
    links = "".join(
        '<a href="%s"%s>%s</a>' % (u, ' aria-current="page"' if u == path else "", n)
        for u, n in NAV)
    return """<header class="gnb">
  <div class="gnb-inner">
    <a class="gnb-logo" href="/"><span>U+</span>핫딜센터</a>
    <nav class="gnb-menu" aria-label="주요 메뉴">%s</nav>
    <a class="gnb-cta" href="%s" target="_blank" rel="noopener">1:1 상담</a>
  </div>
</header>
""" % (links, C["kakao"])

def crumb_html(items):
    parts = []
    for name, url in items:
        parts.append('<a href="%s">%s</a>' % (url, esc(name)) if url else '<span>%s</span>' % esc(name))
    return '<div class="wrap"><nav class="crumb" aria-label="현재 위치">%s</nav></div>' % " › ".join(parts)

def cta(text="휴대폰 가격·조건 1:1로 확인하기"):
    return """<div class="cta-row">
  <a class="btn btn-kakao" href="%s" target="_blank" rel="noopener">💬 카카오톡 1:1 상담</a>
  <a class="btn btn-line" href="tel:%s">📞 %s</a>
  <a class="btn btn-line" href="/stores/">🏬 가까운 매장 찾기</a>
</div>
<p class="notice">%s · 상담 시 모델·가입유형(번호이동/기기변경)·사용 중인 요금제를 알려주시면 더 정확하게 안내해 드립니다.</p>
""" % (C["kakao"], C["tel"], C["tel"], esc(text))

def footer():
    st = " · ".join("<a href=\"/store/%s/\">%s</a>" % (s["slug"], s["name"]) for s in stores())
    links = "".join('<a href="%s">%s</a>' % (u, n) for u, n in NAV if u != "/")
    return """<footer class="ft">
  <div class="wrap-wide">
    <p class="brand-line">%(brand)s</p>
    <dl>
      <dt>상호</dt><dd>주식회사 더끌림컴퍼니 (브랜드: U+핫딜센터 · 유플러스 핫딜)</dd>
      <dt>대표자</dt><dd>%(ceo)s</dd>
      <dt>사업자등록번호</dt><dd>%(bizno)s</dd>
      <dt>본사</dt><dd>%(addr)s</dd>
      <dt>고객센터</dt><dd><a href="tel:%(tel)s">%(tel)s</a> · <a href="%(kakao)s" target="_blank" rel="noopener">카카오톡 1:1 상담</a></dd>
      <dt>운영 지점</dt><dd>서울·경기 %(cnt)d개 직영점 / 전국 우체국 택배 개통</dd>
      <dt>사업 구분</dt><dd>LG유플러스 공식인증 대리점</dd>
    </dl>
    <nav class="ft-links" aria-label="사이트 안내">%(links)s</nav>
    <p class="ft-stores">%(stores)s</p>
    <p class="copy">※ 휴대폰 가격 및 지원 조건은 모델·가입유형·요금제 및 판매 시점에 따라 변경될 수 있습니다. 구매 전 최신 조건을 확인해 주세요.<br>©2026 주식회사 더끌림컴퍼니. All Rights Reserved.</p>
  </div>
</footer>
</body>
</html>""" % {"brand": BRAND_LINE, "ceo": C["ceo"], "bizno": C["bizno"], "addr": C["addr_full"],
              "tel": C["tel"], "kakao": C["kakao"], "cnt": C["store_count"],
              "links": links, "stores": st}


# ---------------- 시세표(텍스트) ----------------
def price_table(t, groups=None, models=None, caption=None, anchor=None):
    """t: site_data.prices() 항목 하나 → HTML 표 (검색엔진이 읽는 텍스트)"""
    items = t["items"]
    if groups:
        items = [i for i in items if i["group"] in groups]
    if models:
        items = [i for i in items if any(m in i["model"] for m in models)]
    if not items:
        return ""
    rows, notes, seen_group = [], [], None
    for i in items:
        if i["group"] != seen_group:
            seen_group = i["group"]
            rows.append('<tr><th colspan="5" style="text-align:left;background:#fff0f6;color:#E6007E">%s</th></tr>'
                        % esc(seen_group))
        rows.append(
            "<tr><td>%s</td><td>%s원</td><td>-%s원</td><td>-%s원</td><td class=\"final\">%s원</td></tr>"
            % (esc(i["model"]), i.get("retail", "-"), i.get("carrier", "0"),
               i.get("agency", "0"), i.get("final", "-")))
        for n in i["notes"]:
            if n not in notes:
                notes.append(n)
    cap = caption or ("LG유플러스 %s · %s요금제 기준 할부원금" % (t["kind"], t["plan"]))
    note_html = ""
    if notes:
        note_html = '<ul class="notice" style="list-style:disc;padding-left:34px">%s</ul>' % "".join(
            "<li>%s</li>" % esc(n) for n in notes)
    return """<div id="%(anchor)s" class="table-scroll">
<table class="data">
<caption>%(cap)s <span style="font-weight:600;color:#5f5f66;font-size:13px">(업데이트 %(upd)s)</span></caption>
<thead><tr><th scope="col">모델 · 용량</th><th scope="col">출고가</th><th scope="col">이통사 지원금</th><th scope="col">대리점 지원금</th><th scope="col">할부원금</th></tr></thead>
<tbody>%(rows)s</tbody>
</table>
</div>
<p class="notice">조건: %(kind)s / %(plan)s요금제 6개월 유지 · <strong>부가서비스 가입 없음 · 제휴카드 결합 없음 · 중고폰 반납 없음</strong>. 위 금액은 단말기 할부원금이며 통신요금은 별도입니다. 이통사 지원금 대신 선택약정 25%% 요금할인을 선택할 수 있습니다.</p>
%(notes)s""" % {"anchor": anchor or t["key"], "cap": esc(cap), "upd": t["updated"],
                "rows": "".join(rows), "kind": t["kind"], "plan": t["plan"], "notes": note_html}


def product_nodes(t, limit=None):
    """Product + Offer 구조화 데이터 (표에 실제로 표시된 가격과 동일한 값만 사용)"""
    out = []
    for i in (t["items"][:limit] if limit else t["items"]):
        price = i["final"].replace(",", "")
        out.append({
            "@type": "Product",
            "name": i["model"],
            "category": "휴대폰 > 스마트폰",
            "description": "%s 기준 출고가 %s원에서 이통사 지원금 %s원, 대리점 지원금 %s원 적용 시 할부원금 %s원. %s. 부가서비스 가입 없음, 제휴카드 결합 없음, 중고폰 반납 없음."
                           % (t["kind"], i.get("retail", "-"), i.get("carrier", "0"),
                              i.get("agency", "0"), i["final"], i.get("cond", "")),
            "offers": {
                "@type": "Offer",
                "url": ORIGIN + "/prices/",
                "priceCurrency": "KRW",
                "price": price,
                "availability": "https://schema.org/InStock",
                "seller": {"@id": ORG_ID},
            },
        })
    return out


def compare_table(mnp, chg, groups=None):
    """번호이동 vs 기기변경 할부원금 비교표"""
    cmap = {i["model"]: i for i in chg["items"]}
    rows = []
    for i in mnp["items"]:
        if groups and i["group"] not in groups:
            continue
        c = cmap.get(i["model"])
        if not c:
            continue
        diff = int(c["final"].replace(",", "")) - int(i["final"].replace(",", ""))
        rows.append("<tr><td>%s</td><td>%s원</td><td>%s원</td><td class=\"final\">%s</td></tr>"
                    % (esc(i["model"]), i["final"], c["final"],
                       ("번호이동이 %s원 저렴" % format(diff, ",")) if diff > 0
                       else ("기기변경이 %s원 저렴" % format(-diff, ",")) if diff < 0 else "동일"))
    if not rows:
        return ""
    return """<div class="table-scroll">
<table class="data">
<caption>같은 모델·같은 %(plan)s요금제 기준, 번호이동과 기기변경 할부원금 비교 <span style="font-weight:600;color:#5f5f66;font-size:13px">(업데이트 %(upd)s)</span></caption>
<thead><tr><th scope="col">모델 · 용량</th><th scope="col">번호이동 할부원금</th><th scope="col">기기변경 할부원금</th><th scope="col">차이</th></tr></thead>
<tbody>%(rows)s</tbody>
</table>
</div>
<p class="notice">두 유형 모두 %(plan)s요금제 6개월 유지 조건이며 부가서비스·제휴카드·중고폰 반납 조건은 없습니다. 기기변경은 기존 결합·가족할인을 그대로 유지할 수 있어, 할부원금 차이만으로 유불리를 판단하지 말고 결합할인까지 합쳐서 비교하는 것이 정확합니다.</p>""" % {
        "plan": mnp["plan"], "upd": mnp["updated"], "rows": "".join(rows)}
