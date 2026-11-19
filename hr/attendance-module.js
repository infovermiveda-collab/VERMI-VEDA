// Vermi Veda HR — Employee Attendance Calendar
export function renderAttendanceModule(root, sb, options = {}) {
  if (options.canManage === false) {
    root.innerHTML = '<div class="vvac-card"><h2>Attendance</h2><p>HR/admin access required.</p></div>';
    return;
  }
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pad = n => String(n).padStart(2,"0");
  const today = new Date();
  let year=today.getFullYear(), month=today.getMonth(), employees=[], records=[], selectedEmployee="", selectedDate="", busy=false;
  const monthKey=()=>year+"-"+pad(month+1);
  const dateKey=d=>year+"-"+pad(month+1)+"-"+pad(d);
  const statusInfo={
    present:["P","Present"], absent:["AB","Absent"], half_day:["HD","Half Day"],
    paid_leave:["PL","Paid Leave"], unpaid_leave:["UL","Unpaid Leave"],
    weekly_off:["WO","Weekly Off"], holiday:["H","Holiday"], travel:["TR","Travel"]
  };
  const findRecord=date=>records.find(r=>r.attendance_date===date);
  const timeMinutes=t=>{if(!t)return null;const [h,m]=String(t).slice(0,5).split(":").map(Number);return h*60+m;};
  const duration=(a,b)=>{const x=timeMinutes(a),y=timeMinutes(b);if(x===null||y===null)return 0;return Math.max(0,(y-x+1440)%1440);};
  const hoursLabel=m=>Math.floor(m/60)+":"+pad(m%60);
  root.innerHTML=`
    <section class="vvac">
      <header class="vvac-header"><div><h2>Attendance Calendar</h2><p>Employee-wise monthly attendance, shifts and working hours</p></div><button class="vvac-refresh" id="vvac-refresh">↻ Refresh</button></header>
      <section class="vvac-toolbar">
        <div class="vvac-legend" id="vvac-legend"></div>
        <div class="vvac-filters">
          <label>Attendance Month<input id="vvac-month" type="month" value="${monthKey()}"></label>
          <label>Employee<select id="vvac-employee"><option value="">Loading employees…</option></select></label>
        </div>
      </section>
      <section class="vvac-calendar-panel">
        <div class="vvac-cal-head">
          <div class="vvac-nav"><button id="vvac-prev-year" title="Previous year">«</button><button id="vvac-prev" title="Previous month">‹</button><button id="vvac-today">Today</button><button id="vvac-next" title="Next month">›</button><button id="vvac-next-year" title="Next year">»</button></div>
          <h3 id="vvac-title"></h3>
          <div class="vvac-view-label">MONTH VIEW</div>
        </div>
        <div class="vvac-weekdays"><span>Monday</span><span>Tuesday</span><span>Wednesday</span><span>Thursday</span><span>Friday</span><span>Saturday</span><span>Sunday</span></div>
        <div class="vvac-grid" id="vvac-grid"></div>
      </section>
      <section class="vvac-editor" id="vvac-editor" hidden></section>
      <p class="vvac-foot" id="vvac-foot">Loading employee attendance…</p>
    </section>`;
  const monthInput=root.querySelector("#vvac-month"), employeeSelect=root.querySelector("#vvac-employee"), grid=root.querySelector("#vvac-grid"), editor=root.querySelector("#vvac-editor"), foot=root.querySelector("#vvac-foot");
  const legend=root.querySelector("#vvac-legend");
  const setLegend=summary=>{
    const items=[["Present",summary.present,"present"],["Working on Weekend",summary.weekend,"weekend"],["Working on Holiday",summary.holidayWork,"holidaywork"],["Absent",summary.absent,"absent"],["Weekly Off",summary.weeklyOff,"weeklyoff"],["Holiday",summary.holiday,"holiday"],["Travel",summary.travel,"travel"],["Late Coming",summary.late,"late"]];
    legend.innerHTML=items.map(([label,n,cls])=>'<span class="vvac-chip vvac-chip-'+cls+'">'+label+' - '+n+'</span>').join("");
  };
  async function loadEmployees(){
    foot.textContent="Loading employee list…";
    const r=await sb.from("vvhr_employees").select("id,employee_code,full_name,department,designation,employment_status").in("employment_status",["active","probation"]).order("employee_code");
    if(r.error){foot.textContent="Could not load employees: "+r.error.message;return;}
    employees=r.data||[];
    const previous=selectedEmployee;
    employeeSelect.innerHTML=employees.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.employee_code)+" - "+esc(e.full_name)+'</option>').join("");
    selectedEmployee=employees.some(e=>e.id===previous)?previous:(employees[0]?.id||"");
    employeeSelect.value=selectedEmployee;
    if(!selectedEmployee){grid.innerHTML='<div class="vvac-empty">No active employees found.</div>';foot.textContent="Add an employee first in HR Management.";return;}
    await loadMonth();
  }
  async function loadMonth(){
    monthInput.value=monthKey();
    root.querySelector("#vvac-title").textContent=new Date(year,month,1).toLocaleDateString("en-IN",{month:"long",year:"numeric"});
    if(!selectedEmployee)return;
    foot.textContent="Loading attendance calendar…";
    const start=year+"-"+pad(month+1)+"-01",end=year+"-"+pad(month+1)+"-"+pad(new Date(year,month+1,0).getDate());
    const r=await sb.from("vvhr_attendance").select("*").eq("employee_id",selectedEmployee).gte("attendance_date",start).lte("attendance_date",end).order("attendance_date");
    if(r.error){foot.textContent="Attendance load failed: "+r.error.message;return;}
    records=r.data||[];
    drawCalendar();
  }
  function drawCalendar(){
    const employee=employees.find(e=>e.id===selectedEmployee);
    const days=new Date(year,month+1,0).getDate(),offset=(new Date(year,month,1).getDay()+6)%7;
    const byDate=new Map(records.map(r=>[r.attendance_date,r]));
    const summary={present:0,weekend:0,holidayWork:0,absent:0,weeklyOff:0,holiday:0,travel:0,late:0};
    records.forEach(r=>{
      const day=new Date(r.attendance_date+"T12:00:00").getDay();
      if(r.status==="present"){summary.present++;if(day===0||day===6)summary.weekend++;if(r.is_holiday)summary.holidayWork++;}
      if(r.status==="absent")summary.absent++;
      if(r.status==="weekly_off")summary.weeklyOff++;
      if(r.status==="holiday"||r.is_holiday)summary.holiday++;
      if(r.status==="travel")summary.travel++;
      if(Number(r.late_minutes)>0)summary.late++;
    });
    setLegend(summary);
    const cells=[];
    for(let i=0;i<offset;i++)cells.push('<div class="vvac-day vvac-day-blank"></div>');
    for(let d=1;d<=days;d++){
      const date=dateKey(d),r=byDate.get(date),weekday=new Date(year,month,d).getDay();
      const defaultOff=weekday===0&&!r;
      const status=r?.status||(defaultOff?"weekly_off":"");
      const info=statusInfo[status]||["","Not Marked"];
      const worked=duration(r?.check_in,r?.check_out);
      const late=Number(r?.late_minutes||0);
      const checkText=r?.check_in?(r.check_out?"IN "+String(r.check_in).slice(0,5)+" · OUT "+String(r.check_out).slice(0,5):"IN "+String(r.check_in).slice(0,5)+" · Check-out missing"):"";
      const shift=r?.shift_name||"Shift not assigned";
      const shiftTime=r?.shift_start_time&&r?.shift_end_time?String(r.shift_start_time).slice(0,5)+" - "+String(r.shift_end_time).slice(0,5):"";
      const classes=["vvac-day",status?"vvac-status-"+status:"vvac-status-unmarked",date===selectedDate?"vvac-selected":""].filter(Boolean).join(" ");
      cells.push('<button type="button" class="'+classes+'" data-date="'+date+'"><span class="vvac-date">'+d+'</span>'+
        (status?'<span class="vvac-statusbar">'+info[1]+(late>0?' · Late '+late+'m':'')+'</span>':'<span class="vvac-unmarked">Not marked</span>')+
        '<span class="vvac-shift">'+esc(shift)+'</span>'+(shiftTime?'<span class="vvac-shift-time">'+esc(shiftTime)+'</span>':'')+
        (checkText?'<span class="vvac-punch">'+esc(checkText)+'</span>':'')+
        (worked?'<span class="vvac-total">Total Hours: '+hoursLabel(worked)+'</span>':(r?.check_in?'<span class="vvac-total vvac-warn">Total Hours: 0:00</span>':""))+
        (r?.is_holiday&&r.holiday_name?'<span class="vvac-holiday-name">'+esc(r.holiday_name)+'</span>':"")+
        '<span class="vvac-edit-hint">Click to edit</span></button>');
    }
    const total=Math.ceil((offset+days)/7)*7;
    for(let i=offset+days;i<total;i++)cells.push('<div class="vvac-day vvac-day-blank"></div>');
    grid.innerHTML=cells.join("");
    grid.querySelectorAll("[data-date]").forEach(b=>b.onclick=()=>openEditor(b.dataset.date));
    foot.textContent=(employee?employee.employee_code+" - "+employee.full_name:"")+" · "+records.length+" attendance entries · Click any date to mark or edit attendance.";
    if(selectedDate&&selectedDate.startsWith(monthKey()))openEditor(selectedDate);
    else editor.hidden=true;
  }
  function openEditor(date){
    selectedDate=date;
    const r=records.find(x=>x.attendance_date===date)||{};
    const dayLabel=new Date(date+"T12:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
    editor.hidden=false;
    editor.innerHTML=`
      <div class="vvac-editor-head"><div><h3>Attendance Entry</h3><p>${esc(dayLabel)}</p></div><button type="button" class="vvac-close" id="vvac-close">✕</button></div>
      <form id="vvac-form" class="vvac-form">
        <label>Attendance Status<select name="status" required>${Object.entries(statusInfo).map(([v,x])=>'<option value="'+v+'" '+(r.status===v?'selected':'')+'>'+x[1]+'</option>').join("")}</select></label>
        <label>Shift Name<input name="shift_name" maxlength="80" value="${esc(r.shift_name||"")}" placeholder="e.g. Morning Shift"></label>
        <label>Shift Start<input name="shift_start_time" type="time" value="${esc(r.shift_start_time||"")}"></label>
        <label>Shift End<input name="shift_end_time" type="time" value="${esc(r.shift_end_time||"")}"></label>
        <label>Check In<input name="check_in" type="time" value="${esc(r.check_in||"")}"></label>
        <label>Check Out<input name="check_out" type="time" value="${esc(r.check_out||"")}"></label>
        <label>Late Minutes<input name="late_minutes" type="number" min="0" value="${Number(r.late_minutes||0)}"></label>
        <label>Overtime Minutes<input name="overtime_minutes" type="number" min="0" value="${Number(r.overtime_minutes||0)}"></label>
        <label class="vvac-holiday-toggle"><input name="is_holiday" type="checkbox" ${r.is_holiday?"checked":""}> Holiday / festival</label>
        <label>Holiday Name<input name="holiday_name" maxlength="120" value="${esc(r.holiday_name||"")}" placeholder="Optional holiday name"></label>
        <label class="vvac-wide">Remarks<input name="remarks" maxlength="500" value="${esc(r.remarks||"")}" placeholder="Optional remarks"></label>
        <div class="vvac-form-actions"><button type="button" class="vvac-cancel" id="vvac-cancel">Cancel</button><button type="submit" id="vvac-save">Save Attendance</button></div>
      </form>`;
    root.querySelector("#vvac-close").onclick=()=>{editor.hidden=true;selectedDate="";};
    root.querySelector("#vvac-cancel").onclick=()=>{editor.hidden=true;selectedDate="";};
    const form=editor.querySelector("#vvac-form");
    form.elements.check_in.onchange=()=>{const shift=timeMinutes(form.elements.shift_start_time.value),check=timeMinutes(form.elements.check_in.value);if(shift!==null&&check!==null)form.elements.late_minutes.value=Math.max(0,check-shift);};
    form.onsubmit=async ev=>{
      ev.preventDefault();if(busy)return;
      const val=n=>form.elements[n].value;
      const status=val("status"),checkIn=val("check_in")||null,checkOut=val("check_out")||null;
      if(checkIn&&checkOut&&checkOut<checkIn){alert("Check-out cannot be earlier than check-in.");return;}
      const shiftStart=val("shift_start_time")||null,shiftEnd=val("shift_end_time")||null;
      let late=Math.max(0,Number(val("late_minutes")||0));
      if(shiftStart&&checkIn){const sm=timeMinutes(shiftStart),ci=timeMinutes(checkIn);late=Math.max(0,ci-sm);}
      const payload={employee_id:selectedEmployee,attendance_date:date,status,shift_name:val("shift_name").trim()||null,shift_start_time:shiftStart,shift_end_time:shiftEnd,check_in:checkIn,check_out:checkOut,late_minutes:late,overtime_minutes:Math.max(0,Number(val("overtime_minutes")||0)),is_holiday:form.elements.is_holiday.checked,holiday_name:val("holiday_name").trim()||null,remarks:val("remarks").trim()||null,marked_by:(await sb.auth.getUser()).data?.user?.id||null};
      const btn=form.querySelector("#vvac-save");btn.disabled=true;btn.textContent="Saving…";busy=true;
      const saved=await sb.from("vvhr_attendance").upsert(payload,{onConflict:"employee_id,attendance_date"}).select("*").single();
      busy=false;btn.disabled=false;btn.textContent="Save Attendance";
      if(saved.error){foot.textContent="Could not save attendance: "+saved.error.message;return;}
      const idx=records.findIndex(x=>x.attendance_date===date);if(idx>=0)records[idx]=saved.data;else records.push(saved.data);
      drawCalendar();foot.textContent="Attendance saved for "+date+".";
    };
  }
  function changeMonth(delta){const d=new Date(year,month+delta,1);year=d.getFullYear();month=d.getMonth();selectedDate="";loadMonth();}
  root.querySelector("#vvac-prev").onclick=()=>changeMonth(-1);
  root.querySelector("#vvac-next").onclick=()=>changeMonth(1);
  root.querySelector("#vvac-prev-year").onclick=()=>changeMonth(-12);
  root.querySelector("#vvac-next-year").onclick=()=>changeMonth(12);
  root.querySelector("#vvac-today").onclick=()=>{year=today.getFullYear();month=today.getMonth();selectedDate="";loadMonth();};
  root.querySelector("#vvac-refresh").onclick=()=>loadMonth();
  monthInput.onchange=()=>{if(!monthInput.value)return;const [y,m]=monthInput.value.split("-").map(Number);year=y;month=m-1;selectedDate="";loadMonth();};
  employeeSelect.onchange=()=>{selectedEmployee=employeeSelect.value;selectedDate="";loadMonth();};
  loadEmployees();
}
