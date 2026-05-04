import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search, Plus, ArrowLeft, Undo2, Redo2, Save, Trash2, Lock, Unlock,
  Eye, EyeOff, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  FileText, Target, CheckSquare, Activity, Bell, Folder, FolderPlus,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Image as ImageIcon, Minus, Type, Layers, X,
  Settings as Cog, CalendarDays, Clock, RotateCcw,
  Pin, PinOff, Copy, RotateCw, Zap, Tag, SortAsc,
  BookOpen, ClipboardList, Lightbulb, Coffee, FolderOpen, Pencil,
  ListFilter, RefreshCw, Palette, GripVertical,
  Mic, MicOff, Maximize2, Minimize2, Table,
  Download, Shield, Key, Fingerprint, BellOff, BellRing,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// CRYPTO
// ═══════════════════════════════════════════════════════════════════
function xorCipher(t,k){let o="";for(let i=0;i<t.length;i++)o+=String.fromCharCode(t.charCodeAt(i)^k.charCodeAt(i%k.length));return o;}
const encryptContent=(p,k)=>{try{return btoa(unescape(encodeURIComponent(xorCipher(p,k))));}catch{return null;}};
const decryptContent=(c,k)=>{try{return xorCipher(decodeURIComponent(escape(atob(c))),k);}catch{return null;}};
function hashPass(s){let h=0x811c9dc5>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,"0");}

// ═══════════════════════════════════════════════════════════════════
// PHASE 9: PIN / BIOMETRIC HELPERS
// ═══════════════════════════════════════════════════════════════════
function hashPin(pin){let h=0xdeadbeef>>>0;for(let i=0;i<pin.length;i++){h^=pin.charCodeAt(i);h=Math.imul(h,0x9e3779b9)>>>0;}return"PIN"+h.toString(16).padStart(8,"0");}
async function isBiometricAvailable(){try{return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();}catch{return false;}}
async function registerBiometric(){
  const ch=new Uint8Array(32);crypto.getRandomValues(ch);
  const cred=await navigator.credentials.create({publicKey:{challenge:ch,rp:{name:"Verso Notes",id:location.hostname||"localhost"},user:{id:new TextEncoder().encode("verso-"+Date.now()),name:"verso",displayName:"Verso User"},pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required",requireResidentKey:false},timeout:60000}});
  if(!cred)return null;return cred.id;
}
async function verifyBiometric(credId){
  const ch=new Uint8Array(32);crypto.getRandomValues(ch);
  const opts={publicKey:{challenge:ch,userVerification:"required",timeout:60000}};
  if(credId){const buf=Uint8Array.from(atob(credId.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));opts.publicKey.allowCredentials=[{type:"public-key",id:buf}];}
  const a=await navigator.credentials.get(opts);return!!a;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 9: EXPORT HELPERS
// ═══════════════════════════════════════════════════════════════════
function htmlToMarkdown(html){
  if(!html)return"";let md=html;
  md=md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi,"# $1\n\n");md=md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi,"## $1\n\n");md=md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi,"### $1\n\n");
  md=md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi,"**$1**");md=md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi,"**$1**");md=md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi,"_$1_");md=md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi,"_$1_");md=md.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi,"~~$1~~");md=md.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi,"$1");
  md=md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi,"- $1\n");md=md.replace(/<[ou]l[^>]*>/gi,"").replace(/<\/[ou]l>/gi,"\n");
  md=md.replace(/<br\s*\/?>/gi,"\n");md=md.replace(/<\/p>/gi,"\n\n").replace(/<p[^>]*>/gi,"");md=md.replace(/<hr[^>]*>/gi,"\n---\n");
  md=md.replace(/<[^>]+>/g,"");md=md.replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"');
  return md.replace(/\n{3,}/g,"\n\n").trim();
}
// ═══════════════════════════════════════════════════════════════════
// CAPACITOR SHARE — drop-in replacements for downloadFile & exportToPDF
//
// INSTALL (run once in your project root):
//   npm install @capacitor/share @capacitor/filesystem
//   npx cap sync android
//
// USAGE in Verso.jsx:
//   Delete the original `downloadFile` and `exportToPDF` functions
//   (lines 53-59) and paste these in their place.
//   No other changes needed — all call sites (lines 503-505) stay the same.
// ═══════════════════════════════════════════════════════════════════

const _isNative = () =>
  typeof window !== "undefined" &&
  window.Capacitor?.isNativePlatform?.() === true;

// ── downloadFile ─────────────────────────────────────────────────────────────
//
//  Web:    anchor-click download (unchanged behaviour)
//  Native: writes a temp file via Filesystem, then opens the share sheet
//
async function downloadFile(content, filename, mime) {
  if (!_isNative()) {
    // Original web implementation
    const b = new Blob([content], { type: mime });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
    return;
  }

  // Native path
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");

    // Encode content to base64 (Filesystem.writeFile requires base64 on native)
    const base64 = btoa(unescape(encodeURIComponent(content)));

    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      encoding: "base64",         // skip this if plugin expects raw base64
      recursive: true,
    });

    await Share.share({
      title: filename,
      url: result.uri,             // file:// URI — Android resolves via FileProvider
      dialogTitle: "Export note",
    });

    // Clean up after share sheet is dismissed
    try {
      await Filesystem.deleteFile({ path: filename, directory: Directory.Cache });
    } catch { /* ignore */ }

  } catch (e) {
    console.error("[Verso] Share failed:", e);
    alert("Could not share file: " + (e?.message ?? e));
  }
}

// ── exportToPDF ───────────────────────────────────────────────────────────────
//
//  Web:    window.open() + window.print() (unchanged behaviour)
//  Native: shares the note as a self-contained HTML file.
//          The user can open it in Chrome/Drive and print-to-PDF from there,
//          or save it directly. window.open() is blocked in Android WebView
//          so this is the best we can do without a native PDF library.
//
async function exportToPDF(title, htmlContent) {
  if (!_isNative()) {
    // Original web implementation
    const w = window.open("", "_blank");
    if (!w) return alert("Allow pop-ups to export PDF.");
    const escaped = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(
      `<!DOCTYPE html><html><head><title>${escaped || "Note"}</title>` +
      `<style>*{box-sizing:border-box;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:750px;margin:40px auto;padding:0 24px;line-height:1.85;color:#111;}` +
      `h1{font-size:28px;font-weight:800;margin:0 0 6px;}p.meta{color:#888;font-size:13px;margin:0 0 28px;padding-bottom:16px;border-bottom:1px solid #eee;}` +
      `img{max-width:100%;border-radius:8px;display:block;margin:8px 0;}table{border-collapse:collapse;width:100%;margin:12px 0;}td,th{border:1px solid #ddd;padding:8px 12px;}` +
      `hr{border:none;border-top:1px solid #ddd;margin:20px 0;}ul,ol{padding-left:24px;}@media print{body{margin:0;max-width:100%;}}</style></head>` +
      `<body><h1>${escaped || "Untitled"}</h1>` +
      `<p class="meta">Exported from Verso &middot; ${new Date().toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</p>` +
      `<div>${htmlContent}</div>` +
      `<script>window.onload=()=>setTimeout(()=>window.print(),350);<\/script></body></html>`
    );
    w.document.close();
    return;
  }

  // Native path: share as .html — user can print-to-PDF in any browser/app
  const escaped = (title || "Untitled").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fullHtml =
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escaped}</title>` +
    `<style>*{box-sizing:border-box;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:750px;margin:40px auto;padding:0 24px;line-height:1.85;color:#111;}` +
    `h1{font-size:28px;font-weight:800;margin:0 0 6px;}p.meta{color:#888;font-size:13px;margin:0 0 28px;padding-bottom:16px;border-bottom:1px solid #eee;}` +
    `img{max-width:100%;border-radius:8px;}table{border-collapse:collapse;width:100%;margin:12px 0;}td,th{border:1px solid #ddd;padding:8px 12px;}` +
    `hr{border:none;border-top:1px solid #ddd;margin:20px 0;}ul,ol{padding-left:24px;}</style></head>` +
    `<body><h1>${escaped}</h1>` +
    `<p class="meta">Exported from Verso &middot; ${new Date().toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</p>` +
    `<div>${htmlContent}</div></body></html>`;

  const safeTitle = (title || "note").replace(/[^a-z0-9_\- ]/gi, "").trim() || "note";
  await downloadFile(fullHtml, `${safeTitle}.html`, "text/html");
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 9: NOTIFICATION HELPERS
// ═══════════════════════════════════════════════════════════════════
const _notifTimers=new Map();
function scheduleNotifications(notes){
  _notifTimers.forEach(id=>clearTimeout(id));_notifTimers.clear();
  if(!("Notification" in window)||Notification.permission!=="granted")return;
  const now=Date.now();
  notes.forEach(n=>{
    if(!n.reminderDate||!n.reminderTime)return;
    const ts=new Date(n.reminderDate+"T"+n.reminderTime).getTime();if(isNaN(ts))return;
    const delay=ts-now;const title=n.title||stripHtml(n.content).slice(0,80)||"Note reminder";
    if(delay<0&&delay>-3600000){try{new Notification("Verso · Reminder",{body:title,tag:n.id,icon:""});}catch{}}
    else if(delay>=0&&delay<=604800000){const id=setTimeout(()=>{try{new Notification("Verso · Reminder",{body:title,tag:n.id,icon:""});}catch{}},delay);_notifTimers.set(n.id,id);}
  });
}
// ── Haptic feedback helper ────────────────────────────────────────
const haptic=(ms=10)=>{try{navigator.vibrate?.(ms);}catch{}};

// ── Capacitor-aware notification permission ───────────────────────
async function requestNotifPermission(){
  // Try Capacitor Android first
  if(typeof window!=="undefined"&&window.Capacitor?.isNativePlatform?.()&&window.Capacitor?.platform==="android"){
    try{
      const {LocalNotifications}=window.Capacitor.Plugins;
      if(LocalNotifications){const r=await LocalNotifications.requestPermissions();return r?.display==="granted";}
    }catch{}
    try{
      const {PushNotifications}=window.Capacitor.Plugins;
      if(PushNotifications){const r=await PushNotifications.requestPermissions();return r?.receive==="granted";}
    }catch{}
  }
  if(!("Notification" in window))return false;
  if(Notification.permission==="granted")return true;
  const r=await Notification.requestPermission();return r==="granted";
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const PRIORITY={low:{label:"Low",color:"#22c55e"},mid:{label:"Mid",color:"#eab308"},high:{label:"High",color:"#ef4444"}};
const NOTE_LABELS=[
  {id:"red",color:"#ef4444",name:"Red"},{id:"orange",color:"#f97316",name:"Orange"},
  {id:"yellow",color:"#eab308",name:"Yellow"},{id:"green",color:"#22c55e",name:"Green"},
  {id:"blue",color:"#3b82f6",name:"Blue"},{id:"purple",color:"#8b5cf6",name:"Purple"},
  {id:"pink",color:"#ec4899",name:"Pink"},{id:"gray",color:"#64748b",name:"Gray"},
];
const SORT_OPTIONS=[{id:"updated",label:"Last edited"},{id:"created",label:"Date created"},{id:"title",label:"Title A–Z"},{id:"words",label:"Word count"}];
const RECUR_NOTE_OPTIONS=[{id:null,label:"None"},{id:"daily",label:"Daily"},{id:"weekly",label:"Weekly"},{id:"monthly",label:"Monthly"},{id:"yearly",label:"Yearly"}];
const TEMPLATES=[
  {id:"blank",icon:FileText,label:"Blank",title:"",content:""},
  {id:"journal",icon:BookOpen,label:"Journal",title:"Journal – "+new Date().toLocaleDateString([],{month:"long",day:"numeric",year:"numeric"}),content:"<b>How I'm feeling today:</b><br><br><br><b>What happened:</b><br><br><br><b>Grateful for:</b><br><br>"},
  {id:"meeting",icon:ClipboardList,label:"Meeting Notes",title:"Meeting – ",content:"<b>Attendees:</b><br><br><b>Agenda:</b><br><ul><li>Item 1</li><li>Item 2</li></ul><b>Action items:</b><br><ul><li></li></ul><b>Notes:</b><br><br>"},
  {id:"todo",icon:CheckSquare,label:"To-Do List",title:"To-Do",content:`<input type="checkbox" style="accent-color:#5b8dee;width:15px;height:15px;vertical-align:middle;margin-right:6px;"/> Task 1<br><input type="checkbox" style="accent-color:#5b8dee;width:15px;height:15px;vertical-align:middle;margin-right:6px;"/> Task 2<br><input type="checkbox" style="accent-color:#5b8dee;width:15px;height:15px;vertical-align:middle;margin-right:6px;"/> Task 3<br>`},
  {id:"idea",icon:Lightbulb,label:"Idea",title:"Idea: ",content:"<b>The idea:</b><br><br><br><b>Why it matters:</b><br><br><br><b>Next steps:</b><br><br>"},
  {id:"daily",icon:Coffee,label:"Daily Plan",title:"Plan – "+new Date().toLocaleDateString([],{weekday:"long",month:"short",day:"numeric"}),content:"<b>Top 3 priorities:</b><br><ol><li></li><li></li><li></li></ol><b>Schedule:</b><br><br><b>Notes:</b><br><br>"},
];

// ── Phase 7: Calendar categories ──────────────────────────────────
const DEFAULT_CALENDARS=[
  {id:"personal",name:"Personal",color:"#5b8dee"},
  {id:"work",name:"Work",color:"#f5a348"},
  {id:"health",name:"Health",color:"#5ecb7c"},
  {id:"social",name:"Social",color:"#e05c6e"},
  {id:"study",name:"Study",color:"#a78bfa"},
];
const RECUR_EVENT_OPTIONS=[{id:null,label:"Never"},{id:"daily",label:"Daily"},{id:"weekly",label:"Weekly"},{id:"monthly",label:"Monthly"},{id:"yearly",label:"Yearly"}];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
const uid=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
function stripHtml(h){if(!h)return "";return h.replace(/<br\s*\/?>/gi," ").replace(/<[^>]*>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();}
function plainToHtml(t){if(!t)return "";if(/<[a-z][\s\S]*>/i.test(t))return t;return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");}
function relTime(ts){const d=Date.now()-ts;if(d<60000)return "just now";if(d<3600000)return `${Math.floor(d/60000)}m ago`;if(d<86400000)return new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});if(d<604800000)return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(ts).getDay()];return new Date(ts).toLocaleDateString([],{month:"short",day:"numeric"});}
const fmtDate=ds=>new Date(ds).toLocaleDateString([],{month:"short",day:"numeric"});
const fmtFull=ts=>new Date(ts).toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})+" · "+new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const fmtDay=ds=>new Date(ds+"T00:00").toLocaleDateString([],{weekday:"long",month:"long",day:"numeric"});
function toDateStr(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function wordCount(html){const p=stripHtml(html);return p.trim()?p.trim().split(/\s+/).filter(Boolean).length:0;}

function groupTimeline(notes){
  const s=new Date();s.setHours(0,0,0,0);const ms=s.getTime();
  const g={today:[],upcoming:[],later:[],past:[]};
  notes.forEach(n=>{const ds=n.timelineDate||n.taskDueDate;if(!ds||(!n.isTimeline&&!n.isTask))return;const t=new Date(ds).getTime();if(t<ms)g.past.push(n);else if(t<ms+86400000)g.today.push(n);else if(t<ms+7*86400000)g.upcoming.push(n);else g.later.push(n);});
  return g;
}
function groupByStatus(notes){
  const s=new Date();s.setHours(0,0,0,0);const ms=s.getTime();
  const g={overdue:[],today:[],upcoming:[],done:[],nodate:[]};
  notes.forEach(n=>{if(n.taskStatus==="done"){g.done.push(n);return;}const ds=n.taskDueDate||n.timelineDate;if(!ds){g.nodate.push(n);return;}const t=new Date(ds+"T00:00").getTime();if(t<ms)g.overdue.push(n);else if(t<ms+86400000)g.today.push(n);else g.upcoming.push(n);});
  return g;
}
function sortNotes(notes,sortId){const arr=[...notes];switch(sortId){case"created":return arr.sort((a,b)=>b.createdAt-a.createdAt);case"title":return arr.sort((a,b)=>(a.title||"").localeCompare(b.title||""));case"words":return arr.sort((a,b)=>wordCount(b.content)-wordCount(a.content));default:return arr.sort((a,b)=>b.updatedAt-a.updatedAt);}
}

// ── Phase 7 helpers ───────────────────────────────────────────────
function eventOccursOnDate(ev,dateStr){
  if(ev.date===dateStr)return true;
  if(!ev.recurringType)return false;
  const base=new Date(ev.date+"T00:00");
  const target=new Date(dateStr+"T00:00");
  if(target<=base)return false;
  if(ev.recurringEnd&&dateStr>ev.recurringEnd)return false;
  const diff=Math.round((target-base)/86400000);
  switch(ev.recurringType){
    case"daily":return true;
    case"weekly":return diff%7===0;
    case"monthly":return target.getDate()===base.getDate();
    case"yearly":return target.getDate()===base.getDate()&&target.getMonth()===base.getMonth();
    default:return false;
  }
}
function getWeekDays(anchorStr,weekStart=0){
  const d=new Date(anchorStr+"T00:00");
  const offset=(d.getDay()-weekStart+7)%7;
  const start=new Date(d);start.setDate(d.getDate()-offset);
  return Array.from({length:7},(_,i)=>{const day=new Date(start);day.setDate(start.getDate()+i);return day;});
}
function addMinutes(hhmm,mins){
  const[h,m]=hhmm.split(":").map(Number);
  const total=h*60+m+mins;
  const nh=Math.floor(total/60);
  const nm=total%60;
  return `${String(Math.min(nh,23)).padStart(2,"0")}:${String(nm).padStart(2,"0")}`;
}
function yToTime(y,HOUR_H,DAY_START,DAY_END){
  const rawMins=Math.max(0,y/HOUR_H*60);
  const snapped=Math.round(rawMins/15)*15;
  const h=DAY_START+Math.floor(snapped/60);
  const m=snapped%60;
  const clH=Math.max(DAY_START,Math.min(DAY_END-1,h));
  return `${String(clH).padStart(2,"0")}:${String(clH===DAY_END-1?0:m).padStart(2,"0")}`;
}

const blankNote=(extra={})=>({id:uid(),title:"",content:"",createdAt:Date.now(),updatedAt:Date.now(),isTask:false,taskDueDate:"",taskStatus:"pending",isGoal:false,goalProgress:0,isTimeline:false,timelineDate:"",isEncrypted:false,encryptedContent:"",passwordHash:"",reminderDate:"",reminderTime:"",bgImage:null,isPinned:false,priority:null,label:null,folderId:null,subtasks:[],recurringType:null,wordGoal:0,...extra});
const blankFolder=(name="")=>({id:uid(),name,createdAt:Date.now()});
const blankEvent=(date="")=>({id:uid(),title:"",date,startTime:"09:00",endTime:"10:00",allDay:false,color:"#5b8dee",description:"",linkedNoteId:null,priority:null,calendarId:"personal",recurringType:null,recurringEnd:""});

// ═══════════════════════════════════════════════════════════════════
// THEME ENGINE
// ═══════════════════════════════════════════════════════════════════
const BASE_THEMES={
  dark:{bg:"#0c0d10",surface:"#13141c",surface2:"#1a1c26",border:"#242736",text:"#dde0f0",sub:"#838ab0",dim:"#484f6b",accent:"#5b8dee",task:"#f5a348",goal:"#5ecb7c",lock:"#e05c6e",edBg:"#0f1018",toolbar:"#15161f"},
  light:{bg:"#f4f5fa",surface:"#ffffff",surface2:"#ecedf5",border:"#dde0f0",text:"#0d1022",sub:"#6070a0",dim:"#9aa0c8",accent:"#3d6cf0",task:"#d97f10",goal:"#2e8f4e",lock:"#c22844",edBg:"#fafbff",toolbar:"#f0f1f9"},
  amoled:{bg:"#000000",surface:"#0a0a0a",surface2:"#111111",border:"#1c1c1c",text:"#f0f0f0",sub:"#707070",dim:"#404040",accent:"#5b8dee",task:"#f5a348",goal:"#5ecb7c",lock:"#e05c6e",edBg:"#000000",toolbar:"#080808"},
  sepia:{bg:"#f4ede0",surface:"#fdf6e3",surface2:"#ece5d3",border:"#d6cfc0",text:"#3b2f1e",sub:"#7a6a55",dim:"#a89880",accent:"#c07840",task:"#b05030",goal:"#507840",lock:"#a03030",edBg:"#fdf8ef",toolbar:"#ece5d3"},
  midnight:{bg:"#080c18",surface:"#0e1424",surface2:"#141c30",border:"#1e2840",text:"#c8d8f8",sub:"#6880b0",dim:"#3a4868",accent:"#7090f0",task:"#f0a040",goal:"#40c880",lock:"#f05070",edBg:"#0a0e1e",toolbar:"#0c1020"},
  forest:{bg:"#0d150d",surface:"#131f13",surface2:"#182418",border:"#223022",text:"#d0e8d0",sub:"#6a9060",dim:"#3a5838",accent:"#5ab855",task:"#d4a040",goal:"#40c870",lock:"#e05050",edBg:"#0f1a0f",toolbar:"#101a10"},
};
const FONTS=[
  {name:"DM Sans",url:"DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,800"},
  {name:"Inter",url:"Inter:wght@400;600;700"},
  {name:"Roboto",url:"Roboto:wght@400;500;700"},
  {name:"Nunito",url:"Nunito:wght@400;600;700"},
  {name:"Poppins",url:"Poppins:wght@400;500;700"},
  {name:"Space Grotesk",url:"Space+Grotesk:wght@400;500;700"},
  {name:"Merriweather",url:"Merriweather:wght@400;700"},
  {name:"Playfair Display",url:"Playfair+Display:wght@400;700"},
  {name:"Lora",url:"Lora:wght@400;700"},
  {name:"JetBrains Mono",url:"JetBrains+Mono:wght@400;700"},
];
const DEFAULT_SETTINGS={preset:"dark",overrides:{},font:"DM Sans",editorSize:16,lineHeight:1.85,cardRadius:12,density:"normal",homeBg:null,weekStart:0,appLockEnabled:false,pinHash:null,biometricCredentialId:null,notificationsEnabled:false};
function computeTheme(s){const t={...BASE_THEMES[s.preset||"dark"],...(s.overrides||{})};t.accentFg="#ffffff";t.accentFaint=t.accent+"18";t.danger=t.lock;return t;}
const DENSITY_PAD={compact:[10,12],normal:[14,16],spacious:[20,22]};
const EVENT_COLORS=["#5b8dee","#f5a348","#5ecb7c","#e05c6e","#a78bfa","#f472b6","#34d399","#fb923c"];
const TEXT_COLORS=[{l:"Default",v:null},{l:"Red",v:"#ef4444"},{l:"Orange",v:"#f97316"},{l:"Yellow",v:"#eab308"},{l:"Green",v:"#22c55e"},{l:"Blue",v:"#3b82f6"},{l:"Purple",v:"#8b5cf6"},{l:"Pink",v:"#ec4899"},{l:"White",v:"#f8fafc"},{l:"Gray",v:"#94a3b8"},{l:"Black",v:"#0f172a"}];
const HL_COLORS=[{l:"None",v:null},{l:"Yellow",v:"#fef08a"},{l:"Green",v:"#bbf7d0"},{l:"Blue",v:"#bfdbfe"},{l:"Pink",v:"#fecaca"},{l:"Purple",v:"#ddd6fe"},{l:"Orange",v:"#fed7aa"}];
const FONT_SIZES=[{l:"Small",v:"12px"},{l:"Normal",v:"16px"},{l:"Large",v:"22px"},{l:"Huge",v:"32px"}];

// ═══════════════════════════════════════════════════════════════════
// ATOMS
// ═══════════════════════════════════════════════════════════════════
function Toggle({on,toggle,accent,borderColor}){return(<div onClick={toggle} style={{width:40,height:22,borderRadius:11,cursor:"pointer",background:on?accent:borderColor,position:"relative",flexShrink:0,transition:"background 0.18s",userSelect:"none"}}><div style={{position:"absolute",top:2,width:18,height:18,borderRadius:"50%",background:"#fff",left:on?20:2,transition:"left 0.16s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/></div>);}
function IBtn({onClick,icon:Icon,color,size=18,title,onMouseDown,active,badge}){const[h,setH]=useState(false);return(<button onMouseDown={onMouseDown} onClick={onClick} title={title} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{background:(h||active)?"rgba(128,128,128,0.14)":"none",border:"none",borderRadius:7,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:6,transition:"background 0.11s",flexShrink:0,position:"relative"}}><Icon size={size} color={color} strokeWidth={1.8}/>{badge>0&&<div style={{position:"absolute",top:2,right:2,background:"#ef4444",borderRadius:"50%",width:12,height:12,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:7,color:"#fff",fontWeight:800}}>{badge>9?"9+":badge}</span></div>}</button>);}
function Pill({active,label,onClick,t,color}){return <button onClick={onClick} style={{background:active?(color||t.accent):t.surface2,color:active?"#fff":t.sub,border:"none",borderRadius:20,padding:"5px 13px",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.13s",fontFamily:"inherit"}}>{label}</button>;}
function Divider({t}){return <div style={{width:1,height:22,background:t.border,flexShrink:0,margin:"0 2px"}}/>;}
function PriorityPill({priority}){if(!priority||!PRIORITY[priority])return null;const{label,color}=PRIORITY[priority];return <span style={{fontSize:10,fontWeight:700,color,background:color+"22",borderRadius:6,padding:"2px 7px",display:"inline-flex",alignItems:"center",gap:3}}><div style={{width:5,height:5,borderRadius:"50%",background:color,flexShrink:0}}/>{label}</span>;}
function PrioritySelector({value,onChange,t}){return(<div style={{display:"flex",gap:7,flexWrap:"wrap"}}><button onClick={()=>onChange(null)} style={{padding:"6px 13px",borderRadius:8,border:`1.5px solid ${!value?t.accent:t.border}`,background:!value?t.accentFaint:t.surface2,color:!value?t.accent:t.sub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>None</button>{Object.entries(PRIORITY).map(([k,{label,color}])=>(<button key={k} onClick={()=>onChange(k)} style={{padding:"6px 13px",borderRadius:8,border:`1.5px solid ${value===k?color:t.border}`,background:value===k?color+"22":t.surface2,color:value===k?color:t.sub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>))}</div>);}

// ═══════════════════════════════════════════════════════════════════
// WORD GOAL RING
// ═══════════════════════════════════════════════════════════════════
function WordGoalRing({words,goal,accent,border,onClick}){
  const pct=Math.min(1,goal>0?words/goal:0);const R=11;const C=2*Math.PI*R;
  const done=pct>=1;const color=done?"#5ecb7c":accent;
  return(
    <svg width={28} height={28} viewBox="0 0 28 28" onClick={onClick} style={{cursor:"pointer",flexShrink:0}}>
      <circle cx={14} cy={14} r={R} fill="none" stroke={border} strokeWidth={2.5}/>
      <circle cx={14} cy={14} r={R} fill="none" stroke={color} strokeWidth={2.5}
        strokeDasharray={C} strokeDashoffset={C*(1-pct)}
        strokeLinecap="round" transform="rotate(-90 14 14)"
        style={{transition:"stroke-dashoffset 0.4s ease"}}/>
      <text x={14} y={17.5} textAnchor="middle" fontSize={6.5} fill={color} fontWeight={800}>{done?"✓":`${Math.round(pct*100)}%`}</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FORMAT TOOLBAR
// ═══════════════════════════════════════════════════════════════════
function FormatToolbar({editorRef,imgRef,bgRef,bgImg,onBgRemove,isListening,onVoiceToggle,t}){
  const[kbBottom,setKbBottom]=useState(0);
  const[openPop,setOpenPop]=useState(null);
  const[tableHover,setTableHover]=useState({r:0,c:0});
  const savedSel=useRef(null);
  useEffect(()=>{const vv=window.visualViewport;if(!vv)return;const u=()=>setKbBottom(Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop)));vv.addEventListener("resize",u);vv.addEventListener("scroll",u);return()=>{vv.removeEventListener("resize",u);vv.removeEventListener("scroll",u);};},[]);
  const saveSel=()=>{const s=window.getSelection();if(s?.rangeCount)savedSel.current=s.getRangeAt(0).cloneRange();};
  const restoreSel=()=>{const s=window.getSelection();if(savedSel.current&&s){s.removeAllRanges();s.addRange(savedSel.current);}};
  const exec=(cmd,val)=>{restoreSel();editorRef.current?.focus();document.execCommand(cmd,false,val??null);setOpenPop(null);};
  const toggle=key=>{saveSel();setOpenPop(o=>o===key?null:key);};
  const applySize=px=>{restoreSel();editorRef.current?.focus();document.execCommand("fontSize",false,"7");editorRef.current?.querySelectorAll('font[size="7"]').forEach(f=>{const sp=document.createElement("span");sp.style.fontSize=px;sp.innerHTML=f.innerHTML;f.replaceWith(sp);});setOpenPop(null);};
  const Pop=({children,left=8,width=170})=>(<div onMouseDown={e=>e.preventDefault()} style={{position:"absolute",bottom:"calc(100% + 4px)",left,background:t.surface,border:`1px solid ${t.border}`,borderRadius:10,padding:10,zIndex:9999,boxShadow:"0 -4px 22px rgba(0,0,0,0.28)",width}}>{children}</div>);
  const TB=({cmd,icon:Icon,label,popKey,customMD})=>{const[h,setH]=useState(false);return <button title={label} onMouseDown={e=>{e.preventDefault();if(customMD){customMD();return;}if(popKey){toggle(popKey);return;}saveSel();exec(cmd);}} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{background:(h||openPop===popKey)?"rgba(128,128,128,0.16)":"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 7px",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={16} color={t.text} strokeWidth={1.8}/></button>;};
  return(
    <div style={{position:"fixed",left:0,right:0,bottom:kbBottom,background:t.toolbar,borderTop:`1px solid ${t.border}`,zIndex:800,transition:"bottom 0.1s ease-out"}}>
      <div style={{position:"relative"}}>
        {openPop==="size"&&<Pop left={4} width={130}>{FONT_SIZES.map(({l,v})=><button key={v} onMouseDown={e=>{e.preventDefault();applySize(v);}} style={{display:"block",width:"100%",background:"none",border:"none",padding:"8px 14px",textAlign:"left",cursor:"pointer",fontSize:v,color:t.text,fontFamily:"inherit",borderRadius:6}}>{l}</button>)}</Pop>}
        {openPop==="color"&&<Pop left={40} width={178}><p style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:t.dim,margin:"0 0 8px"}}>Text Color</p><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{TEXT_COLORS.map(({l,v})=><button key={l} title={l} onMouseDown={e=>{e.preventDefault();v?exec("foreColor",v):exec("removeFormat");setOpenPop(null);}} style={{width:24,height:24,borderRadius:"50%",background:v??"transparent",border:`2px solid ${v?t.border:t.dim}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>{!v&&<X size={11} color={t.dim} strokeWidth={2.5}/>}</button>)}</div></Pop>}
        {openPop==="hl"&&<Pop left={68} width={158}><p style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:t.dim,margin:"0 0 8px"}}>Highlight</p><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{HL_COLORS.map(({l,v})=><button key={l} title={l} onMouseDown={e=>{e.preventDefault();v?exec("hiliteColor",v):exec("removeFormat");setOpenPop(null);}} style={{width:24,height:24,borderRadius:"50%",background:v??"transparent",border:`2px solid ${v?"rgba(0,0,0,0.12)":t.dim}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>{!v&&<X size={11} color={t.dim} strokeWidth={2.5}/>}</button>)}</div></Pop>}
        {openPop==="align"&&<Pop left={104} width={130}>{[{icon:AlignLeft,cmd:"justifyLeft",l:"Left"},{icon:AlignCenter,cmd:"justifyCenter",l:"Center"},{icon:AlignRight,cmd:"justifyRight",l:"Right"}].map(({icon:Ic,cmd,l})=><button key={cmd} onMouseDown={e=>{e.preventDefault();exec(cmd);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:"none",border:"none",padding:"9px 12px",cursor:"pointer",color:t.text,fontFamily:"inherit",fontSize:13,borderRadius:6}}><Ic size={15} color={t.sub} strokeWidth={1.8}/>{l}</button>)}</Pop>}
        {openPop==="table"&&<Pop left={4} width={172}><p style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color:t.dim,margin:"0 0 9px"}}>Insert Table</p><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3}}>{Array.from({length:25},(_,i)=>{const r=Math.floor(i/5)+1,c=(i%5)+1;const active=r<=tableHover.r&&c<=tableHover.c;return(<div key={i} onMouseEnter={()=>setTableHover({r,c})} onMouseLeave={()=>{}} onMouseDown={e=>{e.preventDefault();restoreSel();editorRef.current?.focus();const rows=Array.from({length:tableHover.r},()=>`<tr>${Array.from({length:tableHover.c},()=>`<td style="border:1.5px solid rgba(128,128,128,0.3);padding:7px 10px;min-width:60px;text-align:left;">&nbsp;</td>`).join("")}</tr>`).join("");document.execCommand("insertHTML",false,`<table style="border-collapse:collapse;margin:12px 0;width:100%;table-layout:fixed;">${rows}</table><br>`);setOpenPop(null);}} style={{width:24,height:24,borderRadius:3,background:active?t.accent+"40":t.surface2,border:`1.5px solid ${active?t.accent:t.border}`,cursor:"pointer",transition:"all 0.08s"}}/> );})}</div>{tableHover.r>0&&<p style={{fontSize:11,color:t.sub,margin:"8px 0 0",textAlign:"center",fontWeight:600}}>{tableHover.r} × {tableHover.c} table</p>}</Pop>}
      </div>
      <div style={{display:"flex",alignItems:"center",overflowX:"auto",overflowY:"visible",padding:"5px 8px",gap:0,WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
        <TB cmd="bold" icon={Bold} label="Bold"/><TB cmd="italic" icon={Italic} label="Italic"/><TB cmd="underline" icon={Underline} label="Underline"/><TB cmd="strikeThrough" icon={Strikethrough} label="Strike"/>
        <Divider t={t}/>
        <button title="Text color" onMouseDown={()=>toggle("color")} style={{background:openPop==="color"?"rgba(128,128,128,0.16)":"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 7px",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span style={{fontSize:12,fontWeight:800,color:t.text,lineHeight:1}}>A</span><div style={{width:16,height:3,borderRadius:2,background:t.accent}}/></button>
        <button title="Highlight" onMouseDown={()=>toggle("hl")} style={{background:openPop==="hl"?"rgba(128,128,128,0.16)":"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 7px",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span style={{fontSize:11,fontWeight:800,color:t.text,lineHeight:1}}>H</span><div style={{width:16,height:3,borderRadius:2,background:"#fef08a"}}/></button>
        <button title="Font size" onMouseDown={()=>toggle("size")} style={{background:openPop==="size"?"rgba(128,128,128,0.16)":"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 7px",display:"flex",alignItems:"center",gap:3}}><Type size={15} color={t.text} strokeWidth={1.8}/><ChevronDown size={9} color={t.dim} strokeWidth={2.5}/></button>
        <Divider t={t}/>
        <button title="Alignment" onMouseDown={()=>toggle("align")} style={{background:openPop==="align"?"rgba(128,128,128,0.16)":"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 7px",display:"flex",alignItems:"center",gap:3}}><AlignLeft size={16} color={t.text} strokeWidth={1.8}/><ChevronDown size={9} color={t.dim} strokeWidth={2.5}/></button>
        <Divider t={t}/>
        <TB cmd="insertUnorderedList" icon={List} label="Bullet list"/><TB cmd="insertOrderedList" icon={ListOrdered} label="Numbered list"/>
        <Divider t={t}/>
        <button title="Checkbox" onMouseDown={e=>{e.preventDefault();editorRef.current?.focus();document.execCommand("insertHTML",false,`<input type="checkbox" style="accent-color:${t.accent};width:15px;height:15px;vertical-align:middle;margin-right:6px;cursor:pointer;"/>&nbsp;`);}} style={{background:"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 7px",display:"flex"}}><CheckSquare size={16} color={t.text} strokeWidth={1.8}/></button>
        <button title="Divider line" onMouseDown={e=>{e.preventDefault();editorRef.current?.focus();document.execCommand("insertHTML",false,"<hr/><br>");}} style={{background:"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 7px",display:"flex"}}><Minus size={16} color={t.text} strokeWidth={1.8}/></button>
        <button title="Insert image" onMouseDown={e=>{e.preventDefault();imgRef.current?.click();}} style={{background:"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 7px",display:"flex"}}><ImageIcon size={16} color={t.text} strokeWidth={1.8}/></button>
        <Divider t={t}/>
        <button title="Set background" onMouseDown={e=>{e.preventDefault();bgRef.current?.click();}} style={{background:"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 7px",display:"flex"}}><Layers size={16} color={bgImg?t.accent:t.text} strokeWidth={1.8}/></button>
        {bgImg&&<button title="Remove bg" onMouseDown={e=>{e.preventDefault();onBgRemove();}} style={{background:"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 5px",display:"flex"}}><X size={12} color={t.danger} strokeWidth={2.2}/></button>}
        <Divider t={t}/>
        <button title="Insert table" onMouseDown={e=>{e.preventDefault();toggle("table");setTableHover({r:0,c:0});}} style={{background:openPop==="table"?"rgba(128,128,128,0.16)":"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 7px",display:"flex"}}><Table size={16} color={t.text} strokeWidth={1.8}/></button>
        <button title={isListening?"Stop listening":"Voice to text"} onMouseDown={e=>{e.preventDefault();onVoiceToggle?.();}} style={{background:isListening?"rgba(239,68,68,0.15)":"none",border:"none",borderRadius:7,cursor:"pointer",flexShrink:0,padding:"6px 7px",display:"flex",position:"relative"}}>{isListening?<MicOff size={16} color="#ef4444" strokeWidth={1.8}/>:<Mic size={16} color={t.text} strokeWidth={1.8}/>}{isListening&&<span style={{position:"absolute",top:3,right:3,width:6,height:6,borderRadius:"50%",background:"#ef4444",animation:"pulse 1.2s ease-in-out infinite"}}/>}</button>
        <div style={{flexShrink:0,width:8}}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NOTE CARD
// ═══════════════════════════════════════════════════════════════════
function NoteCard({note,onOpen,onLongPress,selectMode,isSelected,onToggleSelect,t,s}){
  const[hov,setHov]=useState(false);const pressTimer=useRef(null);
  const plain=note.isEncrypted?"":stripHtml(note.content);
  const rawTitle=note.title?.trim();const title=rawTitle||plain.slice(0,60)||"Untitled";
  const preview=note.isEncrypted?"— Encrypted —":(rawTitle?plain.slice(0,130):plain.slice(title.length).trim().slice(0,130));
  const due=note.taskDueDate||note.timelineDate;
  const[vPad,hPad]=DENSITY_PAD[s.density]||DENSITY_PAD.normal;const radius=s.cardRadius??12;
  const labelDef=note.label?NOTE_LABELS.find(l=>l.id===note.label):null;
  const subtasks=note.subtasks||[];const doneSubs=subtasks.filter(s=>s.done).length;const subPct=subtasks.length?Math.round(doneSubs/subtasks.length*100):0;
  const startPress=()=>{pressTimer.current=setTimeout(()=>onLongPress?.(note.id),500);};const endPress=()=>clearTimeout(pressTimer.current);
  return(
    <div onClick={()=>{if(selectMode)onToggleSelect?.(note.id);else onOpen();}} onTouchStart={startPress} onTouchEnd={endPress} onTouchMove={endPress} onMouseDown={startPress} onMouseUp={endPress} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>{endPress();setHov(false);}}
      style={{background:isSelected?t.accentFaint:hov?t.surface2:t.surface,border:`1px solid ${isSelected?t.accent:hov?t.accent+"60":t.border}`,borderLeft:labelDef?`3px solid ${labelDef.color}`:undefined,borderRadius:radius,padding:`${vPad}px ${hPad}px`,cursor:"pointer",marginBottom:s.density==="compact"?6:10,transition:"all 0.13s",position:"relative",overflow:"hidden",userSelect:"none"}}>
      {note.bgImage&&<div style={{position:"absolute",inset:0,opacity:0.07,pointerEvents:"none",backgroundImage:`url(${note.bgImage})`,backgroundSize:"cover",backgroundPosition:"center"}}/>}
      <div style={{position:"relative"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:4}}>
          {selectMode&&<div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${isSelected?t.accent:t.dim}`,background:isSelected?t.accent:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",marginTop:2}}>{isSelected&&<div style={{width:7,height:7,borderRadius:"50%",background:"#fff"}}/>}</div>}
          <span style={{fontWeight:650,fontSize:14.5,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,display:"flex",alignItems:"center",gap:5}}>{note.isPinned&&<Pin size={10} color={t.accent} strokeWidth={2.5} style={{flexShrink:0}}/>}{title}</span>
          <span style={{fontSize:11,color:t.dim,flexShrink:0,paddingTop:1}}>{relTime(note.updatedAt)}</span>
        </div>
        {preview&&<p style={{fontSize:12.5,color:t.sub,margin:"0 0 8px",lineHeight:1.6,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",fontStyle:note.isEncrypted?"italic":"normal"}}>{preview}</p>}
        {note.isGoal&&note.goalProgress>0&&<div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><div style={{flex:1,height:4,borderRadius:2,background:t.border,overflow:"hidden"}}><div style={{height:"100%",width:`${note.goalProgress}%`,background:t.goal,borderRadius:2}}/></div><span style={{fontSize:10,fontWeight:700,color:t.goal,flexShrink:0}}>{note.goalProgress}%</span></div>}
        {subtasks.length>0&&<div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><div style={{flex:1,height:3,borderRadius:2,background:t.border,overflow:"hidden"}}><div style={{height:"100%",width:`${subPct}%`,background:t.task,borderRadius:2}}/></div><span style={{fontSize:10,fontWeight:700,color:t.task,flexShrink:0}}>{doneSubs}/{subtasks.length}</span></div>}
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {note.priority&&<PriorityPill priority={note.priority}/>}
          {note.isTask&&<span style={{display:"flex",gap:4,alignItems:"center",fontSize:11,color:t.task,fontWeight:600}}><CheckSquare size={11} color={t.task} strokeWidth={2}/>{note.taskStatus==="done"?"Done":note.taskStatus==="in-progress"?"In Progress":"Task"}</span>}
          {note.recurringType&&<span style={{fontSize:10,color:t.accent,background:t.accentFaint,borderRadius:5,padding:"2px 6px",fontWeight:700,display:"flex",alignItems:"center",gap:3}}><RefreshCw size={9} color={t.accent} strokeWidth={2.5}/>{note.recurringType}</span>}
          {note.isGoal&&<span style={{display:"flex",gap:4,alignItems:"center",fontSize:11,color:t.goal,fontWeight:600}}><Target size={11} color={t.goal} strokeWidth={2}/>Goal</span>}
          {note.isEncrypted&&<Lock size={11} color={t.lock} strokeWidth={2}/>}
          {note.reminderDate&&<Bell size={11} color={t.accent} strokeWidth={2}/>}
          {due&&<span style={{fontSize:11,color:t.dim,marginLeft:"auto"}}>{fmtDate(due)}</span>}
        </div>
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════
// PHASE 10: VIEW TRANSITION ANIMATION CSS
// ═══════════════════════════════════════════════════════════════════
function injectAnimCSS(){if(document.getElementById("verso-anim-css"))return;const s=document.createElement("style");s.id="verso-anim-css";s.textContent=`
@keyframes versoFadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes versoSlideUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
@keyframes versoSlideIn{from{opacity:0;transform:translateX(18px);}to{opacity:1;transform:translateX(0);}}
@keyframes versoPop{0%{transform:scale(0.92);opacity:0;}60%{transform:scale(1.03);}100%{transform:scale(1);opacity:1;}}
@keyframes versoCheckPop{0%{transform:scale(0.7) rotate(-8deg);opacity:0;}60%{transform:scale(1.12) rotate(2deg);}100%{transform:scale(1) rotate(0deg);opacity:1;}}
.verso-fade-in{animation:versoFadeIn 0.22s ease both;}
.verso-slide-up{animation:versoSlideUp 0.25s ease both;}
.verso-pop{animation:versoPop 0.22s cubic-bezier(0.34,1.56,0.64,1) both;}
`;document.head.appendChild(s);}

// ═══════════════════════════════════════════════════════════════════
// PHASE 10: FIRST-LAUNCH ONBOARDING
// ═══════════════════════════════════════════════════════════════════
const ONBOARD_SLIDES=[
  {title:"Welcome to Verso",sub:"Your private, beautiful space for notes, tasks, and ideas.",icon:"✦",color:"#5b8dee"},
  {title:"Write Anything",sub:"Rich notes, to-do lists, journal entries, goals — all in one place.",icon:"📝",color:"#8b5cf6"},
  {title:"Stay Organised",sub:"Use folders, labels, and priorities to keep everything tidy.",icon:"📁",color:"#f5a348"},
  {title:"Plan Your Days",sub:"A full calendar with reminders keeps your schedule on track.",icon:"📅",color:"#5ecb7c"},
  {title:"Private by Default",sub:"Encrypt any note with a password. Lock the whole app with a PIN.",icon:"🔒",color:"#e05c6e"},
];
function OnboardingScreen({onDone,t}){
  const[slide,setSlide]=useState(0);const last=slide===ONBOARD_SLIDES.length-1;const sl=ONBOARD_SLIDES[slide];
  return(<div style={{position:"fixed",inset:0,background:t.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"0 0 44px",zIndex:9000,overflow:"hidden"}}>
    {/* Background glow */}
    <div style={{position:"absolute",top:"-10%",left:"50%",transform:"translateX(-50%)",width:340,height:340,borderRadius:"50%",background:sl.color+"18",filter:"blur(60px)",transition:"background 0.4s",pointerEvents:"none"}}/>
    {/* Skip */}
    <div style={{alignSelf:"flex-end",padding:"16px 20px"}}>{!last&&<button onClick={onDone} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:t.dim,fontFamily:"inherit",fontWeight:600}}>Skip</button>}</div>
    {/* Illustration area */}
    <div key={slide} className="verso-pop" style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,padding:"0 40px",textAlign:"center"}}>
      <div style={{fontSize:72,lineHeight:1}}>{sl.icon}</div>
      <div style={{width:64,height:64,borderRadius:20,background:sl.color+"22",display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${sl.color}40`}}>
        <div style={{width:24,height:24,borderRadius:6,background:sl.color}}/>
      </div>
      <div>
        <h2 style={{fontSize:26,fontWeight:800,color:t.text,margin:"0 0 10px",letterSpacing:-0.5}}>{sl.title}</h2>
        <p style={{fontSize:15,color:t.sub,margin:0,lineHeight:1.65}}>{sl.sub}</p>
      </div>
    </div>
    {/* Dots */}
    <div style={{display:"flex",gap:7,marginBottom:28}}>{ONBOARD_SLIDES.map((_,i)=><div key={i} style={{width:i===slide?22:7,height:7,borderRadius:4,background:i===slide?sl.color:t.border,transition:"all 0.25s"}}/>)}</div>
    {/* Button */}
    <div style={{width:"100%",padding:"0 28px"}}>
      <button onClick={()=>{haptic(8);last?onDone():setSlide(s=>s+1);}} style={{width:"100%",background:sl.color,color:"#fff",border:"none",borderRadius:16,padding:"15px 0",fontSize:16,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 8px 28px ${sl.color}50`,transition:"all 0.18s"}} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.02)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>{last?"Get Started →":"Next"}</button>
    </div>
  </div>);}

// ═══════════════════════════════════════════════════════════════════
// PHASE 10: EMPTY STATE ILLUSTRATIONS
// ═══════════════════════════════════════════════════════════════════
function EmptyIllustration({type="notes",t}){
  const illos={
    notes:(<svg width={90} height={90} viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x={18} y={12} width={54} height={66} rx={8} fill={t.surface} stroke={t.border} strokeWidth={2}/><rect x={27} y={26} width={36} height={3} rx={1.5} fill={t.dim} opacity={0.5}/><rect x={27} y={35} width={28} height={3} rx={1.5} fill={t.dim} opacity={0.35}/><rect x={27} y={44} width={32} height={3} rx={1.5} fill={t.dim} opacity={0.25}/><circle cx={68} cy={68} r={14} fill={t.accent}/><line x1={63} y1={68} x2={73} y2={68} stroke="white" strokeWidth={2.5} strokeLinecap="round"/><line x1={68} y1={63} x2={68} y2={73} stroke="white" strokeWidth={2.5} strokeLinecap="round"/></svg>),
    folders:(<svg width={90} height={90} viewBox="0 0 90 90" fill="none"><rect x={12} y={34} width={66} height={44} rx={8} fill={t.surface} stroke={t.border} strokeWidth={2}/><path d="M12 42h66" stroke={t.border} strokeWidth={1.5}/><rect x={12} y={24} width={30} height={12} rx={6} fill={t.surface} stroke={t.border} strokeWidth={2}/><circle cx={45} cy={56} r={10} fill={t.accentFaint} stroke={t.accent} strokeWidth={1.5}/><line x1={41} y1={56} x2={49} y2={56} stroke={t.accent} strokeWidth={2} strokeLinecap="round"/><line x1={45} y1={52} x2={45} y2={60} stroke={t.accent} strokeWidth={2} strokeLinecap="round"/></svg>),
    calendar:(<svg width={90} height={90} viewBox="0 0 90 90" fill="none"><rect x={10} y={18} width={70} height={62} rx={8} fill={t.surface} stroke={t.border} strokeWidth={2}/><rect x={10} y={18} width={70} height={22} rx={8} fill={t.accent} opacity={0.18}/><rect x={10} y={32} width={70} height={8} fill={t.accent} opacity={0.18}/><line x1={10} y1={40} x2={80} y2={40} stroke={t.border} strokeWidth={1.5}/><circle cx={30} cy={14} r={5} fill={t.surface} stroke={t.accent} strokeWidth={2}/><circle cx={60} cy={14} r={5} fill={t.surface} stroke={t.accent} strokeWidth={2}/><circle cx={28} cy={52} r={3} fill={t.dim} opacity={0.3}/><circle cx={44} cy={52} r={3} fill={t.dim} opacity={0.3}/><circle cx={60} cy={52} r={3} fill={t.dim} opacity={0.3}/><circle cx={28} cy={64} r={3} fill={t.dim} opacity={0.3}/><circle cx={44} cy={64} r={3} fill={t.dim} opacity={0.3}/><circle cx={60} cy={64} r={3} fill={t.dim} opacity={0.3}/><circle cx={28} cy={76} r={3} fill={t.dim} opacity={0.3}/><circle cx={44} cy={76} r={3} fill={t.dim} opacity={0.3}/><circle cx={60} cy={76} r={3} fill={t.dim} opacity={0.3}/></svg>),
    trash:(<svg width={90} height={90} viewBox="0 0 90 90" fill="none"><path d="M25 30h40l-4 42H29L25 30z" fill={t.surface} stroke={t.border} strokeWidth={2}/><line x1={18} y1={30} x2={72} y2={30} stroke={t.border} strokeWidth={2} strokeLinecap="round"/><rect x={36} y={20} width={18} height={10} rx={4} fill={t.surface} stroke={t.border} strokeWidth={2}/><line x1={37} y1={44} x2={39} y2={64} stroke={t.dim} strokeWidth={2} strokeLinecap="round" opacity={0.5}/><line x1={45} y1={44} x2={45} y2={64} stroke={t.dim} strokeWidth={2} strokeLinecap="round" opacity={0.5}/><line x1={53} y1={44} x2={51} y2={64} stroke={t.dim} strokeWidth={2} strokeLinecap="round" opacity={0.5}/></svg>),
    search:(<svg width={90} height={90} viewBox="0 0 90 90" fill="none"><circle cx={40} cy={40} r={22} fill={t.surface} stroke={t.border} strokeWidth={2.5}/><line x1={56} y1={56} x2={74} y2={74} stroke={t.border} strokeWidth={3.5} strokeLinecap="round"/><line x1={32} y1={40} x2={48} y2={40} stroke={t.dim} strokeWidth={2} strokeLinecap="round" opacity={0.5}/><line x1={40} y1={32} x2={40} y2={48} stroke={t.dim} strokeWidth={2} strokeLinecap="round" opacity={0.5}/></svg>),
  };
  return illos[type]||illos.notes;
}
function Empty({icon:Icon,msg,t,illoType}){return(<div className="verso-fade-in" style={{textAlign:"center",padding:"60px 20px 40px",color:t.dim,display:"flex",flexDirection:"column",alignItems:"center",gap:14}}><EmptyIllustration type={illoType||"notes"} t={t}/><p style={{fontSize:14,margin:0,lineHeight:1.7,color:t.sub,maxWidth:240}}>{msg}</p></div>);}

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE PICKER / QUICK CAPTURE
// ═══════════════════════════════════════════════════════════════════
function TemplatePicker({onPick,onClose,t}){return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:3000,display:"flex",alignItems:"flex-end"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div style={{background:t.surface,borderRadius:"20px 20px 0 0",width:"100%",padding:"20px 20px 36px",boxShadow:"0 -8px 40px rgba(0,0,0,0.4)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><span style={{fontSize:16,fontWeight:700,color:t.text}}>New Note</span><IBtn onClick={onClose} icon={X} color={t.dim} size={16}/></div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>{TEMPLATES.map(tpl=>(<button key={tpl.id} onClick={()=>onPick(tpl)} style={{background:t.surface2,border:`1px solid ${t.border}`,borderRadius:12,padding:"14px 10px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:8,fontFamily:"inherit",transition:"all 0.13s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.background=t.accentFaint;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.background=t.surface2;}}><tpl.icon size={20} color={t.accent} strokeWidth={1.8}/><span style={{fontSize:12,fontWeight:600,color:t.text,textAlign:"center",lineHeight:1.3}}>{tpl.label}</span></button>))}</div></div></div>);}
function QuickCapture({onSave,onClose,t,s}){const[text,setText]=useState("");const taRef=useRef(null);useEffect(()=>{setTimeout(()=>taRef.current?.focus(),80);},[]);const commit=()=>{if(text.trim()){const n=blankNote();n.content=text.replace(/\n/g,"<br>");onSave(n);}onClose();};return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:3000,display:"flex",alignItems:"flex-end"}} onClick={e=>{if(e.target===e.currentTarget)commit();}}><div style={{background:t.surface,borderRadius:"20px 20px 0 0",width:"100%",padding:"18px 20px 32px",boxShadow:"0 -8px 40px rgba(0,0,0,0.4)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:8}}><Zap size={15} color={t.accent} strokeWidth={2}/><span style={{fontSize:14,fontWeight:700,color:t.text}}>Quick Capture</span></div><div style={{display:"flex",gap:8}}><button onClick={onClose} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,color:t.sub,fontFamily:"inherit"}}>Discard</button><button onClick={commit} style={{background:t.accent,color:"#fff",border:"none",borderRadius:8,padding:"7px 18px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Save</button></div></div><textarea ref={taRef} value={text} onChange={e=>setText(e.target.value)} placeholder="Capture a thought…" rows={5} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==="Enter")commit();}} style={{width:"100%",boxSizing:"border-box",background:t.surface2,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 14px",fontSize:s.editorSize||16,color:t.text,outline:"none",resize:"none",fontFamily:"inherit",lineHeight:s.lineHeight||1.85}}/><p style={{fontSize:11,color:t.dim,margin:"8px 0 0",textAlign:"right"}}>⌘↵ to save</p></div></div>);}

// ═══════════════════════════════════════════════════════════════════
// PHASE 9: APP LOCK SCREEN
// ═══════════════════════════════════════════════════════════════════
function AppLockScreen({onUnlock,settings,t}){
  const[pin,setPin]=useState("");const[err,setErr]=useState("");const[shake,setShake]=useState(false);const[bioAvail,setBioAvail]=useState(false);
  useEffect(()=>{isBiometricAvailable().then(a=>{if(a&&settings.biometricCredentialId)setBioAvail(true);});},[settings.biometricCredentialId]);
  const tryBiometric=async()=>{try{const ok=await verifyBiometric(settings.biometricCredentialId);if(ok)onUnlock();}catch(e){setErr("Biometric failed – use PIN.");}};
  useEffect(()=>{if(bioAvail)tryBiometric();},[bioAvail]); // eslint-disable-line
  const triggerShake=msg=>{setShake(true);setErr(msg);setTimeout(()=>{setShake(false);setPin("");setErr("");},700);};
  const press=d=>{
    if(pin.length>=6)return;const next=pin+d;setPin(next);
    if(next.length>=4){
      if(hashPin(next)===settings.pinHash){setPin("");onUnlock();}
      else if(next.length>=6)triggerShake("Incorrect PIN");
    }
  };
  const del=()=>setPin(p=>p.slice(0,-1));
  const pinLen=Math.max(pin.length,4);
  return(
    <div style={{position:"fixed",inset:0,background:t.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:22,zIndex:9999,userSelect:"none"}}>
      <div style={{padding:16,borderRadius:"50%",background:t.accent+"18"}}><Shield size={40} color={t.accent} strokeWidth={1.4}/></div>
      <div style={{textAlign:"center"}}><p style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 5px"}}>Verso is locked</p><p style={{fontSize:14,color:t.dim,margin:0}}>Enter your PIN to continue</p></div>
      <div style={{display:"flex",gap:14,transition:"transform 0.08s",transform:shake?"translateX(8px)":"none"}}>
        {Array.from({length:pinLen},(_,i)=><div key={i} style={{width:15,height:15,borderRadius:"50%",background:i<pin.length?t.accent:t.border,border:`2px solid ${i<pin.length?t.accent:t.dim}`,transition:"all 0.14s"}}/>)}
      </div>
      {err&&<p style={{color:t.danger,fontSize:13,margin:0,fontWeight:600,minHeight:18}}>{err}</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,72px)",gap:12}}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
          <button key={i} onClick={()=>{if(k==="⌫")del();else if(k!=="")press(String(k));}}
            style={{width:72,height:72,borderRadius:"50%",background:k===""?"transparent":t.surface,border:k===""?"none":`1px solid ${t.border}`,fontSize:k==="⌫"?20:22,fontWeight:600,color:t.text,cursor:k===""?"default":"pointer",fontFamily:"inherit",transition:"background 0.1s",outline:"none"}}
            onMouseEnter={e=>{if(k!=="")e.currentTarget.style.background=t.surface2;}} onMouseLeave={e=>{if(k!=="")e.currentTarget.style.background=t.surface;}}
          >{k}</button>
        ))}
      </div>
      {bioAvail&&<button onClick={tryBiometric} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 20px",cursor:"pointer",fontSize:13,color:t.sub,fontFamily:"inherit",marginTop:4}}><Fingerprint size={18} color={t.sub} strokeWidth={1.8}/>Use Biometric</button>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 9: PIN SETUP MODAL
// ═══════════════════════════════════════════════════════════════════
function PinSetupModal({onDone,onCancel,t}){
  const[step,setStep]=useState("enter");const[pin1,setPin1]=useState("");const[pin2,setPin2]=useState("");const[err,setErr]=useState("");
  const active=step==="enter"?pin1:pin2;const setActive=step==="enter"?setPin1:setPin2;
  const press=d=>{
    if(active.length>=6)return;const next=active+d;setActive(next);
    if(step==="enter"&&next.length>=4)setTimeout(()=>setStep("confirm"),200);
    else if(step==="confirm"&&next.length===pin1.length){
      if(next===pin1){onDone(hashPin(next));}
      else{setErr("PINs don't match");setPin2("");setTimeout(()=>{setStep("enter");setPin1("");setPin2("");setErr("");},900);}
    }
  };
  const del=()=>setActive(p=>p.slice(0,-1));
  const pinLen=Math.max(active.length,4);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:t.surface,borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:340,display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,alignSelf:"flex-start"}}><Key size={18} color={t.accent} strokeWidth={1.8}/><span style={{fontSize:17,fontWeight:750,color:t.text}}>{step==="enter"?"Set PIN":"Confirm PIN"}</span></div>
        <p style={{fontSize:13,color:t.dim,margin:0,textAlign:"center"}}>{step==="enter"?"Choose a 4–6 digit PIN to lock Verso":"Re-enter your PIN to confirm"}</p>
        <div style={{display:"flex",gap:12}}>
          {Array.from({length:pinLen},(_,i)=><div key={i} style={{width:13,height:13,borderRadius:"50%",background:i<active.length?t.accent:t.border,border:`2px solid ${i<active.length?t.accent:t.dim}`,transition:"all 0.12s"}}/>)}
        </div>
        {err&&<p style={{color:t.danger,fontSize:12,margin:0,fontWeight:600}}>{err}</p>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,64px)",gap:10}}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
            <button key={i} onClick={()=>{if(k==="⌫")del();else if(k!=="")press(String(k));}}
              style={{width:64,height:64,borderRadius:"50%",background:k===""?"transparent":t.surface2,border:k===""?"none":`1px solid ${t.border}`,fontSize:k==="⌫"?17:19,fontWeight:600,color:t.text,cursor:k===""?"default":"pointer",fontFamily:"inherit",outline:"none"}}
            >{k}</button>
          ))}
        </div>
        <button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:t.dim,fontFamily:"inherit"}}>Cancel</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 9: EXPORT MENU
// ═══════════════════════════════════════════════════════════════════
function ExportMenu({note,getHtml,onClose,t}){
  const rawTitle=note.title||stripHtml(note.content).slice(0,50)||"note";
  const safeName=rawTitle.replace(/[^a-z0-9\-_ ]/gi,"_").replace(/\s+/g,"_").slice(0,50);
  const doText=()=>{downloadFile((note.title?note.title+"\n\n":"")+stripHtml(note.content),safeName+".txt","text/plain");onClose();};
  const doMd=()=>{downloadFile(`# ${note.title||"Untitled"}\n\n${htmlToMarkdown(note.content)}\n\n---\n*Exported from Verso · ${new Date().toLocaleDateString()}*`,safeName+".md","text/markdown");onClose();};
  const doPdf=()=>{exportToPDF(note.title,getHtml());onClose();};
  const opts=[{icon:FileText,label:"Plain Text",sub:"Simple .txt file",action:doText},{icon:BookOpen,label:"Markdown",sub:"Formatted .md file",action:doMd},{icon:Download,label:"PDF",sub:"Print-ready PDF via browser",action:doPdf}];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:3000,display:"flex",alignItems:"flex-end"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:t.surface,borderRadius:"20px 20px 0 0",width:"100%",padding:"20px 20px 36px",boxShadow:"0 -8px 40px rgba(0,0,0,0.4)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><div style={{display:"flex",alignItems:"center",gap:8}}><Download size={16} color={t.accent} strokeWidth={2}/><span style={{fontSize:16,fontWeight:700,color:t.text}}>Export Note</span></div><IBtn onClick={onClose} icon={X} color={t.dim} size={16}/></div>
        {opts.map(({icon:Icon,label,sub,action})=>(
          <button key={label} onClick={action} style={{width:"100%",display:"flex",alignItems:"center",gap:14,background:t.surface2,border:`1px solid ${t.border}`,borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"all 0.13s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.background=t.accentFaint;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.background=t.surface2;}}>
            <div style={{width:40,height:40,borderRadius:10,background:t.accent+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon size={18} color={t.accent} strokeWidth={1.8}/></div>
            <div><p style={{fontSize:14,fontWeight:650,color:t.text,margin:"0 0 2px"}}>{label}</p><p style={{fontSize:12,color:t.dim,margin:0}}>{sub}</p></div>
            <Download size={14} color={t.dim} strokeWidth={1.8} style={{marginLeft:"auto",flexShrink:0}}/>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FOLDERS VIEW
// ═══════════════════════════════════════════════════════════════════
function FoldersView({folders,notes,onOpenFolder,onCreateFolder,onRenameFolder,onDeleteFolder,t,s}){
  const[creating,setCreating]=useState(false);const[newName,setNewName]=useState("");const[editing,setEditing]=useState(null);const[editName,setEditName]=useState("");const nameRef=useRef(null);
  useEffect(()=>{if(creating)setTimeout(()=>nameRef.current?.focus(),60);},[creating]);
  const submit=()=>{if(newName.trim())onCreateFolder(newName.trim());setNewName("");setCreating(false);};
  const saveRename=()=>{if(editName.trim()&&editing)onRenameFolder(editing,editName.trim());setEditing(null);};
  return(<div style={{flex:1,overflowY:"auto",padding:"12px 20px 110px"}}>
    <button onClick={()=>setCreating(true)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,background:t.surface,border:`1.5px dashed ${t.border}`,borderRadius:s.cardRadius??12,padding:"13px 16px",cursor:"pointer",color:t.sub,fontFamily:"inherit",marginBottom:12,transition:"all 0.13s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.color=t.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.color=t.sub;}}><FolderPlus size={16} strokeWidth={1.8}/><span style={{fontSize:13,fontWeight:600}}>New Folder</span></button>
    {creating&&<div style={{display:"flex",gap:8,marginBottom:12}}><input ref={nameRef} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Folder name…" onKeyDown={e=>{if(e.key==="Enter")submit();if(e.key==="Escape"){setCreating(false);setNewName("");}}} style={{flex:1,background:t.surface2,border:`1px solid ${t.accent}`,borderRadius:8,padding:"9px 12px",fontSize:13.5,color:t.text,outline:"none",fontFamily:"inherit"}}/><button onClick={submit} style={{background:t.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>Add</button><button onClick={()=>{setCreating(false);setNewName("");}} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",cursor:"pointer",color:t.sub,fontFamily:"inherit"}}>✕</button></div>}
    {folders.length===0&&!creating?<Empty icon={Folder} msg="No folders yet. Tap 'New Folder' to get started." illoType="folders" t={t}/>:folders.map(f=>{const count=notes.filter(n=>n.folderId===f.id).length;return(<div key={f.id} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:s.cardRadius??12,padding:"12px 16px",marginBottom:8,cursor:"pointer",transition:"all 0.13s"}} onMouseEnter={e=>{e.currentTarget.style.background=t.surface2;e.currentTarget.style.borderColor=t.accent+"60";}} onMouseLeave={e=>{e.currentTarget.style.background=t.surface;e.currentTarget.style.borderColor=t.border;}}>{editing===f.id?<div style={{display:"flex",gap:8}} onClick={e=>e.stopPropagation()}><input autoFocus value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveRename();if(e.key==="Escape")setEditing(null);}} style={{flex:1,background:t.surface2,border:`1px solid ${t.accent}`,borderRadius:7,padding:"7px 10px",fontSize:13,color:t.text,outline:"none",fontFamily:"inherit"}}/><button onClick={saveRename} style={{background:t.accent,color:"#fff",border:"none",borderRadius:7,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>Save</button><button onClick={()=>setEditing(null)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:7,padding:"7px 10px",cursor:"pointer",color:t.sub,fontFamily:"inherit"}}>✕</button></div>:<div style={{display:"flex",alignItems:"center",gap:12}} onClick={()=>onOpenFolder(f)}><FolderOpen size={20} color={t.accent} strokeWidth={1.7}/><div style={{flex:1,minWidth:0}}><p style={{fontSize:14,fontWeight:650,color:t.text,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</p><p style={{fontSize:11,color:t.dim,margin:0}}>{count} note{count!==1?"s":""}</p></div><div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}><IBtn onClick={()=>{setEditing(f.id);setEditName(f.name);}} icon={Pencil} color={t.sub} size={15} title="Rename"/><IBtn onClick={()=>{if(window.confirm(`Delete "${f.name}"?`))onDeleteFolder(f.id);}} icon={Trash2} color={t.dim} size={15} title="Delete"/></div></div>}</div>);})}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════
// HOME VIEW
// ═══════════════════════════════════════════════════════════════════
const STATUS_SECTS=[{key:"overdue",label:"Overdue",col:"#ef4444"},{key:"today",label:"Today",col:null},{key:"upcoming",label:"Upcoming",col:null},{key:"done",label:"Done",col:null},{key:"nodate",label:"No Date",col:null}];
function HomeView({notes,allNotes,folders,search,setSearch,filter,setFilter,sort,setSort,nav,setNav,onNew,onOpen,onTimeline,onTrash,onSettings,onQuickSave,onBulkDelete,onBulkDuplicate,onBulkPin,onCreateFolder,onRenameFolder,onDeleteFolder,onOpenFolder,trashCount,t,s}){
  const[selectMode,setSelectMode]=useState(false);const[selected,setSelected]=useState(new Set());const[showQC,setShowQC]=useState(false);const[showTpl,setShowTpl]=useState(false);const[showSort,setShowSort]=useState(false);const[labelFilter,setLabelFilter]=useState(null);const[groupView,setGroupView]=useState(false);
  const enterSelect=id=>{setSelectMode(true);setSelected(new Set([id]));};const toggleSel=id=>setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});const exitSelect=()=>{setSelectMode(false);setSelected(new Set());};const selectAll=()=>setSelected(new Set(notes.map(n=>n.id)));
  const displayed=labelFilter?notes.filter(n=>n.label===labelFilter):notes;const sorted=sortNotes(displayed,sort);const pinned=sorted.filter(n=>n.isPinned);const unpinned=sorted.filter(n=>!n.isPinned);
  const sectColor={overdue:"#ef4444",today:t.accent,upcoming:t.task,done:t.goal,nodate:t.dim};
  const statusGroups=groupByStatus(sorted);
  const card=n=><NoteCard key={n.id} note={n} onOpen={()=>onOpen(n)} onLongPress={enterSelect} selectMode={selectMode} isSelected={selected.has(n.id)} onToggleSelect={toggleSel} t={t} s={s}/>;
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",position:"relative",background:s.homeBg?`url(${s.homeBg}) center/cover`:t.bg}}>
      {s.homeBg&&<div style={{position:"absolute",inset:0,background:`${t.bg}cc`,pointerEvents:"none"}}/>}
      <div style={{position:"relative",padding:"18px 18px 12px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"baseline",gap:8}}><span style={{fontSize:23,fontWeight:800,letterSpacing:-0.6,color:t.text}}>Verso</span><span style={{fontSize:12,color:t.dim}}>{allNotes.length} note{allNotes.length!==1?"s":""}</span></div>
          <div style={{display:"flex",gap:2,alignItems:"center"}}>
            {selectMode?<button onClick={selectAll} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:t.accent,fontFamily:"inherit",padding:"4px 8px"}}>All</button>:<><IBtn onClick={onTimeline} icon={Activity} color={t.sub} title="Timeline"/><IBtn onClick={onTrash} icon={Trash2} color={t.sub} title="Trash" badge={trashCount}/><IBtn onClick={onSettings} icon={Cog} color={t.sub} title="Settings"/></>}
          </div>
        </div>
        {!selectMode&&nav==="notes"&&(<>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{position:"relative",flex:1}}><Search size={15} color={t.dim} style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes…" style={{width:"100%",boxSizing:"border-box",background:t.surface,border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 12px 9px 34px",fontSize:13.5,color:t.text,outline:"none",fontFamily:"inherit"}}/></div>
            <button onClick={()=>setGroupView(o=>!o)} title="Group by status" style={{background:t.surface,border:`1px solid ${groupView?t.accent:t.border}`,borderRadius:10,padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",transition:"all 0.13s"}}><ListFilter size={15} color={groupView?t.accent:t.sub} strokeWidth={1.8}/></button>
            <div style={{position:"relative"}}><button onClick={()=>setShowSort(o=>!o)} style={{background:t.surface,border:`1px solid ${showSort?t.accent:t.border}`,borderRadius:10,padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center"}}><SortAsc size={15} color={showSort?t.accent:t.sub} strokeWidth={1.8}/></button>{showSort&&<div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:t.surface,border:`1px solid ${t.border}`,borderRadius:10,zIndex:500,boxShadow:"0 4px 20px rgba(0,0,0,0.25)",width:160,overflow:"hidden"}}>{SORT_OPTIONS.map(o=><button key={o.id} onClick={()=>{setSort(o.id);setShowSort(false);}} style={{width:"100%",background:sort===o.id?t.accentFaint:"none",border:"none",padding:"11px 14px",textAlign:"left",cursor:"pointer",fontSize:13,color:sort===o.id?t.accent:t.text,fontFamily:"inherit",fontWeight:sort===o.id?700:400}}>{o.label}</button>)}</div>}</div>
          </div>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2,alignItems:"center"}}>
            {[["all","All"],["tasks","Tasks"],["goals","Goals"],["encrypted","Encrypted"]].map(([k,l])=><Pill key={k} active={filter===k&&!labelFilter} label={l} onClick={()=>{setFilter(k);setLabelFilter(null);}} t={t}/>)}
            <div style={{width:1,height:18,background:t.border,flexShrink:0,margin:"0 4px"}}/>
            {NOTE_LABELS.map(lb=><button key={lb.id} onClick={()=>setLabelFilter(labelFilter===lb.id?null:lb.id)} title={lb.name} style={{width:20,height:20,borderRadius:"50%",background:lb.color,border:`2.5px solid ${labelFilter===lb.id?"#fff":lb.color+"50"}`,cursor:"pointer",padding:0,flexShrink:0}}/>)}
          </div>
        </>)}
        {selectMode&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:14,fontWeight:600,color:t.text}}>{selected.size} selected</span><button onClick={exitSelect} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:t.sub,fontFamily:"inherit"}}>Cancel</button></div>}
      </div>
      {nav==="notes"&&<div style={{flex:1,overflowY:"auto",padding:"2px 20px 110px",position:"relative"}}>
        {displayed.length===0?<Empty icon={FileText} msg={search||labelFilter?"No notes match your search.":"Tap + to write your first note."} illoType={search||labelFilter?"search":"notes"} t={t}/>:groupView
          ?STATUS_SECTS.map(({key,label})=>{const grp=statusGroups[key];if(!grp||grp.length===0)return null;const color=sectColor[key];return(<div key={key} style={{marginBottom:22}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:9,marginTop:4}}><div style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0}}/><span style={{fontSize:11,fontWeight:700,color,textTransform:"uppercase",letterSpacing:1}}>{label}</span><span style={{fontSize:11,color:t.dim}}>({grp.length})</span></div>{grp.map(card)}</div>);})
          :<>{pinned.length>0&&<><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,marginTop:2}}><Pin size={11} color={t.dim} strokeWidth={2}/><span style={{fontSize:11,fontWeight:700,color:t.dim,textTransform:"uppercase",letterSpacing:0.8}}>Pinned</span></div>{pinned.map(card)}{unpinned.length>0&&<div style={{height:1,background:t.border,margin:"8px 0 14px"}}/>}</>}{unpinned.map(card)}</>}
      </div>}
      {nav==="folders"&&<FoldersView folders={folders} notes={allNotes} onOpenFolder={onOpenFolder} onCreateFolder={onCreateFolder} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} t={t} s={s}/>}
      {!selectMode&&<div style={{position:"absolute",right:20,bottom:76,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10,zIndex:50}}>
        <button onClick={()=>setShowQC(true)} style={{width:42,height:42,borderRadius:"50%",background:t.surface,border:`1.5px solid ${t.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 2px 12px rgba(0,0,0,0.22)`}}><Zap size={17} color={t.accent} strokeWidth={2}/></button>
        <button onClick={()=>setShowTpl(true)} style={{width:52,height:52,borderRadius:"50%",background:t.accent,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 22px ${t.accent}50`,transition:"transform 0.13s"}} onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.08)")} onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}><Plus size={24} color="#fff" strokeWidth={2}/></button>
      </div>}
      {selectMode&&selected.size>0&&<div style={{position:"absolute",bottom:0,left:0,right:0,background:t.surface,borderTop:`1px solid ${t.border}`,padding:"10px 14px",display:"flex",gap:8,zIndex:200}}>
        <button onClick={()=>{onBulkPin([...selected]);exitSelect();}} style={{flex:1,background:t.accentFaint,border:`1px solid ${t.accent}40`,borderRadius:9,padding:"9px 0",cursor:"pointer",fontSize:12,color:t.accent,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontWeight:600}}><Pin size={13} strokeWidth={2}/>Pin</button>
        <button onClick={()=>{onBulkDuplicate([...selected]);exitSelect();}} style={{flex:1,background:t.surface2,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 0",cursor:"pointer",fontSize:12,color:t.sub,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontWeight:600}}><Copy size={13} strokeWidth={2}/>Copy</button>
        <button onClick={()=>{if(window.confirm(`Move ${selected.size} note${selected.size!==1?"s":""} to trash?`)){onBulkDelete([...selected]);exitSelect();}}} style={{flex:1,background:t.danger+"18",border:`1px solid ${t.danger}40`,borderRadius:9,padding:"9px 0",cursor:"pointer",fontSize:12,color:t.danger,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontWeight:600}}><Trash2 size={13} strokeWidth={2}/>Delete</button>
      </div>}
      {showTpl&&<TemplatePicker onPick={tpl=>{setShowTpl(false);onNew(tpl);}} onClose={()=>setShowTpl(false)} t={t}/>}
      {showQC&&<QuickCapture onSave={onQuickSave} onClose={()=>setShowQC(false)} t={t} s={s}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FOLDER DETAIL
// ═══════════════════════════════════════════════════════════════════
function FolderDetailView({folder,notes,onOpen,onBack,onMoveOut,t,s}){
  const[selectMode,setSelectMode]=useState(false);const[selected,setSelected]=useState(new Set());const folderNotes=notes.filter(n=>n.folderId===folder.id);const enterSelect=id=>{setSelectMode(true);setSelected(new Set([id]));};const toggleSel=id=>setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});const exitSelect=()=>{setSelectMode(false);setSelected(new Set());};
  return(<div style={{display:"flex",flexDirection:"column",height:"100%",background:t.bg}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${t.border}`,background:t.surface,flexShrink:0}}><div style={{display:"flex",alignItems:"center",gap:8}}><IBtn onClick={onBack} icon={ArrowLeft} color={t.sub}/><span style={{fontSize:17,fontWeight:750,color:t.text}}>{folder.name}</span><span style={{fontSize:11,color:t.dim}}>{folderNotes.length} note{folderNotes.length!==1?"s":""}</span></div>{selectMode&&<button onClick={exitSelect} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:t.sub,fontFamily:"inherit"}}>Cancel</button>}</div><div style={{flex:1,overflowY:"auto",padding:"12px 20px 30px"}}>{folderNotes.length===0?<Empty icon={FolderOpen} msg="This folder is empty." illoType="folders" t={t}/>:folderNotes.map(n=><NoteCard key={n.id} note={n} onOpen={()=>onOpen(n)} onLongPress={enterSelect} selectMode={selectMode} isSelected={selected.has(n.id)} onToggleSelect={toggleSel} t={t} s={s}/>)}</div>{selectMode&&selected.size>0&&<div style={{background:t.surface,borderTop:`1px solid ${t.border}`,padding:"10px 14px",display:"flex",gap:8}}><button onClick={()=>{onMoveOut([...selected]);exitSelect();}} style={{flex:1,background:t.surface2,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 0",cursor:"pointer",fontSize:12,color:t.sub,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontWeight:600}}><FolderOpen size={13} strokeWidth={2}/>Remove from folder</button></div>}</div>);
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS VIEW  (+weekStart)
// ═══════════════════════════════════════════════════════════════════
function SettingsView({settings,onSave,onBack,onLockNow,t}){
  const[s,setS]=useState(settings);const bgRef=useRef(null);
  const[showPinSetup,setShowPinSetup]=useState(false);const[bioStatus,setBioStatus]=useState("");const[notifStatus,setNotifStatus]=useState("");
  const upd=patch=>setS(p=>({...p,...patch}));const updOv=(k,v)=>setS(p=>({...p,overrides:{...p.overrides,[k]:v}}));
  const themeBase=BASE_THEMES[s.preset]||BASE_THEMES.dark;
  const Sec=({label,children})=>(<div style={{marginBottom:28}}><p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:t.dim,margin:"0 0 14px"}}>{label}</p>{children}</div>);
  const ColorDot=({val,label,onChange})=>{const ref=useRef(null);return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,cursor:"pointer"}} onClick={()=>ref.current?.click()}><div style={{width:38,height:38,borderRadius:10,background:val,border:`2px solid ${t.border}`,position:"relative"}}><input ref={ref} type="color" value={val} onChange={e=>onChange(e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%"}}/></div><span style={{fontSize:10,color:t.dim,whiteSpace:"nowrap"}}>{label}</span></div>);};
  return(<div style={{display:"flex",flexDirection:"column",height:"100%",background:t.bg}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${t.border}`,background:t.surface,flexShrink:0}}><div style={{display:"flex",alignItems:"center",gap:8}}><IBtn onClick={onBack} icon={ArrowLeft} color={t.sub}/><span style={{fontSize:18,fontWeight:750,color:t.text}}>Settings</span></div><button onClick={()=>onSave(s)} style={{background:t.accent,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Save</button></div>
    <div style={{flex:1,overflowY:"auto",padding:"22px 20px 60px"}}>
      <Sec label="Theme Preset"><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{Object.keys(BASE_THEMES).map(key=>{const bt=BASE_THEMES[key];return <button key={key} onClick={()=>upd({preset:key,overrides:{}})} style={{padding:"8px 16px",borderRadius:20,border:`2px solid ${s.preset===key?t.accent:t.border}`,background:bt.surface,color:bt.text,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",textTransform:"capitalize"}}>{key}</button>;})}</div></Sec>
      <Sec label="Custom Colors"><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><ColorDot label="Accent" val={s.overrides?.accent||themeBase.accent} onChange={v=>updOv("accent",v)}/><ColorDot label="Background" val={s.overrides?.bg||themeBase.bg} onChange={v=>updOv("bg",v)}/><ColorDot label="Surface" val={s.overrides?.surface||themeBase.surface} onChange={v=>updOv("surface",v)}/><ColorDot label="Text" val={s.overrides?.text||themeBase.text} onChange={v=>updOv("text",v)}/><ColorDot label="Border" val={s.overrides?.border||themeBase.border} onChange={v=>updOv("border",v)}/><ColorDot label="Task" val={s.overrides?.task||themeBase.task} onChange={v=>updOv("task",v)}/><ColorDot label="Goal" val={s.overrides?.goal||themeBase.goal} onChange={v=>updOv("goal",v)}/></div><button onClick={()=>upd({overrides:{}})} style={{marginTop:14,display:"flex",alignItems:"center",gap:6,background:"none",border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,color:t.sub,fontFamily:"inherit"}}><RotateCcw size={13} color={t.sub} strokeWidth={1.8}/>Reset colors</button></Sec>
      <Sec label="Home Background"><div style={{display:"flex",gap:10,alignItems:"center"}}>{s.homeBg?<div style={{width:60,height:40,borderRadius:8,backgroundImage:`url(${s.homeBg})`,backgroundSize:"cover",border:`1px solid ${t.border}`}}/>:<div style={{width:60,height:40,borderRadius:8,background:t.surface2,border:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}><Layers size={18} color={t.dim} strokeWidth={1.8}/></div>}<button onClick={()=>bgRef.current?.click()} style={{background:t.surface2,border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13,color:t.text,fontFamily:"inherit"}}>{s.homeBg?"Change":"Set Image"}</button>{s.homeBg&&<button onClick={()=>upd({homeBg:null})} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13,color:t.danger,fontFamily:"inherit"}}>Remove</button>}<input ref={bgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>upd({homeBg:ev.target.result});r.readAsDataURL(f);e.target.value="";}}/></div></Sec>
      {/* Phase 7: Week start */}
      <Sec label="Week Starts On"><div style={{display:"flex",gap:8}}>{[{l:"Sunday",v:0},{l:"Monday",v:1}].map(({l,v})=><button key={v} onClick={()=>upd({weekStart:v})} style={{background:s.weekStart===v?t.accent:t.surface2,color:s.weekStart===v?"#fff":t.sub,border:"none",borderRadius:8,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>{l}</button>)}</div></Sec>
      <Sec label="Font"><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{FONTS.map(f=><button key={f.name} onClick={()=>upd({font:f.name})} style={{fontFamily:f.name,background:s.font===f.name?t.accentFaint:t.surface2,border:`1.5px solid ${s.font===f.name?t.accent:t.border}`,borderRadius:8,padding:"8px 14px",cursor:"pointer",color:t.text,fontSize:13}}>{f.name}</button>)}</div></Sec>
      <Sec label="Editor Size"><div style={{display:"flex",gap:8}}>{[{l:"Small",v:13},{l:"Normal",v:16},{l:"Large",v:19},{l:"XL",v:22}].map(({l,v})=><button key={v} onClick={()=>upd({editorSize:v})} style={{background:s.editorSize===v?t.accent:t.surface2,color:s.editorSize===v?"#fff":t.sub,border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{l}</button>)}</div></Sec>
      <Sec label="Line Spacing"><div style={{display:"flex",gap:8}}>{[{l:"Tight",v:1.5},{l:"Normal",v:1.85},{l:"Relaxed",v:2.2}].map(({l,v})=><button key={v} onClick={()=>upd({lineHeight:v})} style={{background:s.lineHeight===v?t.accent:t.surface2,color:s.lineHeight===v?"#fff":t.sub,border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{l}</button>)}</div></Sec>
      <Sec label="Card Shape"><div style={{display:"flex",gap:8}}>{[{l:"Square",v:0},{l:"Slight",v:6},{l:"Rounded",v:12},{l:"Large",v:20},{l:"Pill",v:28}].map(({l,v})=><button key={v} onClick={()=>upd({cardRadius:v})} style={{background:s.cardRadius===v?t.accent:t.surface2,color:s.cardRadius===v?"#fff":t.sub,border:"none",borderRadius:Math.min(v||2,12),padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{l}</button>)}</div></Sec>
      <Sec label="Card Density"><div style={{display:"flex",gap:8}}>{[{l:"Compact",v:"compact"},{l:"Normal",v:"normal"},{l:"Spacious",v:"spacious"}].map(({l,v})=><button key={v} onClick={()=>upd({density:v})} style={{background:s.density===v?t.accent:t.surface2,color:s.density===v?"#fff":t.sub,border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>{l}</button>)}</div></Sec>
      <button onClick={()=>setS(DEFAULT_SETTINGS)} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:`1px solid ${t.danger}30`,borderRadius:10,padding:"12px 18px",cursor:"pointer",fontSize:13,color:t.danger,fontFamily:"inherit",width:"100%"}}><RotateCcw size={15} color={t.danger} strokeWidth={1.8}/>Reset all to defaults</button>

      {/* ── Security ── */}
      <Sec label="Security & Lock">
        <div style={{background:t.surface2,borderRadius:12,overflow:"hidden",border:`1px solid ${t.border}`}}>
          {/* App Lock Row */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",borderBottom:`1px solid ${t.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:8,background:t.accent+"18",display:"flex",alignItems:"center",justifyContent:"center"}}><Shield size={15} color={t.accent} strokeWidth={1.8}/></div><div><p style={{fontSize:13.5,fontWeight:600,color:t.text,margin:0}}>App Lock</p><p style={{fontSize:11,color:t.dim,margin:0}}>{s.pinHash?"PIN set":"No PIN configured"}</p></div></div>
            <Toggle on={s.appLockEnabled&&!!s.pinHash} toggle={()=>{if(!s.pinHash){setShowPinSetup(true);}else{upd({appLockEnabled:!s.appLockEnabled});}}} accent={t.accent} borderColor={t.border}/>
          </div>
          {/* Set / Change PIN */}
          <button onClick={()=>setShowPinSetup(true)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,background:"none",border:"none",padding:"12px 16px",cursor:"pointer",fontFamily:"inherit",borderBottom:`1px solid ${t.border}`,textAlign:"left"}}>
            <div style={{width:32,height:32,borderRadius:8,background:t.surface,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${t.border}`}}><Key size={15} color={t.sub} strokeWidth={1.8}/></div>
            <div><p style={{fontSize:13.5,fontWeight:600,color:t.text,margin:0}}>{s.pinHash?"Change PIN":"Set up PIN"}</p><p style={{fontSize:11,color:t.dim,margin:0}}>4–6 digit numeric code</p></div>
            <ChevronRight size={14} color={t.dim} strokeWidth={1.8} style={{marginLeft:"auto"}}/>
          </button>
          {/* Remove PIN */}
          {s.pinHash&&<button onClick={()=>{if(window.confirm("Remove PIN? App lock will be disabled."))upd({pinHash:null,appLockEnabled:false,biometricCredentialId:null});}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,background:"none",border:"none",padding:"12px 16px",cursor:"pointer",fontFamily:"inherit",borderBottom:`1px solid ${t.border}`,textAlign:"left"}}>
            <div style={{width:32,height:32,borderRadius:8,background:t.danger+"18",display:"flex",alignItems:"center",justifyContent:"center"}}><Lock size={15} color={t.danger} strokeWidth={1.8}/></div>
            <span style={{fontSize:13.5,color:t.danger,fontWeight:600}}>Remove PIN</span>
          </button>}
          {/* Biometric */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:8,background:t.surface,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${t.border}`}}><Fingerprint size={15} color={t.sub} strokeWidth={1.8}/></div><div><p style={{fontSize:13.5,fontWeight:600,color:t.text,margin:0}}>Biometric Unlock</p><p style={{fontSize:11,color:t.dim,margin:0}}>{bioStatus||"Face ID / Fingerprint"}</p></div></div>
            <Toggle on={!!s.biometricCredentialId} toggle={async()=>{
              if(s.biometricCredentialId){upd({biometricCredentialId:null});setBioStatus("Disabled");return;}
              if(!s.pinHash){setBioStatus("Set a PIN first");return;}
              try{setBioStatus("Registering…");const id=await registerBiometric();if(id){upd({biometricCredentialId:id});setBioStatus("Enabled ✓");}else setBioStatus("Failed");}
              catch(e){setBioStatus("Not supported or cancelled");}
            }} accent={t.accent} borderColor={t.border}/>
          </div>
        </div>
        {s.appLockEnabled&&s.pinHash&&<button onClick={()=>{onSave(s);onLockNow();}} style={{marginTop:10,display:"flex",alignItems:"center",gap:8,background:t.danger+"18",border:`1px solid ${t.danger}30`,borderRadius:10,padding:"11px 18px",cursor:"pointer",fontSize:13,color:t.danger,fontFamily:"inherit",width:"100%",fontWeight:600}}><Shield size={14} color={t.danger} strokeWidth={2}/>Lock Now</button>}
      </Sec>
      <Sec label="Notifications">
        <div style={{background:t.surface2,borderRadius:12,overflow:"hidden",border:`1px solid ${t.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:8,background:t.accent+"18",display:"flex",alignItems:"center",justifyContent:"center"}}><Bell size={15} color={t.accent} strokeWidth={1.8}/></div><div><p style={{fontSize:13.5,fontWeight:600,color:t.text,margin:0}}>Reminder Notifications</p><p style={{fontSize:11,color:t.dim,margin:0}}>{window.Capacitor?.isNativePlatform?.()?"Android / iOS push permission":!("Notification" in window)?"Not supported by browser":Notification.permission==="granted"?"Allowed":Notification.permission==="denied"?"Blocked in browser":notifStatus||"Enable for note reminders"}</p></div></div>
            <Toggle on={s.notificationsEnabled} toggle={async()=>{
              if(s.notificationsEnabled){upd({notificationsEnabled:false});setNotifStatus("Disabled");return;}
              const ok=await requestNotifPermission();if(ok){upd({notificationsEnabled:true});setNotifStatus("Enabled ✓");}else{setNotifStatus("Permission denied");}
            }} accent={t.accent} borderColor={t.border}/>
          </div>
        </div>
        {s.notificationsEnabled&&<p style={{fontSize:11,color:t.dim,margin:"8px 0 0",lineHeight:1.55}}>{window.Capacitor?.isNativePlatform?.()?"Notifications will appear in your Android/iOS notification tray.":"Reminders will notify you while Verso is open. For background notifications, pin the Verso tab."}</p>}
      </Sec>

      {showPinSetup&&<PinSetupModal onDone={hash=>{upd({pinHash:hash,appLockEnabled:true});setShowPinSetup(false);}} onCancel={()=>setShowPinSetup(false)} t={t}/>}
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 7: CLOCK + TIME LINE
// ═══════════════════════════════════════════════════════════════════
function MiniClock({color}){
  const[now,setNow]=useState(new Date());
  useEffect(()=>{const i=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(i);},[]);
  return <span style={{fontSize:12,color,fontWeight:700,fontVariantNumeric:"tabular-nums",letterSpacing:0.3}}>{now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>;
}
function CurrentTimeLine({HOUR_H,DAY_START,DAY_END,color="#ef4444"}){
  const[now,setNow]=useState(new Date());
  useEffect(()=>{const i=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(i);},[]);
  const h=now.getHours(),m=now.getMinutes();
  if(h<DAY_START||h>=DAY_END)return null;
  const top=(h-DAY_START+m/60)*HOUR_H;
  return(<div style={{position:"absolute",top,left:0,right:0,zIndex:20,pointerEvents:"none"}}><div style={{height:2,background:color,position:"relative"}}><div style={{width:8,height:8,borderRadius:"50%",background:color,position:"absolute",left:-1,top:-3}}/></div></div>);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 7: CALENDAR MANAGER
// ═══════════════════════════════════════════════════════════════════
function CalendarManager({calendarDefs,onUpdate,onClose,t}){
  const[defs,setDefs]=useState(calendarDefs);const[newName,setNewName]=useState("");const[newColor,setNewColor]=useState("#5b8dee");const[editingId,setEditingId]=useState(null);const[editName,setEditName]=useState("");
  const BUILT_IN=["personal","work","health","social","study"];
  const save=()=>onUpdate(defs);
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:3000,display:"flex",alignItems:"flex-end"}} onClick={e=>{if(e.target===e.currentTarget){save();onClose();}}}>
    <div style={{background:t.surface,borderRadius:"20px 20px 0 0",width:"100%",padding:"20px 20px 36px",maxHeight:"75vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(0,0,0,0.4)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontSize:16,fontWeight:700,color:t.text}}>Manage Calendars</span><IBtn onClick={()=>{save();onClose();}} icon={X} color={t.dim} size={16}/></div>
      <div style={{flex:1,overflowY:"auto",marginBottom:14}}>
        {defs.map((cal,i)=>(
          <div key={cal.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 4px",borderBottom:`1px solid ${t.border+"60"}`}}>
            <div style={{width:16,height:16,borderRadius:"50%",background:cal.color,flexShrink:0}}/>
            {editingId===cal.id?<><input autoFocus value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setDefs(d=>d.map((c,j)=>j===i?{...c,name:editName.trim()||c.name}:c));setEditingId(null);}if(e.key==="Escape")setEditingId(null);}} style={{flex:1,background:t.surface2,border:`1px solid ${t.accent}`,borderRadius:7,padding:"5px 10px",fontSize:13,color:t.text,outline:"none",fontFamily:"inherit"}}/><button onClick={()=>{setDefs(d=>d.map((c,j)=>j===i?{...c,name:editName.trim()||c.name}:c));setEditingId(null);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>✓</button></>:<><span style={{flex:1,fontSize:14,color:t.text,fontWeight:500}}>{cal.name}{BUILT_IN.includes(cal.id)&&<span style={{fontSize:10,color:t.dim,marginLeft:6}}>built-in</span>}</span><IBtn onClick={()=>{setEditingId(cal.id);setEditName(cal.name);}} icon={Pencil} color={t.sub} size={14} title="Rename"/>{!BUILT_IN.includes(cal.id)&&<IBtn onClick={()=>setDefs(d=>d.filter((_,j)=>j!==i))} icon={Trash2} color={t.dim} size={14} title="Delete"/>}</>}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newName.trim()){setDefs(d=>[...d,{id:uid(),name:newName.trim(),color:newColor}]);setNewName("");}}} placeholder="New calendar name…" style={{flex:1,background:t.surface2,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:t.text,outline:"none",fontFamily:"inherit"}}/>
        <div style={{position:"relative",width:40,height:40,flexShrink:0}}><div style={{width:40,height:40,borderRadius:8,background:newColor,border:`2px solid ${t.border}`,cursor:"pointer"}}/><input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%",borderRadius:8}}/></div>
        <button onClick={()=>{if(newName.trim()){setDefs(d=>[...d,{id:uid(),name:newName.trim(),color:newColor}]);setNewName("");}}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px 14px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>Add</button>
      </div>
      <button onClick={()=>{save();onClose();}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:12,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>Done</button>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 7: EVENT EDITOR  (+calendar, recurring)
// ═══════════════════════════════════════════════════════════════════
function EventEditor({ev,notes,calendarDefs,onSave,onDelete,onClose,t}){
  const[e,setE]=useState(ev);const upd=p=>setE(x=>({...x,...p}));
  const inp={background:t.surface2,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",fontSize:13.5,color:t.text,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit"};
  const calColor=calendarDefs.find(c=>c.id===e.calendarId)?.color||t.accent;
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:2000,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={ex=>{if(ex.target===ex.currentTarget)onClose();}}>
    <div style={{background:t.surface,borderRadius:"18px 18px 0 0",width:"100%",maxWidth:600,maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:"50%",background:calColor}}/><span style={{fontSize:16,fontWeight:700,color:t.text}}>Event</span></div>
        <div style={{display:"flex",gap:6}}>{ev.id&&ev.title&&<button onClick={()=>onDelete(e.id)} style={{background:t.danger+"18",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,color:t.danger,fontFamily:"inherit",fontWeight:600}}>Delete</button>}<button onClick={()=>onSave(e)} style={{background:t.accent,border:"none",borderRadius:8,padding:"7px 18px",cursor:"pointer",fontSize:13,color:"#fff",fontFamily:"inherit",fontWeight:700}}>Save</button></div>
      </div>
      <div style={{overflowY:"auto",padding:"16px 20px 28px",display:"flex",flexDirection:"column",gap:12}}>
        <input value={e.title} onChange={x=>upd({title:x.target.value})} placeholder="Event title" style={{...inp,fontSize:16,fontWeight:600}}/>
        {/* Calendar selector */}
        <div><p style={{fontSize:11,color:t.dim,margin:"0 0 7px",fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>Calendar</p><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{calendarDefs.map(cal=><button key={cal.id} onClick={()=>upd({calendarId:cal.id,color:cal.color})} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,border:`2px solid ${e.calendarId===cal.id?cal.color:t.border}`,background:e.calendarId===cal.id?cal.color+"22":t.surface2,cursor:"pointer",fontFamily:"inherit"}}><div style={{width:8,height:8,borderRadius:"50%",background:cal.color}}/><span style={{fontSize:12,fontWeight:600,color:e.calendarId===cal.id?cal.color:t.sub}}>{cal.name}</span></button>)}</div></div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontSize:12,color:t.sub}}>All day</span><Toggle on={e.allDay} toggle={()=>upd({allDay:!e.allDay})} accent={t.accent} borderColor={t.border}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div><p style={{fontSize:11,color:t.dim,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:.6}}>Date</p><input type="date" value={e.date} onChange={x=>upd({date:x.target.value})} style={inp}/></div>
          {!e.allDay&&<><div><p style={{fontSize:11,color:t.dim,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:.6}}>Start</p><input type="time" value={e.startTime} onChange={x=>upd({startTime:x.target.value})} style={inp}/></div><div><p style={{fontSize:11,color:t.dim,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:.6}}>End</p><input type="time" value={e.endTime} onChange={x=>upd({endTime:x.target.value})} style={inp}/></div></>}
        </div>
        {/* Recurring */}
        <div><p style={{fontSize:11,color:t.dim,margin:"0 0 7px",fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>Repeat</p><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:e.recurringType?8:0}}>{RECUR_EVENT_OPTIONS.map(({id,label})=><button key={String(id)} onClick={()=>upd({recurringType:id})} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${e.recurringType===id?t.accent:t.border}`,background:e.recurringType===id?t.accentFaint:t.surface2,color:e.recurringType===id?t.accent:t.sub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>{id&&<RefreshCw size={10} strokeWidth={2.5}/>}{label}</button>)}</div>{e.recurringType&&<div style={{marginTop:8}}><p style={{fontSize:11,color:t.dim,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:.6}}>End Date (optional)</p><input type="date" value={e.recurringEnd||""} onChange={x=>upd({recurringEnd:x.target.value})} style={inp}/></div>}</div>
        <div><p style={{fontSize:11,color:t.dim,margin:"0 0 8px",fontWeight:600,textTransform:"uppercase",letterSpacing:.6}}>Priority</p><PrioritySelector value={e.priority} onChange={v=>upd({priority:v})} t={t}/></div>
        <div><p style={{fontSize:11,color:t.dim,margin:"0 0 8px",fontWeight:600,textTransform:"uppercase",letterSpacing:.6}}>Color</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{EVENT_COLORS.map(c=><button key={c} onClick={()=>upd({color:c})} style={{width:28,height:28,borderRadius:"50%",background:c,border:`3px solid ${e.color===c?t.text:"transparent"}`,cursor:"pointer",padding:0}}/>)}</div></div>
        <div><p style={{fontSize:11,color:t.dim,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:.6}}>Description</p><textarea value={e.description} onChange={x=>upd({description:x.target.value})} placeholder="Add details…" rows={3} style={{...inp,resize:"vertical",lineHeight:1.7}}/></div>
        <div><p style={{fontSize:11,color:t.dim,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:.6}}>Link to Note</p><select value={e.linkedNoteId||""} onChange={x=>upd({linkedNoteId:x.target.value||null})} style={{...inp,cursor:"pointer"}}><option value="">None</option>{notes.map(n=><option key={n.id} value={n.id}>{n.title||stripHtml(n.content).slice(0,40)||"Untitled"}</option>)}</select></div>
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 7: CALENDAR VIEW  (full upgrade)
// ═══════════════════════════════════════════════════════════════════
const HOUR_H=56,DAY_START=6,DAY_END=22;
const HOURS=Array.from({length:DAY_END-DAY_START},(_,i)=>i+DAY_START);
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW_SHORT=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function timeToY(hhmm){if(!hhmm)return 0;const[h,m]=hhmm.split(":").map(Number);return(h-DAY_START+m/60)*HOUR_H;}
function minutesDiff(s,e){const[sh,sm]=s.split(":").map(Number);const[eh,em]=e.split(":").map(Number);return(eh*60+em)-(sh*60+sm);}
function fmtHour(h){return h===12?"12p":h<12?`${h}a`:`${h-12}p`;}

function CalendarView({events,notes,calendarDefs,onSaveEvent,onDeleteEvent,onBack,t,s}){
  const today=new Date();const todayStr=toDateStr(today);
  const weekStart=s.weekStart??0;
  const[view,setView]=useState("month");const[year,setYear]=useState(today.getFullYear());const[month,setMonth]=useState(today.getMonth());const[selDay,setSelDay]=useState(todayStr);const[editing,setEditing]=useState(null);const[dayPopup,setDayPopup]=useState(null);
  // Phase 7:
  const[visibleCals,setVisibleCals]=useState(()=>new Set(calendarDefs.map(c=>c.id)));
  const[showManage,setShowManage]=useState(false);
  const[dragPreview,setDragPreview]=useState(null);
  const dragInfo=useRef(null);
  const weekGridRef=useRef(null);const weekScrollRef=useRef(null);const dayGridRef=useRef(null);const dayScrollRef=useRef(null);

  const weekDays=useMemo(()=>getWeekDays(selDay,weekStart),[selDay,weekStart]);
  const weekDaysRef=useRef(weekDays);useEffect(()=>{weekDaysRef.current=weekDays;},[weekDays]);
  const viewRef=useRef(view);useEffect(()=>{viewRef.current=view;},[view]);

  // eventsOn: respects recurrence + calendar visibility
  const eventsOn=useCallback(d=>events.filter(e=>eventOccursOnDate(e,d)&&visibleCals.has(e.calendarId??"personal")),[events,visibleCals]);

  const prevMonth=()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);};
  const nextMonth=()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);};
  const selDate=new Date(selDay+"T00:00");
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstDowOffset=(new Date(year,month,1).getDay()-weekStart+7)%7;
  const dowLabels=Array.from({length:7},(_,i)=>DOW_SHORT[(i+weekStart)%7]);

  const openNew=(date="")=>setEditing(blankEvent(date||selDay));
  const openEdit=ev=>setEditing({...ev});
  const saveEv=ev=>{if(!ev.title.trim())return;onSaveEvent(ev);setEditing(null);};
  const delEv=id=>{onDeleteEvent(id);setEditing(null);};
  const btnStyle=active=>({padding:"7px 16px",borderRadius:20,border:`1px solid ${active?t.accent:t.border}`,background:active?t.accentFaint:"none",color:active?t.accent:t.sub,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"});

  // ── Drag to reschedule ────────────────────────────────────────
  const startEventDrag=useCallback((e,ev,dayStr)=>{
    if(e.button!==undefined&&e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    const rect=e.currentTarget.getBoundingClientRect();
    const clickY=(e.touches?e.touches[0].clientY:e.clientY)-rect.top;
    const dur=minutesDiff(ev.startTime,ev.endTime);
    dragInfo.current={ev,dur,offsetY:Math.max(0,clickY),origDate:dayStr,preview:null};
    setDragPreview({evId:ev.id,date:dayStr,startTime:ev.startTime,endTime:ev.endTime});
  },[]);

  useEffect(()=>{
    if(!dragPreview)return;
    const handleMove=e=>{
      const info=dragInfo.current;if(!info)return;
      const clientX=e.touches?e.touches[0].clientX:e.clientX;
      const clientY=e.touches?e.touches[0].clientY:e.clientY;
      if(viewRef.current==="day"&&dayGridRef.current&&dayScrollRef.current){
        const rect=dayGridRef.current.getBoundingClientRect();
        const scrollTop=dayScrollRef.current.scrollTop;
        const y=clientY-rect.top+scrollTop-info.offsetY;
        const newStart=yToTime(y,HOUR_H,DAY_START,DAY_END);
        const newEnd=addMinutes(newStart,info.dur);
        const next={evId:info.ev.id,date:info.origDate,startTime:newStart,endTime:newEnd};
        dragInfo.current.preview=next;setDragPreview(next);
      } else if(viewRef.current==="week"&&weekGridRef.current&&weekScrollRef.current){
        const rect=weekGridRef.current.getBoundingClientRect();
        const scrollTop=weekScrollRef.current.scrollTop;
        const x=clientX-rect.left-48;
        const colW=(rect.width-48)/7;
        const col=Math.max(0,Math.min(6,Math.floor(x/colW)));
        const y=clientY-rect.top+scrollTop-info.offsetY;
        const newStart=yToTime(y,HOUR_H,DAY_START,DAY_END);
        const newEnd=addMinutes(newStart,info.dur);
        const newDate=toDateStr(weekDaysRef.current[col]);
        const next={evId:info.ev.id,date:newDate,startTime:newStart,endTime:newEnd};
        dragInfo.current.preview=next;setDragPreview(next);
      }
    };
    const handleUp=()=>{
      const info=dragInfo.current;
      if(info?.preview){
        const{ev}=info;const p=info.preview;
        if(p.date!==ev.date||p.startTime!==ev.startTime)onSaveEvent({...ev,date:p.date,startTime:p.startTime,endTime:p.endTime});
      }
      dragInfo.current=null;setDragPreview(null);
    };
    document.addEventListener("mousemove",handleMove);document.addEventListener("mouseup",handleUp);
    document.addEventListener("touchmove",handleMove,{passive:false});document.addEventListener("touchend",handleUp);
    return()=>{document.removeEventListener("mousemove",handleMove);document.removeEventListener("mouseup",handleUp);document.removeEventListener("touchmove",handleMove);document.removeEventListener("touchend",handleUp);};
  },[dragPreview,onSaveEvent]);

  // ── Event block renderer ──────────────────────────────────────
  const EventBlock=({ev,ds,isGhost=false,isPreview=false,top,height})=>{
    const calDef=calendarDefs.find(c=>c.id===(ev.calendarId??"personal"));
    const calColor=calDef?.color||t.accent;
    // Priority overrides color if set
    const priColor=ev.priority==="high"?"#ef4444":ev.priority==="mid"?"#eab308":ev.priority==="low"?"#22c55e":null;
    const color=priColor||ev.color||calColor;
    const isShort=height<=36;
    return(<div
      onMouseDown={isGhost?undefined:e=>startEventDrag(e,ev,ds)}
      onTouchStart={isGhost?undefined:e=>startEventDrag(e,ev,ds)}
      onClick={e=>{if(!isGhost){e.stopPropagation();haptic(8);openEdit(ev);}}}
      style={{position:"absolute",top:top+1,left:3,right:3,height:height-2,
        background:isPreview?color+"33":color+"22",
        borderLeft:`3.5px solid ${color}`,
        borderRadius:"0 6px 6px 0",
        cursor:isGhost?"default":isPreview?"grabbing":"grab",
        overflow:"hidden",zIndex:isPreview?30:10,
        boxShadow:isPreview?`0 4px 20px ${color}50`:`0 1px 4px ${color}20`,
        opacity:isGhost?0.3:1,
        outline:isPreview?`2px solid ${color}`:isGhost?"none":`1px solid ${color}40`,
        userSelect:"none",transition:isPreview?"none":"box-shadow 0.1s",
        display:"flex",flexDirection:"column",justifyContent:"center",padding:"2px 7px"}}>
      {!isShort&&<p style={{fontSize:10.5,color:color,margin:"0 0 1px",fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.startTime}–{ev.endTime}</p>}
      <p style={{fontSize:isShort?10:11.5,fontWeight:700,color:t.text,margin:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",opacity:isGhost?0.6:1}}>{isShort?`${ev.startTime} ${ev.title||"Event"}`:ev.title||"Event"}</p>
      {!isShort&&ev.description&&height>52&&<p style={{fontSize:10,color:t.sub,margin:"2px 0 0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.description}</p>}
      {/* Resize handles */}
      {!isGhost&&!isPreview&&<><div style={{position:"absolute",top:3,right:4,width:6,height:6,borderRadius:"50%",background:color,opacity:0.7}}/><div style={{position:"absolute",bottom:3,left:4,width:6,height:6,borderRadius:"50%",background:color,opacity:0.7}}/></>}
    </div>);
  };

  // ── Render events for a day column (week/day view) ────────────
  const renderDayEvents=(ds)=>{
    const dayEvs=eventsOn(ds).filter(ev=>!ev.allDay);
    const isDragSource=ev=>dragPreview?.evId===ev.id;
    const isPreviewHere=dragPreview?.date===ds;
    const previewEv=dragPreview?events.find(e=>e.id===dragPreview.evId):null;
    return(<>
      {dayEvs.map(ev=>{
        const top=timeToY(ev.startTime);const dur=minutesDiff(ev.startTime,ev.endTime);const ht=Math.max((dur/60)*HOUR_H,22);
        return <EventBlock key={ev.id} ev={ev} ds={ds} isGhost={isDragSource(ev)} top={top} height={ht}/>;
      })}
      {isPreviewHere&&previewEv&&<EventBlock ev={previewEv} ds={ds} isPreview top={timeToY(dragPreview.startTime)} height={Math.max((minutesDiff(dragPreview.startTime,dragPreview.endTime)/60)*HOUR_H,22)}/>}
    </>);
  };

  const calFilterBar=(
    <div style={{display:"flex",gap:6,overflowX:"auto",padding:"8px 16px 0",scrollbarWidth:"none",alignItems:"center"}}>
      {calendarDefs.map(cal=>{
        const on=visibleCals.has(cal.id);
        return(<button key={cal.id} onClick={()=>setVisibleCals(prev=>{const n=new Set(prev);n.has(cal.id)?n.delete(cal.id):n.add(cal.id);return n;})} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:16,border:`1.5px solid ${on?cal.color:t.border}`,background:on?cal.color+"22":"transparent",cursor:"pointer",fontFamily:"inherit",transition:"all 0.13s",flexShrink:0}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:on?cal.color:t.dim}}/>
          <span style={{fontSize:11,fontWeight:600,color:on?cal.color:t.dim}}>{cal.name}</span>
        </button>);
      })}
    </div>
  );

  return(<div style={{display:"flex",flexDirection:"column",height:"100%",background:t.bg}}>
    {/* Header */}
    <div style={{padding:"10px 16px 0",borderBottom:`1px solid ${t.border}`,background:t.surface,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <IBtn onClick={onBack} icon={ArrowLeft} color={t.sub}/>
        <span style={{fontSize:18,fontWeight:750,color:t.text,flex:1}}>Calendar</span>
        {/* Phase 7: mini clock */}
        <MiniClock color={t.dim}/>
        <button onClick={()=>{setSelDay(todayStr);setYear(today.getFullYear());setMonth(today.getMonth());}} style={{...btnStyle(false),fontSize:11,marginLeft:4}}>Today</button>
        <IBtn onClick={()=>setShowManage(true)} icon={Palette} color={t.sub} title="Manage calendars"/>
        <button onClick={()=>openNew()} style={{background:t.accent,border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontFamily:"inherit",color:"#fff",fontSize:12,fontWeight:700}}><Plus size={14} color="#fff" strokeWidth={2.5}/>Event</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        <button style={btnStyle(view==="month")} onClick={()=>setView("month")}>Month</button>
        <button style={btnStyle(view==="week")} onClick={()=>setView("week")}>Week</button>
        <button style={btnStyle(view==="day")} onClick={()=>setView("day")}>Day</button>
      </div>
      {calFilterBar}
    </div>

    {/* MONTH VIEW */}
    {view==="month"&&<div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px 8px"}}>
        <IBtn onClick={prevMonth} icon={ChevronLeft} color={t.sub}/>
        <span style={{fontWeight:700,fontSize:16,color:t.text}}>{MONTHS[month]} {year}</span>
        <IBtn onClick={nextMonth} icon={ChevronRight} color={t.sub}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 10px 4px",gap:2}}>
        {dowLabels.map(d=><div key={d} style={{textAlign:"center",fontSize:11,color:t.dim,fontWeight:700,padding:"4px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 10px 16px",gap:2}}>
        {Array(firstDowOffset).fill(null).map((_,i)=><div key={"e"+i}/>)}
        {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
          const ds=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const evs=eventsOn(ds);const isToday=ds===todayStr;const isSel=ds===selDay;
          return(<div key={d} onClick={()=>{setSelDay(ds);setDayPopup(ds);}} style={{minHeight:56,padding:"4px 4px 2px",borderRadius:8,cursor:"pointer",background:isSel?t.accentFaint:isToday?t.accent+"14":"transparent",border:`1px solid ${isSel?t.accent:isToday?t.accent+"40":t.border+"60"}`,transition:"background 0.1s"}}>
            <div style={{fontSize:13,fontWeight:isToday||isSel?700:400,color:isToday?t.accent:t.text,textAlign:"center",marginBottom:2}}>{d}</div>
            <div style={{display:"flex",flexDirection:"column",gap:1}}>
              {evs.slice(0,2).map(e=>{const calDef=calendarDefs.find(x=>x.id===(e.calendarId??"personal"));const priColor=e.priority==="high"?"#ef4444":e.priority==="mid"?"#eab308":e.priority==="low"?"#22c55e":null;const c=priColor||e.color||calDef?.color||t.accent;return<div key={e.id} onClick={ev2=>{ev2.stopPropagation();haptic(8);setEditing({...e});}} style={{background:c+"1a",borderLeft:`2.5px solid ${c}`,borderRadius:"0 3px 3px 0",padding:"1.5px 4px",fontSize:9.5,color:c,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:2,cursor:"pointer"}}>{e.recurringType&&<RefreshCw size={7} strokeWidth={2.5} color={c}/>}{e.title||"Event"}</div>;})}
              {evs.length>2&&<div style={{fontSize:9,color:t.dim,paddingLeft:4}}>+{evs.length-2}</div>}
            </div>
          </div>);
        })}
      </div>
    </div>}

    {/* WEEK VIEW */}
    {view==="week"&&<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 16px",borderBottom:`1px solid ${t.border}`,flexShrink:0}}>
        <IBtn onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()-7);setSelDay(toDateStr(d));}} icon={ChevronLeft} color={t.sub}/>
        <span style={{fontWeight:600,fontSize:13,color:t.text}}>{weekDays[0].toLocaleDateString([],{month:"short",day:"numeric"})} – {weekDays[6].toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})}</span>
        <IBtn onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()+7);setSelDay(toDateStr(d));}} icon={ChevronRight} color={t.sub}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:`48px repeat(7,1fr)`,borderBottom:`1px solid ${t.border}`,flexShrink:0,background:t.surface}}>
        <div/>
        {weekDays.map(d=>{const ds=toDateStr(d);const isToday=ds===todayStr;return(<div key={ds} onClick={()=>{setSelDay(ds);setView("day");}} style={{textAlign:"center",padding:"8px 2px",cursor:"pointer",borderLeft:`1px solid ${t.border}`}}>
          <div style={{fontSize:10,color:t.dim,fontWeight:700}}>{DOW_SHORT[d.getDay()]}</div>
          <div style={{fontSize:16,fontWeight:700,color:isToday?t.accent:t.text,width:26,height:26,borderRadius:"50%",background:isToday?t.accentFaint:"transparent",display:"flex",alignItems:"center",justifyContent:"center",margin:"2px auto 0"}}>{d.getDate()}</div>
        </div>);})}
      </div>
      <div ref={weekScrollRef} style={{flex:1,overflowY:"auto"}}>
        <div ref={weekGridRef} style={{display:"grid",gridTemplateColumns:`48px repeat(7,1fr)`,position:"relative"}}>
          <div>{HOURS.map(h=><div key={h} style={{height:HOUR_H,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingRight:8,paddingTop:4,boxSizing:"border-box"}}><span style={{fontSize:10,color:t.dim,fontWeight:600}}>{fmtHour(h)}</span></div>)}</div>
          {weekDays.map(d=>{const ds=toDateStr(d);const isToday=ds===todayStr;return(<div key={ds} style={{position:"relative",borderLeft:`1px solid ${t.border}`,background:isToday?t.accent+"05":"transparent"}}>
            {HOURS.map(h=><div key={h} onClick={()=>{const ne=blankEvent(ds);ne.startTime=`${String(h).padStart(2,"0")}:00`;ne.endTime=`${String(h+1).padStart(2,"0")}:00`;setEditing(ne);}} style={{height:HOUR_H,borderTop:`1px solid ${t.border}30`,cursor:"pointer",boxSizing:"border-box"}}/>)}
            {isToday&&<CurrentTimeLine HOUR_H={HOUR_H} DAY_START={DAY_START} DAY_END={DAY_END} color="#ef4444"/>}
            {renderDayEvents(ds)}
          </div>);})}
        </div>
      </div>
    </div>}

    {/* DAY VIEW */}
    {view==="day"&&<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 16px",borderBottom:`1px solid ${t.border}`,flexShrink:0}}>
        <IBtn onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()-1);setSelDay(toDateStr(d));}} icon={ChevronLeft} color={t.sub}/>
        <span style={{fontWeight:700,fontSize:14,color:t.text}}>{fmtDay(selDay)}</span>
        <IBtn onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()+1);setSelDay(toDateStr(d));}} icon={ChevronRight} color={t.sub}/>
      </div>
      <div ref={dayScrollRef} style={{flex:1,overflowY:"auto"}}>
        <div ref={dayGridRef} style={{display:"grid",gridTemplateColumns:"48px 1fr",position:"relative"}}>
          <div>{HOURS.map(h=><div key={h} style={{height:HOUR_H,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingRight:8,paddingTop:4,boxSizing:"border-box"}}><span style={{fontSize:10,color:t.dim,fontWeight:600}}>{fmtHour(h)}</span></div>)}</div>
          <div style={{position:"relative",borderLeft:`1px solid ${t.border}`}}>
            {HOURS.map(h=><div key={h} onClick={()=>{const ne=blankEvent(selDay);ne.startTime=`${String(h).padStart(2,"0")}:00`;ne.endTime=`${String(h+1).padStart(2,"0")}:00`;setEditing(ne);}} style={{height:HOUR_H,borderTop:`1px solid ${t.border}30`,cursor:"pointer",boxSizing:"border-box"}}/>)}
            <CurrentTimeLine HOUR_H={HOUR_H} DAY_START={DAY_START} DAY_END={DAY_END} color="#ef4444"/>
            {renderDayEvents(selDay)}
          </div>
        </div>
      </div>
    </div>}

    {/* Day popup */}
    {dayPopup&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1500,display:"flex",alignItems:"flex-end"}} onClick={e=>{if(e.target===e.currentTarget)setDayPopup(null);}}>
      <div style={{background:t.surface,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,margin:"0 auto",padding:"18px 20px 32px",boxShadow:"0 -8px 40px rgba(0,0,0,0.35)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span style={{fontSize:15,fontWeight:700,color:t.text}}>{fmtDay(dayPopup)}</span>
          <div style={{display:"flex",gap:8}}><button onClick={()=>{setSelDay(dayPopup);setView("day");setDayPopup(null);}} style={{background:t.surface2,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 13px",cursor:"pointer",fontSize:12,color:t.sub,fontFamily:"inherit"}}>View Day</button><IBtn onClick={()=>setDayPopup(null)} icon={X} color={t.dim} size={16}/></div>
        </div>
        {eventsOn(dayPopup).length===0?<p style={{color:t.dim,fontSize:13,margin:"0 0 14px"}}>No events.</p>:<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14,maxHeight:240,overflowY:"auto"}}>
          {eventsOn(dayPopup).sort((a,b)=>a.startTime.localeCompare(b.startTime)).map(ev=>{const calColor=calendarDefs.find(c=>c.id===(ev.calendarId??"personal"))?.color||ev.color||t.accent;return(<div key={ev.id+dayPopup} onClick={()=>{openEdit(ev);setDayPopup(null);}} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:10,background:t.surface2,cursor:"pointer",borderLeft:`3px solid ${calColor}`}}>
            <div style={{flex:1,minWidth:0}}><p style={{fontWeight:600,fontSize:13,color:t.text,margin:"0 0 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}}>{ev.recurringType&&<RefreshCw size={10} color={calColor} strokeWidth={2.5}/>}{ev.title||"Untitled"}</p><p style={{fontSize:11,color:t.dim,margin:0,display:"flex",alignItems:"center",gap:5}}><Clock size={10} color={t.dim} strokeWidth={2}/>{ev.allDay?"All day":`${ev.startTime} – ${ev.endTime}`}{ev.priority&&<PriorityPill priority={ev.priority}/>}</p></div>
          </div>);})}
        </div>}
        <button onClick={()=>{openNew(dayPopup);setDayPopup(null);}} style={{width:"100%",background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"11px 0",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}><Plus size={16} color="#fff" strokeWidth={2.5}/>Add Event</button>
      </div>
    </div>}

    {editing&&<EventEditor ev={editing} notes={notes} calendarDefs={calendarDefs} onSave={saveEv} onDelete={delEv} onClose={()=>setEditing(null)} t={t}/>}
    {showManage&&<CalendarManager calendarDefs={calendarDefs} onUpdate={updated=>{/* handled by parent */}} onClose={()=>setShowManage(false)} t={t}/>}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════
// UPGRADE BLOCKS (note editor)
// ═══════════════════════════════════════════════════════════════════
function UpBlock({icon:Icon,label,icolor,on,onToggle,t,children}){return(<div style={{borderRadius:10,border:`1px solid ${on?icolor+"45":t.border}`,overflow:"hidden",transition:"border-color 0.18s"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",background:on?icolor+"08":"transparent"}}><div style={{display:"flex",alignItems:"center",gap:9}}><Icon size={15} color={on?icolor:t.sub} strokeWidth={1.8}/><span style={{fontSize:13.5,fontWeight:550,color:on?t.text:t.sub}}>{label}</span></div><Toggle on={on} toggle={onToggle} accent={icolor} borderColor={t.border}/></div>{on&&children&&<div style={{padding:"12px 14px 14px",display:"flex",flexDirection:"column",gap:10,borderTop:`1px solid ${t.border}`}}>{children}</div>}</div>);}
function UpField({label,color,children}){return <div style={{display:"flex",flexDirection:"column",gap:5}}><span style={{fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,color,opacity:0.65}}>{label}</span>{children}</div>;}

// ═══════════════════════════════════════════════════════════════════
// NOTE EDITOR
// ═══════════════════════════════════════════════════════════════════
function NoteEditor({note,onSave,onBack,onDelete,onDuplicate,folders,t,s}){
  const editorRef=useRef(null),imgRef=useRef(null),bgRef=useRef(null),saveTimer=useRef(null);
  const[title,setTitle]=useState(note.title||"");const[saved,setSaved]=useState(true);const[panelOpen,setPanelOpen]=useState(false);const[isEmpty,setIsEmpty]=useState(!note.content);const[wordInfo,setWordInfo]=useState({words:0,chars:0});
  const[isPinned,setIsPinned]=useState(note.isPinned||false);const[priority,setPriority]=useState(note.priority||null);const[label,setLabel]=useState(note.label||null);const[folderId,setFolderId]=useState(note.folderId||null);const[showLabelPop,setShowLabelPop]=useState(false);
  const[isTask,setIsTask]=useState(note.isTask);const[taskDue,setTaskDue]=useState(note.taskDueDate||"");const[taskSt,setTaskSt]=useState(note.taskStatus||"pending");const[isGoal,setIsGoal]=useState(note.isGoal);const[isTL,setIsTL]=useState(note.isTimeline);const[tlDate,setTlDate]=useState(note.timelineDate||"");
  const[isEnc,setIsEnc]=useState(note.isEncrypted);const[encPass,setEncPass]=useState("");const[encConf,setEncConf]=useState("");const[showPw,setShowPw]=useState(false);const[encErr,setEncErr]=useState("");
  const[remDate,setRemDate]=useState(note.reminderDate||"");const[remTime,setRemTime]=useState(note.reminderTime||"");const[isRem,setIsRem]=useState(!!(note.reminderDate));const[bgImg,setBgImg]=useState(note.bgImage||null);
  const[unlocked,setUnlocked]=useState(!note.isEncrypted);const[sessionPw,setSessionPw]=useState("");const[unlockIn,setUnlockIn]=useState("");const[unlockErr,setUnlockErr]=useState("");
  const[subtasks,setSubtasks]=useState(note.subtasks||[]);const[goalProg,setGoalProg]=useState(note.goalProgress||0);const[recurType,setRecurType]=useState(note.recurringType||null);
  // ── Phase 8 ───────────────────────────────────────────────────────
  const[focusMode,setFocusMode]=useState(false);
  const[wordGoal,setWordGoal]=useState(note.wordGoal||0);const[showGoalPop,setShowGoalPop]=useState(false);const[goalDraft,setGoalDraft]=useState(String(note.wordGoal||0));
  const[isListening,setIsListening]=useState(false);const recognitionRef=useRef(null);
  // ── Phase 9 ───────────────────────────────────────────────────────
  const[showExport,setShowExport]=useState(false);

  useEffect(()=>{if(document.getElementById("verso-ed-css"))return;const sty=document.createElement("style");sty.id="verso-ed-css";sty.textContent=`.draft-ed{outline:none;word-break:break-word;}.draft-ed ul{list-style-type:disc!important;padding-left:26px!important;margin:4px 0!important;}.draft-ed ol{list-style-type:decimal!important;padding-left:26px!important;margin:4px 0!important;}.draft-ed li{display:list-item!important;list-style-position:outside!important;margin:3px 0!important;line-height:1.85!important;}.draft-ed ul ul{list-style-type:circle!important;}.draft-ed img{max-width:100%;border-radius:10px;display:block;margin:8px 0;}.draft-ed hr{border:none;border-top:1.5px solid rgba(128,128,128,0.25);margin:18px 0;}.draft-ed::-webkit-scrollbar{display:none;}.draft-ed table{border-collapse:collapse;margin:12px 0;width:100%;}.draft-ed td,.draft-ed th{border:1.5px solid rgba(128,128,128,0.3);padding:7px 10px;min-width:60px;vertical-align:top;}.draft-ed input[type="checkbox"]{appearance:none;-webkit-appearance:none;width:20px;height:20px;border-radius:6px;border:2px solid var(--verso-accent,#5b8dee);cursor:pointer;vertical-align:middle;margin-right:7px;background:transparent;transition:background 0.18s,border-color 0.18s,box-shadow 0.18s;position:relative;display:inline-block;flex-shrink:0;}.draft-ed input[type="checkbox"]:checked{background:var(--verso-accent,#5b8dee);border-color:var(--verso-accent,#5b8dee);box-shadow:0 2px 10px var(--verso-accent-shadow,rgba(91,141,238,0.45));animation:versoCheckPop 0.22s cubic-bezier(0.34,1.56,0.64,1);}.draft-ed input[type="checkbox"]:checked::after{content:"";position:absolute;left:4px;top:1px;width:7px;height:11px;border:2.5px solid #fff;border-top:none;border-left:none;transform:rotate(45deg);}@keyframes versoCheckPop{0%{transform:scale(0.7);opacity:0.4;}60%{transform:scale(1.15);}100%{transform:scale(1);opacity:1;}}@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}`;document.head.appendChild(sty);},[]);
  // Phase 10: dynamic checkbox accent CSS var
  useEffect(()=>{let sty=document.getElementById("verso-cb-css");if(!sty){sty=document.createElement("style");sty.id="verso-cb-css";document.head.appendChild(sty);}sty.textContent=`.draft-ed{--verso-accent:${t.accent};--verso-accent-shadow:${t.accent}70;}`;},[t.accent]);
  useEffect(()=>{if(editorRef.current&&unlocked){const html=plainToHtml(note.isEncrypted?"":(note.content||""));editorRef.current.innerHTML=html;updateStats(html);}},[]); // eslint-disable-line

  const updateStats=useCallback(html=>{const plain=stripHtml(html??editorRef.current?.innerHTML??"");const words=plain.trim()?plain.trim().split(/\s+/).filter(Boolean).length:0;setWordInfo({words,chars:plain.length});setIsEmpty(!plain.trim());},[]);
  const getHtml=useCallback(()=>{const ed=editorRef.current;if(!ed)return "";ed.querySelectorAll('input[type="checkbox"]').forEach(cb=>{cb.checked?cb.setAttribute("checked",""):cb.removeAttribute("checked");});return ed.innerHTML;},[]);
  const buildNote=useCallback(()=>({...note,title,content:isEnc?"":getHtml(),updatedAt:Date.now(),isTask,taskDueDate:taskDue,taskStatus:taskSt,isGoal,isTimeline:isTL,timelineDate:tlDate,isEncrypted:isEnc,encryptedContent:isEnc&&sessionPw?(encryptContent(getHtml(),sessionPw)??note.encryptedContent):(note.encryptedContent||""),passwordHash:note.passwordHash||"",reminderDate:isRem?remDate:"",reminderTime:isRem?remTime:"",bgImage:bgImg,isPinned,priority,label,folderId,subtasks,goalProgress:goalProg,recurringType:recurType,wordGoal}),[note,title,getHtml,isTask,taskDue,taskSt,isGoal,isTL,tlDate,isEnc,sessionPw,isRem,remDate,remTime,bgImg,isPinned,priority,label,folderId,subtasks,goalProg,recurType,wordGoal]);
  const doSave=useCallback(()=>{onSave(buildNote());setSaved(true);},[onSave,buildNote]);
  const schedSave=useCallback(html=>{setSaved(false);updateStats(html);clearTimeout(saveTimer.current);saveTimer.current=setTimeout(doSave,1100);},[doSave,updateStats]);
  useEffect(()=>()=>clearTimeout(saveTimer.current),[]);
  useEffect(()=>{const h=e=>{if((e.metaKey||e.ctrlKey)&&e.key==="s"){e.preventDefault();doSave();}if(e.key==="Escape"&&focusMode)setFocusMode(false);};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[doSave,focusMode]);
  const toggleVoice=useCallback(()=>{if(isListening){recognitionRef.current?.stop();setIsListening(false);return;}const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert("Voice input isn't supported in this browser. Try Chrome or Edge.");return;}const rec=new SR();rec.continuous=true;rec.interimResults=false;rec.lang="en-US";rec.onresult=e=>{const txt=Array.from(e.results).slice(e.resultIndex).map(r=>r[0].transcript).join(" ");editorRef.current?.focus();document.execCommand("insertText",false,txt+" ");schedSave(editorRef.current?.innerHTML);};rec.onerror=()=>setIsListening(false);rec.onend=()=>setIsListening(false);rec.start();recognitionRef.current=rec;setIsListening(true);},[isListening,schedSave]);
  useEffect(()=>()=>{recognitionRef.current?.stop();},[]);

  const handleUnlock=()=>{if(!note.encryptedContent){setUnlocked(true);return;}if(hashPass(unlockIn)!==note.passwordHash){setUnlockErr("Incorrect password.");return;}const dec=decryptContent(note.encryptedContent,unlockIn);if(!dec){setUnlockErr("Decryption failed.");return;}if(editorRef.current){editorRef.current.innerHTML=plainToHtml(dec);updateStats(editorRef.current.innerHTML);}setSessionPw(unlockIn);setUnlocked(true);};
  const applyEncryption=()=>{if(!encPass){setEncErr("Enter a password.");return;}if(encPass!==encConf){setEncErr("Passwords do not match.");return;}onSave({...buildNote(),content:"",encryptedContent:encryptContent(getHtml(),encPass),passwordHash:hashPass(encPass),isEncrypted:true,updatedAt:Date.now()});setIsEnc(true);setSessionPw(encPass);setEncErr("");setSaved(true);};
  const handleImg=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{editorRef.current?.focus();document.execCommand("insertHTML",false,`<img src="${ev.target.result}" alt=""/><br>`);schedSave(editorRef.current?.innerHTML);};r.readAsDataURL(f);e.target.value="";};
  const handleBg=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{setBgImg(ev.target.result);setSaved(false);clearTimeout(saveTimer.current);saveTimer.current=setTimeout(doSave,800);};r.readAsDataURL(f);e.target.value="";};

  const labelDef=label?NOTE_LABELS.find(l=>l.id===label):null;
  const doneSubs=subtasks.filter(x=>x.done).length;
  const upgBadge=[isTask&&"Task",isTask&&subtasks.length>0&&`${doneSubs}/${subtasks.length}`,isTask&&recurType&&`↻${recurType}`,isGoal&&"Goal",isGoal&&goalProg>0&&`${goalProg}%`,isTL&&"Timeline",isEnc&&"Encrypted",isRem&&"Reminder",priority&&PRIORITY[priority]?.label].filter(Boolean);
  const inp={background:t.surface2,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 12px",fontSize:13.5,color:t.text,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit"};
  const sep=<div style={{width:1,height:18,background:t.border,margin:"0 1px"}}/>;

  if(!unlocked)return(<div style={{display:"flex",flexDirection:"column",height:"100%"}}><div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:`1px solid ${t.border}`,background:t.surface,flexShrink:0}}><IBtn onClick={onBack} icon={ArrowLeft} color={t.sub}/><span style={{fontWeight:650,fontSize:15,color:t.text}}>Locked Note</span></div><div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:32}}><div style={{padding:18,borderRadius:"50%",background:t.lock+"18"}}><Lock size={36} color={t.lock} strokeWidth={1.5}/></div><p style={{color:t.sub,textAlign:"center",margin:0,fontSize:14,lineHeight:1.65}}>This note is encrypted.<br/>Enter your password.</p><input type="password" value={unlockIn} autoFocus onChange={e=>setUnlockIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleUnlock()} placeholder="Password" style={{...inp,maxWidth:280,textAlign:"center",fontSize:15}}/>{unlockErr&&<p style={{color:t.danger,fontSize:12,margin:0}}>{unlockErr}</p>}<button onClick={handleUnlock} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"11px 30px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Unlock</button></div></div>);

  return(<div style={{display:"flex",flexDirection:"column",height:"100%",background:t.edBg,...(focusMode?{position:"fixed",inset:0,zIndex:1500}:{})}}>
    <input ref={imgRef} type="file" accept="image/*" onChange={handleImg} style={{display:"none"}}/>
    <input ref={bgRef} type="file" accept="image/*" onChange={handleBg} style={{display:"none"}}/>
    {/* ── Normal header ─────────────────────────────────────────── */}
    {!focusMode&&<div style={{display:"flex",alignItems:"center",gap:2,padding:"7px 10px",borderBottom:`1px solid ${t.border}`,flexShrink:0,background:t.surface}}>
      <IBtn onClick={()=>{doSave();onBack();}} icon={ArrowLeft} color={t.sub} title="Back"/>
      {sep}
      <IBtn icon={Undo2} color={t.sub} title="Undo" onMouseDown={e=>{e.preventDefault();document.execCommand("undo");}}/>
      <IBtn icon={Redo2} color={t.sub} title="Redo" onMouseDown={e=>{e.preventDefault();document.execCommand("redo");}}/>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,position:"relative"}}>
        <WordGoalRing words={wordInfo.words} goal={wordGoal} accent={t.accent} border={t.border} onClick={()=>{setGoalDraft(String(wordGoal));setShowGoalPop(o=>!o);}}/>
        <span onClick={()=>{setGoalDraft(String(wordGoal));setShowGoalPop(o=>!o);}} style={{fontSize:11,color:saved?t.dim:t.accent,fontWeight:saved?400:600,cursor:"pointer",userSelect:"none"}}>{saved?`${wordInfo.words} words${wordGoal>0?` / ${wordGoal} goal`:" · "+wordInfo.chars+" chars"}`:"saving…"}</span>
        {showGoalPop&&<div onMouseDown={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 14px",zIndex:700,boxShadow:`0 6px 28px rgba(0,0,0,0.32)`,width:200,display:"flex",flexDirection:"column",gap:8}}>
          <p style={{fontSize:11,fontWeight:700,color:t.dim,margin:0,textTransform:"uppercase",letterSpacing:0.6}}>Word goal</p>
          <div style={{display:"flex",gap:6}}><input type="number" min={0} max={100000} value={goalDraft} onChange={e=>setGoalDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){const v=Math.max(0,parseInt(goalDraft)||0);setWordGoal(v);setSaved(false);setShowGoalPop(false);}if(e.key==="Escape")setShowGoalPop(false);}} autoFocus placeholder="e.g. 500" style={{flex:1,background:t.surface2,border:`1px solid ${t.border}`,borderRadius:7,padding:"7px 10px",fontSize:13,color:t.text,outline:"none",fontFamily:"inherit"}}/><button onClick={()=>{const v=Math.max(0,parseInt(goalDraft)||0);setWordGoal(v);setSaved(false);setShowGoalPop(false);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:7,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>Set</button></div>
          {wordGoal>0&&<button onClick={()=>{setWordGoal(0);setSaved(false);setShowGoalPop(false);}} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:11,color:t.dim,fontFamily:"inherit"}}>Remove goal</button>}
        </div>}
      </div>
      <div style={{position:"relative"}}>
        <IBtn onClick={()=>setShowLabelPop(o=>!o)} icon={Tag} color={labelDef?labelDef.color:t.dim} title="Label" active={!!label}/>
        {showLabelPop&&<div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:t.surface,border:`1px solid ${t.border}`,borderRadius:10,padding:10,zIndex:600,boxShadow:"0 4px 20px rgba(0,0,0,0.28)",display:"flex",gap:7,flexWrap:"wrap",width:190}}><button onClick={()=>{setLabel(null);setShowLabelPop(false);setSaved(false);}} style={{width:24,height:24,borderRadius:"50%",background:"transparent",border:`2px solid ${t.dim}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}><X size={10} color={t.dim} strokeWidth={2.5}/></button>{NOTE_LABELS.map(lb=><button key={lb.id} onClick={()=>{setLabel(lb.id);setShowLabelPop(false);setSaved(false);}} title={lb.name} style={{width:24,height:24,borderRadius:"50%",background:lb.color,border:`2.5px solid ${label===lb.id?"#fff":lb.color+"40"}`,cursor:"pointer",padding:0}}/>)}</div>}
      </div>
      <IBtn onClick={()=>{const next=!isPinned;setIsPinned(next);setSaved(false);clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>{onSave({...buildNote(),isPinned:next});setSaved(true);},400);}} icon={isPinned?PinOff:Pin} color={isPinned?t.accent:t.dim} title={isPinned?"Unpin":"Pin"}/>
      <IBtn onClick={()=>onDuplicate(buildNote())} icon={Copy} color={t.dim} title="Duplicate"/>
      {sep}
      <IBtn onClick={doSave} icon={Save} color={saved?t.dim:t.accent} title="Save"/>
      {sep}
      <IBtn onClick={()=>setFocusMode(true)} icon={Maximize2} color={t.dim} title="Focus mode"/>
      {sep}
      <IBtn onClick={()=>setShowExport(true)} icon={Download} color={t.dim} title="Export note"/>
      {sep}
      <IBtn onClick={()=>{if(window.confirm("Move to trash?"))onDelete(note.id);}} icon={Trash2} color={t.dim} title="Delete"/>
    </div>}
    {/* ── Focus mode minimal header ──────────────────────────────── */}
    {focusMode&&<div style={{position:"absolute",top:0,left:0,right:0,zIndex:10,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:`${t.surface}d0`,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderBottom:`1px solid ${t.border}50`}}>
      <IBtn onClick={()=>{doSave();onBack();}} icon={ArrowLeft} color={t.sub} title="Back"/>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <WordGoalRing words={wordInfo.words} goal={wordGoal} accent={t.accent} border={t.border} onClick={()=>{setGoalDraft(String(wordGoal));setShowGoalPop(o=>!o);}}/>
        <span style={{fontSize:12,color:t.dim,fontWeight:600}}>{wordInfo.words} words{wordGoal>0?` / ${wordGoal} goal`:""}</span>
      </div>
      <IBtn onClick={()=>setFocusMode(false)} icon={Minimize2} color={t.accent} title="Exit focus (Esc)"/>
    </div>}
    {labelDef&&<div style={{height:3,background:labelDef.color,flexShrink:0}}/>}
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",paddingBottom:56,position:"relative",...(focusMode?{paddingTop:52}:{})}}>
      {bgImg&&<div style={{position:"absolute",inset:0,pointerEvents:"none",backgroundImage:`url(${bgImg})`,backgroundSize:"cover",backgroundPosition:"center",opacity:0.09}}/>}
      <div style={{position:"relative",flex:1,display:"flex",flexDirection:"column"}}>
        <input type="text" value={title} placeholder="Title" onChange={e=>{setTitle(e.target.value);schedSave(editorRef.current?.innerHTML);}} style={{background:"transparent",border:"none",outline:"none",padding:"22px 22px 2px",fontSize:24,fontWeight:750,color:t.text,fontFamily:"inherit",width:"100%",boxSizing:"border-box"}}/>
        <div style={{padding:"0 22px 12px",fontSize:11.5,color:t.dim,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <span>Created {fmtFull(note.createdAt)}</span>
          {note.updatedAt>note.createdAt+2000&&<><span style={{opacity:.35}}>·</span><span>Edited {relTime(note.updatedAt)}</span></>}
          {priority&&<><span style={{opacity:.35}}>·</span><PriorityPill priority={priority}/></>}
          {labelDef&&<><span style={{opacity:.35}}>·</span><span style={{fontSize:10,fontWeight:700,color:labelDef.color}}>{labelDef.name}</span></>}
        </div>
        <div style={{position:"relative",flex:1}}>
          {isEmpty&&<div style={{position:"absolute",top:0,left:22,pointerEvents:"none",fontSize:s.editorSize||16,color:t.dim,lineHeight:s.lineHeight||1.85,userSelect:"none"}}>Start writing…</div>}
          <div ref={editorRef} className="draft-ed" contentEditable suppressContentEditableWarning spellCheck onInput={()=>schedSave(editorRef.current?.innerHTML)} onClick={e=>{if(e.target.type==="checkbox")setTimeout(()=>schedSave(editorRef.current?.innerHTML),50);}} style={{outline:"none",padding:`0 22px 40px`,fontSize:s.editorSize||16,lineHeight:s.lineHeight||1.85,color:t.text,minHeight:200,caretColor:t.accent}}/>
        </div>
        {/* Upgrade panel */}
        {!focusMode&&<div style={{borderTop:`1px solid ${t.border}`,flexShrink:0,background:t.surface}}>
          <button onClick={()=>setPanelOpen(o=>!o)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:"13px 20px",color:t.sub,fontFamily:"inherit"}}>
            <span style={{fontSize:13,fontWeight:650,display:"flex",alignItems:"center",gap:7}}><span style={{color:t.accent}}>✦</span> Upgrade Note{upgBadge.length>0&&<span style={{fontSize:11,background:t.accentFaint,color:t.accent,borderRadius:10,padding:"2px 8px",fontWeight:600}}>{upgBadge.join(" · ")}</span>}</span>
            {panelOpen?<ChevronUp size={16} color={t.dim} strokeWidth={1.8}/>:<ChevronDown size={16} color={t.dim} strokeWidth={1.8}/>}
          </button>
          {panelOpen&&<div style={{padding:"4px 20px 22px",display:"flex",flexDirection:"column",gap:10}}>
            <UpBlock icon={Folder} label="Move to Folder" icolor={t.accent} on={!!folderId} onToggle={()=>setFolderId(null)} t={t}><UpField label="Folder" color={t.sub}><select value={folderId||""} onChange={e=>setFolderId(e.target.value||null)} style={{...inp,cursor:"pointer"}}><option value="">None</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></UpField></UpBlock>
            <UpBlock icon={CheckSquare} label="Mark as Task" icolor={t.task} on={isTask} onToggle={()=>setIsTask(o=>!o)} t={t}>
              <UpField label="Due Date" color={t.sub}><input type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)} style={inp}/></UpField>
              <UpField label="Status" color={t.sub}><select value={taskSt} onChange={e=>setTaskSt(e.target.value)} style={{...inp,cursor:"pointer"}}><option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="done">Done ✓</option></select></UpField>
              <UpField label="Priority" color={t.sub}><PrioritySelector value={priority} onChange={setPriority} t={t}/></UpField>
              <UpField label="Subtasks" color={t.sub}><div style={{display:"flex",flexDirection:"column",gap:7}}>
                {subtasks.map((st,i)=>(<div key={st.id} style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={st.done} onChange={()=>{setSubtasks(p=>p.map((x,j)=>j===i?{...x,done:!x.done}:x));setSaved(false);}} style={{accentColor:t.task,width:16,height:16,cursor:"pointer",flexShrink:0}}/><input value={st.text} onChange={e=>{setSubtasks(p=>p.map((x,j)=>j===i?{...x,text:e.target.value}:x));setSaved(false);}} placeholder="Subtask…" style={{...inp,flex:1,padding:"6px 10px",fontSize:13,textDecoration:st.done?"line-through":"none",opacity:st.done?0.5:1}}/><button onClick={()=>{setSubtasks(p=>p.filter((_,j)=>j!==i));setSaved(false);}} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",flexShrink:0}}><X size={13} color={t.dim} strokeWidth={2.2}/></button></div>))}
                <button onClick={()=>{setSubtasks(p=>[...p,{id:uid(),text:"",done:false}]);setSaved(false);}} style={{background:"none",border:`1.5px dashed ${t.border}`,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,color:t.sub,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,width:"100%"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=t.task;e.currentTarget.style.color=t.task;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.color=t.sub;}}><Plus size={13} strokeWidth={2}/>Add subtask</button>
                {subtasks.length>0&&<div style={{display:"flex",alignItems:"center",gap:9,marginTop:2}}><div style={{flex:1,height:5,borderRadius:3,background:t.border,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.round(doneSubs/subtasks.length*100)}%`,background:t.task,borderRadius:3,transition:"width 0.35s"}}/></div><span style={{fontSize:12,color:t.task,fontWeight:700}}>{doneSubs}/{subtasks.length}</span></div>}
              </div></UpField>
              <UpField label="Repeat" color={t.sub}><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{RECUR_NOTE_OPTIONS.map(({id,label})=><button key={String(id)} onClick={()=>{setRecurType(id);setSaved(false);}} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${recurType===id?t.accent:t.border}`,background:recurType===id?t.accentFaint:t.surface2,color:recurType===id?t.accent:t.sub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>{id&&<RefreshCw size={10} strokeWidth={2.5}/>}{label}</button>)}</div></UpField>
            </UpBlock>
            <UpBlock icon={Target} label="Mark as Goal" icolor={t.goal} on={isGoal} onToggle={()=>setIsGoal(o=>!o)} t={t}>
              <UpField label="Progress" color={t.sub}><div style={{display:"flex",alignItems:"center",gap:12}}><input type="range" min={0} max={100} value={goalProg} onChange={e=>{setGoalProg(Number(e.target.value));setSaved(false);}} style={{flex:1,accentColor:t.goal,cursor:"pointer"}}/><span style={{fontSize:16,fontWeight:800,color:t.goal,minWidth:44,textAlign:"right"}}>{goalProg}%</span></div><div style={{height:7,borderRadius:4,background:t.border,overflow:"hidden",marginTop:4}}><div style={{height:"100%",width:`${goalProg}%`,background:`linear-gradient(90deg,${t.goal},${t.goal}cc)`,borderRadius:4,transition:"width 0.2s"}}/></div><div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>{[0,25,50,75,100].map(v=><button key={v} onClick={()=>{setGoalProg(v);setSaved(false);}} style={{background:goalProg===v?t.goal+"22":t.surface2,border:`1px solid ${goalProg===v?t.goal:t.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,color:goalProg===v?t.goal:t.sub,fontFamily:"inherit"}}>{v}%</button>)}</div></UpField>
            </UpBlock>
            <UpBlock icon={Activity} label="Add to Timeline" icolor={t.accent} on={isTL} onToggle={()=>setIsTL(o=>!o)} t={t}><UpField label="Date" color={t.sub}><input type="date" value={tlDate} onChange={e=>setTlDate(e.target.value)} style={inp}/></UpField></UpBlock>
            <UpBlock icon={Bell} label="Set Reminder" icolor={t.accent} on={isRem} onToggle={()=>setIsRem(o=>!o)} t={t}><UpField label="Date" color={t.sub}><input type="date" value={remDate} onChange={e=>setRemDate(e.target.value)} style={inp}/></UpField><UpField label="Time" color={t.sub}><input type="time" value={remTime} onChange={e=>setRemTime(e.target.value)} style={inp}/></UpField></UpBlock>
            <UpBlock icon={isEnc?Lock:Unlock} label="Encrypt Note" icolor={t.lock} on={isEnc} onToggle={()=>{setIsEnc(o=>!o);if(isEnc){setEncPass("");setEncConf("");setEncErr("");}}} t={t}>
              {note.isEncrypted&&sessionPw?<p style={{fontSize:12,color:t.goal,margin:0}}>✓ Unlocked for this session.</p>:<><UpField label="Password" color={t.sub}><div style={{position:"relative"}}><input type={showPw?"text":"password"} value={encPass} onChange={e=>setEncPass(e.target.value)} placeholder="Create a password" style={{...inp,paddingRight:40}}/><button onClick={()=>setShowPw(s=>!s)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{showPw?<EyeOff size={15} color={t.dim} strokeWidth={1.8}/>:<Eye size={15} color={t.dim} strokeWidth={1.8}/>}</button></div></UpField><UpField label="Confirm" color={t.sub}><input type="password" value={encConf} onChange={e=>setEncConf(e.target.value)} placeholder="Confirm password" style={inp}/></UpField>{encErr&&<p style={{color:t.danger,fontSize:12,margin:0}}>{encErr}</p>}<button onClick={applyEncryption} style={{background:t.lock,color:"#fff",border:"none",borderRadius:8,padding:10,fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"inherit"}}>Apply Encryption</button></>}
            </UpBlock>
            <button onClick={()=>{doSave();setPanelOpen(false);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:12,fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"inherit"}}>{saved?"✓ Saved":"Save Changes"}</button>
          </div>}
        </div>}
      </div>
    </div>
    <FormatToolbar editorRef={editorRef} imgRef={imgRef} bgRef={bgRef} bgImg={bgImg} onBgRemove={()=>{setBgImg(null);setSaved(false);clearTimeout(saveTimer.current);saveTimer.current=setTimeout(doSave,600);}} isListening={isListening} onVoiceToggle={toggleVoice} t={t}/>
    {showExport&&<ExportMenu note={buildNote()} getHtml={getHtml} onClose={()=>setShowExport(false)} t={t}/>}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════
// TIMELINE + TRASH
// ═══════════════════════════════════════════════════════════════════
function TimelineView({notes,onBack,onOpen,t}){
  const groups=groupTimeline(notes);const sects=[{key:"today",label:"Today",color:t.accent},{key:"upcoming",label:"Upcoming",color:t.task},{key:"later",label:"Later",color:t.sub},{key:"past",label:"Past",color:t.dim}];const hasAny=sects.some(sc=>groups[sc.key]?.length);
  return(<div style={{display:"flex",flexDirection:"column",height:"100%",background:t.bg}}><div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:`1px solid ${t.border}`,background:t.surface,flexShrink:0}}><IBtn onClick={onBack} icon={ArrowLeft} color={t.sub}/><span style={{fontSize:18,fontWeight:750,color:t.text}}>Timeline</span></div><div style={{flex:1,overflowY:"auto",padding:"20px"}}>{!hasAny?<Empty icon={Activity} msg="No timeline items yet." t={t}/>:sects.map(({key,label,color})=>groups[key]?.length?(<div key={key} style={{marginBottom:26}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><div style={{width:7,height:7,borderRadius:"50%",background:color}}/><span style={{fontSize:11,fontWeight:700,color,textTransform:"uppercase",letterSpacing:1.2}}>{label}</span></div>{groups[key].map(n=>{const ds=n.timelineDate||n.taskDueDate;const title=n.title?.trim()||stripHtml(n.content).slice(0,50)||"Untitled";return(<div key={n.id} onClick={()=>onOpen(n)} style={{background:t.surface,border:`1px solid ${t.border}`,borderLeft:`3px solid ${color}`,borderRadius:"0 10px 10px 0",padding:"11px 14px",marginBottom:8,cursor:"pointer",transition:"background 0.13s"}} onMouseEnter={e=>e.currentTarget.style.background=t.surface2} onMouseLeave={e=>e.currentTarget.style.background=t.surface}><div style={{fontSize:14,fontWeight:600,color:t.text,marginBottom:3}}>{title}</div><div style={{fontSize:12,color:t.dim,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>{ds&&<span>{fmtDate(ds)}</span>}{n.isTask&&<span style={{color:t.task}}>Task · {n.taskStatus}</span>}{n.isGoal&&<span style={{color:t.goal}}>Goal{n.goalProgress>0?` · ${n.goalProgress}%`:""}</span>}{n.priority&&<PriorityPill priority={n.priority}/>}</div></div>);})}</div>):null)}</div></div>);
}
function TrashView({trash,onRestore,onPermanentDelete,onEmptyTrash,onBack,t,s}){
  const radius=s.cardRadius??12;const daysSince=ts=>{const d=Math.floor((Date.now()-ts)/86400000);return d===0?"Today":d===1?"Yesterday":`${d} days ago`;};
  return(<div style={{display:"flex",flexDirection:"column",height:"100%",background:t.bg}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${t.border}`,background:t.surface,flexShrink:0}}><div style={{display:"flex",alignItems:"center",gap:8}}><IBtn onClick={onBack} icon={ArrowLeft} color={t.sub}/><div><span style={{fontSize:18,fontWeight:750,color:t.text}}>Trash</span>{trash.length>0&&<span style={{fontSize:11,color:t.dim,marginLeft:8}}>Auto-purges after 30 days</span>}</div></div>{trash.length>0&&<button onClick={()=>{if(window.confirm("Permanently delete all?"))onEmptyTrash();}} style={{background:t.danger+"18",border:`1px solid ${t.danger}40`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,color:t.danger,fontFamily:"inherit",fontWeight:600}}>Empty</button>}</div><div style={{flex:1,overflowY:"auto",padding:"16px 20px 30px"}}>{trash.length===0?<Empty icon={Trash2} msg="Trash is empty." illoType="trash" t={t}/>:trash.map(n=>{const plain=stripHtml(n.content);const rawTitle=n.title?.trim();const title=rawTitle||plain.slice(0,60)||"Untitled";const preview=rawTitle?plain.slice(0,100):plain.slice(title.length).trim().slice(0,100);return(<div key={n.id} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:radius,padding:"12px 14px",marginBottom:10,opacity:0.75}}><div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:4}}><span style={{fontWeight:650,fontSize:14,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{title}</span><span style={{fontSize:11,color:t.dim,flexShrink:0}}>{n.trashedAt?daysSince(n.trashedAt):""}</span></div>{preview&&<p style={{fontSize:12.5,color:t.sub,margin:"0 0 10px",lineHeight:1.55,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{preview}</p>}<div style={{display:"flex",gap:8}}><button onClick={()=>onRestore(n.id)} style={{flex:1,background:t.accentFaint,border:`1px solid ${t.accent}40`,borderRadius:8,padding:"7px 0",cursor:"pointer",fontSize:12,color:t.accent,fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><RotateCw size={12} strokeWidth={2}/>Restore</button><button onClick={()=>{if(window.confirm("Permanently delete?"))onPermanentDelete(n.id);}} style={{background:t.danger+"18",border:`1px solid ${t.danger}40`,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,color:t.danger,fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",gap:5}}><Trash2 size={12} strokeWidth={2}/>Delete</button></div></div>);})}</div></div>);
}

// ═══════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════
export default function App(){
  const[settings,setSettings]=useState(DEFAULT_SETTINGS);const[view,setView]=useState("home");const[nav,setNav]=useState("notes");const[notes,setNotes]=useState([]);const[folders,setFolders]=useState([]);const[trash,setTrash]=useState([]);const[events,setEvents]=useState([]);const[calendarDefs,setCalendarDefs]=useState(DEFAULT_CALENDARS);const[current,setCurrent]=useState(null);const[search,setSearch]=useState("");const[filter,setFilter]=useState("all");const[sort,setSort]=useState("updated");const[openFolder,setOpenFolder]=useState(null);const[ready,setReady]=useState(false);
  // ── Phase 9 ──────────────────────────────────────────────────────
  const[isLocked,setIsLocked]=useState(false);const lockTimerRef=useRef(null);const LOCK_TIMEOUT=5*60*1000;
  // ── Phase 10: Onboarding ─────────────────────────────────────────
  const[showOnboard,setShowOnboard]=useState(false);
  const t=computeTheme(settings);

  useEffect(()=>{const f=FONTS.find(x=>x.name===settings.font)||FONTS[0];let link=document.getElementById("verso-font");if(!link){link=document.createElement("link");link.id="verso-font";link.rel="stylesheet";document.head.appendChild(link);}link.href=`https://fonts.googleapis.com/css2?family=${f.url}&display=swap`;document.body.style.cssText="margin:0;padding:0;overflow:hidden;";injectAnimCSS();},[settings.font]);

  useEffect(()=>{(async()=>{try{
    const n=await window.storage.get("draft-notes");if(n?.value)setNotes(JSON.parse(n.value));
    const ev=await window.storage.get("draft-events");if(ev?.value)setEvents(JSON.parse(ev.value));
    const st=await window.storage.get("draft-settings");if(st?.value)setSettings(p=>{const merged={...DEFAULT_SETTINGS,...JSON.parse(st.value)};return merged;});
    const tr=await window.storage.get("draft-trash");if(tr?.value){const p=JSON.parse(tr.value);const cut=Date.now()-30*24*60*60*1000;setTrash(p.filter(n=>n.trashedAt>cut));}
    const fl=await window.storage.get("draft-folders");if(fl?.value)setFolders(JSON.parse(fl.value));
    const cd=await window.storage.get("draft-calendars");if(cd?.value)setCalendarDefs(JSON.parse(cd.value));
  }catch{}
  // Phase 10: onboarding – separate try so a missing key always shows it
  try{const ob=await window.storage.get("verso-onboarded");if(!ob?.value)setShowOnboard(true);}catch{setShowOnboard(true);}
  setReady(true);})();},[]);

  // Phase 9: Initialize lock on load
  useEffect(()=>{if(!ready)return;setSettings(s=>{if(s.appLockEnabled&&s.pinHash)setIsLocked(true);return s;});},[ready]);

  // Phase 9: Schedule notifications when notes or settings change
  useEffect(()=>{if(settings.notificationsEnabled)scheduleNotifications(notes);},[notes,settings.notificationsEnabled]);

  // Phase 9: Auto-lock on tab hide (5 min)
  useEffect(()=>{
    if(!settings.appLockEnabled||!settings.pinHash)return;
    const onVis=()=>{
      if(document.hidden){lockTimerRef.current=setTimeout(()=>setIsLocked(true),LOCK_TIMEOUT);}
      else{clearTimeout(lockTimerRef.current);}
    };
    document.addEventListener("visibilitychange",onVis);
    return()=>{document.removeEventListener("visibilitychange",onVis);clearTimeout(lockTimerRef.current);};
  },[settings.appLockEnabled,settings.pinHash]);

  const persist=useCallback(async(ns,evs,st)=>{try{if(ns!==undefined)await window.storage.set("draft-notes",JSON.stringify(ns));if(evs!==undefined)await window.storage.set("draft-events",JSON.stringify(evs));if(st!==undefined)await window.storage.set("draft-settings",JSON.stringify(st));}catch{}},[]);
  const persistTrash=useCallback(async tr=>{try{await window.storage.set("draft-trash",JSON.stringify(tr));}catch{}},[]);
  const persistFolders=useCallback(async fl=>{try{await window.storage.set("draft-folders",JSON.stringify(fl));}catch{}},[]);
  const persistCalendars=useCallback(async cd=>{try{await window.storage.set("draft-calendars",JSON.stringify(cd));}catch{}},[]);

  const handleSave=useCallback(note=>{const u={...note,updatedAt:Date.now()};setNotes(prev=>{const exists=prev.some(n=>n.id===u.id);const next=exists?prev.map(n=>n.id===u.id?u:n).sort((a,b)=>b.updatedAt-a.updatedAt):[u,...prev];persist(next);return next;});setCurrent(u);},[persist]);
  const handleDelete=useCallback(id=>{const note=notes.find(n=>n.id===id);if(!note)return;const trashed={...note,trashedAt:Date.now()};setNotes(prev=>{const next=prev.filter(n=>n.id!==id);persist(next);return next;});setTrash(prev=>{const next=[trashed,...prev];persistTrash(next);return next;});setView("home");},[notes,persist,persistTrash]);
  const handleDuplicate=useCallback(note=>{const copy={...note,id:uid(),title:note.title?`${note.title} (copy)`:"",createdAt:Date.now(),updatedAt:Date.now(),isPinned:false};setNotes(prev=>{const next=[copy,...prev];persist(next);return next;});setCurrent(copy);},[persist]);
  const handleBulkDelete=useCallback(ids=>{const toTrash=notes.filter(n=>ids.includes(n.id)).map(n=>({...n,trashedAt:Date.now()}));setNotes(prev=>{const next=prev.filter(n=>!ids.includes(n.id));persist(next);return next;});setTrash(prev=>{const next=[...toTrash,...prev];persistTrash(next);return next;});},[notes,persist,persistTrash]);
  const handleBulkDuplicate=useCallback(ids=>{const copies=notes.filter(n=>ids.includes(n.id)).map(n=>({...n,id:uid(),title:n.title?`${n.title} (copy)`:"",createdAt:Date.now(),updatedAt:Date.now(),isPinned:false}));setNotes(prev=>{const next=[...copies,...prev];persist(next);return next;});},[notes,persist]);
  const handleBulkPin=useCallback(ids=>{const allPinned=ids.every(id=>notes.find(n=>n.id===id)?.isPinned);setNotes(prev=>{const next=prev.map(n=>ids.includes(n.id)?{...n,isPinned:!allPinned}:n);persist(next);return next;});},[notes,persist]);
  const handleRestore=useCallback(id=>{const note=trash.find(n=>n.id===id);if(!note)return;const restored={...note,trashedAt:null,updatedAt:Date.now()};setTrash(prev=>{const next=prev.filter(n=>n.id!==id);persistTrash(next);return next;});setNotes(prev=>{const next=[restored,...prev];persist(next);return next;});},[trash,persist,persistTrash]);
  const handlePermanentDelete=useCallback(id=>{setTrash(prev=>{const next=prev.filter(n=>n.id!==id);persistTrash(next);return next;});},[persistTrash]);
  const handleEmptyTrash=useCallback(()=>{setTrash([]);persistTrash([]);},[persistTrash]);
  const handleCreateFolder=useCallback(name=>{const f=blankFolder(name);setFolders(prev=>{const next=[...prev,f];persistFolders(next);return next;});},[persistFolders]);
  const handleRenameFolder=useCallback((id,name)=>{setFolders(prev=>{const next=prev.map(f=>f.id===id?{...f,name}:f);persistFolders(next);return next;});},[persistFolders]);
  const handleDeleteFolder=useCallback(id=>{setFolders(prev=>{const next=prev.filter(f=>f.id!==id);persistFolders(next);return next;});setNotes(prev=>{const next=prev.map(n=>n.folderId===id?{...n,folderId:null}:n);persist(next);return next;});},[persistFolders,persist]);
  const handleMoveOutOfFolder=useCallback(ids=>{setNotes(prev=>{const next=prev.map(n=>ids.includes(n.id)?{...n,folderId:null}:n);persist(next);return next;});},[persist]);
  const handleSaveEvent=useCallback(ev=>{setEvents(prev=>{const exists=prev.some(e=>e.id===ev.id);const next=exists?prev.map(e=>e.id===ev.id?ev:e):[...prev,ev];persist(undefined,next);return next;});},[persist]);
  const handleDeleteEvent=useCallback(id=>{setEvents(prev=>{const next=prev.filter(e=>e.id!==id);persist(undefined,next);return next;});},[persist]);
  const handleSaveSettings=useCallback(st=>{setSettings(st);persist(undefined,undefined,st);},[persist]);
  const handleUpdateCalendars=useCallback(defs=>{setCalendarDefs(defs);persistCalendars(defs);},[persistCalendars]);

  const visible=notes.filter(n=>{const q=search.toLowerCase();const plain=stripHtml(n.content);const ms=!q||n.title.toLowerCase().includes(q)||plain.toLowerCase().includes(q);const mf=filter==="all"||(filter==="tasks"&&n.isTask)||(filter==="goals"&&n.isGoal)||(filter==="encrypted"&&n.isEncrypted);return ms&&mf;});

  if(!ready)return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BASE_THEMES.dark.bg,color:"#484f6b",fontSize:14}}>Loading…</div>;

  // Phase 10: Show onboarding on first launch
  if(showOnboard)return <OnboardingScreen onDone={async()=>{try{await window.storage.set("verso-onboarded","1");}catch{}setShowOnboard(false);}} t={t}/>;

  // Phase 9: Show lock screen
  if(isLocked)return <AppLockScreen onUnlock={()=>setIsLocked(false)} settings={settings} t={t}/>;

  const font=settings.font||"DM Sans";
  return(
    <div style={{height:"100vh",overflow:"hidden",background:t.bg,color:t.text,fontFamily:`'${font}',system-ui,sans-serif`}}>
      {(view==="home"||view==="calendar")&&<div style={{position:"fixed",bottom:0,left:0,right:0,display:"flex",background:t.surface,borderTop:`1px solid ${t.border}`,zIndex:100}}>
        {[{id:"notes",Icon:FileText,label:"Notes",action:()=>{haptic(8);setView("home");setNav("notes");},active:view==="home"&&nav==="notes"},{id:"calendar",Icon:CalendarDays,label:"Calendar",action:()=>{haptic(8);setView("calendar");},active:view==="calendar"},{id:"folders",Icon:Folder,label:"Folders",action:()=>{haptic(8);setView("home");setNav("folders");},active:view==="home"&&nav==="folders"}].map(({id,Icon,label,action,active})=>(
          <button key={id} onClick={action} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",color:active?t.accent:t.dim,padding:"10px 0 14px",fontFamily:"inherit"}}>
            <Icon size={20} color={active?t.accent:t.dim} strokeWidth={1.8}/><span style={{fontSize:11,fontWeight:600}}>{label}</span>
          </button>
        ))}
      </div>}
      {view==="home"&&<HomeView notes={visible} allNotes={notes} folders={folders} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} nav={nav} setNav={setNav} onNew={tpl=>{haptic(10);const n=blankNote({title:tpl.title,content:tpl.content});setCurrent(n);setView("editor");}} onOpen={n=>{haptic(8);setCurrent({...n});setView("editor");}} onTimeline={()=>setView("timeline")} onTrash={()=>setView("trash")} onSettings={()=>setView("settings")} onQuickSave={n=>handleSave(n)} onBulkDelete={handleBulkDelete} onBulkDuplicate={handleBulkDuplicate} onBulkPin={handleBulkPin} onCreateFolder={handleCreateFolder} onRenameFolder={handleRenameFolder} onDeleteFolder={handleDeleteFolder} onOpenFolder={f=>{setOpenFolder(f);setView("folderDetail");}} trashCount={trash.length} t={t} s={settings}/>}
      {view==="editor"&&current&&<NoteEditor key={current.id} note={current} onSave={handleSave} onBack={()=>setView("home")} onDelete={handleDelete} onDuplicate={n=>{handleDuplicate(n);setView("editor");}} folders={folders} t={t} s={settings}/>}
      {view==="folderDetail"&&openFolder&&<FolderDetailView folder={openFolder} notes={notes} onOpen={n=>{setCurrent({...n});setView("editor");}} onBack={()=>{setView("home");setNav("folders");}} onMoveOut={handleMoveOutOfFolder} t={t} s={settings}/>}
      {view==="timeline"&&<TimelineView notes={notes} onBack={()=>setView("home")} onOpen={n=>{setCurrent({...n});setView("editor");}} t={t}/>}
      {view==="calendar"&&<CalendarView events={events} notes={notes} calendarDefs={calendarDefs} onSaveEvent={handleSaveEvent} onDeleteEvent={handleDeleteEvent} onBack={()=>setView("home")} t={t} s={settings}/>}
      {view==="settings"&&<SettingsView settings={settings} onSave={st=>{handleSaveSettings(st);setView("home");}} onBack={()=>setView("home")} onLockNow={()=>{if(settings.appLockEnabled&&settings.pinHash)setIsLocked(true);else setView("home");}} t={t}/>}
      {view==="trash"&&<TrashView trash={trash} onRestore={handleRestore} onPermanentDelete={handlePermanentDelete} onEmptyTrash={handleEmptyTrash} onBack={()=>setView("home")} t={t} s={settings}/>}
    </div>
  );
}
