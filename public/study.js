/* 학생 필기 · 용어 찾기 · 교수용 내용 수정 (student-notes 스킬 v1·v1·v2를 한 페이지 앱용으로 감쌈)
   화면이 바뀔 때마다 PTX_STUDY.mount(설정)으로 다시 붙이고, 이전 화면의 버튼·이벤트는 unmount()로 걷어 낸다.
   - 필기·메모: 이 브라우저 localStorage 'mp-notes-v1:<app>' (주차·탭별)
   - 용어 찾기: window.GLOSSARY 를 사전으로 사용, 다른 주차 본문도 찾음
   - 내용 수정: 교수 로그인 때만 보이고, 고친 글은 Supabase ex_course 'edits' 에 저장되어 모든 학생 화면에 반영 */
(function () {
  "use strict";
  var HANDLERS = [], OBSERVERS = [];
  function ON(t, type, fn, opt) { t.addEventListener(type, fn, opt); HANDLERS.push([t, type, fn, opt]); }
  function OBS(o) { OBSERVERS.push(o); return o; }
  var UI_IDS = ["stBtn", "stBar", "stShp", "stPanel", "lkBtn", "lkBub", "lkPanel", "edBtn", "edBar", "edSvgIn"];
  function modStudy(__CFG, __ON, __OBS) {

"use strict";
var CFG=__CFG;
var MOD=CFG.app||document.documentElement.getAttribute("data-mod")||(location.pathname.split("/").pop()||document.title||"app");
var ACTIVE=CFG.activeClass||"on";
var COLORS={ink:"#172033",red:"#d62839",blue:"#1f5fa8",green:"#1f8a4c",hl:"rgba(255,214,0,.42)"};
var slides=[].slice.call(document.querySelectorAll(CFG.slides||"section.slide, .slide"));
var paged=slides.length>0;
slides.forEach(function(el){ if(getComputedStyle(el).position==="static") el.style.position="relative"; });
var data={};          // key -> {i,t,memo,star,strokes:[{c,w,p:[x,y,...]}],ts}
var useParent=!!CFG.parentStore&&(window.parent&&window.parent!==window);
var LSK="mp-notes-v1:"+MOD;
var tool="pen", color="ink", penOn=false, hist=[];
var SHAPES={line:"➖ 직선",arrow:"↗ 화살표",rect:"▭ 네모",ellipse:"◯ 동그라미"}, shape="arrow";
function now(){return Date.now();}
/* ---------- storage ---------- */
function loadLocal(){try{var s=localStorage.getItem(LSK); if(s) data=JSON.parse(s)||{};}catch(e){}}
var saveT=0;
function save(){
  clearTimeout(saveT);
  saveT=setTimeout(function(){
    Object.keys(data).forEach(function(k){var d=data[k]; if(!d.memo&&!d.star&&!(d.strokes&&d.strokes.length)) delete data[k];});
    if(useParent){ try{parent.postMessage({app:"mp",notesPut:MOD,notes:data},"*");}catch(e){} }
    else { try{localStorage.setItem(LSK,JSON.stringify(data));}catch(e){} }
    flash();
  },350);
}
/* ---------- slide helpers ---------- */
function curIdx(){ if(!paged) return 0; var i;
  for(i=0;i<slides.length;i++) if(slides[i].classList.contains(ACTIVE)) return i;
  var best=0,bd=1e9,mid=innerHeight/2; for(i=0;i<slides.length;i++){ var r=slides[i].getBoundingClientRect(); if(!r.height) continue; var d=Math.abs((r.top+r.bottom)/2-mid); if(d<bd){bd=d;best=i;} } return best; }
function titleOf(i){ if(!paged) return document.title||"메모"; var el=slides[i]; var t=el.getAttribute("data-title")||el.getAttribute("aria-label"); if(!t){ var h=el.querySelector("h1,h2,h3"); t=h?h.textContent.trim().replace(/\s+/g," ").slice(0,60):""; } return t||("슬라이드 "+(i+1)); }
function keyOf(i){ return paged? (slides[i].id||titleOf(i)+"#"+i) : "page"; }
function entry(i,create){ var k=keyOf(i); if(!data[k]&&create) data[k]={i:i,t:titleOf(i),memo:"",star:false,strokes:[]}; if(data[k]){data[k].i=i;data[k].t=titleOf(i);} return data[k]; }
/* ---------- UI: button ---------- */
var btn=document.createElement("button"); btn.id="stBtn"; btn.type="button"; btn.setAttribute("aria-pressed","false");
btn.textContent=CFG.label||"✍ 내 필기"; btn.title="이 슬라이드에 펜으로 쓰거나 메모를 남깁니다(브라우저에 저장)";
var bar=CFG.mount?document.querySelector(CFG.mount):null;
if(bar){ bar.appendChild(btn); }
else { btn.classList.add("float"); document.body.appendChild(btn); }
/* ---------- toolbar ---------- */
var tb=document.createElement("div"); tb.id="stBar"; tb.hidden=true; tb.setAttribute("role","toolbar"); tb.setAttribute("aria-label","필기 도구");
function b(html,attrs){var e=document.createElement("button"); e.type="button"; e.innerHTML=html; for(var k in attrs) e.setAttribute(k,attrs[k]); tb.appendChild(e); return e;}
function sep(){var s=document.createElement("span"); s.className="sep"; tb.appendChild(s);}
var tPen,tHl,tEr,tSh,tTx,bFs,tNone,sws={},bUndo,bClear,bMemo,bHide,msg;
if(paged){
  tNone=b("👆 넘기기",{"data-t":"none",title:"필기 멈추고 슬라이드 조작(퀴즈 풀기 등)"});
  tPen=b("✏️ 펜",{"data-t":"pen",title:"펜 (P)"});
  tHl=b("🖍 형광펜",{"data-t":"hl",title:"형광펜 (H)"});
  tSh=b("↗ 도형 ▾",{"data-t":"shape",title:"직선·화살표·네모·동그라미 (S) — Shift를 누르고 그리면 반듯하게"});
  tTx=b("🔤 글자",{"data-t":"text",title:"쓰고 싶은 자리를 누른 뒤 자판으로 입력 (T) — Enter 완료 · Shift+Enter 줄바꿈 · Esc 취소. 써 둔 글자를 누르면 다시 고칩니다"});
  bFs=b("가 보통",{title:"글자 크기 바꾸기 (작게·보통·크게)"});
  tEr=b("🧽 지우개",{"data-t":"er",title:"지운 획을 누르거나 문지르기 (E)"});
  sep();
  ["ink","red","blue","green"].forEach(function(c){ var e=b("",{"class":"sw","data-c":c,"aria-label":{ink:"검정",red:"빨강",blue:"파랑",green:"초록"}[c]}); e.style.background=COLORS[c]; sws[c]=e; });
  sep();
  bUndo=b("↶ 되돌리기",{title:"마지막 필기 되돌리기 (Ctrl+Z)"});
  bClear=b("🗑 이 쪽 지우기",{title:"이 슬라이드의 펜 필기를 모두 지웁니다(메모는 남음)"});
  bHide=b("👁 숨기기",{"aria-pressed":"false",title:"필기를 잠깐 숨깁니다"});
  sep();
}
bMemo=b("📝 메모",{"aria-pressed":"false",title:"이 슬라이드 메모·중요 표시"});
msg=document.createElement("span"); msg.className="stmsg"; tb.appendChild(msg);
b("닫기 ✕",{title:"필기 도구 닫기"}).onclick=function(){setOpen(false);};
document.body.appendChild(tb);
var shp=document.createElement("div"); shp.id="stShp"; shp.hidden=true; shp.setAttribute("role","group"); shp.setAttribute("aria-label","도형 고르기");
Object.keys(SHAPES).forEach(function(k){ var e=document.createElement("button"); e.type="button"; e.textContent=SHAPES[k]; e.setAttribute("data-k",k); e.onclick=function(){ shape=k; if(tSh) tSh.textContent=SHAPES[k].split(" ")[0]+" 도형 ▾"; setTool("shape"); shp.hidden=true; syncShp(); }; shp.appendChild(e); });
var shpTip=document.createElement("small"); shpTip.textContent="Shift: 반듯하게"; shp.appendChild(shpTip);
document.body.appendChild(shp);
function syncShp(){ [].forEach.call(shp.querySelectorAll("button"),function(x){ x.setAttribute("aria-pressed",x.getAttribute("data-k")===shape); }); }
function openShp(){ if(!tSh) return; syncShp(); shp.hidden=false; var r=tSh.getBoundingClientRect(), w=shp.offsetWidth; shp.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2))+"px"; shp.style.top=(r.top-shp.offsetHeight-8)+"px"; }
/* ---------- memo panel ---------- */
var pn=document.createElement("aside"); pn.id="stPanel"; pn.hidden=true; pn.setAttribute("aria-label","슬라이드 메모");
pn.innerHTML='<header><b id="stTitle"></b><button class="x" type="button" aria-label="메모 닫기">✕</button></header><div class="body"><div class="row"><button class="star" type="button" aria-pressed="false">☆ 중요</button><span class="saved" id="stSaved"></span></div><textarea id="stTa" placeholder="이 슬라이드에서 기억할 점, 질문, 시험에 나올 것 같은 내용을 적어 두세요. 자동으로 저장됩니다."></textarea><div class="lst"><h4>여기서 남긴 노트</h4><div id="stList"></div></div><div class="row io"><button type="button" class="star" id="stExp" title="메모와 필기를 한 파일(.html)로 저장">⬇ 노트 저장</button><button type="button" class="star" id="stBak" title="백업(.json) 내보내기">백업</button><label class="star" title="백업(.json) 불러와 합치기">불러오기<input type="file" id="stImp" accept=".json,application/json" hidden></label></div></div>';
document.body.appendChild(pn);
var ta=pn.querySelector("#stTa"), starB=pn.querySelector(".star"), savedEl=pn.querySelector("#stSaved");
pn.querySelector(".x").onclick=function(){showMemo(false);};
function flash(){ savedEl.textContent="저장됨 ✓"; clearTimeout(flash.t); flash.t=setTimeout(function(){savedEl.textContent="";},1400); }
ta.addEventListener("input",function(){ var e=entry(curIdx(),true); e.memo=ta.value; e.ts=now(); save(); renderList(); markStar(); });
ta.addEventListener("keydown",function(e){ e.stopPropagation(); });
starB.onclick=function(){ var e=entry(curIdx(),true); e.star=!e.star; e.ts=now(); save(); syncPanel(); renderList(); markStar(); };
function syncPanel(){
  var i=curIdx(), e=entry(i,false);
  pn.querySelector("#stTitle").textContent=(paged?(i+1)+". ":"")+titleOf(i);
  if(document.activeElement!==ta) ta.value=e?e.memo||"":"";
  var st=!!(e&&e.star); starB.setAttribute("aria-pressed",st); starB.textContent=st?"★ 중요":"☆ 중요";
}
function renderList(){
  var host=pn.querySelector("#stList"); var ks=Object.keys(data).filter(function(k){var d=data[k];return d.memo||d.star||(d.strokes&&d.strokes.length);});
  ks.sort(function(a,b){return (data[a].i||0)-(data[b].i||0);});
  if(!ks.length){ host.innerHTML='<p class="empty">아직 없습니다. 펜으로 쓰거나 메모를 남기면 여기에 모입니다.</p>'; return; }
  var ci=curIdx(); host.innerHTML="";
  ks.forEach(function(k){ var d=data[k]; var x=document.createElement("button"); x.type="button"; if(d.i===ci) x.className="cur";
    var bits=[]; if(d.star) bits.push("★"); if(d.strokes&&d.strokes.length) bits.push("✏️"+d.strokes.length);
    x.innerHTML=(paged?(d.i+1)+". ":"")+esc(d.t)+" <small>"+bits.join(" ")+"</small>"+(d.memo?'<br><small>'+esc(d.memo.slice(0,60))+(d.memo.length>60?"…":"")+'</small>':"");
    x.onclick=function(){ goTo(d.i); }; host.appendChild(x); });
}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function goTo(i){ if(!paged) return; if(typeof CFG.goTo==="function"){ CFG.goTo(i); return; }
  var t=CFG.toc&&document.querySelector(CFG.toc); if(t){ t.value=String(i); t.dispatchEvent(new Event("change")); return; }
  slides[i].scrollIntoView({behavior:"smooth",block:"start"}); }
function markStar(){ if(!paged) return; slides.forEach(function(s,i){ var m=s.querySelector(":scope > .st-mark"); var e=data[keyOf(i)]; var on=!!(e&&e.star);
  if(on&&!m){ m=document.createElement("span"); m.className="st-mark"; m.textContent="★ 중요"; s.appendChild(m); } else if(!on&&m) m.remove(); }); }
/* ---------- export / backup ---------- */
var PAL=COLORS;
/* ---------- 자판 글자 (k:"text", p:[x,y], fs, tx) ---------- */
var FONT='"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif', FSZ=[["작게",18],["보통",24],["크게",34]], fsI=1, BBX=new WeakMap(), HID=new WeakSet(), tEdit=null;
var mctx=document.createElement("canvas").getContext("2d");
function txtLines(st){ return String(st.tx||"").split("\n"); }
function txtBox(st){ var c=BBX.get(st); if(c) return c; mctx.font="600 "+st.fs+"px "+FONT; var L=txtLines(st), w=0; L.forEach(function(l){ w=Math.max(w,mctx.measureText(l).width); });
  var b=[st.p[0],st.p[1],st.p[0]+Math.max(w,st.fs*.6),st.p[1]+L.length*st.fs*1.3]; BBX.set(st,b); return b; }
function textSVG(st,col){ var L=txtLines(st); return '<text x="'+st.p[0]+'" y="'+st.p[1]+'" font-size="'+st.fs+'" font-weight="600" fill="'+col+'" font-family="Pretendard,\'Apple SD Gothic Neo\',\'Noto Sans KR\',\'Malgun Gothic\',sans-serif">'+L.map(function(l,n){ return '<tspan x="'+st.p[0]+'" dy="'+(n?st.fs*1.3:st.fs)+'">'+esc(l||" ")+'</tspan>'; }).join("")+'</text>'; }
function textAt(i,p){ var e=data[keyOf(i)]; if(!e) return null; for(var j=e.strokes.length-1;j>=0;j--){ var st=e.strokes[j]; if(st.k!=="text") continue; var b=txtBox(st); if(p[0]>=b[0]-6&&p[0]<=b[2]+6&&p[1]>=b[1]-6&&p[1]<=b[3]+6) return st; } return null; }
function openText(i,p,st){
  closeText(true); var c=canvasFor(i); if(!c) return; var s=slides[i], k=c.getBoundingClientRect().width/1000;
  var ta2=document.createElement("textarea"); ta2.className="st-tx"; ta2.rows=1; ta2.spellcheck=false; ta2.setAttribute("aria-label","필기 글자 입력");
  var fs=st?st.fs:FSZ[fsI][1], col=st?st.c:color, x=st?st.p[0]:p[0], y=st?st.p[1]:p[1];
  ta2.value=st?st.tx:""; ta2.style.left=(x*k+c.offsetLeft)+"px"; ta2.style.top=(y*k+c.offsetTop)+"px"; ta2.style.font="600 "+(fs*k)+"px "+FONT; ta2.style.lineHeight="1.3"; ta2.style.color=COLORS[col]||COLORS.ink;
  ta2.placeholder="글자 입력 후 Enter";
  s.appendChild(ta2); tEdit={i:i,ta:ta2,st:st,old:st?st.tx:"",fs:fs,c:col,x:x,y:y};
  if(st){ HID.add(st); draw(i); }
  function fit(){ ta2.style.height="auto"; ta2.style.height=ta2.scrollHeight+"px"; ta2.style.width="1px"; ta2.style.width=Math.min(s.clientWidth-(x*k)-8,Math.max(80,ta2.scrollWidth+12))+"px"; }
  ta2.addEventListener("input",fit); fit();
  ta2.addEventListener("keydown",function(ev){ ev.stopPropagation(); if(ev.isComposing||ev.keyCode===229) return;
    if(ev.key==="Enter"&&!ev.shiftKey){ ev.preventDefault(); closeText(true); } else if(ev.key==="Escape"){ ev.preventDefault(); closeText(false); } });
  ta2.addEventListener("pointerdown",function(ev){ ev.stopPropagation(); });
  ta2.addEventListener("blur",function(){ setTimeout(function(){ if(tEdit&&tEdit.ta===ta2) closeText(true); },150); });
  setTimeout(function(){ ta2.focus(); },0);
}
function closeText(commit){
  if(!tEdit) return; var t=tEdit; tEdit=null; var v=commit?t.ta.value.replace(/\s+$/,""):t.old; t.ta.remove();
  var e=entry(t.i,true);
  if(t.st){ HID.delete(t.st); BBX.delete(t.st);
    if(!v){ var j=e.strokes.indexOf(t.st); if(j>=0){ e.strokes.splice(j,1); hist.push({i:t.i,type:"del",s:t.st,at:j}); } }
    else if(v!==t.old){ t.st.tx=v; hist.push({i:t.i,type:"edit",s:t.st,old:t.old}); } else { draw(t.i); return; }
  } else { if(!v){ return; } var ns={c:t.c,w:0,k:"text",fs:t.fs,p:[Math.round(t.x*10)/10,Math.round(t.y*10)/10],tx:v}; e.strokes.push(ns); hist.push({i:t.i,type:"add",s:ns}); }
  e.ts=now(); save(); draw(t.i); renderList(); status();
}
function svgOf(strokes){ if(!strokes||!strokes.length) return ""; var x0=1e9,y0=1e9,x1=0,y1=0; strokes.forEach(function(s){ if(s.k==="text"){ var b=txtBox(s); x0=Math.min(x0,b[0]);y0=Math.min(y0,b[1]);x1=Math.max(x1,b[2]);y1=Math.max(y1,b[3]); return; } for(var j=0;j<s.p.length;j+=2){x0=Math.min(x0,s.p[j]);x1=Math.max(x1,s.p[j]);y0=Math.min(y0,s.p[j+1]);y1=Math.max(y1,s.p[j+1]);}});
  x0=Math.max(0,x0-20);y0=Math.max(0,y0-20); var w=Math.max(120,x1+20-x0),h=Math.max(60,y1+20-y0);
  return '<svg viewBox="'+x0+' '+y0+' '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg">'+strokes.map(function(s){var pts=[];for(var j=0;j<s.p.length;j+=2)pts.push(s.p[j]+","+s.p[j+1]); if(pts.length===1)pts.push((s.p[0]+.1)+","+s.p[1]); if(s.k==="text") return textSVG(s,PAL[s.c]||PAL.ink); if(s.k) return shapeSVG(s,PAL[s.c]||PAL.ink); return '<polyline points="'+pts.join(" ")+'" fill="none" stroke="'+(PAL[s.c]||PAL.ink)+'" stroke-width="'+s.w+'" stroke-linecap="round" stroke-linejoin="round"/>';}).join("")+'</svg>'; }
function dl(name,text,type){ var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type:type})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500); }
function stamp(){ var d=new Date(),z=function(n){return (n<10?"0":"")+n;}; return d.getFullYear()+z(d.getMonth()+1)+z(d.getDate())+"_"+z(d.getHours())+z(d.getMinutes()); }
pn.querySelector("#stExp").onclick=function(){ var ks=Object.keys(data).sort(function(a,b){return (data[a].i||0)-(data[b].i||0);}); var T=CFG.title||document.title||"노트";
  var body=ks.map(function(k){var d=data[k]; return '<div class="it'+(d.star?' s':'')+'"><h3>'+(paged?(d.i+1)+'. ':'')+esc(d.t)+(d.star?' <em>★ 중요</em>':'')+'</h3>'+(d.memo?'<p>'+esc(d.memo)+'</p>':'')+svgOf(d.strokes)+'</div>';}).join("")||"<p>노트가 없습니다.</p>";
  dl("내노트_"+stamp()+".html",'<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>내 노트 · '+esc(T)+'</title><style>body{font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;max-width:820px;margin:24px auto;padding:0 16px;color:#172033;line-height:1.6}.it{border:1px solid #d5dbe3;border-radius:10px;padding:10px 12px;margin:10px 0;break-inside:avoid}.it.s{border-color:#e0a800}h3{margin:0 0 4px;font-size:1rem}h3 em{font-style:normal;color:#7a5600;font-size:.85rem}p{white-space:pre-wrap;margin:0 0 6px}svg{width:100%;max-height:220px;border:1px solid #e3e7ee;border-radius:8px;background:#fafbfc}</style></head><body><h1>내 노트 · '+esc(T)+'</h1><p>저장한 날: '+new Date().toLocaleString("ko-KR")+' · 이름: ________________</p>'+body+'</body></html>',"text/html"); };
pn.querySelector("#stBak").onclick=function(){ dl("내노트_백업_"+stamp()+".json",JSON.stringify({app:MOD,v:1,at:Date.now(),notes:data}),"application/json"); };
pn.querySelector("#stImp").onchange=function(){ var f=this.files&&this.files[0], inp=this; if(!f) return; var r=new FileReader();
  r.onload=function(){ try{ var o=JSON.parse(r.result).notes; if(!o||typeof o!=="object") throw 0; Object.keys(o).forEach(function(k){ if(!data[k]||(o[k].ts||0)>(data[k].ts||0)) data[k]=o[k]; }); save(); refreshAll(); renderList(); syncPanel(); savedEl.textContent="불러왔습니다 ✓"; }catch(e){ savedEl.textContent="백업 파일을 읽지 못했습니다"; } inp.value=""; };
  r.readAsText(f); };
/* ---------- shapes ---------- */
function headPts(x0,y0,x1,y1,w){ var a=Math.atan2(y1-y0,x1-x0), L=12+w*3, s=0.5; return [x1-L*Math.cos(a-s),y1-L*Math.sin(a-s),x1-L*Math.cos(a+s),y1-L*Math.sin(a+s)]; }
function shapePath(g,st,k){ var p=st.p, x0=p[0]*k,y0=p[1]*k,x1=p[2]*k,y1=p[3]*k;
  if(st.k==="rect"){ g.rect(Math.min(x0,x1),Math.min(y0,y1),Math.abs(x1-x0),Math.abs(y1-y0)); }
  else if(st.k==="ellipse"){ g.ellipse((x0+x1)/2,(y0+y1)/2,Math.abs(x1-x0)/2,Math.abs(y1-y0)/2,0,0,Math.PI*2); }
  else { g.moveTo(x0,y0); g.lineTo(x1,y1); if(st.k==="arrow"){ var h=headPts(x0,y0,x1,y1,st.w*k); g.moveTo(h[0],h[1]); g.lineTo(x1,y1); g.lineTo(h[2],h[3]); } } }
function shapeSamples(st){ var p=st.p,x0=p[0],y0=p[1],x1=p[2],y1=p[3],o=[],n=40,t;
  if(st.k==="rect"){ [[x0,y0,x1,y0],[x1,y0,x1,y1],[x1,y1,x0,y1],[x0,y1,x0,y0]].forEach(function(e){ for(t=0;t<=10;t++) o.push(e[0]+(e[2]-e[0])*t/10,e[1]+(e[3]-e[1])*t/10); }); }
  else if(st.k==="ellipse"){ var cx=(x0+x1)/2,cy=(y0+y1)/2,rx=Math.abs(x1-x0)/2,ry=Math.abs(y1-y0)/2; for(t=0;t<=n;t++) o.push(cx+rx*Math.cos(t/n*Math.PI*2),cy+ry*Math.sin(t/n*Math.PI*2)); }
  else { for(t=0;t<=20;t++) o.push(x0+(x1-x0)*t/20,y0+(y1-y0)*t/20); }
  return o; }
function shapeSVG(st,col){ var p=st.p,x0=p[0],y0=p[1],x1=p[2],y1=p[3],a=' fill="none" stroke="'+col+'" stroke-width="'+st.w+'" stroke-linecap="round" stroke-linejoin="round"';
  if(st.k==="rect") return '<rect x="'+Math.min(x0,x1)+'" y="'+Math.min(y0,y1)+'" width="'+Math.abs(x1-x0)+'" height="'+Math.abs(y1-y0)+'"'+a+'/>';
  if(st.k==="ellipse") return '<ellipse cx="'+(x0+x1)/2+'" cy="'+(y0+y1)/2+'" rx="'+Math.abs(x1-x0)/2+'" ry="'+Math.abs(y1-y0)/2+'"'+a+'/>';
  var d='M'+x0+' '+y0+'L'+x1+' '+y1; if(st.k==="arrow"){ var h=headPts(x0,y0,x1,y1,st.w); d+='M'+h[0]+' '+h[1]+'L'+x1+' '+y1+'L'+h[2]+' '+h[3]; } return '<path d="'+d+'"'+a+'/>'; }
function constrain(st,shift){ if(!shift) return; var p=st.p,dx=p[2]-p[0],dy=p[3]-p[1];
  if(st.k==="rect"||st.k==="ellipse"){ var m=Math.max(Math.abs(dx),Math.abs(dy)); p[2]=p[0]+(dx<0?-m:m); p[3]=p[1]+(dy<0?-m:m); }
  else { var a=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4), r=Math.hypot(dx,dy); p[2]=p[0]+r*Math.cos(a); p[3]=p[1]+r*Math.sin(a); } }
/* ---------- canvas ---------- */
var cvs={};
function canvasFor(i){
  if(!paged) return null;
  var s=slides[i]; var c=cvs[i];
  if(!c){ c=document.createElement("canvas"); c.className="stcv"; s.appendChild(c); cvs[i]=c; bindDraw(c,i); }
  return c;
}
function sizeAndDraw(i){
  var c=canvasFor(i); if(!c) return; var s=slides[i];
  var w=s.clientWidth, h=Math.max(s.scrollHeight,s.clientHeight), dpr=window.devicePixelRatio||1;
  if(!w) return;
  c.style.width=w+"px"; c.style.height=h+"px";
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){ c.width=Math.round(w*dpr); c.height=Math.round(h*dpr); }
  draw(i);
}
function draw(i,extra){
  var c=cvs[i]; if(!c) return; var g=c.getContext("2d"); var dpr=window.devicePixelRatio||1; var w=c.width/dpr;
  g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,c.width,c.height); var k=w/1000;
  var e=data[keyOf(i)]; var list=(e&&e.strokes)?e.strokes.slice():[]; if(extra) list.push(extra);
  list.forEach(function(st){ var p=st.p; if(!p||p.length<2) return;
    g.strokeStyle=COLORS[st.c]||COLORS.ink; g.lineWidth=st.w*k; g.lineCap="round"; g.lineJoin="round";
    if(st.k==="text"){ if(HID.has(st)) return; g.globalCompositeOperation="source-over"; g.fillStyle=COLORS[st.c]||COLORS.ink; g.font="600 "+(st.fs*k)+"px "+FONT; g.textBaseline="top"; txtLines(st).forEach(function(l,n){ g.fillText(l,p[0]*k,(p[1]+n*st.fs*1.3+st.fs*.08)*k); }); return; }
    if(st.k){ g.globalCompositeOperation="source-over"; g.beginPath(); shapePath(g,st,k); g.stroke(); return; }
    g.globalCompositeOperation=st.c==="hl"?"multiply":"source-over";
    g.beginPath(); g.moveTo(p[0]*k,p[1]*k);
    if(p.length===2) g.lineTo(p[0]*k+0.1,p[1]*k);
    for(var j=2;j<p.length;j+=2) g.lineTo(p[j]*k,p[j+1]*k);
    g.stroke(); });
  g.globalCompositeOperation="source-over";
}
function bindDraw(c,i){
  var cur=null, pid=null;
  function pt(ev){ var r=c.getBoundingClientRect(); var k=1000/r.width; return [Math.round((ev.clientX-r.left)*k*10)/10, Math.round((ev.clientY-r.top)*k*10)/10]; }
  c.addEventListener("pointerdown",function(ev){
    if(!penOn||tool==="none") return; ev.preventDefault();
    if(tool==="text"){ var tp=pt(ev); openText(i,tp,textAt(i,tp)); return; }
    pid=ev.pointerId; try{c.setPointerCapture(pid);}catch(e){}
    var p=pt(ev);
    if(tool==="er"){ cur={er:true}; eraseAt(i,p); return; }
    if(tool==="shape"){ cur={c:color,w:3,k:shape,p:[p[0],p[1],p[0],p[1]]}; draw(i,cur); return; }
    cur={c:tool==="hl"?"hl":color, w:tool==="hl"?18:(ev.pointerType==="pen"&&ev.pressure?2+ev.pressure*2.4:3), p:[p[0],p[1]]};
    draw(i,cur);
  });
  c.addEventListener("pointermove",function(ev){
    if(!cur||ev.pointerId!==pid) return; ev.preventDefault(); var p=pt(ev);
    if(cur.er){ eraseAt(i,p); return; }
    if(cur.k){ cur.p[2]=p[0]; cur.p[3]=p[1]; constrain(cur,ev.shiftKey); draw(i,cur); return; }
    var n=cur.p.length; var dx=p[0]-cur.p[n-2], dy=p[1]-cur.p[n-1]; if(dx*dx+dy*dy<2) return;
    cur.p.push(p[0],p[1]); draw(i,cur);
  });
  function end(ev){
    if(!cur||(ev&&ev.pointerId!==pid)) return;
    if(cur.k&&Math.hypot(cur.p[2]-cur.p[0],cur.p[3]-cur.p[1])<4){ cur=null; pid=null; draw(i); return; }
    if(cur.k) cur.p=cur.p.map(function(v){return Math.round(v*10)/10;});
    if(!cur.er){ var e=entry(i,true); e.strokes.push(cur); e.ts=now(); hist.push({i:i,type:"add",s:cur}); save(); }
    cur=null; pid=null; draw(i); renderList(); status();
  }
  c.addEventListener("pointerup",end); c.addEventListener("pointercancel",end); c.addEventListener("lostpointercapture",end);
}
function eraseAt(i,p){
  var e=data[keyOf(i)]; if(!e||!e.strokes.length) return; var r=14;
  for(var j=e.strokes.length-1;j>=0;j--){ if(e.strokes[j].k==="text"){ var tb2=txtBox(e.strokes[j]); if(p[0]>=tb2[0]-4&&p[0]<=tb2[2]+4&&p[1]>=tb2[1]-4&&p[1]<=tb2[3]+4){ var s0=e.strokes.splice(j,1)[0]; hist.push({i:i,type:"del",s:s0,at:j}); e.ts=now(); save(); draw(i); renderList(); status(); } continue; }
    var q=e.strokes[j].k?shapeSamples(e.strokes[j]):e.strokes[j].p, hit=false;
    for(var m=0;m<q.length;m+=2){ var dx=q[m]-p[0], dy=q[m+1]-p[1]; if(dx*dx+dy*dy<r*r){hit=true;break;} }
    if(hit){ var s=e.strokes.splice(j,1)[0]; hist.push({i:i,type:"del",s:s,at:j}); e.ts=now(); save(); draw(i); renderList(); status(); }
  }
}
function undo(){
  var h=hist.pop(); if(!h){ toastMsg("되돌릴 필기가 없습니다"); return; }
  var e=entry(h.i,true);
  if(h.type==="add"){ var k=e.strokes.indexOf(h.s); if(k>=0) e.strokes.splice(k,1); }
  else if(h.type==="del"){ e.strokes.splice(Math.min(h.at,e.strokes.length),0,h.s); }
  else if(h.type==="clear"){ e.strokes=h.list.slice(); }
  else if(h.type==="edit"){ h.s.tx=h.old; BBX.delete(h.s); }
  if(h.i!==curIdx()) goTo(h.i);
  save(); draw(h.i); renderList(); status();
}
function status(){ if(!msg) return; var e=data[keyOf(curIdx())]; var n=e&&e.strokes?e.strokes.length:0; msg.textContent=n?("이 쪽 필기 "+n+"획"):""; }
function toastMsg(t){ if(!msg) return; msg.textContent=t; clearTimeout(toastMsg.t); toastMsg.t=setTimeout(status,1600); }
/* ---------- tool state ---------- */
function setTool(t){
  tool=t; penOn=(t!=="none"); document.body.classList.toggle("st-pen",penOn); document.body.classList.toggle("st-er",t==="er");
  if(t!=="text") closeText(true); document.body.classList.toggle("st-txt",t==="text");
  [tNone,tPen,tHl,tSh,tTx,tEr].forEach(function(x){ if(x) x.setAttribute("aria-pressed", x.getAttribute("data-t")===t); });
  if(t!=="shape"&&typeof shp!=="undefined") shp.hidden=true;
}
function setColor(c){ color=c; Object.keys(sws).forEach(function(k){ sws[k].setAttribute("aria-pressed",k===c); }); if(tool!=="pen"&&tool!=="shape"&&tool!=="text") setTool("pen"); if(tEdit){ tEdit.c=c; tEdit.ta.style.color=COLORS[c]; if(tEdit.st) tEdit.st.c=c; } }
function setOpen(on){
  tb.hidden=!on; btn.setAttribute("aria-pressed",on); if(!on) shp.hidden=true;
  if(on){ if(paged){ setTool("pen"); setColor("ink"); sizeAndDraw(curIdx()); drawVisible(); } else showMemo(true); status(); }
  else { closeText(true); if(paged) setTool("none"); showMemo(false); }
}
function showMemo(on){ pn.hidden=!on; bMemo.setAttribute("aria-pressed",on); if(on){ syncPanel(); renderList(); } }
btn.onclick=function(){ setOpen(tb.hidden); };
bMemo.onclick=function(){ showMemo(pn.hidden); if(!pn.hidden) setTimeout(function(){ta.focus();},30); };
if(paged){
  [tNone,tPen,tHl,tTx,tEr].forEach(function(x){ x.onclick=function(){ setTool(x.getAttribute("data-t")); }; });
  bFs.addEventListener("mousedown",function(ev){ ev.preventDefault(); });
  bFs.onclick=function(){ fsI=(fsI+1)%FSZ.length; bFs.textContent="가 "+FSZ[fsI][0]; if(tEdit){ var c=cvs[tEdit.i], k=c?c.getBoundingClientRect().width/1000:1; tEdit.fs=FSZ[fsI][1]; if(tEdit.st){ tEdit.st.fs=tEdit.fs; BBX.delete(tEdit.st); } tEdit.ta.style.fontSize=(tEdit.fs*k)+"px"; tEdit.ta.dispatchEvent(new Event("input")); } else if(tool!=="text") setTool("text"); };
  tSh.onclick=function(){ if(tool==="shape"&&!shp.hidden){ shp.hidden=true; return; } setTool("shape"); openShp(); };
  Object.keys(sws).forEach(function(k){ sws[k].addEventListener("mousedown",function(ev){ if(tEdit) ev.preventDefault(); }); sws[k].onclick=function(){ setColor(k); if(tEdit) tEdit.ta.focus(); }; });
  bUndo.onclick=undo;
  var clrArm=0;
  bClear.onclick=function(){
    var i=curIdx(), e=data[keyOf(i)]; if(!e||!e.strokes.length){ toastMsg("지울 필기가 없습니다"); return; }
    if(!clrArm){ clrArm=1; bClear.textContent="한 번 더 누르면 지움"; setTimeout(function(){clrArm=0; bClear.textContent="🗑 이 쪽 지우기";},2500); return; }
    clrArm=0; bClear.textContent="🗑 이 쪽 지우기";
    hist.push({i:i,type:"clear",list:e.strokes.slice()}); e.strokes=[]; e.ts=now(); save(); draw(i); renderList(); status(); toastMsg("지웠습니다 — ↶ 되돌리기로 복구");
  };
  bHide.onclick=function(){ var on=document.body.classList.toggle("st-hide"); bHide.setAttribute("aria-pressed",on); bHide.textContent=on?"👁 보이기":"👁 숨기기"; };
}
__ON(document,"keydown",function(e){
  if(tb.hidden) return; var t=e.target.tagName; if(t==="INPUT"||t==="TEXTAREA"||t==="SELECT") return;
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&(e.key==="z"||e.key==="Z")&&paged){ e.preventDefault(); undo(); return; }
  if(!paged||e.ctrlKey||e.metaKey||e.altKey) return;
  var k=e.key.toLowerCase(); if(k==="p") setTool("pen"); else if(k==="h") setTool("hl"); else if(k==="e") setTool("er"); else if(k==="s"){ setTool("shape"); openShp(); } else if(k==="t"){ e.preventDefault(); setTool("text"); } else if(k==="escape"){ if(!shp.hidden) shp.hidden=true; else setOpen(false); }
});
/* ---------- react to slide changes & resizes ---------- */
var lastIdx=-1;
function onSlide(){ var i=curIdx(); if(i===lastIdx) return; if(tEdit&&tEdit.i!==i&&document.activeElement!==tEdit.ta) closeText(true); lastIdx=i; if(paged){ if(data[keyOf(i)]||!tb.hidden) sizeAndDraw(i); } if(!pn.hidden){ syncPanel(); renderList(); } status(); }
if(paged){ var mo=__OBS(new MutationObserver(onSlide)); slides.forEach(function(s){ mo.observe(s,{attributes:true,attributeFilter:["class"]}); }); }
function drawVisible(){ if(!paged) return; slides.forEach(function(sl,i){ var r=sl.getBoundingClientRect(); if(r.height&&r.bottom>0&&r.top<innerHeight&&(data[keyOf(i)]||!tb.hidden)) sizeAndDraw(i); }); }
var scT=0; __ON(window,"scroll",function(){ clearTimeout(scT); scT=setTimeout(function(){ onSlide(); drawVisible(); },120); },true);
var rzT=0; __ON(window,"resize",function(){ clearTimeout(rzT); rzT=setTimeout(function(){ if(paged) sizeAndDraw(curIdx()); },120); });
if(paged && window.ResizeObserver){ var ro=__OBS(new ResizeObserver(function(){ clearTimeout(rzT); rzT=setTimeout(function(){ sizeAndDraw(curIdx()); },80); })); slides.forEach(function(s){ ro.observe(s); }); }
function refreshAll(){ markStar(); lastIdx=-1; onSlide(); if(paged){ Object.keys(cvs).forEach(function(k){ draw(+k); }); drawVisible(); } }
/* ---------- init ---------- */
__ON(window,"message",function(ev){ var d=ev.data; if(!d||d.app!=="mp") return;
  if(d.notesFor===MOD){ data=d.notes||{}; refreshAll(); }
  if(d.studyOpen){ setOpen(true); if(d.studyMemo) showMemo(true); }
});
if(useParent){ try{ parent.postMessage({app:"mp",notesGet:MOD},"*"); }catch(e){} } else { loadLocal(); }
refreshAll();
function addMemo(x){ var e=entry(curIdx(),true); e.memo=(e.memo?e.memo+"\n":"")+x; e.ts=now(); save(); markStar(); if(!pn.hidden){ ta.value=e.memo; renderList(); } }
window.STUDY=window.__study={addMemo:addMemo,data:function(){return data;},setTool:setTool,setOpen:setOpen,undo:undo,showMemo:showMemo};

  }
  function modLookup(__CFG, __ON, __OBS) {

"use strict";
var CFG=__CFG;
var G=CFG.glossary||[];
var MOD=CFG.app||document.documentElement.getAttribute("data-mod")||(location.pathname.split("/").pop()||document.title||"app");
var ACTIVE=CFG.activeClass||"on";
var slides=[].slice.call(document.querySelectorAll(CFG.slides||"section.slide, .slide"));
var inApp=!!CFG.parentStore&&(window.parent&&window.parent!==window);
function titleOf(i){ var el=slides[i]; var t=el.getAttribute("data-title")||el.getAttribute("aria-label"); if(!t){ var h=el.querySelector("h1,h2,h3"); t=h?h.textContent.trim().replace(/\s+/g," ").slice(0,60):""; } return t||("슬라이드 "+(i+1)); }
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function norm(s){return String(s||"").toLowerCase().replace(/[\s·\-‐–—_()（）\[\]「」『』'"“”‘’.,!?:;…\/]/g,"");}
/* ---- word cleanup: strip Korean particles/endings ---- */
var JOSA=["으로부터","에서부터","이라는","이라고","입니다","이에요","이다","에서는","에게서","까지는","으로는","에서","에게","까지","부터","처럼","보다","으로","라는","이며","이고","하고","하는","하며","한다","된다","되는","은","는","이","가","을","를","의","에","로","와","과","도","만","나","란","며","고"];
function cands(q){ var s=String(q||"").trim().replace(/^[\s"'“‘(\[]+|[\s"'”’)\].,!?:;…]+$/g,""); var out=[s]; var t=s;
  for(var n=0;n<3;n++){ var hit=false; for(var i=0;i<JOSA.length;i++){ var j=JOSA[i]; if(t.length>j.length+1&&t.slice(-j.length)===j){ t=t.slice(0,-j.length); out.push(t); hit=true; break; } } if(!hit) break; }
  return out; }
/* ---- glossary index ---- */
var IDX=G.map(function(g,i){ var keys=[g.t,g.en].concat(g.a||[]).map(norm).filter(Boolean); return {i:i,keys:keys}; });
function lookup(q){
  var cs=cands(q).map(norm).filter(Boolean); if(!cs.length) return {best:null,sim:[]};
  var best=null, score=0, sim=[];
  IDX.forEach(function(x){ var s=0;
    cs.forEach(function(c,ci){ x.keys.forEach(function(k){ var v=0;
      if(k===c) v=100-ci; else if(c.length>=2&&k.indexOf(c)===0) v=60-ci; else if(c.length>=2&&k.indexOf(c)>0) v=40-ci; else if(k.length>=2&&c.indexOf(k)>=0) v=35+Math.min(k.length,10)-ci;
      if(v>s) s=v; }); });
    if(s>0) sim.push({i:x.i,s:s}); });
  sim.sort(function(a,b){return b.s-a.s;});
  if(sim.length&&sim[0].s>=35){ best=G[sim[0].i]; score=sim[0].s; sim=sim.slice(1); }
  return {best:best,score:score,sim:sim.slice(0,8).map(function(x){return G[x.i];})};
}
function termsFor(q,best){ var t=cands(q).filter(function(x){return x.length>=1;}).slice(-1); if(best){ t=t.concat([best.t]).concat((best.a||[]).filter(function(a){return /[가-힣]{2,}|^[A-Za-z]{2,}$/.test(a)&&a.indexOf("(")<0;})); } var seen={},o=[]; t.forEach(function(x){ var k=x.toLowerCase(); if(x&&!seen[k]){seen[k]=1;o.push(x);} }); return o; }
/* ---- slide search in this page ---- */
function slideText(s){ var c=s.cloneNode(true); [].forEach.call(c.querySelectorAll("canvas,script,style,.st-mark,.myphotos,.mylinks"),function(n){n.remove();}); return (c.textContent||"").replace(/\s+/g," ").trim(); }
var TXT=null; function texts(){ if(!TXT) TXT=slides.map(slideText); return TXT; }
__ON(document,"mp-edited",function(){ TXT=null; });
function findLocal(terms){ var out=[]; if(!slides.length) return out; var tx=texts();
  tx.forEach(function(t,i){ var lo=t.toLowerCase(), hit=-1, w=""; for(var k=0;k<terms.length;k++){ var p=lo.indexOf(terms[k].toLowerCase()); if(p>=0&&(hit<0||p<hit)){hit=p;w=terms[k];} }
    if(hit>=0) out.push({i:i,t:titleOf(i),snip:snip(t,hit,w.length)}); });
  return out; }
function snip(t,p,l){ var a=Math.max(0,p-26), b=Math.min(t.length,p+l+38); return (a>0?"…":"")+esc(t.slice(a,p))+"<mark>"+esc(t.slice(p,p+l))+"</mark>"+esc(t.slice(p+l,b))+(b<t.length?"…":""); }
function goTo(i,terms){ if(typeof CFG.goTo==="function") CFG.goTo(i); else { var t=CFG.toc&&document.querySelector(CFG.toc); if(t){ t.value=String(i); t.dispatchEvent(new Event("change")); } else slides[i].scrollIntoView({behavior:"smooth",block:"start"}); }
  setTimeout(function(){ mark(slides[i],terms); },120); }
/* ---- highlight with CSS Custom Highlight API ---- */
function mark(root,terms){ if(!window.CSS||!CSS.highlights||!window.Highlight) return; CSS.highlights.delete("lk"); if(!root||!terms||!terms.length) return;
  var ranges=[], w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null), n, first=null;
  while((n=w.nextNode())){ var v=n.nodeValue.toLowerCase(); terms.forEach(function(tm){ var q=tm.toLowerCase(), p=0; if(!q) return; while((p=v.indexOf(q,p))>=0){ var r=new Range(); r.setStart(n,p); r.setEnd(n,p+q.length); ranges.push(r); if(!first) first=n.parentElement; p+=q.length; } }); }
  if(ranges.length){ var h=new Highlight(); ranges.forEach(function(r){ h.add(r); }); CSS.highlights.set("lk",h); if(first&&first.scrollIntoView) first.scrollIntoView({block:"nearest"}); clearTimeout(mark.t); mark.t=setTimeout(function(){CSS.highlights.delete("lk");},6000); }
}
/* ---- UI ---- */
var btn=document.createElement("button"); btn.id="lkBtn"; btn.type="button"; btn.textContent="📖 용어"; btn.title="모르는 단어 찾기 — 슬라이드의 글자를 드래그하거나 두 번 눌러도 됩니다"; btn.setAttribute("aria-pressed","false");
var bar=CFG.mount?document.querySelector(CFG.mount):null; var st=bar&&bar.querySelector("#stBtn");
if(bar){ if(st) bar.insertBefore(btn,st); else bar.appendChild(btn); } else { btn.classList.add("float"); document.body.appendChild(btn); }
var bub=document.createElement("button"); bub.id="lkBub"; bub.type="button"; bub.hidden=true; bub.textContent="🔍 찾아보기"; document.body.appendChild(bub);
var pn=document.createElement("aside"); pn.id="lkPanel"; pn.hidden=true; pn.setAttribute("aria-label","용어 찾기");
pn.innerHTML='<div class="hd"><b>📖 용어 찾기</b><button class="x" type="button" aria-label="닫기">✕</button></div><form><input id="lkQ" type="search" placeholder="모르는 단어 입력" autocomplete="off"><button type="submit">찾기</button></form><div id="lkBody"></div>';
document.body.appendChild(pn);
var inp=pn.querySelector("#lkQ"), body=pn.querySelector("#lkBody"), lastQ="", remote=[];
pn.querySelector(".x").onclick=function(){ open(false); };
pn.querySelector("form").onsubmit=function(e){ e.preventDefault(); run(inp.value); };
inp.addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Escape") open(false); });
var typT=0; inp.addEventListener("input",function(){ clearTimeout(typT); typT=setTimeout(function(){ run(inp.value); },250); });
function open(on){ pn.hidden=!on; btn.setAttribute("aria-pressed",on); if(on){ var sp=document.getElementById("stPanel"); if(sp&&!sp.hidden){ var x=sp.querySelector(".x"); if(x) x.click(); } } else if(window.CSS&&CSS.highlights) CSS.highlights.delete("lk"); }
btn.onclick=function(){ if(pn.hidden){ open(true); if(!inp.value) run(""); setTimeout(function(){inp.focus();},30); } else open(false); };
function webLinks(q,best){ var k=encodeURIComponent(q), e=best&&best.en?encodeURIComponent(best.en):"";
  var L=[["네이버 지식백과","terms.naver.com","https://terms.naver.com/search.naver?query="+k],["위키백과","ko.wikipedia.org","https://ko.wikipedia.org/w/index.php?search="+k],["구글 검색","google.com","https://www.google.com/search?q="+k]];
  if(CFG.medical) L.splice(1,0,["KMLE 의학 사전","의학용어·약어","https://www.kmle.co.kr/search.php?Search="+k]);
  if(e&&CFG.medical) L.push(["PubMed 논문","영어: "+best.en,"https://pubmed.ncbi.nlm.nih.gov/?term="+e]);
  if(e) L.push(["YouTube 영상","영어: "+best.en,"https://www.youtube.com/results?search_query="+e]);
  return '<div class="lk-web">'+L.map(function(x){return '<a href="'+x[2]+'" target="_blank" rel="noopener">'+x[0]+'<small>'+esc(x[1])+'</small></a>';}).join("")+'</div>'; }
function card(g){ var ch=(g.ch||[]).map(function(n){return CFG.chLabel?CFG.chLabel(n):n+"장";}).join(", ");
  return '<div class="lk-card"><div><span class="t">'+esc(g.t)+'</span><span class="en">'+esc(g.en||"")+'</span></div>'+((g.a&&g.a.length)?'<div class="al">다른 이름·약어: '+esc(g.a.join(", "))+'</div>':"")+'<p>'+esc(g.d)+'</p>'+(ch?'<div class="ch">주로 나오는 곳: '+ch+'</div>':"")+(window.STUDY&&window.STUDY.addMemo?'<button class="add" type="button" data-t="'+esc(g.t)+'">＋ 이 슬라이드 메모에 넣기</button>':"")+'</div>'; }
function azList(filter){ var f=norm(filter); var arr=G.slice().sort(function(a,b){return a.t.localeCompare(b.t,"ko");}); if(f) arr=arr.filter(function(g){ return [g.t,g.en].concat(g.a||[]).some(function(k){return norm(k).indexOf(f)>=0;}); });
  return '<div class="lk-az">'+arr.map(function(g){return '<button type="button" data-q="'+esc(g.t)+'">'+esc(g.t)+'</button>';}).join("")+'</div>'; }
function run(q){
  q=String(q||"").trim(); lastQ=q; inp.value=q;
  if(!q){ body.innerHTML='<p class="lk-tip">슬라이드에서 모르는 단어를 <b>두 번 누르거나 드래그</b>하면 <b>🔍 찾아보기</b>가 뜹니다. 휴대폰에서는 단어를 <b>길게 누르세요</b>.</p><h4>용어 사전 전체 ('+G.length+'개)</h4>'+azList(""); return; }
  var r=lookup(q), terms=termsFor(q,r.best), html="";
  html+=r.best?card(r.best):'<p class="lk-none">용어 사전에 <b>'+esc(q)+'</b>이(가) 없습니다. 아래 강의 속 위치나 인터넷 찾기를 이용하세요.</p>';
  if(r.sim.length) html+='<h4>비슷한 용어</h4><div class="lk-sim">'+r.sim.map(function(g){return '<button type="button" data-q="'+esc(g.t)+'">'+esc(g.t)+'</button>';}).join("")+'</div>';
  var loc=findLocal(terms);
  if(slides.length){ html+='<h4>'+(CFG.hereLabel||'이 장에서 나오는 곳')+' ('+loc.length+')</h4>'+(loc.length?loc.slice(0,30).map(function(h){return '<button class="lk-hit" type="button" data-i="'+h.i+'"><b>'+(h.i+1)+'. '+esc(h.t)+'</b><small>'+h.snip+'</small></button>';}).join(""):'<p class="lk-none">'+(CFG.hereLabel?'이 화면에는':'이 장에는')+' 나오지 않습니다.</p>'); }
  if(typeof CFG.crossSearch==="function"){ var X=CFG.crossSearch(terms)||[]; html+='<h4>다른 주차에서 ('+X.length+')</h4>'+(X.length?X.slice(0,40).map(function(h){return '<button class="lk-hit" type="button" data-href="'+esc(h.href)+'"><b>'+esc(h.label)+' · '+esc(h.t)+'</b><small>'+h.snip+'</small></button>';}).join(""):'<p class="lk-none">다른 주차에는 나오지 않습니다.</p>'); }
  if(inApp) html+='<div id="lkRemote"><h4>다른 장에서</h4><p class="lk-none">찾는 중…</p></div>';
  html+='<h4>인터넷에서 찾기</h4>'+webLinks(q,r.best);
  body.innerHTML=html; body.scrollTop=0;
  body._terms=terms;
  if(inApp){ try{ parent.postMessage({app:"mp",lookup:terms,from:MOD,q:q},"*"); }catch(e){} }
}
body.addEventListener("click",function(e){
  var b=e.target.closest("button"); if(!b) return;
  if(b.dataset.q){ run(b.dataset.q); return; }
  if(b.dataset.href){ window.__lkPending=body._terms; open(false); location.hash=b.dataset.href; return; }
  if(b.dataset.i!=null&&b.classList.contains("lk-hit")&&!b.dataset.m){ goTo(+b.dataset.i, body._terms); if(innerWidth<=640) open(false); return; }
  if(b.dataset.m){ try{ parent.postMessage({app:"mp",open:b.dataset.m,slide:(+b.dataset.i)+1,hl:body._terms},"*"); }catch(x){} return; }
  if(b.classList.contains("add")&&window.STUDY&&window.STUDY.addMemo){ var g=G.filter(function(x){return x.t===b.dataset.t;})[0]; if(g){ window.STUDY.addMemo("📖 "+g.t+(g.en?" ("+g.en+")":"")+": "+g.d); b.textContent="✓ 메모에 넣었습니다"; b.disabled=true; } }
});
__ON(window,"message",function(ev){ var d=ev.data; if(!d||d.app!=="mp") return;
  if(d.lookupRes&&d.q===lastQ){ var host=document.getElementById("lkRemote"); if(!host) return; var L=d.lookupRes.filter(function(h){return h.m!==MOD;});
    host.innerHTML='<h4>다른 장에서 ('+L.length+')</h4>'+(L.length?L.slice(0,40).map(function(h){return '<button class="lk-hit" type="button" data-m="'+h.m+'" data-i="'+h.i+'"><b>'+esc(h.chap)+' · '+(h.i+1)+'. '+esc(h.t)+'</b><small>'+h.snip+'</small></button>';}).join(""):'<p class="lk-none">다른 장에는 나오지 않습니다.</p>'); }
  if(d.hl&&d.slide){ setTimeout(function(){ mark(slides[d.slide-1],d.hl); },350); }
});
/* ---- selection bubble ---- */
var selT=0, selText="";
function inUI(n){ while(n){ if(n.nodeType===1&&(n.isContentEditable||n.id==="lkPanel"||n.id==="stPanel"||n.id==="stBar"||n.tagName==="INPUT"||n.tagName==="TEXTAREA"||n.tagName==="SELECT")) return true; n=n.parentNode; } return false; }
function checkSel(){
  var s=window.getSelection(); if(!s||s.isCollapsed||!s.rangeCount){ bub.hidden=true; return; }
  var t=String(s).replace(/\s+/g," ").trim(); if(!t||t.length>40||inUI(s.anchorNode)){ bub.hidden=true; return; }
  if(document.body.classList.contains("st-pen")){ bub.hidden=true; return; }
  selText=t; var r=s.getRangeAt(0).getBoundingClientRect(); if(!r.width&&!r.height){ bub.hidden=true; return; }
  bub.hidden=false; var touch=matchMedia("(pointer:coarse)").matches, bw=bub.offsetWidth, bh=bub.offsetHeight;
  var x=Math.max(8,Math.min(innerWidth-bw-8,r.left+r.width/2-bw/2)), y=touch? r.bottom+12 : r.top-bh-8; if(y<8) y=r.bottom+8; if(y+bh>innerHeight-8) y=r.top-bh-8;
  bub.style.left=x+"px"; bub.style.top=y+"px";
}
__ON(document,"selectionchange",function(){ clearTimeout(selT); selT=setTimeout(checkSel,180); });
__ON(window,"scroll",function(){ bub.hidden=true; },true);
bub.addEventListener("mousedown",function(e){ e.preventDefault(); });
bub.onclick=function(){ bub.hidden=true; var q=selText; try{ window.getSelection().removeAllRanges(); }catch(e){} open(true); run(q); };
window.LOOKUP=window.__lookup={run:function(q){open(true);run(q);},lookup:lookup,cands:cands,jump:function(terms){ var h=findLocal(terms)[0]; if(h) goTo(h.i,terms); return !!h; }};

  }
  function modEdit(__CFG, __ON, __OBS) {

"use strict";
var CFG=__CFG;
var MOD=CFG.app||document.documentElement.getAttribute("data-mod")||(location.pathname.split("/").pop()||document.title||"app");
var slides=[].slice.call(document.querySelectorAll(CFG.slides||"section.slide, .slide"));
if(!slides.length) slides=[document.querySelector("main")||document.body];
var inApp=!!CFG.parentStore&&(window.parent&&window.parent!==window);
var LSK="mp-edits-v1:"+MOD, FLAG="mp-edit-on";
/* ---- 고칠 수 있는 글 칸 찾기 (웹앱 틀의 '수정본 저장'도 같은 규칙을 씀) ---- */
/*EDITC*/var EDITC={BLOCK:"H1,H2,H3,H4,H5,H6,P,LI,TD,TH,DT,DD,FIGCAPTION,BLOCKQUOTE,CAPTION,SUMMARY".split(","),INL:"DIV,SPAN,B,STRONG,EM,SMALL,A,LABEL".split(","),
  NO:"svg,button,select,textarea,input,canvas,script,style,iframe,video,audio,[contenteditable=false],.st-mark,.myphotos,.mylinks,[data-noedit]",
  norm:function(el){ return el.tagName+"|"+(el.textContent||"").replace(/\s+/g," ").trim(); },
  hash:function(s){ var h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36)+"_"+s.length; },
  SVGNO:"svg.anat,[data-noedit],[contenteditable=false]",
  isSvg:function(el){ return el.namespaceURI==="http://www.w3.org/2000/svg"; },
  get:function(el){ return this.isSvg(el)?el.textContent:el.innerHTML; },
  set:function(el,v){ if(this.isSvg(el)) el.textContent=v; else el.innerHTML=v; },
  cands:function(root,skip){ var self=this, out=[];
    var all=[].slice.call(root.querySelectorAll("*"));
    all.forEach(function(el){ var t=el.tagName;
      if(self.isSvg(el)){ if((t==="text"||t==="tspan")&&!el.querySelector("*")&&(el.textContent||"").trim()&&!el.closest(self.SVGNO)&&!(skip&&el.closest(skip))) out.push(el); return; }
      if(self.BLOCK.indexOf(t)<0&&self.INL.indexOf(t)<0) return;
      if(el.closest(self.NO)) return; if(skip&&el.closest(skip)) return;
      if(el.querySelector("button,input,select,textarea,svg,canvas,iframe,video,img")) return;
      if(!(el.textContent||"").trim()) return;
      if(self.INL.indexOf(t)>=0){ var direct=false; for(var n=el.firstChild;n;n=n.nextSibling){ if(n.nodeType===3&&n.nodeValue.trim()){ direct=true; break; } } if(!direct) return; }
      out.push(el); });
    return out.filter(function(el){ for(var p=el.parentElement;p&&p!==root;p=p.parentElement){ if(out.indexOf(p)>=0) return false; } return true; }); },
  key:function(slide,i){ return slide.id||slide.getAttribute("data-title")||("s"+i); }
};/*/EDITC*/
window.EDITC=EDITC;
var SKIP=CFG.editSkip||"#quiz,.quiz,[data-noedit]";
var CELLS=[]; // {el,sk,idx,o,r}
slides.forEach(function(s,si){ var sk=EDITC.key(s,si); EDITC.cands(s,SKIP).forEach(function(el,idx){ var c={el:el,sk:sk,idx:idx,o:EDITC.hash(EDITC.norm(el)),r:EDITC.get(el),svg:EDITC.isSvg(el)}; el._ed=c; CELLS.push(c); }); });
var data={}; // sk -> idx -> {o,h}
function CLEAN(h){ var d=new DOMParser().parseFromString("<div>"+String(h||"")+"</div>","text/html"), r=d.body.firstChild;
  [].forEach.call(r.querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button,textarea,select"),function(n){n.remove();});
  [].forEach.call(r.querySelectorAll("*"),function(n){ [].slice.call(n.attributes).forEach(function(a){ var k=a.name.toLowerCase(), v=String(a.value||"").trim().toLowerCase(); if(k.indexOf("on")===0||((k==="href"||k==="src"||k==="xlink:href")&&v.indexOf("javascript:")===0)) n.removeAttribute(a.name); }); });
  return r.innerHTML; }
function count(){ var n=0; Object.keys(data).forEach(function(k){ n+=Object.keys(data[k]).length; }); return n; }
function apply(){ var miss=0;
  CELLS.forEach(function(c){ EDITC.set(c.el,c.r); c.el.classList.remove("ed-ch"); });
  Object.keys(data).forEach(function(sk){ var m=data[sk]; Object.keys(m).forEach(function(idx){ var v=m[idx];
    var c=CELLS.filter(function(x){return x.sk===sk&&String(x.idx)===String(idx)&&x.o===v.o;})[0]||CELLS.filter(function(x){return x.sk===sk&&x.o===v.o;})[0];
    if(c){ EDITC.set(c.el,c.svg?String(v.h):CLEAN(v.h)); c.el.classList.add("ed-ch"); } else miss++; }); });
  try{ document.dispatchEvent(new Event("mp-edited")); }catch(e){}
  return miss; }
var saveT=0;
function save(){ clearTimeout(saveT); saveT=setTimeout(function(){
  var p=typeof CFG.editSave==="function"?CFG.editSave(MOD,data):null; status("저장하는 중…");
  Promise.resolve(p).then(function(ok){ status(ok?"학생 화면에 반영됨 ✓ · 고친 칸 "+count()+"개":"저장하지 못했습니다 — 교수 로그인을 확인하세요"); }); try{ document.dispatchEvent(new Event("mp-edited")); }catch(e){} },900); }
function record(c){ var h=EDITC.get(c.el); if(!data[c.sk]) data[c.sk]={};
  if(h===c.r){ delete data[c.sk][c.idx]; if(!Object.keys(data[c.sk]).length) delete data[c.sk]; c.el.classList.remove("ed-ch"); }
  else { data[c.sk][c.idx]={o:c.o,h:h}; c.el.classList.add("ed-ch"); }
  save(); }
/* ---- UI ---- */
var btn=document.createElement("button"); btn.id="edBtn"; btn.type="button"; btn.textContent="✏️ 수정"; btn.title="교수용: 이 화면의 글을 고칩니다"; btn.hidden=true; btn.setAttribute("aria-pressed","false");
var bar=CFG.mount?document.querySelector(CFG.mount):null;
if(bar){ var before=bar.querySelector("#lkBtn")||bar.querySelector("#stBtn"); if(before) bar.insertBefore(btn,before); else bar.appendChild(btn); } else { btn.classList.add("float"); document.body.appendChild(btn); }
var tb=document.createElement("div"); tb.id="edBar"; tb.hidden=true; tb.setAttribute("role","toolbar"); tb.setAttribute("aria-label","내용 수정 도구");
function B(html,title){ var e=document.createElement("button"); e.type="button"; e.innerHTML=html; if(title) e.title=title; tb.appendChild(e); return e; }
function sep(){ var s=document.createElement("span"); s.className="sep"; tb.appendChild(s); }
var msg=document.createElement("span"); msg.className="msg"; msg.textContent="초록 점선 칸을 눌러 고치세요 · 고친 글은 학생 화면에도 보입니다";
var bBold=B("<b>B</b> 굵게","선택한 글자 굵게 (Ctrl+B)"), bUndo=B("↶ 되돌리기","방금 고친 것 되돌리기 (Ctrl+Z)"), bCell=B("↺ 이 칸 원래대로","커서가 있는 칸을 처음 글로"), bSlide=B("🗑 이 쪽 원래대로","이 슬라이드에서 고친 것을 모두 처음 글로");
sep(); var bSave=B("💾 지금 반영","고친 내용을 바로 서버에 저장해 학생 화면에 반영합니다(고치면 자동으로도 저장됩니다)");
var bExp=B("수정 내보내기","고친 내용만 .json으로 저장(다른 컴퓨터로 옮길 때)");
var lImp=document.createElement("label"); lImp.innerHTML='불러오기<input type="file" accept=".json,application/json" hidden>'; lImp.title="수정 내보내기 파일(.json)을 불러와 적용"; tb.appendChild(lImp);
sep(); tb.appendChild(msg); var bDone=B("완료 ✓","수정 끝내기"); bDone.className="done";
document.body.appendChild(tb);
function status(t){ msg.textContent=t; clearTimeout(status.t); status.t=setTimeout(function(){ msg.textContent="고친 칸 "+count()+"개 · 초록 점선 칸을 눌러 고치세요"; },2200); }
var on=false, lastCell=null;
function setOn(v){ on=v; document.body.classList.toggle("ed-on",v); tb.hidden=!v; btn.setAttribute("aria-pressed",v);
  CELLS.forEach(function(c){ if(v){ if(!c.svg){ c.el.setAttribute("contenteditable","true"); c.el.spellcheck=false; } c.el.setAttribute("data-ed",""); } else { c.el.removeAttribute("contenteditable"); c.el.removeAttribute("data-ed"); } });
  if(!v) svgClose(true);
  if(v){ if(window.__study&&document.body.classList.contains("st-pen")) try{ window.__study.setOpen(false); }catch(e){} var lp=document.getElementById("lkPanel"); if(lp&&!lp.hidden){ var x=lp.querySelector(".x"); if(x) x.click(); } status("고친 칸 "+count()+"개 · 초록 점선 칸을 눌러 고치세요"); }
  else if(document.activeElement&&document.activeElement._ed) document.activeElement.blur(); }
/* 그림(SVG) 속 글자: 누르면 작은 입력칸이 떠서 고침 */
var svgIn=document.createElement("input"); svgIn.id="edSvgIn"; svgIn.type="text"; svgIn.hidden=true; svgIn.setAttribute("aria-label","그림 속 글자 고치기"); document.body.appendChild(svgIn);
var svgCur=null;
var svgOrig="";
function svgOpen(c){ svgClose(true); svgCur=c; lastCell=c; var r=c.el.getBoundingClientRect(); svgOrig=svgIn.value=c.el.textContent; svgIn.hidden=false;
  svgIn.style.width=Math.max(140,Math.min(innerWidth-24,r.width+60))+"px"; svgIn.style.left=Math.max(8,Math.min(innerWidth-svgIn.offsetWidth-8,r.left-10))+"px"; svgIn.style.top=Math.max(8,r.top-6)+"px"; svgIn.focus(); svgIn.select(); }
function svgClose(commit){ if(!svgCur) return; var c=svgCur; svgCur=null; var v=commit?svgIn.value:svgOrig; if(v!==c.el.textContent){ c.el.textContent=v; record(c); } svgIn.hidden=true; }
svgIn.addEventListener("keydown",function(e){ e.stopPropagation(); if(e.key==="Enter"){ e.preventDefault(); svgClose(true); } else if(e.key==="Escape"){ e.preventDefault(); svgClose(false); } });
svgIn.addEventListener("input",function(){ if(svgCur){ svgCur.el.textContent=svgIn.value; record(svgCur); } });
svgIn.addEventListener("blur",function(){ setTimeout(function(){ if(document.activeElement!==svgIn) svgClose(true); },120); });
__ON(document,"click",function(e){ if(!on) return; var t=e.target&&e.target.closest&&e.target.closest("[data-ed]"); if(t&&t._ed&&t._ed.svg){ e.preventDefault(); e.stopPropagation(); svgOpen(t._ed); } },true);
btn.onclick=function(){ setOn(!on); };
bDone.onclick=function(){ setOn(false); };
__ON(document,"input",function(e){ var c=e.target&&e.target._ed||(e.target.closest&&e.target.closest("[data-ed]")||{})._ed; if(on&&c) record(c); },true);
__ON(document,"focusin",function(e){ if(e.target&&e.target._ed) lastCell=e.target._ed; });
__ON(document,"paste",function(e){ if(!on||!(e.target.closest&&e.target.closest("[data-ed]"))) return; e.preventDefault(); var t=(e.clipboardData||window.clipboardData).getData("text/plain"); document.execCommand("insertText",false,t); },true);
__ON(window,"keydown",function(e){ var t=e.target; if(!on||!t||!t.isContentEditable) return;
  if(e.key==="Escape"){ t.blur(); e.stopPropagation(); return; }
  if(e.key==="Enter"&&!e.shiftKey&&/^(H\d|TD|TH|SPAN|B|STRONG|EM|SMALL|A|LABEL|FIGCAPTION|CAPTION|SUMMARY)$/.test(t.tagName)){ e.preventDefault(); }
  e.stopPropagation(); },true);
bBold.addEventListener("mousedown",function(e){ e.preventDefault(); }); bBold.onclick=function(){ document.execCommand("bold"); var a=document.activeElement; if(a&&a._ed) record(a._ed); };
bUndo.addEventListener("mousedown",function(e){ e.preventDefault(); }); bUndo.onclick=function(){ document.execCommand("undo"); var a=document.activeElement; if(a&&a._ed) record(a._ed); };
bCell.addEventListener("mousedown",function(e){ e.preventDefault(); }); bCell.onclick=function(){ var c=(document.activeElement&&document.activeElement._ed)||lastCell; if(!c){ status("먼저 고칠 칸을 누르세요"); return; } svgClose(false); EDITC.set(c.el,c.r); record(c); status("이 칸을 처음 글로 돌렸습니다"); };
var arm=0; bSlide.onclick=function(){ var s=curSlide(); var list=CELLS.filter(function(c){ return s.contains(c.el)&&EDITC.get(c.el)!==c.r; });
  if(!list.length){ status("이 쪽에는 고친 칸이 없습니다"); return; }
  if(!arm){ arm=1; bSlide.textContent="한 번 더 누르면 되돌림"; setTimeout(function(){ arm=0; bSlide.textContent="🗑 이 쪽 원래대로"; },2500); return; }
  arm=0; bSlide.textContent="🗑 이 쪽 원래대로"; svgClose(false); list.forEach(function(c){ EDITC.set(c.el,c.r); record(c); }); status(list.length+"칸을 처음 글로 돌렸습니다"); };
function curSlide(){ var A=CFG.activeClass||"on"; for(var i=0;i<slides.length;i++) if(slides[i].classList.contains(A)) return slides[i];
  var best=slides[0],bd=1e9,mid=innerHeight/2; slides.forEach(function(s){ var r=s.getBoundingClientRect(); if(!r.height) return; var d=Math.abs((r.top+r.bottom)/2-mid); if(d<bd){bd=d;best=s;} }); return best; }
function dl(name,text,type){ var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type:type})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },600); }
function stamp(){ var d=new Date(),z=function(n){return (n<10?"0":"")+n;}; return d.getFullYear()+z(d.getMonth()+1)+z(d.getDate())+"_"+z(d.getHours())+z(d.getMinutes()); }
bExp.onclick=function(){ if(inApp){ try{ parent.postMessage({app:"mp",editExport:true},"*"); }catch(e){} return; } dl("수정내용_"+stamp()+".json",JSON.stringify({app:"edits",v:1,mods:(function(o){o[MOD]=data;return o;})({})}),"application/json"); };
lImp.querySelector("input").onchange=function(){ var f=this.files&&this.files[0], inp=this; if(!f) return; var r=new FileReader();
  r.onload=function(){ try{ var o=JSON.parse(r.result); if(inApp){ parent.postMessage({app:"mp",editImport:o},"*"); } else { var mine=(o.mods&&o.mods[MOD])||o; Object.keys(mine).forEach(function(sk){ data[sk]=Object.assign(data[sk]||{},mine[sk]); }); var miss=apply(); if(on) setOn(true); save(); status("불러왔습니다"+(miss?" (맞지 않는 칸 "+miss+"개 건너뜀)":"")); } }catch(e){ status("파일을 읽지 못했습니다"); } inp.value=""; };
  r.readAsText(f); };
/* 단독 웹앱: 원본 파일을 골라 고친 내용을 넣은 새 파일 만들기 */
bSave.onclick=function(){ clearTimeout(saveT); saveT=0; var p=typeof CFG.editSave==="function"?CFG.editSave(MOD,data):null; status("저장하는 중…"); Promise.resolve(p).then(function(ok){ status(ok?"학생 화면에 반영됨 ✓":"저장하지 못했습니다 — 교수 로그인을 확인하세요"); }); };
function bake(src,edits){ var doc=new DOMParser().parseFromString(src,"text/html"), ok=0, miss=0;
  var ss=[].slice.call(doc.querySelectorAll(CFG.slides||"section.slide, .slide")); if(!ss.length) ss=[doc.querySelector("main")||doc.body];
  var cells=[]; ss.forEach(function(s,si){ var sk=EDITC.key(s,si); EDITC.cands(s,SKIP).forEach(function(el,idx){ cells.push({el:el,sk:sk,idx:idx,o:EDITC.hash(EDITC.norm(el))}); }); });
  Object.keys(edits).forEach(function(sk){ Object.keys(edits[sk]).forEach(function(idx){ var v=edits[sk][idx];
    var c=cells.filter(function(x){return x.sk===sk&&String(x.idx)===String(idx)&&x.o===v.o;})[0]||cells.filter(function(x){return x.sk===sk&&x.o===v.o&&!x.used;})[0];
    if(c){ EDITC.set(c.el,v.h); c.used=1; ok++; } else miss++; }); });
  var dt=doc.doctype?"<!DOCTYPE html>\n":""; return {html:dt+doc.documentElement.outerHTML,ok:ok,miss:miss}; }
/* ---- 켜기: 웹앱 틀의 '교수용 수정 켜기', 설정 editable:true, 또는 Ctrl+Shift+E ---- */
function showBtn(v){ btn.hidden=!v; if(!v&&on) setOn(false); }
var flagOn=false; try{ flagOn=localStorage.getItem(FLAG)==="1"; }catch(e){}
if(CFG.editable===false){ btn.remove(); }
else if(!inApp) showBtn(CFG.editable===true||flagOn);
__ON(document,"keydown",function(e){ if(CFG.editable===false||inApp) return; if((e.ctrlKey||e.metaKey)&&e.shiftKey&&(e.key==="E"||e.key==="e")){ e.preventDefault(); var v=btn.hidden; try{ localStorage.setItem(FLAG,v?"1":"0"); }catch(x){} showBtn(v); if(!v) setOn(false); } });
__ON(window,"message",function(ev){ var d=ev.data; if(!d||d.app!=="mp") return;
  if(d.editFor===MOD){ data=d.edits||{}; apply(); if(on) setOn(true); if(typeof d.editOn==="boolean"&&CFG.editable!==false) showBtn(d.editOn); }
  if(typeof d.editOnly==="boolean"&&CFG.editable!==false) showBtn(d.editOnly);
});
if(inApp){ try{ parent.postMessage({app:"mp",editGet:MOD},"*"); }catch(e){} } else { try{ data=JSON.parse(JSON.stringify(CFG.edits||{})); }catch(e){ data={}; } apply(); }
window.EDIT={on:function(){showBtn(true);setOn(true);},off:function(){setOn(false);},data:function(){return data;},bake:bake,count:count};

  }
  function unmount() {
    try { if (window.EDIT && window.EDIT.off) window.EDIT.off(); } catch (e) {}
    try { if (window.__study && window.__study.setOpen) window.__study.setOpen(false); } catch (e) {}
    HANDLERS.forEach(function (h) { h[0].removeEventListener(h[1], h[2], h[3]); }); HANDLERS = [];
    OBSERVERS.forEach(function (o) { try { o.disconnect(); } catch (e) {} }); OBSERVERS = [];
    UI_IDS.forEach(function (id) { var e = document.getElementById(id); if (e) e.remove(); });
    [].forEach.call(document.querySelectorAll(".stcv,.st-mark"), function (e) { e.remove(); });
    document.body.classList.remove("st-pen", "st-er", "st-hide", "ed-on", "ptx-study");
    try { if (window.CSS && CSS.highlights) CSS.highlights.delete("lk"); } catch (e) {}
    window.STUDY = window.__study = window.LOOKUP = window.__lookup = window.EDIT = undefined;
  }
  function mount(cfg) {
    unmount();
    if (!cfg) return;
    document.body.classList.add("ptx-study");
    var parts = cfg.parts || { study: true, lookup: true, edit: true };
    if (parts.study) modStudy(cfg, ON, OBS);
    if (parts.lookup) modLookup(cfg, ON, OBS);
    if (parts.edit) modEdit(cfg, ON, OBS);
    if (window.__lkPending && window.LOOKUP) { var t = window.__lkPending; window.__lkPending = null; setTimeout(function () { window.LOOKUP && window.LOOKUP.jump(t); }, 250); }
  }
  window.PTX_STUDY = { mount: mount, unmount: unmount };
})();
