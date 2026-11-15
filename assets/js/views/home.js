/* ==========================================================================
   หน้าหลัก (Dashboard)
   ========================================================================== */
'use strict';

function niceMax(v) {
  if (!(v > 0)) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= v) return s * p;
  return 10 * p;
}

/** กราฟแท่งแนวตั้ง (series เดียวหรือหลาย series) แบบ HTML พร้อม tooltip */
function columnChart({ cats, series, height = 200, label = '' }) {
  const max = niceMax(Math.max(0, ...series.flatMap(s => s.data)));
  const ticks = [0, .25, .5, .75, 1].map(f => max * f);
  const multi = series.length > 1;
  const fmtK = n => n >= 1000 ? fm(Math.round(n / 100) / 10) + 'k' : fm(n);
  const cols = cats.map((c, i) => {
    const tip = `<b>${c.full || c.label}</b>${series.map(s => `<span><i style="background:${s.color}"></i>${s.name}<em>${money(s.data[i])}</em></span>`).join('')}`;
    const bars = series.map(s => {
      const v = s.data[i], h = v > 0 ? Math.max(2, v / max * 100) : 0;
      return `<span class="cc-bar" style="height:${h}%;--c:${s.color}">${s.labelAt && s.labelAt(i) && v > 0 ? `<em class="cc-val">${fmtK(v)}</em>` : ''}</span>`;
    }).join('');
    return `<div class="cc-col ${c.hl ? 'hl' : ''}" tabindex="0"><div class="cc-bars ${multi ? 'multi' : ''}">${bars}</div>
      <div class="cc-tip" role="tooltip">${tip}</div><span class="cc-x">${c.label}</span></div>`;
  }).join('');
  return `<div class="cc" style="--h:${height}px" role="img" aria-label="${esc(label)}">
    <div class="cc-y">${ticks.slice().reverse().map(t => `<span>${fmtK(t)}</span>`).join('')}</div>
    <div class="cc-plot"><div class="cc-grid">${ticks.map(() => '<i></i>').join('')}</div><div class="cc-cols">${cols}</div></div>
  </div>`;
}

function followItem(c) {
  const st = pkgStatus(c), p = pkgById(c.pkgId), total = p ? p.pieces : Math.max(c.left, 1);
  const pct = Math.max(0, Math.min(100, c.left / total * 100));
  const dl = daysBetween(today(), c.exp);
  return `<div class="fl">
    ${avatar(c)}
    <div class="fl-main">
      <div class="fl-top"><b>${esc(c.name)}</b>${badge(st.label, st.tone)}</div>
      <div class="fl-sub">${esc(c.pkgName)} · ${dl < 0 ? 'หมดอายุแล้ว ' + Math.abs(dl) + ' วัน' : dl === 0 ? 'หมดอายุวันนี้' : 'อีก ' + dl + ' วัน'} · ${c.left < 0 ? `<b class="owed">เกิน ${-c.left} ชิ้น</b>` : `เหลือ <b>${c.left}</b>/${total}`}</div>
      <div class="meter sm ${st.tone}"><span style="width:${pct}%"></span></div>
    </div>
    <button class="btn btn-outline btn-sm" data-act="buyPkg" data-id="${c.id}">${icon('refresh')}<span class="hide-xs">ต่อแพ็คเกจ</span></button>
  </div>`;
}

function rcRow(r) {
  return `<div class="rr ${r.void ? 'is-void' : ''}">
    <span class="rr-ic ${r.kind === 'pkg' ? 'pkg' : 'wash'}">${icon(r.kind === 'pkg' ? 'package' : 'washer')}</span>
    <div class="rr-main"><b>${esc(r.name)}</b><small>${esc(r.no)} · ${dTh(r.date)} ${r.time || ''}</small></div>
    ${r.void ? badge('ยกเลิก', 'danger') : ''}
    <span class="rr-amt">${money(r.total)}</span>
    <button class="icon-btn ghost" data-act="reprint" data-no="${esc(r.no)}" title="ดู / พิมพ์" aria-label="ดูใบเสร็จ ${esc(r.no)}">${icon('chevronRight')}</button>
  </div>`;
}

V.home = {
  render() {
    const t = today();
    const incOf = d => sumBy(db.ledger.filter(l => l.date == d && l.type == 'in'), l => l.amt);
    const inc = incOf(t), incY = incOf(addDays(-1));
    const bills = db.rc.filter(r => r.date == t && r.kind == 'order' && !r.void).length;
    const actives = db.customers.filter(active).length;
    const low = db.customers.filter(needsFollow).sort((a, b) => a.exp.localeCompare(b.exp));
    const rec = db.rc.slice(-6).reverse();
    const h = new Date().getHours();
    const greet = h < 12 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
    const diff = inc - incY;

    const days = Array.from({ length: 7 }, (_, i) => addDays(i - 6));
    const chart = columnChart({
      label: 'รายรับ 7 วันล่าสุด', height: 150,
      cats: days.map(d => { const dd = parseD(d); return { label: d === t ? 'วันนี้' : TH_DAYS[dd.getDay()].slice(0, 2) + '.', full: dTh(d), hl: d === t }; }),
      series: [{ name: 'รายรับ', color: 'var(--chart-dark)', data: days.map(incOf), labelAt: i => i === 6 }]
    });
    const week = sumBy(days, incOf);

    const age = backupAge();
    const backupTip = !syncOn()
      ? `<div class="notice">${icon('cloud')}<div><b>ข้อมูลอยู่เฉพาะในเครื่องนี้</b><span>เครื่องอื่นจะไม่เห็นข้อมูลจนกว่าจะเชื่อมหลายเครื่อง${age == null || age > 7 ? ` · ${age == null ? 'ยังไม่เคยสำรองข้อมูล' : 'สำรองล่าสุด ' + age + ' วันก่อน'}` : ''}</span></div>
          <div class="tip-btns">${age == null || age > 7 ? `<button class="btn btn-sm btn-ghost" data-act="backup">${icon('download')}สำรอง</button>` : ''}<button class="btn btn-sm btn-dark" data-act="syncSetupGo">${icon('link')}เชื่อมหลายเครื่อง</button></div></div>` : '';

    const qa = [
      ['order', 'รับผ้า / คิดเงิน', 'เปิดบิลใหม่', 'washer'],
      ['cust', 'ลูกค้า', 'ค้นหา · ต่อแพ็คเกจ', 'users'],
      ['acct', 'บัญชี', 'รายรับ · รายจ่าย', 'wallet'],
      ['pkg', 'แพ็คเกจ', 'ตั้งราคารายเดือน', 'package']
    ];
    const kpi = (ic, label, val, note = '') => `<article class="b-kpi"><span class="b-kpi-ic">${icon(ic)}</span><small>${label}</small><b>${val}</b>${note ? `<em>${note}</em>` : ''}</article>`;

    return `
      <header class="greet">
        <div>
          <span class="eyebrow">${icon(h >= 18 || h < 6 ? 'moon' : 'sun')}${greet} · ${dLong()}</span>
          <h1>ภาพรวมวันนี้</h1>
        </div>
        <div class="greet-actions">
          <a class="btn btn-ghost" href="#/rc">${icon('receipt')}ใบเสร็จ</a>
          <a class="btn btn-primary" href="#/order">${icon('plus')}รับผ้าใหม่</a>
        </div>
      </header>

      ${backupTip}

      <section class="bento">
        <article class="b-rev">
          <div class="b-rev-top">
            <div><small>รายรับวันนี้</small><b>${money(inc)}</b></div>
            <span class="delta ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${icon(diff >= 0 ? 'trendUp' : 'trendDown')}${diff === 0 ? 'เท่าเมื่อวาน' : (diff > 0 ? '+' : '−') + money(Math.abs(diff))}</span>
          </div>
          <div class="b-rev-chart">${chart}</div>
          <div class="b-rev-foot"><span>7 วันล่าสุด <b>${money(week)}</b></span><a href="#/acct">ดูบัญชี ${icon('arrowRight')}</a></div>
        </article>
        ${kpi('receipt', 'บิลรับผ้าวันนี้', bills, 'บิล')}
        ${kpi('users', 'สมาชิกแพ็คเกจ', actives, 'ใช้งานอยู่')}
        ${kpi('bell', 'ต้องติดตาม', low.length, low.length ? 'ใกล้หมด/หมดอายุ' : 'เรียบร้อย')}
        <nav class="b-actions" aria-label="ทางลัด">
          ${qa.map(([k, l, d, ic]) => `<a class="act" href="#/${k}"><span class="act-ic">${icon(ic)}</span><span class="act-txt"><b>${l}</b><small>${d}</small></span>${icon('arrowRight', 'act-go')}</a>`).join('')}
        </nav>
      </section>

      <section class="duo">
        <div class="panel">
          <div class="panel-head"><div><h2>ต้องติดตาม</h2><p>เหลือ ≤ ${cfg().lowLeft} ชิ้น หรือหมดอายุภายใน ${cfg().warnDays} วัน</p></div>${low.length ? `<span class="count-pill">${low.length}</span>` : ''}</div>
          ${low.length ? `<div class="fl-list">${low.map(followItem).join('')}</div>` : empty('checkCircle', 'ไม่มีรายการต้องติดตาม', 'ลูกค้าแพ็คเกจทุกคนยังมียอดคงเหลือเพียงพอ')}
        </div>
        <div class="panel">
          <div class="panel-head"><div><h2>ใบเสร็จล่าสุด</h2><p>6 รายการล่าสุด</p></div><a class="link" href="#/rc">ทั้งหมด ${icon('chevronRight')}</a></div>
          ${rec.length ? `<div class="rr-list">${rec.map(rcRow).join('')}</div>` : empty('receipt', 'ยังไม่มีใบเสร็จ', 'เริ่มรับผ้ารายการแรกได้เลย', `<a class="btn btn-primary" href="#/order">${icon('plus')}รับผ้าใหม่</a>`)}
        </div>
      </section>`;
  }
};
