# -*- coding: utf-8 -*-
"""개통후기 입력 도구(/reviews/admin/) 생성 — 검색엔진 비노출"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import site_data as D

def build(base):
    opts = "".join('<option value="%s">%s</option>' % (s["slug"], s["name"]) for s in D.stores())
    html = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>개통후기 입력 도구 (내부용)</title>
<link rel="stylesheet" href="/assets/uhd.css">
<style>
body{background:#fbfbfd}
.box{max-width:900px;margin:24px auto;padding:0 16px}
fieldset{border:1px solid #eaeaea;border-radius:14px;background:#fff;padding:18px 20px;margin-bottom:18px}
legend{font-weight:900;padding:0 8px}
label{display:block;font-size:13px;font-weight:700;color:#5f5f66;margin:12px 0 4px}
input,select,textarea{width:100%;padding:11px 12px;border:1px solid #ddd;border-radius:9px;font-size:15px;font-family:inherit}
textarea{min-height:110px;resize:vertical}
.row{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
button{border:0;border-radius:9px;padding:12px 18px;font-weight:800;font-size:15px;cursor:pointer}
.primary{background:#E6007E;color:#fff}
.ghost{background:#f2f2f4;color:#333}
.danger{background:#fff0f0;color:#c00}
.bar{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.item{border:1px solid #eaeaea;border-radius:12px;background:#fff;padding:14px 16px;margin-bottom:10px}
.item h4{margin:0 0 6px;font-size:16px}
.item p{margin:0 0 6px;font-size:14px;color:#333}
.item small{color:#777}
code{background:#f4f4f6;padding:2px 6px;border-radius:5px;font-size:13px}
#json{width:100%;min-height:180px;font-family:ui-monospace,Menlo,monospace;font-size:12px}
.chk{display:flex;align-items:flex-start;gap:8px;margin-top:14px}
.chk input{width:auto;margin-top:4px}
.warn{background:#fff8e6;border:1px solid #ffe08a;border-radius:10px;padding:12px 14px;font-size:14px;margin-bottom:16px}
</style>
</head>
<body>
<div class="box">
<h1 style="font-size:24px;margin:24px 0 6px">개통후기 입력 도구 <span style="font-size:14px;color:#888">내부용</span></h1>
<p style="color:#5f5f66;font-size:14px">여기서 입력한 내용은 <code>data/reviews.json</code> 파일로 저장됩니다.
파일을 GitHub 저장소의 <code>data/reviews.json</code> 에 덮어쓰면 후기 페이지와 매장 페이지가 자동으로 갱신됩니다.</p>
<div class="warn">고객 동의를 받은 <b>실제 개통 후기만</b> 입력하세요. 이름은 첫 글자만 남기고 자동으로 가려집니다.
전화번호·주소 등 개인정보는 본문에 쓰지 마세요.</div>

<fieldset>
<legend>후기 추가</legend>
<div class="row">
  <div><label>구매일</label><input type="date" id="f-date"></div>
  <div><label>가입유형</label><select id="f-type">
    <option>번호이동</option><option>기기변경</option><option>신규가입</option></select></div>
</div>
<div class="row">
  <div><label>구매모델 (예: 갤럭시 Z 플립8 256GB)</label><input id="f-model" placeholder="갤럭시 Z 플립8 256GB"></div>
  <div><label>구매지점</label><select id="f-store"><option value="">선택 안 함 (택배·온라인)</option>__OPTS__</select></div>
</div>
<div class="row">
  <div><label>고객 성함 (첫 글자만 노출)</label><input id="f-name" placeholder="김민수"></div>
  <div><label>구매조건 (예: 85요금제 6개월 / 부가서비스 없음)</label><input id="f-cond" placeholder="85요금제 6개월, 부가서비스·카드·중고폰 반납 없음"></div>
</div>
<label>고객 후기 내용</label>
<textarea id="f-body" placeholder="고객이 직접 작성한 내용을 그대로 입력하세요."></textarea>
<div class="chk"><input type="checkbox" id="f-agree"><label for="f-agree" style="margin:0;font-weight:600;color:#333">고객에게 후기 게시 동의를 받았습니다.</label></div>
<div class="bar"><button class="primary" onclick="addItem()">후기 추가</button>
<button class="ghost" onclick="clearForm()">입력 초기화</button></div>
</fieldset>

<fieldset>
<legend>등록된 후기 (<span id="cnt">0</span>건)</legend>
<div id="list"></div>
<div class="bar">
  <button class="primary" onclick="download()">reviews.json 내려받기</button>
  <button class="ghost" onclick="copyJson()">JSON 복사</button>
  <button class="ghost" onclick="loadServer()">서버 파일 다시 불러오기</button>
</div>
<label style="margin-top:18px">JSON 원본 (직접 수정 후 <b>적용</b>도 가능)</label>
<textarea id="json"></textarea>
<div class="bar"><button class="ghost" onclick="applyJson()">JSON 적용</button></div>
</fieldset>
</div>

<script>
let items = [];
function esc(s){return (s||'').toString();}
function render(){
  document.getElementById('cnt').textContent = items.length;
  document.getElementById('list').innerHTML = items.map(function(r,i){
    return '<div class="item"><h4>'+esc(r.model)+' <span style="font-size:12px;color:#E6007E">'+esc(r.type)+'</span></h4>'
      +'<p>'+esc(r.body)+'</p>'
      +'<small>'+esc(r.date)+' · '+esc(r.name)+' · '+esc(r.store||'택배/온라인')+' · '+esc(r.condition||'')+'</small><br>'
      +'<button class="danger" style="margin-top:8px;padding:6px 12px;font-size:13px" onclick="del('+i+')">삭제</button></div>';
  }).join('') || '<p style="color:#888">등록된 후기가 없습니다.</p>';
  document.getElementById('json').value = JSON.stringify(items, null, 2);
}
function addItem(){
  var d=document.getElementById('f-date').value, m=document.getElementById('f-model').value.trim(),
      b=document.getElementById('f-body').value.trim();
  if(!document.getElementById('f-agree').checked){alert('고객 동의 확인에 체크해 주세요.');return;}
  if(!d||!m||!b){alert('구매일, 구매모델, 후기 내용은 필수입니다.');return;}
  items.unshift({date:d, model:m, type:document.getElementById('f-type').value,
    store:document.getElementById('f-store').value, name:document.getElementById('f-name').value.trim(),
    condition:document.getElementById('f-cond').value.trim(), body:b, consent:true});
  clearForm(); render();
}
function clearForm(){['f-model','f-name','f-cond','f-body'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('f-agree').checked=false;}
function del(i){ if(confirm('이 후기를 삭제할까요?')){items.splice(i,1);render();} }
function download(){
  var blob=new Blob([JSON.stringify(items,null,2)],{type:'application/json'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='reviews.json'; a.click();
}
function copyJson(){ navigator.clipboard.writeText(JSON.stringify(items,null,2)).then(function(){alert('복사했습니다.');}); }
function applyJson(){
  try{ items=JSON.parse(document.getElementById('json').value); render(); alert('적용했습니다.'); }
  catch(e){ alert('JSON 형식이 올바르지 않습니다: '+e.message); }
}
function loadServer(){
  fetch('/data/reviews.json?t='+Date.now()).then(function(r){return r.json();})
    .then(function(d){ items=d||[]; render(); })
    .catch(function(){ items=[]; render(); });
}
loadServer();
</script>
</body>
</html>"""
    html = html.replace("__OPTS__", opts)
    path = os.path.join(base, "reviews", "admin", "index.html")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w", encoding="utf-8").write(html)
    print("  ✓ /reviews/admin/ (검색 비노출)")
