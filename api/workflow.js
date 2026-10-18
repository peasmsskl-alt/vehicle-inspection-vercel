const { google } = require("googleapis");
const { OAuth2Client } = require("google-auth-library");
const oauth = new OAuth2Client();

function auth() {
  const key=process.env.GOOGLE_PRIVATE_KEY, email=process.env.GOOGLE_CLIENT_EMAIL;
  if(!key||!email) throw new Error("กรุณาตั้ง GOOGLE_CLIENT_EMAIL และ GOOGLE_PRIVATE_KEY");
  return new google.auth.GoogleAuth({credentials:{client_email:email,private_key:key.replace(/\\n/g,"\n")},scopes:["https://www.googleapis.com/auth/spreadsheets"]});
}
async function identify(req){
  const h=String(req.headers.authorization||"");
  if(!h.startsWith("Bearer ")) throw Object.assign(new Error("กรุณาเข้าสู่ระบบด้วย Google"),{status:401});
  if(!process.env.GOOGLE_OAUTH_CLIENT_ID) throw new Error("กรุณาตั้ง GOOGLE_OAUTH_CLIENT_ID ใน Vercel");
  const ticket=await oauth.verifyIdToken({idToken:h.slice(7),audience:process.env.GOOGLE_OAUTH_CLIENT_ID});
  const p=ticket.getPayload(), email=String(p.email||"").toLowerCase();
  if(!p.email_verified||!email) throw Object.assign(new Error("ไม่สามารถยืนยันอีเมลได้"),{status:401});
  const domain=String(process.env.ALLOWED_EMAIL_DOMAIN||"").toLowerCase();
  if(domain && email.split("@")[1]!==domain) throw Object.assign(new Error("อีเมลนี้ไม่มีสิทธิ์ใช้งาน"),{status:403});
  return {email,name:p.name||email};
}
const n=v=>String(v||"").trim().toLowerCase();
async function values(api,id,range){const r=await api.spreadsheets.values.get({spreadsheetId:id,range});return r.data.values||[];}
function colName(n){let s="";while(n){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;}
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 if(!["GET","POST"].includes(req.method)) return res.status(405).json({error:"Method not allowed"});
 try{
  const user=await identify(req), id=process.env.GOOGLE_SHEET_ID;
  if(!id) throw new Error("ไม่พบ GOOGLE_SHEET_ID");
  const api=google.sheets({version:"v4",auth:auth()});
  const [jp,ea,rows]=await Promise.all([values(api,id,"JorPorW!A:Z"),values(api,id,"EmployeeApprovers!A:Z"),values(api,id,"Inspections!A:X")]);
  const admins=(process.env.ADMIN_EMAILS||"").split(",").map(n);
  let role=admins.includes(user.email)?"ADMIN":"CONTROLLER", displayName=user.name;
  function inSheet(data){
   if(!data.length)return null;
   const hs=data[0].map(n), ei=hs.findIndex(x=>["อีเมล","email","e-mail","อีเมลผู้ใช้งาน"].includes(x));
   const ni=hs.findIndex(x=>["ชื่อ","ชื่อ-นามสกุล","ชื่อผู้ใช้งาน","ผู้อนุมัติ","หัวหน้าแผนก","ชื่อ จป.ว."].includes(x));
   const ai=hs.findIndex(x=>["ใช้งาน","สถานะ","active"].includes(x));
   if(ei<0)return null;
   for(const r of data.slice(1)) if(n(r[ei])===user.email && !(ai>=0&&["false","0","no","ไม่ใช้งาน"].includes(n(r[ai])))) return {name:ni>=0?r[ni]||"":""};
   return null;
  }
  if(role!=="ADMIN"){
   const a=inSheet(jp), b=inSheet(ea);
   if(a){role="JORPORW";displayName=a.name||displayName;}
   else if(b){role="APPROVER";displayName=b.name||displayName;}
  }
  if(req.method==="GET"){
   const headers=rows[0]||[];
   const records=rows.slice(1).map((r,i)=>({row:i+2,inspectionId:r[2]||"",date:r[0]||"",time:r[1]||"",workType:r[3]||"",shift:r[4]||"",location:r[5]||"",controller:r[6]||"",peopleCount:r[7]||"",vehicleType:r[9]||"",plate:r[10]||"",vehicleResult:r[11]||"",tools:r[13]||"",prevention:r[14]||"",photoUrl:r[15]||"",status:r[17]||"",assignedApprover:r[19]||"",safetyStatus:r[22]||"",reason:r[23]||""})).filter(x=>x.inspectionId);
   const visible=records.filter(x=>role==="ADMIN"||role==="JORPORW"|| (role==="APPROVER"&&(n(x.assignedApprover)===n(displayName)||n(x.assignedApprover)===user.email)) || (role==="CONTROLLER"&&(n(x.controller)===n(displayName)||n(x.controller)===n(user.name)||n(x.controller)===user.email)));
   return res.status(200).json({user:{...user,role,displayName},records:visible});
  }
  const {action, row, reason=""}=req.body||{}, rn=Number(row);
  if(!Number.isInteger(rn)||rn<2) throw new Error("แถวรายการไม่ถูกต้อง");
  if(!["pass_safety","return_safety","approve","reject"].includes(action)) throw new Error("คำสั่งไม่ถูกต้อง");
  const safety=["pass_safety","return_safety"].includes(action);
  if(safety&&!["JORPORW","ADMIN"].includes(role)) throw Object.assign(new Error("เฉพาะ จป.ว. หรือ ADMIN ดำเนินการได้"),{status:403});
  if(!safety&&!["APPROVER","ADMIN"].includes(role)) throw Object.assign(new Error("เฉพาะผู้อนุมัติหรือ ADMIN ดำเนินการได้"),{status:403});
  if(["return_safety","reject"].includes(action)&&!String(reason).trim()) throw new Error("กรุณาระบุเหตุผล");
  const rowData=rows[rn-1]||[];
  if(!rowData[2]) throw new Error("ไม่พบรายการ");
  if(role==="APPROVER"&&n(rowData[19])!==n(displayName)&&n(rowData[19])!==user.email) throw Object.assign(new Error("รายการนี้ไม่ได้มอบหมายให้คุณ"),{status:403});
  const now=new Date().toLocaleString("th-TH",{timeZone:"Asia/Bangkok"});
  const updates=safety?[
   {range:`Inspections!W${rn}`,values:[[action==="pass_safety"?"ผ่าน จป.ว.":"ส่งกลับแก้ไข"]]},
   {range:`Inspections!S${rn}`,values:[[displayName]]},
   {range:`Inspections!U${rn}`,values:[[now]]},
   {range:`Inspections!X${rn}`,values:[[String(reason).trim()]]},
   {range:`Inspections!R${rn}`,values:[[action==="pass_safety"?"รออนุมัติ":"แก้ไขตามข้อเสนอแนะ"]]}
  ]:[
   {range:`Inspections!R${rn}`,values:[[action==="approve"?"อนุมัติแล้ว":"ไม่อนุมัติ"]]},
   {range:`Inspections!V${rn}`,values:[[now]]},
   {range:`Inspections!U${rn}`,values:[[displayName]]},
   {range:`Inspections!X${rn}`,values:[[String(reason).trim()]]}
  ];
  await api.spreadsheets.values.batchUpdate({spreadsheetId:id,requestBody:{valueInputOption:"USER_ENTERED",data:updates}});
  await api.spreadsheets.values.append({spreadsheetId:id,range:"WorkflowLog!A:G",valueInputOption:"USER_ENTERED",requestBody:{values:[[now,rowData[2],displayName,user.email,role,action,String(reason).trim()]]}}).catch(()=>{});
  return res.status(200).json({ok:true,message:"บันทึกผลแล้ว"});
 }catch(e){console.error(e);return res.status(e.status||500).json({error:e.message||"เกิดข้อผิดพลาด"});}
};
