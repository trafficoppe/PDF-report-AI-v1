let incidentsData = [];
let scheduleData = [];
let officerMap = {}; 

const cleanStr = (str) => str ? str.replace(/\s+/g, ' ').trim() : '';

// แปลงลิงก์ Google Drive จาก คอลัมน์ AC ให้แสดงผลเป็นภาพได้
function convertDriveUrl(url) {
  if (!url) return '';
  let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
  }
  return url;
}

async function loadData() {
  try {
    const [incidentsRes, scheduleRes, officerRes] = await Promise.all([
      fetch(INCIDENT_URL).then(res => res.text()),
      fetch(SCHEDULE_URL).then(res => res.text()),
      fetch(OFFICER_URL).then(res => res.text())
    ]);

    incidentsData = Papa.parse(incidentsRes).data;
    scheduleData = Papa.parse(scheduleRes).data;
    const officerData = Papa.parse(officerRes).data;

    buildOfficerMap(officerData);
    setInitialDatePickerDate();
  } catch (error) {
    alert("เกิดข้อผิดพลาดในการโหลดข้อมูล: " + error);
  }
}

function buildOfficerMap(officerData) {
  officerMap = {};
  for (let i = 1; i < officerData.length; i++) {
    let row = officerData[i];
    if (row && row[0] && row[1]) {
      let name = cleanStr(row[0]);
      let position = cleanStr(row[1]);
      if (name !== "ชื่อ-สกุล" && !name.includes("ผลัด") && name !== "วันที่") {
        officerMap[name] = position;
      }
    }
  }
  
  officerMap["นายบุญฤทธิ์ สายลือนาม"] = "วิทยุสื่อสาร";
  officerMap["บุญฤทธิ์ สายลือนาม"] = "วิทยุสื่อสาร";
}

function parseDateString(str) {
  if (!str) return null;
  let clean = str.trim().split(' ')[0];
  
  if (clean.includes('-')) {
    let parts = clean.split('-');
    if (parts.length === 3) {
      let y = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      let d = parseInt(parts[2], 10);
      if (y > 2400) y -= 543;
      return { day: d, month: m, year: y };
    }
  }
  
  if (clean.includes('/')) {
    let parts = clean.split('/');
    if (parts.length === 3) {
      let d = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y < 100) y += (y < 50 ? 2000 : 2500);
      if (y > 2400) y -= 543;
      return { day: d, month: m, year: y };
    }
  }
  return null;
}

function isSameDateObj(d1, d2) {
  if (!d1 || !d2) return false;
  return d1.day === d2.day && d1.month === d2.month && d1.year === d2.year;
}

function setInitialDatePickerDate() {
  const picker = document.getElementById('datePicker');
  
  for (let i = 0; i < scheduleData.length; i++) {
    let row = scheduleData[i];
    if (!row || !row[0]) continue;
    let parsed = parseDateString(row[0]);
    if (parsed) {
      let yyyy = parsed.year;
      let mm = String(parsed.month).padStart(2, '0');
      let dd = String(parsed.day).padStart(2, '0');
      picker.value = `${yyyy}-${mm}-${dd}`;
      break;
    }
  }
  
  updateReport();
}

function updateReport() {
  const picker = document.getElementById('datePicker');
  if (!picker.value) return;

  const selectedDateObj = parseDateString(picker.value);
  if (!selectedDateObj) return;

  let scheduleRowIndex = -1;
  for (let i = 0; i < scheduleData.length; i++) {
    let row = scheduleData[i];
    if (!row || !row[0]) continue;
    let parsedRowDate = parseDateString(row[0]);
    if (isSameDateObj(parsedRowDate, selectedDateObj)) {
      scheduleRowIndex = i;
      break;
    }
  }

  if (scheduleRowIndex === -1) {
    document.getElementById('shiftTableBody').innerHTML = '<tr><td colspan="3" style="text-align:center; color:red; padding:15px;">ไม่พบข้อมูลตารางเวรในวันที่เลือก</td></tr>';
    document.getElementById('incidentIntroText').innerText = "ไม่พบข้อมูล";
    document.getElementById('incidentSummaryList').innerHTML = "";
    // เปลี่ยนจาก page2 เป็น incidentDetailSection
    document.getElementById('incidentDetailSection').style.display = 'none'; 
    return;
  }

  const formattedDate = formatThaiDateFromObj(selectedDateObj);

  document.getElementById('docSubject').innerText = "รายงานเหตุการณ์ วันที่ " + formattedDate;
  document.getElementById('reportDateText').innerText = formattedDate;

  renderShiftTable(scheduleRowIndex);
  renderIncidentSummary(selectedDateObj); 
}


function renderShiftTable(rowIndex) {
  const row = scheduleData[rowIndex];
  
  const getNamesFromCol = (colIdx) => {
    let names = [];
    for (let r = 4; r <= 7; r++) { 
      if (scheduleData[r] && scheduleData[r][colIdx]) {
        let name = cleanStr(scheduleData[r][colIdx]);
        if (name && (officerMap[name] || name.startsWith("นาย") || name.startsWith("นาง"))) {
          names.push(name);
        }
      }
    }
    return names;
  };

  const groups = {
    "ผลัด 1": getNamesFromCol(1),
    "ผลัด 2": getNamesFromCol(2),
    "ผลัด 3": getNamesFromCol(3),
    "ผลัด 4": getNamesFromCol(4),
    "จราจร":  getNamesFromCol(5) 
  };

  let morningGroup = [], afternoonGroup = [], nightGroup = [], trafficGroup = groups["จราจร"];
  
  for (let col = 1; col <= 4; col++) {
    let shiftType = cleanStr(row[col]);
    let groupName = `ผลัด ${col}`;
    if (shiftType === "เช้า") morningGroup = groups[groupName];
    if (shiftType === "บ่าย") afternoonGroup = groups[groupName];
    if (shiftType === "ดึก") nightGroup = groups[groupName];
  }

  const tbody = document.getElementById('shiftTableBody');
  tbody.innerHTML = '';

  const createPatrolRows = (shiftName, time, members) => {
    let validMembers = members.filter(m => officerMap[m] || m.startsWith("นาย") || m.startsWith("นาง"));
    if (validMembers.length === 0) return;

    const rolesTemplate = ["สายตรวจ1", "สายตรวจ2", "สายตรวจ3", "วิทยุสื่อสาร"];
    let matchedMembers = ["", "", "", ""];
    let usedMembers = new Set();

    validMembers.forEach(m => {
      let role = officerMap[m];
      let idx = rolesTemplate.indexOf(role);
      if (idx !== -1 && matchedMembers[idx] === "") {
        matchedMembers[idx] = m;
        usedMembers.add(m); 
      }
    });

    let leftoverMembers = validMembers.filter(m => !usedMembers.has(m));
    for (let i = 0; i < rolesTemplate.length; i++) {
      if (matchedMembers[i] === "" && leftoverMembers.length > 0) {
        matchedMembers[i] = leftoverMembers.shift();
      }
    }

    let finalRows = [];
    for (let i = 0; i < 4; i++) {
      if (matchedMembers[i] !== "") {
        finalRows.push({ role: rolesTemplate[i], name: matchedMembers[i] });
      }
    }

    if (finalRows.length === 0) return;

    let shiftCell = document.createElement('td');
    shiftCell.rowSpan = finalRows.length;
    shiftCell.innerHTML = `<b>${shiftName}</b><br>${time}`;
    shiftCell.style.textAlign = 'center';

    finalRows.forEach((rowObj, index) => {
      let tr = document.createElement('tr');
      tr.title = "ดับเบิลคลิกเพื่อลบรายชื่อนี้"; 
      tr.style.cursor = "pointer";

      tr.ondblclick = function() {
        let hasShiftCell = tr.contains(shiftCell);
        if (hasShiftCell) { 
          if (shiftCell.rowSpan > 1) { 
            let nextTr = tr.nextElementSibling;
            shiftCell.rowSpan -= 1;
            nextTr.insertBefore(shiftCell, nextTr.firstChild); 
          }
        } else { 
          shiftCell.rowSpan -= 1; 
        }
        tr.remove(); 
      };
      
      if (index === 0) {
        tr.appendChild(shiftCell);
      }
      
      let td2 = document.createElement('td');
      td2.innerText = rowObj.role;
      td2.style.textAlign = 'center';
      
      let td3 = document.createElement('td');
      td3.innerText = rowObj.name;
      td3.style.textAlign = 'left'; 
      td3.style.paddingLeft = '15px';
      
      tr.appendChild(td2);
      tr.appendChild(td3);
      tbody.appendChild(tr);
    });
  };

  const createTrafficRows = (shiftName, time, members) => {
    let validMembers = members.filter(m => officerMap[m] || m.startsWith("นาย") || m.startsWith("นาง"));
    if (validMembers.length === 0) return;

    let shiftCell = document.createElement('td');
    shiftCell.rowSpan = validMembers.length;
    shiftCell.innerHTML = `<b>${shiftName}</b><br>${time}`;
    shiftCell.style.textAlign = 'center';

    validMembers.forEach((m, index) => {
      let tr = document.createElement('tr');
      tr.title = "ดับเบิลคลิกเพื่อลบรายชื่อนี้";
      tr.style.cursor = "pointer";

      tr.ondblclick = function() {
        let hasShiftCell = tr.contains(shiftCell);
        if (hasShiftCell) {
          if (shiftCell.rowSpan > 1) {
            let nextTr = tr.nextElementSibling;
            shiftCell.rowSpan -= 1;
            nextTr.insertBefore(shiftCell, nextTr.firstChild);
          }
        } else {
          shiftCell.rowSpan -= 1;
        }
        tr.remove();
      };

      if (index === 0) {
        tr.appendChild(shiftCell);
      }
      
      let td2 = document.createElement('td');
      td2.innerText = "จราจร";
      td2.style.textAlign = 'center';
      
      let td3 = document.createElement('td');
      td3.innerText = m;
      td3.style.textAlign = 'left'; 
      td3.style.paddingLeft = '15px';
      
      tr.appendChild(td2);
      tr.appendChild(td3);
      tbody.appendChild(tr);
    });
  };

  createPatrolRows("ผลัดเช้า", "07.00 - 15.00 น.", morningGroup);
  createPatrolRows("ผลัดบ่าย", "15.00 - 23.00 น.", afternoonGroup);
  createPatrolRows("ผลัดกลางคืน", "23.00 - 07.00 น.", nightGroup);
  createTrafficRows("เจ้าหน้าที่จราจร", "08.00 - 16.00 น.", trafficGroup);
}

function renderIncidentSummary(targetDateObj) {
  const summaryDiv = document.getElementById('incidentSummaryList');
  const introText = document.getElementById('incidentIntroText');
  // เปลี่ยน ID เป้าหมายเพื่อซ่อน/แสดงเฉพาะรายละเอียด
  const detailSection = document.getElementById('incidentDetailSection'); 
  const detailList = document.getElementById('incidentDetailList');
  
  summaryDiv.innerHTML = '';
  detailList.innerHTML = '';

  let incidentCounts = {};
  let matchedRows = [];

  for (let i = 1; i < incidentsData.length; i++) {
    let row = incidentsData[i];
    if (row && row[0]) {
      let rowDateObj = parseDateString(row[0]);
      if (isSameDateObj(rowDateObj, targetDateObj)) {
        let type = row[14] || "เหตุการณ์ทั่วไป"; 
        incidentCounts[type] = (incidentCounts[type] || 0) + 1;
        matchedRows.push(row);
      }
    }
  }

  if (matchedRows.length === 0) {
    introText.innerText = "เหตุการณ์ปกติ";
    detailSection.style.display = 'none'; // ซ่อนเฉพาะบล็อกรายละเอียดเหตุการณ์
    return;
  }

  introText.innerText = "พบเหตุการณ์ไม่ปกติ โดยมีรายละเอียดดังนี้";
  
  let counter = 1;
  for (const [type, count] of Object.entries(incidentCounts)) {
    let p = document.createElement('p');
    p.innerHTML = `${counter}. ${type} <span style="display:inline-block; width: 50px; text-align:right;">${count} ครั้ง</span>`;
    summaryDiv.appendChild(p);
    counter++;
  }

  detailSection.style.display = 'block'; // แสดงบล็อกรายละเอียดเมื่อมีข้อมูล
  
  matchedRows.forEach((row, idx) => {
    let rawImgUrl = row[30] ? row[30].trim() : '';
    let imgUrl = convertDriveUrl(rawImgUrl);
    let reportText = row[33] ? cleanStr(row[33]) : 'ไม่มีข้อมูลสรุปเหตุการณ์';

    let itemDiv = document.createElement('div');
    itemDiv.className = 'incident-detail-item';

    let imgElementHtml = imgUrl 
      ? `<img src="${imgUrl}" alt="รูปภาพเหตุการณ์" onerror="this.onerror=null; this.src='https://via.placeholder.com/400x300?text=ไม่สามารถโหลดรูปภาพได้';">`
      : `<div style="padding: 40px; background: #eee; color: #777; border-radius: 4px; text-align:center;">ไม่มีรูปภาพประกอบ</div>`;

    itemDiv.innerHTML = `
      <div class="incident-detail-left">
        ${imgElementHtml}
      </div>
      <div class="incident-detail-right">
        <div style="text-indent: 2.5cm; margin-top: 0;">${reportText}</div>
      </div>
    `;

    detailList.appendChild(itemDiv);
  });
}

function formatThaiDateFromObj(dateObj) {
  if (!dateObj) return "";
  const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const d = dateObj.day;
  const m = months[dateObj.month - 1];
  const y = dateObj.year + 543; 
  return `${d} ${m} ${y}`;
}

window.onload = loadData;
// =====================================================================
// ส่วนที่เพิ่มใหม่สำหรับดึงข้อมูล รปภ. เอกชน (วางต่อท้ายไฟล์เดิมได้เลย)
// =====================================================================

const GUARD_DATA_CSV_URL = "https://docs.google.com/spreadsheets/d/1LD5AVbwLV2RplbUYNlzY529rkN41dgvvqcXzGjBFBW8/export?format=csv&gid=1109000347";

// กำหนดเป้าหมาย รปภ.
const guardTargets = {
  "ส่วนกลาง": { day: 32, night: 24, label: "ส่วนกลาง" },
  "ศูนย์การเรียนรู้มหิดล": { day: 12, night: 7, label: "ศูนย์การเรียนรู้มหิดล" },
  "มหิดลสิทธาคาร": { day: 10, night: 5, label: "มหิดลสิทธาคาร" },
  "อาคารสิริวิทยา": { day: 7, night: 3, label: "อาคารสิริวิทยา" },
  "โครงการจัดตั้งสถาบันอุทยานธรรมชาติวิทยาสิรีรุกขชาติ": { day: 10, night: 4, label: "สิรีฯ" },
  "หอพักนักศึกษา": { day: 13, night: 11, label: "หอพักนักศึกษา" }
};

// 1. เก็บฟังก์ชัน updateReport เดิมเอาไว้ในตัวแปร
const originalUpdateReport = updateReport;

// 2. เขียนทับฟังก์ชัน updateReport ใหม่ เพื่อให้ดึงข้อมูลใหม่ต่อจากการทำงานเดิม
updateReport = function() {
  // รันโค้ดเก่าของคุณทั้งหมดก่อน
  originalUpdateReport(); 
  
  // รันโค้ดใหม่ (ดึงข้อมูล รปภ.เอกชน)
  const picker = document.getElementById('datePicker');
  if (picker && picker.value) {
    const selectedDateObj = parseDateString(picker.value);
    if (selectedDateObj) {
      fetchGuardData(selectedDateObj);
    }
  }
};

// 3. ฟังก์ชันดึงและคำนวณข้อมูลจากชีทรายชื่อ รปภ.
function fetchGuardData(selectedDateObj) {
  Papa.parse(GUARD_DATA_CSV_URL, {
    download: true,
    header: true,
    complete: function(results) {
      const data = results.data;
      
      let dailyCounts = {
        "ส่วนกลาง": { day: 0, night: 0 },
        "ศูนย์การเรียนรู้มหิดล": { day: 0, night: 0 },
        "มหิดลสิทธาคาร": { day: 0, night: 0 },
        "อาคารสิริวิทยา": { day: 0, night: 0 },
        "โครงการจัดตั้งสถาบันอุทยานธรรมชาติวิทยาสิรีรุกขชาติ": { day: 0, night: 0 },
        "หอพักนักศึกษา": { day: 0, night: 0 }
      };

      data.forEach(row => {
        // ใช้ฟังก์ชัน parseDateString เดิมของคุณแปลงวันที่ในแต่ละแถว
        const rowDateObj = parseDateString(row["วันที่ปฏิบัติงาน"]); 
        
        // ใช้ฟังก์ชัน isSameDateObj เดิมของคุณเทียบวันที่ให้ตรงกัน
        if (isSameDateObj(rowDateObj, selectedDateObj)) {
          const unit = cleanStr(row["สัญญาจ้าง (พื้นที่)"]);
          const shift = cleanStr(row["ผลัดการทำงาน"]);

          if (dailyCounts[unit]) {
            if (shift === "เช้า" || shift === "กลางวัน") {
              dailyCounts[unit].day += 1;
            } else if (shift === "กลางคืน") {
              dailyCounts[unit].night += 1;
            }
          }
        }
      });

      renderGuardTable(dailyCounts);
    }
  });
}

// 4. ฟังก์ชันแสดงผลตาราง รปภ.เอกชน
function renderGuardTable(dailyCounts) {
  const tbody = document.getElementById("guardTableBody");
  if (!tbody) return;
  
  tbody.innerHTML = ""; // ล้างค่าตารางเดิม

  for (const [unit, target] of Object.entries(guardTargets)) {
    const actual = dailyCounts[unit];
    const totalActual = actual.day + actual.night;
    
    // ตรวจสอบความครบถ้วน
    const isComplete = (actual.day >= target.day && actual.night >= target.night);
    const statusText = isComplete ? "ครบ" : "ไม่ครบ";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align: left; font-size: 16pt !important;">${target.label}</td>
      <td style="font-size: 16pt !important;">${actual.day}</td>
      <td style="font-size: 16pt !important;">${actual.night}</td>
      <td style="font-size: 16pt !important;">${totalActual}</td>
      <td style="font-size: 16pt !important;">${statusText}</td>
    `;
    tbody.appendChild(tr);
  }
}
// =====================================================================
// ส่วนที่เพิ่มใหม่ 2: ทำให้ทุกตารางสามารถคลิกเพื่อพิมพ์/ลบ/แก้ไขข้อความได้
// =====================================================================

function makeAllTablesEditable() {
  // หาช่อง (td) ทั้งหมดในทุกตาราง
  const allTableCells = document.querySelectorAll('table td');
  
  allTableCells.forEach(td => {
    // ป้องกันการใส่การตั้งค่าซ้ำซ้อน
    if (!td.hasAttribute('contenteditable')) {
      
      // สั่งให้เซลล์นี้สามารถคลิกแก้ไขข้อความได้ (HTML5)
      td.setAttribute('contenteditable', 'true');
      
      // (ตกแต่งเสริม) เมื่อคลิกที่ช่อง ให้มีเส้นประบางๆ จะได้รู้ว่ากำลังแก้ไขอยู่
      td.addEventListener('focus', function() {
        this.style.outline = '1px dashed #999';
        this.style.backgroundColor = '#fafafa';
      });
      
      // เมื่อคลิกที่อื่น (เลิกแก้ไข) ให้เอากรอบและสีออก
      td.addEventListener('blur', function() {
        this.style.outline = 'none';
        this.style.backgroundColor = '';
      });
    }
  });
}

// สร้างตัวดักจับ (Observer) คอยดูว่าตารางมีการสร้างข้อมูลใหม่หรือไม่ 
// (เช่น ตอนดึงข้อมูลเสร็จ หรือเปลี่ยนวันที่)
const tableObserver = new MutationObserver(() => {
  makeAllTablesEditable();
});

// ให้ตัวดักจับเริ่มสอดส่องการเปลี่ยนแปลงในหน้าเว็บทันที
tableObserver.observe(document.body, { childList: true, subtree: true });

// สั่งรัน 1 รอบเผื่อมีตารางบางส่วนถูกโหลดเตรียมไว้แล้ว
makeAllTablesEditable();
// =====================================================================
// ส่วนที่เพิ่มใหม่ 3: อัปเกรดตารางให้คำนวณอัตโนมัติเมื่อพิมพ์ + เพิ่มหมายเหตุ
// (วางต่อท้ายไฟล์สุดได้เลย โค้ดจะไปแทนที่ฟังก์ชัน renderGuardTable เดิมให้อัตโนมัติ)
// =====================================================================

function renderGuardTable(dailyCounts) {
  const tbody = document.getElementById("guardTableBody");
  if (!tbody) return;
  
  // 1. ลองหาหัวตาราง (thead) เพื่อแอบเพิ่มหัวข้อ "หมายเหตุ" ให้โดยอัตโนมัติ (ถ้ายังไม่มี)
  const table = tbody.parentElement;
  const theadTr = table.querySelector("thead tr") || table.querySelector("tr");
  if (theadTr && theadTr.children.length === 5) {
      const thNote = document.createElement("th");
      thNote.innerText = "หมายเหตุ";
      thNote.style.cssText = "font-size: 16pt; text-align: center;";
      theadTr.appendChild(thNote);
  }

  tbody.innerHTML = ""; // ล้างค่าตารางเดิมเตรียมวาดใหม่

  for (const [unit, target] of Object.entries(guardTargets)) {
    const actual = dailyCounts[unit];
    
    const tr = document.createElement("tr");
    
    // --- สร้างแต่ละช่อง (td) ---
    const tdUnit = document.createElement("td");
    tdUnit.style.cssText = "text-align: left; font-size: 16pt !important;";
    tdUnit.innerText = target.label;

    const tdDay = document.createElement("td");
    tdDay.style.cssText = "font-size: 16pt !important; text-align: center;";
    tdDay.innerText = actual.day;

    const tdNight = document.createElement("td");
    tdNight.style.cssText = "font-size: 16pt !important; text-align: center;";
    tdNight.innerText = actual.night;

    const tdTotal = document.createElement("td");
    tdTotal.style.cssText = "font-size: 16pt !important; text-align: center; font-weight: bold;";
    
    const tdStatus = document.createElement("td");
    tdStatus.style.cssText = "font-size: 16pt !important; text-align: center; font-weight: bold;";

    const tdNote = document.createElement("td");
    tdNote.style.cssText = "font-size: 16pt !important; text-align: left;";

    // นำช่องทั้งหมดใส่ในแถว
    tr.appendChild(tdUnit);
    tr.appendChild(tdDay);
    tr.appendChild(tdNight);
    tr.appendChild(tdTotal);
    tr.appendChild(tdStatus);
    tr.appendChild(tdNote);
    tbody.appendChild(tr);

    // --- ฟังก์ชันคำนวณยอดและสถานะ (จะถูกเรียกใช้ตอนโหลด และ ตอนพิมพ์แก้เลข) ---
    const calculateAndUpdate = () => {
        // ดึงตัวเลขล่าสุดจากช่อง ถ้าพิมพ์ตัวหนังสือแปลกๆ มาให้มองเป็น 0
        let currentDay = parseInt(tdDay.innerText) || 0;
        let currentNight = parseInt(tdNight.innerText) || 0;
        
        // คำนวณรวม
        tdTotal.innerText = currentDay + currentNight;

        // เช็คส่วนขาด
        let missingDay = target.day - currentDay;
        let missingNight = target.night - currentNight;
        
        // ถ้าเกินเป้า ให้ถือว่าไม่ขาด (ไม่ติดลบ)
        if (missingDay < 0) missingDay = 0;
        if (missingNight < 0) missingNight = 0;

        let totalMissing = missingDay + missingNight;

        if (totalMissing > 0) {
            tdStatus.innerText = `ขาด ${totalMissing}`;
            tdStatus.style.color = "red";
            
            // สรุปหมายเหตุว่าขาดผลัดไหนกี่คน
            let noteText = [];
            if (missingDay > 0) noteText.push(`กลางวันขาด ${missingDay}`);
            if (missingNight > 0) noteText.push(`กลางคืนขาด ${missingNight}`);
            
            tdNote.innerText = noteText.join(', ');
            tdNote.style.color = "red";
        } else {
            tdStatus.innerText = "ครบ";
            tdStatus.style.color = "green"; // สีเขียวเมื่อครบ
            tdNote.innerText = "-";
            tdNote.style.color = "black";
        }
    };

    // 1. คำนวณทันทีเมื่อโหลดข้อมูลเสร็จ
    calculateAndUpdate();

    // 2. ดักจับเหตุการณ์ "เมื่อมีการพิมพ์/แก้ไขข้อความ" ในช่องกลางวันหรือกลางคืน ให้คำนวณใหม่ทันที
    tdDay.addEventListener("input", calculateAndUpdate);
    tdNight.addEventListener("input", calculateAndUpdate);
  }
}
// =====================================================================
// ส่วนที่เพิ่มใหม่ 4: ดึงข้อมูลการจราจรและวาดกราฟ (อัปเดตแก้บัคกราฟไม่ขึ้น)
// =====================================================================

const originalUpdateReportWithGuardAndTraffic = updateReport;

updateReport = function() {
  originalUpdateReportWithGuardAndTraffic(); 
  
  const picker = document.getElementById('datePicker');
  if (picker && picker.value) {
    const selectedDateObj = parseDateString(picker.value);
    if (selectedDateObj) {
      fetchTrafficData(selectedDateObj);
    }
  }
};

function fetchTrafficData(selectedDateObj) {
  Papa.parse(TRAFFIC_URL, {
    download: true,
    header: false, 
    complete: function(results) {
      const data = results.data;
      let foundLatestRow = null;
      
      // ค้นหาข้อมูลจากล่างขึ้นบน (เอาแถวล่าสุดของวันที่เลือก)
      for (let i = data.length - 1; i >= 1; i--) {
        let row = data[i];
        if (row && row[0]) {
          let rowDateObj = parseDateString(row[0]); // คอลัมน์ A คือวันที่
          if (isSameDateObj(rowDateObj, selectedDateObj)) {
            foundLatestRow = row;
            break; 
          }
        }
      }

      // โครงสร้างตัวเลขเริ่มต้น (เป็น 0 ทั้งหมด)
      let td = {
        car: [0,0,0,0,0],
        moto: [0,0,0,0,0],
        nohelm: [0,0,0,0,0]
      };

      // ถ้าเจอข้อมูลของวันนั้น ให้อัปเดตตัวเลข
      if (foundLatestRow) {
        td.car = [
          (parseInt(foundLatestRow[2]) || 0), (parseInt(foundLatestRow[3]) || 0), (parseInt(foundLatestRow[4]) || 0), (parseInt(foundLatestRow[5]) || 0), (parseInt(foundLatestRow[6]) || 0)
        ];
        td.moto = [
          (parseInt(foundLatestRow[7]) || 0), (parseInt(foundLatestRow[8]) || 0), (parseInt(foundLatestRow[9]) || 0), (parseInt(foundLatestRow[10]) || 0), (parseInt(foundLatestRow[11]) || 0)
        ];
        td.nohelm = [
          (parseInt(foundLatestRow[12]) || 0), (parseInt(foundLatestRow[13]) || 0), (parseInt(foundLatestRow[14]) || 0), (parseInt(foundLatestRow[15]) || 0), (parseInt(foundLatestRow[16]) || 0)
        ];
      }

      // ส่งข้อมูลไปวาดกราฟ
      renderTrafficCharts(td);
    },
    error: function(err) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลจราจร: ", err);
    }
  });
}

// ตัวแปรเก็บ Instance ของกราฟ
let vehicleChartInstance = null;
let helmetChartInstance = null;

function renderTrafficCharts(td) {
  if (typeof Chart === 'undefined') {
    alert("ไม่พบไลบรารีสำหรับสร้างกราฟ กรุณาตรวจสอบโค้ด <script> ในไฟล์ HTML");
    return;
  }

  const gatesLabels = ['ประตู 1', 'ประตู 3', 'ประตู 4', 'ประตู 5', 'ประตู 6'];

  Chart.defaults.font.family = "'Sarabun', sans-serif";
  Chart.defaults.font.size = 14; 
  Chart.defaults.color = "#000";

  // Plugin สำหรับวาดตัวเลขขนาดเล็กบนหัวแท่งกราฟ
  const barDataLabelsPlugin = {
    id: 'barDataLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        meta.data.forEach((bar, index) => {
          const val = dataset.data[index];
          if (val !== null && val !== undefined) {
            ctx.save();
            ctx.fillStyle = '#000';
            ctx.font = '11px Sarabun, sans-serif'; // ขนาดฟอนต์เล็กพอดีหัวแท่ง
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(val, bar.x, bar.y - 2); // แสดงเหนือแท่งกราฟเล็กน้อย
            ctx.restore();
          }
        });
      });
    }
  };

  // --- กราฟที่ 1: ยานพาหนะ ---
  const canvasVehicle = document.getElementById('vehicleChart');
  if (!canvasVehicle) return; 

  if (vehicleChartInstance) {
    vehicleChartInstance.destroy(); 
  }
  
  vehicleChartInstance = new Chart(canvasVehicle.getContext('2d'), {
    type: 'bar',
    data: {
      labels: gatesLabels,
      datasets: [
        {
          label: 'รถยนต์',
          data: td.car,
          backgroundColor: 'rgba(54, 162, 235, 0.8)', 
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          maxBarThickness: 35
        },
        {
          label: 'รถจักรยานยนต์',
          data: td.moto,
          backgroundColor: 'rgba(255, 159, 64, 0.8)', 
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1,
          maxBarThickness: 35
        }
      ]
    },
    plugins: [barDataLabelsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: { top: 15, right: 15 } // เว้นระยะบนเผื่อตัวเลขเหนือแท่งกราฟ
      },
      plugins: {
        legend: { position: 'top' },
        title: { display: false } 
      },
      scales: {
        y: { 
          beginAtZero: true, 
          title: { display: false },
          ticks: { font: { size: 12 } } 
        },
        x: { 
          title: { display: false },
          ticks: { font: { size: 13 } } 
        }
      }
    }
  });

  // --- กราฟที่ 2: หมวกนิรภัย ---
  const canvasHelmet = document.getElementById('helmetChart');
  if (!canvasHelmet) return;

  if (helmetChartInstance) {
    helmetChartInstance.destroy();
  }

  helmetChartInstance = new Chart(canvasHelmet.getContext('2d'), {
    type: 'bar',
    data: {
      labels: gatesLabels,
      datasets: [{
        label: 'ผู้ไม่สวมหมวกนิรภัย',
        data: td.nohelm,
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
        maxBarThickness: 35
      }]
    },
    plugins: [barDataLabelsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: { top: 15, right: 15 }
      },
      plugins: {
        legend: { display: false },
        title: { display: false } 
      },
      scales: {
        y: { 
          beginAtZero: true, 
          title: { display: false },
          ticks: { font: { size: 12 } } 
        },
        x: { 
          title: { display: false },
          ticks: { font: { size: 13 } }
        }
      }
    }
  });
}