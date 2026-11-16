const chapters=[{id:1,title:'상해선수의 재활프로그램 수립',section:1,objectives,bank,lessons,extensions,corrections,topics:['재활팀','스포츠 재활의 철학','재활프로그램의 장·단기 목표설정','재활에 대한 기록','재활프로그램 관리에서 법률상 고려점','요약']}];
function O(text,context,explanation){return {text,context,explanation};}
function S(stem,target,clue,reason,transfer){return {stem,target,clue,reason,transfer};}
function U(name,takeaway,paragraphs,options,scenarios){return {name,takeaway,paragraphs,options,scenarios};}
function stableShuffle(values,seed){const a=[...values];let state=seed>>>0;for(let i=a.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function addChapter(id,title,section,objectives,topics,units){
 const slots=stableShuffle(Array.from({length:20},(_,n)=>n%5),id*9173);
 const c={id,title,section,objectives,topics,bank:[],lessons:[],extensions:[],corrections:[]};
 units.forEach((u,g)=>{
 c.lessons.push({name:u.name,takeaway:u.takeaway,paragraphs:u.paragraphs,rows:u.options.map(o=>[o.text,o.context]),flow:['단서 확인','관련 원리 구분','안전한 적용','반응 재평가'],review:u.takeaway+' 각 선택지가 적용되는 조건을 비교해 보세요.'});
 u.scenarios.forEach((s,k)=>{
 const n=c.bank.length,right=slots[n],order=stableShuffle([0,1,2,3,4].filter(j=>j!==s.target),id*1031+n*307);order.splice(right,0,s.target);const chosen=u.options[s.target];
 const rationale=s.reason+' '+chosen.explanation;
 c.bank.push([g+1,s.stem,order.map(j=>u.options[j].text),right,rationale,order.map(j=>j===s.target?s.reason+' '+u.options[j].explanation:`${u.options[j].text}: ${u.options[j].explanation} 적용 단서는 ‘${u.options[j].context}’이다. 이 문항의 핵심 단서는 ‘${s.clue}’이므로, 가장 직접적인 답은 ‘${chosen.text}’이다.`)]);
 c.corrections.push(order.map(j=>`${u.options[j].context} → ${u.options[j].text}. ${u.options[j].explanation}`));
 const transferOrder=[s.target,(s.target+1+k%2)%5,(s.target+3)%5];const rot=(n+id)%3;const choices=transferOrder.slice(rot).concat(transferOrder.slice(0,rot));
 c.extensions.push([[s.clue,chosen.context,s.reason],s.transfer,choices.map(j=>u.options[j].text),choices.indexOf(s.target),rationale+' 다른 선택지는 각각 '+choices.filter(j=>j!==s.target).map(j=>u.options[j].context+' 상황').join(', ')+'에서 구분해 적용한다.']);
 });});chapters.push(c);
}
