/**
 * 思数培优 · 通用刷题引擎
 * 依赖：SUBJECT, SUBJECT_COLOR, QUESTION_BANK, CHAPTERS, STAGES 全局变量
 * 页面需引入 quiz-shared.css 和对应 questions-*.js
 */
(function(){
'use strict';

const LETTERS = ['A','B','C','D'];
let currentQuiz=[], currentIndex=0, score=0, answers=[], timerInterval, timerSeconds=0,
    quizActive=false, quizStartTime, currentStreak=0;

// ===== UTILS =====
function shuffle(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelector('.subj-name')&&(document.querySelector('.subj-name').textContent=SUBJECT);
  const root=document.documentElement;
  root.style.setProperty('--primary',SUBJECT_COLOR);
  document.getElementById('stageTags').innerHTML=['全部',...STAGES].map(s=>`<span class="topic-tag" data-s="${s}" onclick="window._selStage('${s}')">${s==='全部'?'📚 全部':s}</span>`).join('');
  document.getElementById('topicTags').innerHTML=['全部',...CHAPTERS].map(c=>`<span class="topic-tag" data-c="${c}" onclick="window._selChapter('${c}')">${c==='全部'?'📚 全部':c}</span>`).join('');
  window._selStage('全部');
  renderHistory();
  updateErrBadge();
  initDaily();
});

// ===== SELECTION =====
let selStage='全部', selChapter='全部';
window._selStage=function(s){
  selStage=s; selChapter='全部';
  document.querySelectorAll('#stageTags .topic-tag').forEach(t=>t.classList.toggle('selected',t.dataset.s===s));
  document.querySelectorAll('#topicTags .topic-tag').forEach(t=>t.classList.toggle('selected',t.dataset.c==='全部'));
  updateAvail();
};
window._selChapter=function(c){
  selChapter=c;
  document.querySelectorAll('#topicTags .topic-tag').forEach(t=>t.classList.toggle('selected',t.dataset.c===c));
  updateAvail();
};
function updateAvail(){
  let pool=[...QUESTION_BANK];
  if(selStage!=='全部') pool=pool.filter(q=>q.stage===selStage);
  if(selChapter!=='全部') pool=pool.filter(q=>q.chapter===selChapter);
  const diff=document.getElementById('diffSelect').value;
  if(diff!=='all') pool=pool.filter(q=>q.diff===parseInt(diff));
  document.getElementById('availCount').textContent=pool.length;
}

// ===== START QUIZ =====
window.startQuiz=function(){
  let pool=[...QUESTION_BANK];
  if(selStage!=='全部') pool=pool.filter(q=>q.stage===selStage);
  if(selChapter!=='全部') pool=pool.filter(q=>q.chapter===selChapter);
  const diff=document.getElementById('diffSelect').value;
  if(diff!=='all') pool=pool.filter(q=>q.diff===parseInt(diff));
  let count=parseInt(document.getElementById('countSelect').value)||20;
  if(count===0) count=pool.length;
  if(pool.length===0){alert('没有符合条件的题目');return;}
  count=Math.min(count,pool.length);
  currentQuiz=shuffle(pool).slice(0,count);
  currentIndex=0; score=0; answers=[]; timerSeconds=0; quizActive=true; currentStreak=0;
  quizStartTime=new Date();
  document.getElementById('controls').style.display='none';
  document.getElementById('statsBar').style.display='flex';
  document.getElementById('resultArea').innerHTML='';
  document.getElementById('historySection').style.display='none';
  updateStats(); renderQuestion(); startTimer();
};

// ===== RENDER Q =====
function renderQuestion(){
  if(currentIndex>=currentQuiz.length){endQuiz();return;}
  const q=currentQuiz[currentIndex];
  const qShuffled=shuffle([0,1,2,3]);
  q._shuffled=qShuffled;
  q._correctShuffled=qShuffled.indexOf(q.ans);
  const diffLabels={1:'⭐ 基础',2:'⭐⭐ 进阶',3:'⭐⭐⭐ 挑战'};
  const diffCls={1:'easy',2:'medium',3:'hard'};
  let html=`<div class="q-card active"><div class="q-meta">`;
  html+=`<span class="q-num">#${currentIndex+1}/${currentQuiz.length}</span>`;
  html+=`<span class="q-topic ${diffCls[q.diff]||'easy'}">${diffLabels[q.diff]||''}</span>`;
  html+=`<span class="q-topic easy" style="background:#e8e5ff;color:#1a237e;">${q.chapter||''}</span>`;
  html+=`<span class="q-topic easy" style="background:#fce4ec;color:#c62828;">${q.topic||''}</span>`;
  html+=`</div><div class="q-text">${q.q}</div><div class="options">`;
  qShuffled.forEach((oi,si)=>{
    html+=`<div class="option" data-index="${si}" onclick="window._selAnswer(this,${si})">
      <span class="opt-letter">${LETTERS[si]}</span><span class="opt-text">${q.opts[oi]}</span></div>`;
  });
  html+=`</div><div class="explanation" id="explanation"><h4>💡 解析</h4><p>${q.exp}</p></div>
    <div style="margin-top:18px;text-align:center;">
    <button class="btn btn-primary" id="btnNext" onclick="window._nextQ()" style="display:none;">
    ${currentIndex<currentQuiz.length-1?'下一题 →':'查看成绩 🎯'}</button></div></div>`;
  document.getElementById('questionArea').innerHTML=html;
  setTimeout(()=>{if(typeof renderMathInElement!=='undefined')renderMathInElement(document.getElementById('questionArea'),{throwOnError:false});},100);
}

// ===== ANSWER =====
window._selAnswer=function(el,si){
  if(!quizActive) return;
  const q=currentQuiz[currentIndex];
  const isCorrect=(si===q._correctShuffled);
  const allOpts=el.parentElement.querySelectorAll('.option');
  allOpts.forEach(o=>o.classList.add('locked'));
  allOpts.forEach((o,i)=>{if(i===q._correctShuffled)o.classList.add('correct');if(i===si&&!isCorrect)o.classList.add('wrong');});
  el.classList.add('selected');
  document.getElementById('explanation').classList.add('show');
  document.getElementById('btnNext').style.display='inline-flex';
  if(isCorrect){score++;currentStreak++;}else{currentStreak=0;addWrongAnswer(q,q.opts[q._shuffled[si]],q.opts[q.ans],q.topic);}
  answers.push({question:q.q,topic:q.topic,userAnswer:q.opts[q._shuffled[si]],correctAnswer:q.opts[q.ans],isCorrect,explanation:q.exp});
  quizActive=false;
  updateStats();
};
window._nextQ=function(){
  currentIndex++; quizActive=true; quizStartTime=new Date(); currentStreak=0;
  if(currentIndex>=currentQuiz.length){endQuiz();}else{renderQuestion();updateStats();}
};

// ===== END =====
function endQuiz(){
  clearInterval(timerInterval); quizActive=false;
  const total=currentQuiz.length, pct=Math.round((score/total)*100);
  document.getElementById('questionArea').innerHTML='';
  document.getElementById('statsBar').style.display='none';
  let cls2,emoji,msg;
  if(pct>=80){cls2='great';emoji='🎉';msg='太棒了！';}
  else if(pct>=60){cls2='good';emoji='👍';msg='不错！继续加油！';}
  else{cls2='ok';emoji='💪';msg='别灰心，多练习！';}
  const mins=Math.floor(timerSeconds/60),secs=timerSeconds%60;
  const timeStr=mins>0?`${mins}分${secs}秒`:`${secs}秒`;

  let html=`<div class="result-area show">
    <div class="score-circle ${cls2}">${pct}%</div>
    <h3>${emoji} ${msg}</h3>
    <table class="detail-table">
    <tr><th>总题数</th><td>${total}</td></tr>
    <tr><th>正确</th><td style="color:#2e7d32;">${score}题</td></tr>
    <tr><th>错误</th><td style="color:#c62828;">${total-score}题</td></tr>
    <tr><th>用时</th><td>${timeStr}</td></tr>
    <tr><th>正确率</th><td>${pct}%</td></tr></table>
    <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
    <button class="btn btn-primary" onclick="startQuiz()">🔄 再来一轮</button>
    <button class="btn btn-outline" onclick="resetQuiz()">📋 重新选题</button>
    <button class="btn btn-gold" onclick="window._showPoster(${score},${total},${pct})">📊 生成海报</button>
    </div></div>`;

  html+=`<div class="review-section"><h3>📖 答题回顾</h3>`;
  answers.forEach((a,i)=>{
    html+=`<div class="review-item"><span class="ri-status ${a.isCorrect?'correct':'wrong'}">${a.isCorrect?'✅ 正确':'❌ 错误'}</span>
    <strong>${a.topic}</strong> · ${a.question}<br>
    你的答案：${a.userAnswer} ${a.isCorrect?'':'| 正确答案：'+a.correctAnswer}<br>
    <span style="color:#757575;">${a.explanation}</span></div>`;
  });
  html+=`</div>`;
  document.getElementById('resultArea').innerHTML=html;
  document.getElementById('historySection').style.display='block';
  setTimeout(()=>{if(typeof renderMathInElement!=='undefined')renderMathInElement(document.getElementById('resultArea'),{throwOnError:false});},100);

  // Stats
  let s=getStats(); s.quizzesTaken++; s.totalQuestions+=total; s.totalCorrect+=score;
  let chs=new Set(currentQuiz.map(q=>q.chapter));
  chs.forEach(ch=>{if(!s.chaptersDone.includes(ch))s.chaptersDone.push(ch);});
  saveStats(s);
  let allHard=currentQuiz.every(q=>q.diff===3);
  checkAchievements({total,score,pct,allHard});
  saveHistory(total,score,pct,timerSeconds);
  renderHistory();
}

function resetQuiz(){
  clearInterval(timerInterval); quizActive=false;
  document.getElementById('controls').style.display='block';
  document.getElementById('statsBar').style.display='none';
  document.getElementById('questionArea').innerHTML='';
  document.getElementById('resultArea').innerHTML='';
  document.getElementById('historySection').style.display='block';
}

// ===== TIMER =====
function startTimer(){clearInterval(timerInterval);timerSeconds=0;updateTimerDisplay();timerInterval=setInterval(()=>{timerSeconds++;updateTimerDisplay();},1000);}
function updateTimerDisplay(){const m=Math.floor(timerSeconds/60),s=timerSeconds%60;document.getElementById('timerDisp').textContent=`⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function updateStats(){
  const total=currentQuiz.length;
  document.getElementById('scoreDisp').textContent=`✅ ${score}`;
  document.getElementById('progDisp').textContent=`📋 ${currentIndex+1}/${total}`;
  const pct=total>0?Math.round((score/Math.max(1,total))*100):0;
  document.getElementById('accDisp').textContent=`📊 ${pct}%`;
}

// ===== STATS =====
function getStats(){try{let s=JSON.parse(localStorage.getItem('sishu_ach_stats')||'{}');s.quizzesTaken=s.quizzesTaken||0;s.totalQuestions=s.totalQuestions||0;s.totalCorrect=s.totalCorrect||0;s.chaptersDone=s.chaptersDone||[];return s;}catch(e){return{quizzesTaken:0,totalQuestions:0,totalCorrect:0,chaptersDone:[]};}}
function saveStats(s){try{localStorage.setItem('sishu_ach_stats',JSON.stringify(s));}catch(e){}}
function getUnlocked(){try{return JSON.parse(localStorage.getItem('sishu_ach_unlocked')||'[]');}catch(e){return[];}}

// ===== ACHIEVEMENTS =====
const ACH_DEFS=[
  {id:'first_quiz',name:'初出茅庐',desc:'完成第一次刷题',icon:'🎯',check:s=>s.quizzesTaken>=1},
  {id:'perfect',name:'满分学霸',desc:'获得满分',icon:'💯',check:(s,t,sc)=>sc===t&&t>0},
  {id:'quiz_5',name:'刷题达人',desc:'完成5次刷题',icon:'📚',check:s=>s.quizzesTaken>=5},
  {id:'quiz_20',name:'刷题狂魔',desc:'完成20次刷题',icon:'💪',check:s=>s.quizzesTaken>=20},
  {id:'total_100',name:'百题斩',desc:'累计答对100题',icon:'🗡️',check:s=>s.totalCorrect>=100},
  {id:'total_500',name:'题海无涯',desc:'累计答对500题',icon:'🌊',check:s=>s.totalCorrect>=500},
  {id:'all_chapters',name:'全章节制霸',desc:'刷过所有章节',icon:'👑',check:s=>s.chaptersDone.length>=CHAPTERS.length},
  {id:'accuracy_90',name:'精准射手',desc:'正确率≥90%',icon:'🎯',check:(s,t,sc)=>t>0&&sc/t>=0.9},
  {id:'hard_mode',name:'挑战者',desc:'完成挑战难度',icon:'🏔️',check:(s,t,sc,d)=>d&&t>=10},
];
function checkAchievements(summary){
  let s=getStats(), unlocked=getUnlocked(), newly=[];
  ACH_DEFS.forEach(ach=>{
    if(unlocked.includes(ach.id))return;
    let earned=false;
    if(ach.id==='perfect'||ach.id==='accuracy_90') earned=ach.check(s,summary.total,summary.score);
    else if(ach.id==='hard_mode') earned=ach.check(s,summary.total,summary.score,summary.allHard);
    else earned=ach.check(s);
    if(earned){unlocked.push(ach.id);newly.push(ach);}
  });
  if(newly.length){localStorage.setItem('sishu_ach_unlocked',JSON.stringify(unlocked));alert('🏆 新成就解锁！\n'+newly.map(a=>a.icon+' '+a.name).join('\n'));}
}

// ===== HISTORY =====
function saveHistory(total,score,pct,time){
  let h=JSON.parse(localStorage.getItem('sishu_quiz_history')||'[]');
  h.unshift({date:new Date().toLocaleDateString('zh-CN'),total,score,pct,time,subject:SUBJECT,topics:selStage!=='全部'?selStage:(selChapter!=='全部'?selChapter:'全部')});
  if(h.length>50)h=h.slice(0,50);
  localStorage.setItem('sishu_quiz_history',JSON.stringify(h));
}
function renderHistory(){
  const h=JSON.parse(localStorage.getItem('sishu_quiz_history')||'[]'),c=document.getElementById('historyList');
  if(!c)return;
  if(h.length===0){c.innerHTML='<div class="history-empty">暂无刷题记录，快来开始第一轮练习吧！📝</div>';return;}
  c.innerHTML=h.map(r=>{
    const m=Math.floor(r.time/60),s=r.time%60;
    return `<div class="history-item"><div><strong>${r.date}</strong> · ${r.subject||''} ${r.topics||''}<br><span style="color:#757575;">${r.total}题 · ${m>0?m+'分':''}${s}秒</span></div>
    <div class="hi-score" style="color:${r.pct>=80?'#2e7d32':r.pct>=60?'#e65100':'#c62828'}">${r.score}/${r.total} (${r.pct}%)</div></div>`;
  }).join('');
}

// ===== ERROR BOOK =====
function getErrors(){return JSON.parse(localStorage.getItem('sishu_error_book')||'[]');}
function addWrongAnswer(q,ua,ca,topic){
  let errs=getErrors();
  if(!errs.some(e=>e.q===q.q)){errs.unshift({q:q.q,topic,userAnswer:ua,correctAnswer:ca,explanation:q.exp,id:q.id});if(errs.length>200)errs=errs.slice(0,200);localStorage.setItem('sishu_error_book',JSON.stringify(errs));}
  updateErrBadge();
}
window._toggleErr=function(){
  const p=document.getElementById('errPanel'),o=document.getElementById('errOverlay');
  const open=p.style.display==='flex';
  p.style.display=open?'none':'flex'; o.style.display=open?'none':'block';
  if(!open)renderErrBook();
};
function renderErrBook(){
  let errs=getErrors(),b=document.getElementById('errBody');
  if(errs.length===0){b.innerHTML='<div class="ep-empty">🎉 太棒了！没有错题</div>';return;}
  b.innerHTML=errs.map((e,i)=>`<div class="err-item"><span class="ei-topic">${e.topic||'未分类'}</span><div class="ei-q">${e.q}</div><div class="ei-ans">你的答案：<span class="ei-wrong">${e.userAnswer||'未作答'}</span></div><div class="ei-ans">正确答案：<span class="ei-right">${e.correctAnswer}</span></div><div class="ei-exp">💡 ${e.explanation||'无解析'}</div></div>`).join('');
  setTimeout(()=>{if(typeof renderMathInElement!=='undefined')renderMathInElement(b,{throwOnError:false});},100);
}
window._exportErr=function(){
  let errs=getErrors();if(errs.length===0){alert('暂无错题');return;}
  let t='📔 我的错题本 ('+SUBJECT+')\n'+'='.repeat(30)+'\n\n';
  errs.forEach((e,i)=>{t+=`${i+1}. [${e.topic||'未分类'}] ${e.q}\n   我的答案：${e.userAnswer||'未作答'}\n   正确答案：${e.correctAnswer}\n   解析：${e.explanation||'无'}\n\n`;});
  navigator.clipboard.writeText(t).then(()=>alert('错题已复制到剪贴板！'));
};
window._clearErr=function(){if(confirm('确定清空所有错题？')){localStorage.setItem('sishu_error_book','[]');renderErrBook();updateErrBadge();}};
function updateErrBadge(){const n=getErrors().length,b=document.getElementById('errBadge'),f=document.getElementById('errFab');if(b)b.textContent=n;if(f)f.style.display=n>0?'flex':'none';}

// ===== SHARE POSTER =====
window._showPoster=function(score,total,pct){
  const o=document.getElementById('posterOverlay'),c=document.getElementById('posterCanvas');
  o.classList.add('show');
  const ctx=c.getContext('2d'),w=360,h=520;
  const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,SUBJECT_COLOR);g.addColorStop(1,'#333');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#ffd54f';ctx.font='bold 28px "Microsoft YaHei"';ctx.textAlign='center';ctx.fillText('思数培优',w/2,60);
  ctx.fillStyle='#fff';ctx.font='16px "Microsoft YaHei"';ctx.fillText('高中'+SUBJECT+'刷题',w/2,90);
  const cx=w/2,cy=190,r=70;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
  const sg=ctx.createLinearGradient(0,cy-r,0,cy+r);sg.addColorStop(0,'#ffd54f');sg.addColorStop(1,'#ff8f00');
  ctx.fillStyle=sg;ctx.fill();ctx.fillStyle=SUBJECT_COLOR;ctx.font='bold 48px "Microsoft YaHei"';
  ctx.fillText(pct+'%',cx,cy+6);ctx.fillStyle='#fff';ctx.font='14px "Microsoft YaHei"';ctx.fillText('本次正确率',cx,cy+36);
  const stats=getStats();
  [{l:'刷题次数',v:stats.quizzesTaken},{l:'累计答对',v:stats.totalCorrect},{l:'解锁成就',v:getUnlocked().length}].forEach((it,i)=>{
    const x=30+i*100;ctx.fillStyle='#ffd54f';ctx.font='bold 22px "Microsoft YaHei"';ctx.fillText(it.v,x+50,280);
    ctx.fillStyle='#90caf9';ctx.font='12px "Microsoft YaHei"';ctx.fillText(it.l,x+50,306);
  });
  ctx.fillStyle='#ffd54f';ctx.font='bold 15px "Microsoft YaHei"';ctx.fillText('✔ 8人小班 ✔ 学霸团队 ✔ 在线题库',w/2,h-80);
  ctx.fillStyle='#fff';ctx.font='13px "Microsoft YaHei"';ctx.fillText('扫码开始刷题',w/2,h-50);
};
window._closePoster=function(){document.getElementById('posterOverlay').classList.remove('show');};
window._savePoster=function(){const c=document.getElementById('posterCanvas');const a=document.createElement('a');a.download='思数培优-'+SUBJECT+'刷题.png';a.href=c.toDataURL('image/png');a.click();};

// ===== DAILY =====
function getDailyQ(){
  const today=new Date().toISOString().slice(0,10);
  const saved=JSON.parse(localStorage.getItem('sishu_daily_'+SUBJECT)||'{}');
  if(saved.date===today)return saved.q;
  let hash=0;for(let i=0;i<today.length;i++)hash=((hash<<5)-hash)+today.charCodeAt(i);hash=Math.abs(hash);
  const q=QUESTION_BANK[hash%QUESTION_BANK.length];
  localStorage.setItem('sishu_daily_'+SUBJECT,JSON.stringify({date:today,q}));
  return q;
}
function initDaily(){
  const q=getDailyQ(),container=document.querySelector('.container');
  if(!container)return;
  const old=document.getElementById('dailyCard');if(old)old.remove();
  const card=document.createElement('div');card.className='daily-card';card.id='dailyCard';
  card.onclick=()=>{const a=card.querySelector('.daily-answer');a&&a.classList.toggle('show');};
  card.innerHTML=`<div class="dc-badge">📅 每日一题 · ${SUBJECT}</div><div class="dc-q" id="dailyQ">${q.q}</div><div class="dc-hint">点击查看答案 →</div>
    <div class="daily-answer" id="dailyAnswer"><div class="da-correct">✅ 正确答案：${q.opts[q.ans]}</div><div class="da-exp">💡 ${q.exp}</div>
    <div style="margin-top:8px;">${q.opts.map((o,i)=>`<div style="font-size:13px;color:${i===q.ans?'#2e7d32':'#666'};padding:2px 0;">${LETTERS[i]}. ${o}</div>`).join('')}</div></div>`;
  container.insertBefore(card,container.firstChild);
  setTimeout(()=>{if(typeof renderMathInElement!=='undefined')renderMathInElement(card,{throwOnError:false});},200);
}

// ===== PHOTO UPLOAD =====
window._openCamera=function(){
  const input=document.getElementById('photoInput');
  if(input)input.click();
};
window._handlePhoto=function(e){
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=function(ev){
    const imgData=ev.target.result;
    document.getElementById('photoPreview').src=imgData;
    document.getElementById('photoModal').style.display='flex';
    document.getElementById('photoDesc').value='';
  };
  reader.readAsDataURL(file);
};
window._closePhoto=function(){
  document.getElementById('photoModal').style.display='none';
};
window._submitPhoto=function(){
  const desc=document.getElementById('photoDesc').value.trim();
  const imgSrc=document.getElementById('photoPreview').src;
  // Save to localStorage for now (backend will handle AI processing later)
  let photos=JSON.parse(localStorage.getItem('sishu_photos')||'[]');
  photos.unshift({date:new Date().toISOString(),desc,img:imgSrc.slice(0,200)+'...',subject:SUBJECT});
  if(photos.length>50)photos=photos.slice(0,50);
  localStorage.setItem('sishu_photos',JSON.stringify(photos));
  alert('✅ 题目已保存！老师会尽快回复。\n\n（AI解题功能即将上线）');
  document.getElementById('photoModal').style.display='none';
  e.target.value='';
};

// ===== KEYBOARD =====
document.addEventListener('keydown',e=>{
  if(!quizActive)return;
  const map={a:0,b:1,c:2,d:3,A:0,B:1,C:2,D:3,1:0,2:1,3:2,4:3};
  if(map[e.key]!==undefined){
    const opts=document.querySelectorAll('.option');
    if(opts.length>0&&!opts[0].classList.contains('locked'))opts[map[e.key]].click();
  }
  if(e.key==='Enter'||e.key===' '){e.preventDefault();const b=document.getElementById('btnNext');if(b&&b.style.display!=='none')window._nextQ();}
});

})();
