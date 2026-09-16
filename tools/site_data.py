# -*- coding: utf-8 -*-
"""U+핫딜센터 사이트 공통 데이터 (회사정보 / 매장 / FAQ / 단가표 파서)"""
import os, re, json, datetime, subprocess

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGIN = "https://theggeulrim.github.io"

COMPANY = {
    "brand": "U+핫딜센터",
    "brand_alt": "유플러스 핫딜",
    "legal": "주식회사 더끌림컴퍼니",
    "legal_short": "더끌림컴퍼니",
    "ceo": "이민진",
    "bizno": "192-88-01136",
    "tel": "070-4007-7776",
    "tel_intl": "+82-70-4007-7776",
    "addr_street": "난곡로 194, 1층 (신림동)",
    "addr_full": "서울특별시 관악구 난곡로 194, 1층(신림동)",
    "locality": "관악구",
    "region": "서울특별시",
    "kakao": "http://pf.kakao.com/_xlyGxin/chat",
    "reserve": "https://forms.gle/eigWXXKac2XHpJ538",
    "store_count": 23,
}

# 한 문장 브랜드 정의 — 전 페이지에 동일 문구로 삽입
BRAND_LINE = ("U+핫딜센터(유플러스 핫딜)는 주식회사 더끌림컴퍼니가 운영하는 "
              "LG유플러스 공식인증 대리점입니다.")

# slug, 매장명, 사진, 도/시, 시군구, 도로명주소, 랜드마크(매장명에서 확인 가능한 사실만)
STORES = [
 ("sillim","신림점","store16.jpeg","서울특별시","관악구","남부순환로 1601","신림역 인근"),
 ("bongcheon","봉천사거리점","store13.jpeg","서울특별시","관악구","관악로 194","봉천사거리 인근"),
 ("nakseongdae","낙성대점","store4.jpeg","서울특별시","관악구","남부순환로 1952","낙성대역 인근"),
 ("nangok","난곡점","store5.jpeg","서울특별시","관악구","난곡로 194","난곡로 본사 1층"),
 ("namhyeon","남현점","store7.jpeg","서울특별시","관악구","남현길 8","남현동"),
 ("sadang","사당점","store15.jpeg","서울특별시","동작구","동작대로 45","사당역 인근"),
 ("gasan","가산점","store1.jpeg","서울특별시","금천구","디지털로 212","가산디지털단지 인근"),
 ("nammun","남문시장점","store6.jpeg","서울특별시","금천구","독산로87길 2","독산동 남문시장 인근"),
 ("mullae","문래힐스테이트점","store11.jpeg","서울특별시","영등포구","선유로 59","문래동"),
 ("daerim-9","대림9번출구점","store8.jpeg","서울특별시","영등포구","도림로 135","대림역 9번 출구 인근"),
 ("daerim-11","대림11번출구점","store9.jpeg","서울특별시","영등포구","도림로 144","대림역 11번 출구 인근"),
 ("daerim-samgeori","대림삼거리점","store10.jpeg","서울특별시","영등포구","디지털로54길 3 1층","대림삼거리 인근"),
 ("yeongdeungpo-gucheong","영등포구청점","store17.jpeg","서울특별시","영등포구","당산로 136-1","영등포구청역 인근"),
 ("gangseo-gucheong","강서구청점","store2.jpeg","서울특별시","강서구","화곡로 322","강서구청 인근"),
 ("jeungmi","증미산점","store19.jpeg","서울특별시","강서구","양천로 583","증미역 인근"),
 ("beomgye","범계점","store12.jpeg","경기도","안양시 동안구","평촌대로223번길 49","범계역 인근"),
 ("pyeongchon-hagwonga","평촌학원가점","store21.jpeg","경기도","안양시 동안구","평촌대로 137-7","평촌 학원가"),
 ("bisan","비산이마트점","store14.jpeg","경기도","안양시 동안구","관악대로 99","비산동"),
 ("gwanyang","관양시장점","store3.jpeg","경기도","안양시 동안구","관악대로 341","관양시장 인근"),
 ("hogye","호계점","store22.jpeg","경기도","안양시 동안구","경수대로 541","호계동"),
 ("anyang-ilbeonga","안양일번가점","store18.jpeg","경기도","안양시 만안구","안양로292번길 8","안양일번가"),
 ("suwon-station","수원역점","store23.jpeg","경기도","수원시 팔달구","고매로 26","수원역 인근"),
 ("chilbo","칠보마을점","store20.jpeg","경기도","수원시 권선구","금곡로102번길 30 1층","칠보마을"),
]

REGION_GROUPS = [
    ("서울 관악·동작", ["sillim","bongcheon","nakseongdae","nangok","namhyeon","sadang"]),
    ("서울 영등포·강서", ["mullae","daerim-9","daerim-11","daerim-samgeori","yeongdeungpo-gucheong","gangseo-gucheong","jeungmi"]),
    ("서울 금천", ["gasan","nammun"]),
    ("경기 안양", ["beomgye","pyeongchon-hagwonga","bisan","gwanyang","hogye","anyang-ilbeonga"]),
    ("경기 수원", ["suwon-station","chilbo"]),
]

def stores():
    """stores.json 이 있으면 그 값을(영업시간·주차 등 직접 입력분) 우선 사용"""
    path = os.path.join(BASE, "data", "stores.json")
    base = []
    for slug, name, photo, region, locality, street, landmark in STORES:
        base.append({
            "slug": slug, "name": name, "photo": "/" + photo,
            "region": region, "locality": locality, "street": street,
            "address": "%s %s %s" % (region, locality, street),
            "landmark": landmark, "tel": COMPANY["tel"],
            "hours": "", "parking": "", "note": "",
        })
    if os.path.exists(path):
        saved = {s["slug"]: s for s in json.load(open(path, encoding="utf-8"))}
        for s in base:
            if s["slug"] in saved:
                for k in ("hours", "parking", "note"):
                    s[k] = saved[s["slug"]].get(k, "") or ""
    return base

def store_by_slug():
    return {s["slug"]: s for s in stores()}

def reviews():
    """실제 개통후기(고객 동의분만). 없으면 빈 목록 — 가짜 후기는 만들지 않는다."""
    path = os.path.join(BASE, "data", "reviews.json")
    if not os.path.exists(path):
        return []
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception:
        return []
    return [r for r in data if r.get("body")]

# ---------------- 단가표 파서 ----------------
PRICE_FILES = [
    ("mnp-85",  "번호이동", "85",  "단가표_0915/번호이동_85요금제.txt"),
    ("mnp-115", "번호이동", "115", "단가표_0915/번호이동_115요금제.txt"),
    ("chg-85",  "기기변경", "85",  "단가표_0915/기기변경_85요금제.txt"),
    ("chg-115", "기기변경", "115", "단가표_0915/기기변경_115요금제.txt"),
]
NUM = re.compile(r"([\d,]+)\s*원")

def parse_price_file(path):
    """모델 블록 → dict 리스트"""
    txt = open(path, encoding="utf-8").read()
    groups, cur_group, cur = [], "기타", None
    out = []
    lines = [l.strip() for l in txt.splitlines()]
    i = 0
    while i < len(lines):
        l = lines[i]
        if not l:
            i += 1; continue
        if l.startswith("[") or set(l) == {"ㅡ"}:
            i += 1; continue
        if l in ("아이폰18 PRO", "갤럭시", "아이폰", "폴더블", "아이폰18", "단순개봉"):
            cur_group = l; i += 1; continue
        # 모델 블록 시작: 다음 줄이 '출고가'
        if i + 1 < len(lines) and lines[i+1].startswith("출고가"):
            model = l
            item = {"group": cur_group, "model": model, "notes": []}
            i += 1
            while i < len(lines) and lines[i]:
                s = lines[i]
                if s.startswith("출고가"):
                    item["retail"] = NUM.search(s).group(1)
                elif s.startswith("이통사 지원금") or s.startswith("공시지원금"):
                    item["carrier"] = NUM.search(s).group(1)
                elif s.startswith("대리점 지원금"):
                    item["agency"] = NUM.search(s).group(1)
                elif s.startswith("할부원금"):
                    item["final"] = NUM.search(s).group(1)
                elif s.startswith("("):
                    item["cond"] = s.strip("()")
                elif s.startswith("*"):
                    item["notes"].append(s.lstrip("*").strip())
                i += 1
            if "final" in item:
                out.append(item)
            continue
        i += 1
    return out

def file_updated(path):
    """단가표가 실제로 바뀐 시각. git 저장소면 커밋 시각을, 아니면 파일 수정 시각을 쓴다.
       (CI 체크아웃 시각이 '가격 업데이트 시각'으로 잘못 표시되는 것을 막는다)"""
    try:
        out = subprocess.check_output(
            ["git", "log", "-1", "--format=%cd", "--date=format:%Y-%m-%d %H:%M", "--", path],
            cwd=BASE, stderr=subprocess.DEVNULL).decode().strip()
        if out:
            return out
    except Exception:
        pass
    return datetime.datetime.fromtimestamp(os.path.getmtime(path)).strftime("%Y-%m-%d %H:%M")


def prices():
    tables = []
    for key, kind, plan, rel in PRICE_FILES:
        p = os.path.join(BASE, rel)
        if not os.path.exists(p):
            continue
        tables.append({
            "key": key, "kind": kind, "plan": plan,
            "updated": file_updated(p),
            "items": parse_price_file(p),
        })
    return tables
