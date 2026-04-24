// ── State ──────────────────────────────────────────────
let selectedStage = null;
let answers = new Array(45).fill(null);
let benchmarkData = null;

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  benchmarkData = BENCHMARK_DATA;
  renderStageSelect();
  renderSurvey();
});

// ── Screen navigation ──────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Stage select screen ────────────────────────────────
function renderStageSelect() {
  const grid = document.getElementById('stage-grid');
  grid.innerHTML = STAGES.map(s => `
    <button class="stage-btn" onclick="selectStage('${s.id}', this)">
      <div class="stage-name">${s.id}</div>
      <div class="stage-years">교직 경력 ${s.years}</div>
    </button>
  `).join('');
}

function selectStage(id, el) {
  selectedStage = id;
  document.querySelectorAll('.stage-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('btn-to-survey').disabled = false;
}

// ── Survey screen ──────────────────────────────────────
function renderSurvey() {
  const wrap = document.getElementById('survey-wrap');
  const domainNames = {
    understanding: { label: 'AI·디지털의 이해',         cls: 'understanding' },
    application:   { label: 'AI·디지털의 교육적 활용',  cls: 'application' },
    professional:  { label: 'AI·디지털 활용 전문성 개발', cls: 'professional' },
  };
  const likertLabels = ['1점\n매우 그렇지 않다', '2점\n그렇지 않다', '3점\n보통이다', '4점\n그렇다', '5점\n매우 그렇다'];

  let html = '';
  let currentDomain = null;
  let currentSC = null;

  SUB_COMPETENCIES.forEach(sc => {
    if (sc.domain !== currentDomain) {
      const d = domainNames[sc.domain];
      html += `<div class="domain-header">
        <span class="domain-badge ${d.cls}">${d.label}</span>
      </div>`;
      currentDomain = sc.domain;
    }
    html += `<div class="sc-block">
      <div class="sc-title"><span class="sc-num">${sc.id}</span>${sc.name}</div>`;
    sc.items.forEach(idx => {
      const qNum = idx + 1;
      html += `<div class="q-item" id="q-wrap-${idx}">
        <div class="q-text"><span class="q-num">Q${qNum}.</span>${QUESTIONS[idx]}</div>
        <div class="likert">
          ${likertLabels.map((lbl, v) => `
            <label>
              <input type="radio" name="q${idx}" value="${v+1}" onchange="onAnswer(${idx}, ${v+1})">
              <div class="likert-btn">${lbl.replace('\n','<br>')}</div>
            </label>
          `).join('')}
        </div>
      </div>`;
    });
    html += `</div>`;
  });

  wrap.innerHTML = html;
  updateProgress();
}

function onAnswer(idx, val) {
  answers[idx] = val;
  document.getElementById(`q-wrap-${idx}`).style.borderColor = '#34C98A';
  updateProgress();
}

function updateProgress() {
  const answered = answers.filter(a => a !== null).length;
  const pct = Math.round((answered / 45) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-label').textContent = `${answered} / 45 문항 완료`;
  document.getElementById('btn-submit').disabled = answered < 45;
}

// ── Submit & compute results ───────────────────────────
function submitSurvey() {
  const unanswered = answers.map((a,i) => a === null ? i+1 : null).filter(n => n !== null);
  if (unanswered.length > 0) {
    alert(`미응답 문항이 있습니다: Q${unanswered.slice(0,5).join(', ')}${unanswered.length > 5 ? ' 외' : ''}`);
    return;
  }
  renderResults();
  showScreen('screen-result');
}

function computeScores() {
  const scScores = SUB_COMPETENCIES.map(sc => {
    const avg = sc.items.reduce((s, i) => s + answers[i], 0) / sc.items.length;
    return { id: sc.id, name: sc.name, domain: sc.domain, score: parseFloat(avg.toFixed(3)) };
  });

  const domainScores = {};
  ['understanding', 'application', 'professional'].forEach(d => {
    const scs = scScores.filter(s => s.domain === d);
    domainScores[d] = parseFloat((scs.reduce((s, c) => s + c.score, 0) / scs.length).toFixed(3));
  });

  const total = parseFloat((scScores.reduce((s, c) => s + c.score, 0) / scScores.length).toFixed(3));
  return { scScores, domainScores, total };
}

function gradeLabel(score) {
  if (score >= 4.5) return { text: '매우 우수', color: '#059669' };
  if (score >= 4.0) return { text: '우수',      color: '#10B981' };
  if (score >= 3.5) return { text: '보통',      color: '#F59E0B' };
  if (score >= 3.0) return { text: '미흡',      color: '#EF4444' };
  return              { text: '매우 미흡',      color: '#DC2626' };
}

// ── LPA 프로파일 분류 ──────────────────────────────────
function classifyProfile(scScores) {
  const myDomainScores = DOMAIN_GROUPS.map(g => groupAvg(scScores, g.scIds));
  let minDist = Infinity, best = null;
  LPA_PROFILES.forEach(p => {
    const dist = Math.sqrt(myDomainScores.reduce((sum, v, i) => sum + Math.pow(v - p.means[i], 2), 0));
    if (dist < minDist) { minDist = dist; best = p; }
  });
  return best;
}

function renderProfileCard(profile) {
  const el = document.getElementById('profile-card-wrap');
  el.innerHTML = `
    <div style="background:${profile.bgColor};border:2px solid ${profile.borderColor};border-radius:16px;padding:28px;text-align:center;margin-bottom:0">
      <div style="font-size:2.8rem;margin-bottom:8px">${profile.emoji}</div>
      <div style="font-size:0.85rem;color:${profile.color};font-weight:700;margin-bottom:4px">나의 AI·디지털 역량 유형</div>
      <div style="font-size:2rem;font-weight:900;color:${profile.color};margin-bottom:6px">${profile.name}</div>
      <div style="display:inline-block;background:${profile.borderColor};color:${profile.color};border-radius:99px;padding:4px 14px;font-size:0.8rem;font-weight:700;margin-bottom:14px">${profile.pattern}</div>
      <div style="font-size:0.9rem;color:#374151;line-height:1.8;margin-bottom:20px;text-align:left;background:#fff;border-radius:10px;padding:14px 16px">${profile.desc}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:left;margin-bottom:16px">
        <div style="background:#fff;border-radius:10px;padding:14px">
          <div style="font-size:0.8rem;font-weight:700;color:#374151;margin-bottom:8px">✅ 강점</div>
          ${profile.strengths.map(s => `<div style="font-size:0.82rem;color:#374151;padding:3px 0;border-bottom:1px solid #F3F4F6">· ${s}</div>`).join('')}
        </div>
        <div style="background:#fff;border-radius:10px;padding:14px">
          <div style="font-size:0.8rem;font-weight:700;color:#374151;margin-bottom:8px">🎯 추천 연수</div>
          ${profile.recs.map(r => `<div style="font-size:0.82rem;color:#374151;padding:3px 0;border-bottom:1px solid #F3F4F6">· ${r}</div>`).join('')}
        </div>
      </div>
      <div style="font-size:0.78rem;color:#6B7280;background:#fff;border-radius:8px;padding:8px 14px;display:inline-block">
        전국 교사 중 <strong style="color:${profile.color}">${profile.pct}%</strong> (${profile.n}명)가 이 유형에 해당합니다
      </div>
    </div>`;
}

// ── Results rendering ──────────────────────────────────
function renderResults() {
  const { scScores, domainScores, total } = computeScores();
  const bench = benchmarkData.stages;
  const stageBench = bench[selectedStage];
  const totalBench = bench['전체'];
  const grade = gradeLabel(total);

  // Hero
  document.getElementById('result-stage-badge').textContent = `${selectedStage} (${STAGES.find(s=>s.id===selectedStage).years})`;
  document.getElementById('result-total-score').textContent = total.toFixed(2);
  document.getElementById('result-grade').innerHTML =
    `<span style="color:${grade.color}">${grade.text}</span> 수준`;

  const stageAvgAll = Object.values(stageBench.subCompetencies).reduce((s,v)=>s+v.avg,0) /
                      Object.values(stageBench.subCompetencies).length;
  document.getElementById('result-stage-avg').textContent =
    `${selectedStage} 평균: ${stageAvgAll.toFixed(2)} | 전체 평균: ${(
      Object.values(totalBench.subCompetencies).reduce((s,v)=>s+v.avg,0) /
      Object.values(totalBench.subCompetencies).length
    ).toFixed(2)}`;

  // Domain scores (카드)
  ['understanding','application','professional'].forEach(d => {
    document.getElementById(`d-score-${d}`).textContent = domainScores[d].toFixed(2);
  });

  // LPA 유형 분류 및 카드 표시
  const profile = classifyProfile(scScores);
  renderProfileCard(profile);

  // 범례 레이블 업데이트
  document.getElementById('legend-stage-label').textContent = `${selectedStage} 평균`;

  // 종합 점수 세로 막대 차트
  renderTotalBarChart(total, stageBench, totalBench);

  // 영역별 세로 막대 차트
  renderDomainBarChart(domainScores, stageBench, totalBench);

  // 생애주기별 하위역량 비교 차트
  renderStageComparisonChart(scScores);

  // 레이더 차트
  renderRadarChart(scScores, stageBench, totalBench);

  // 비교표
  renderCompareTable(scScores, stageBench, totalBench);

  // 추천 연수
  renderRecommendations(scScores, domainScores);
}

// ── 종합 점수 세로 막대 차트 ─────────────────────────────
function renderTotalBarChart(total, stageBench, totalBench) {
  const ctx = document.getElementById('total-bar-chart').getContext('2d');
  if (window._totalBarChart) window._totalBarChart.destroy();

  const stageAvg = parseFloat((
    Object.values(stageBench.subCompetencies).reduce((s,v)=>s+v.avg,0) /
    Object.values(stageBench.subCompetencies).length
  ).toFixed(2));
  const overallAvg = parseFloat((
    Object.values(totalBench.subCompetencies).reduce((s,v)=>s+v.avg,0) /
    Object.values(totalBench.subCompetencies).length
  ).toFixed(2));

  window._totalBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['내 점수', `${selectedStage}\n평균`, '전체 평균'],
      datasets: [{
        data: [total, stageAvg, overallAvg],
        backgroundColor: ['rgba(59,110,248,0.85)', 'rgba(52,201,138,0.85)', 'rgba(247,168,79,0.85)'],
        borderColor:     ['#3B6EF8', '#34C98A', '#F7A84F'],
        borderWidth: 2,
        borderRadius: 8,
        barThickness: 64,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(2)}점` } },
        datalabels: { display: false }
      },
      scales: {
        y: { min: 1, max: 5, ticks: { stepSize: 0.5 }, grid: { color: '#E2E8F0' },
             title: { display: true, text: '점수 (5점 만점)', font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 13, weight: 'bold' } } }
      },
      animation: { duration: 800 }
    },
    plugins: [{
      id: 'valueLabels',
      afterDatasetsDraw(chart) {
        const { ctx, data } = chart;
        chart.data.datasets.forEach((dataset, i) => {
          chart.getDatasetMeta(i).data.forEach((bar, idx) => {
            const val = dataset.data[idx];
            ctx.fillStyle = '#1E293B';
            ctx.font = 'bold 14px Noto Sans KR, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(val.toFixed(2), bar.x, bar.y - 8);
          });
        });
      }
    }]
  });
}

// ── 영역별 세로 막대 차트 ────────────────────────────────
function renderDomainBarChart(domainScores, stageBench, totalBench) {
  const ctx = document.getElementById('domain-bar-chart').getContext('2d');
  if (window._domainBarChart) window._domainBarChart.destroy();

  const domainKeys  = ['understanding', 'application', 'professional'];
  const domainNames = ['AI·디지털의 이해', 'AI·디지털의 교육적 활용', 'AI·디지털 활용\n전문성 개발'];

  function domainBenchAvg(bench, domain) {
    const ids = SUB_COMPETENCIES.filter(s=>s.domain===domain).map(s=>s.id);
    return parseFloat((ids.reduce((s,id)=>s+bench.subCompetencies[id].avg,0)/ids.length).toFixed(2));
  }

  const myData    = domainKeys.map(d => parseFloat(domainScores[d].toFixed(2)));
  const stageData = domainKeys.map(d => domainBenchAvg(stageBench, d));
  const totalData = domainKeys.map(d => domainBenchAvg(totalBench, d));

  window._domainBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: domainNames,
      datasets: [
        { label: '내 점수',               data: myData,    backgroundColor: 'rgba(59,110,248,0.85)',  borderColor: '#3B6EF8', borderWidth: 2, borderRadius: 6 },
        { label: `${selectedStage} 평균`, data: stageData, backgroundColor: 'rgba(52,201,138,0.85)', borderColor: '#34C98A', borderWidth: 2, borderRadius: 6 },
        { label: '전체 평균',             data: totalData, backgroundColor: 'rgba(247,168,79,0.85)', borderColor: '#F7A84F', borderWidth: 2, borderRadius: 6 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}점` } },
      },
      scales: {
        y: { min: 1, max: 5, ticks: { stepSize: 0.5 }, grid: { color: '#E2E8F0' },
             title: { display: true, text: '점수 (5점 만점)', font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 0 } }
      },
      animation: { duration: 800 }
    },
    plugins: [{
      id: 'valueLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.data.datasets.forEach((dataset, i) => {
          chart.getDatasetMeta(i).data.forEach((bar, idx) => {
            const val = dataset.data[idx];
            ctx.fillStyle = '#1E293B';
            ctx.font = 'bold 11px Noto Sans KR, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(val.toFixed(2), bar.x, bar.y - 6);
          });
        });
      }
    }]
  });
}

// ── 5개 역량영역 × 4 생애주기 비교 차트 ─────────────────
const DOMAIN_GROUPS = [
  { label: '이해',          scIds: [1,2,3,4] },
  { label: '교육설계\n및 개발', scIds: [5,6,8] },
  { label: '교육운영',       scIds: [9,10,11] },
  { label: '교육평가',       scIds: [7,12,13] },
  { label: '전문성\n개발',   scIds: [14,15] },
];

function groupAvg(source, scIds) {
  if (Array.isArray(source)) {
    const vals = scIds.map(id => source.find(s => s.id === id).score);
    return parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2));
  }
  const vals = scIds.map(id => source.subCompetencies[id].avg);
  return parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2));
}

function renderStageComparisonChart(scScores) {
  const ctx = document.getElementById('stage-compare-chart').getContext('2d');
  if (window._stageComparisonChart) window._stageComparisonChart.destroy();

  const bench = benchmarkData.stages;
  const stageIds = ['입직기', '성장기', '발전기', '심화기'];
  const stageColors       = ['rgba(99,179,237,0.85)','rgba(72,187,120,0.85)','rgba(246,173,85,0.85)','rgba(245,101,101,0.85)'];
  const stageBorderColors = ['#63B3ED','#48BB78','#F6AD55','#F56565'];

  const datasets = [
    {
      label: '내 점수',
      data: DOMAIN_GROUPS.map(g => groupAvg(scScores, g.scIds)),
      backgroundColor: 'rgba(59,110,248,0.85)',
      borderColor: '#3B6EF8',
      borderWidth: 2,
      borderRadius: 6,
    },
    ...stageIds.map((stage, i) => ({
      label: `${stage} 평균`,
      data: DOMAIN_GROUPS.map(g => groupAvg(bench[stage], g.scIds)),
      backgroundColor: stageColors[i],
      borderColor: stageBorderColors[i],
      borderWidth: 1.5,
      borderRadius: 6,
    }))
  ];

  window._stageComparisonChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: DOMAIN_GROUPS.map(g => g.label), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 14, padding: 10 } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(2)}점` } },
      },
      scales: {
        y: { min: 1, max: 5, ticks: { stepSize: 0.5 }, grid: { color: '#E2E8F0' },
             title: { display: true, text: '점수 (5점 만점)', font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 12, weight: 'bold' }, maxRotation: 0 } }
      },
      animation: { duration: 800 }
    },
    plugins: [{
      id: 'valueLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.getDatasetMeta(0).data.forEach((bar, idx) => {
          const val = chart.data.datasets[0].data[idx];
          ctx.fillStyle = '#1E293B';
          ctx.font = 'bold 12px Noto Sans KR, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(val.toFixed(2), bar.x, bar.y - 6);
        });
      }
    }]
  });
}

function renderRadarChart(scScores, stageBench, totalBench) {
  const ctx = document.getElementById('radar-chart').getContext('2d');
  if (window._radarChart) window._radarChart.destroy();

  const labels = SC_SHORT_NAMES;
  const myData  = scScores.map(s => s.score);
  const stageData = scScores.map(s => stageBench.subCompetencies[s.id].avg);
  const totalData = scScores.map(s => totalBench.subCompetencies[s.id].avg);

  window._radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [
        { label: '내 점수',           data: myData,    borderColor: '#3B6EF8', backgroundColor: 'rgba(59,110,248,0.15)', borderWidth: 2.5, pointRadius: 4 },
        { label: `${selectedStage} 평균`, data: stageData, borderColor: '#34C98A', backgroundColor: 'rgba(52,201,138,0.08)', borderWidth: 1.8, pointRadius: 3, borderDash: [5,3] },
        { label: '전체 평균',          data: totalData, borderColor: '#F7A84F', backgroundColor: 'rgba(247,168,79,0.05)', borderWidth: 1.5, pointRadius: 3, borderDash: [3,3] },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { r: { min: 1, max: 5, ticks: { stepSize: 1, font: { size: 10 } }, pointLabels: { font: { size: 11 } } } },
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } }
    }
  });
}

function renderCompareTable(scScores, stageBench, totalBench) {
  const sorted = [...scScores].sort((a,b) => a.score - b.score);
  const tbody = document.getElementById('compare-tbody');
  tbody.innerHTML = sorted.map(sc => {
    const stageAvg = stageBench.subCompetencies[sc.id].avg;
    const diff = sc.score - stageAvg;
    const isWeak = diff < -0.3;
    const isGood = diff > 0.2;
    const barW = (sc.score / 5 * 100).toFixed(1);
    const stageW = (stageAvg / 5 * 100).toFixed(1);
    return `<tr>
      <td style="font-size:0.8rem">${sc.id}</td>
      <td style="font-size:0.82rem">${sc.name.substring(0,18)}…</td>
      <td style="font-weight:700;color:${isWeak?'#DC2626':isGood?'#059669':'var(--text)'}">${sc.score.toFixed(2)}</td>
      <td>${stageAvg.toFixed(2)}</td>
      <td class="score-bar-cell">
        <div class="score-bar-wrap">
          <div class="score-bar-group" style="width:${stageW}%"></div>
          <div class="score-bar-mine"  style="width:${barW}%"></div>
        </div>
      </td>
      <td>${isWeak ? '<span class="tag-weak">보완필요</span>' : isGood ? '<span class="tag-good">강점</span>' : ''}</td>
    </tr>`;
  }).join('');
}

function renderRecommendations(scScores, domainScores) {
  const wrap = document.getElementById('rec-wrap');
  const stageBench = benchmarkData.stages[selectedStage];

  const weakDomains = ['understanding','application','professional'].filter(d => {
    const scs = scScores.filter(s=>s.domain===d);
    const myAvg = scs.reduce((s,c)=>s+c.score,0)/scs.length;
    const benchAvg = scs.reduce((s,c)=>s+stageBench.subCompetencies[c.id].avg,0)/scs.length;
    return myAvg < benchAvg - 0.15;
  });

  const domainLabel = { understanding:'AI·디지털의 이해', application:'AI·디지털의 교육적 활용', professional:'AI·디지털 활용 전문성 개발' };

  if (weakDomains.length === 0) {
    wrap.innerHTML = `<div class="alert" style="background:#D1FAE5;border:1px solid #6EE7B7;color:#065F46">
      🎉 모든 역량 영역이 ${selectedStage} 집단 평균 이상입니다! 현재 수준을 잘 유지하고 있습니다.
    </div>`;
    return;
  }

  wrap.innerHTML = weakDomains.map(d => {
    const myAvg = domainScores[d];
    const level = myAvg >= 4.0 ? 'high' : myAvg >= 3.0 ? 'mid' : 'low';
    const recs = TRAINING_RECOMMENDATIONS[d][level];
    const colorMap = { understanding:'#4F8EF7', application:'#34C98A', professional:'#F7A84F' };
    return `<div class="rec-section">
      <h4><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorMap[d]};margin-right:4px"></span>
        ${domainLabel[d]} 영역 추천 연수
      </h4>
      <ul class="rec-list">
        ${recs.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>`;
  }).join('');
}

function resetAll() {
  selectedStage = null;
  answers = new Array(45).fill(null);
  document.querySelectorAll('.stage-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-to-survey').disabled = true;
  if (window._radarChart)          { window._radarChart.destroy();          window._radarChart = null; }
  if (window._totalBarChart)       { window._totalBarChart.destroy();       window._totalBarChart = null; }
  if (window._domainBarChart)      { window._domainBarChart.destroy();      window._domainBarChart = null; }
  if (window._stageComparisonChart){ window._stageComparisonChart.destroy();window._stageComparisonChart = null; }
  showScreen('screen-stage');
}
