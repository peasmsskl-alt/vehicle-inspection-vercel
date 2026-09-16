const { google } = require('googleapis');
function getSheets(){
 const raw=process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
 if(!raw) throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_SERVICE_ACCOUNT_JSON_B64');
 const credentials=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));
 const auth=new google.auth.GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/spreadsheets']});
 return google.sheets({version:'v4',auth});
}
function sheetId(){if(!process.env.GOOGLE_SHEET_ID)throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_SHEET_ID');return process.env.GOOGLE_SHEET_ID;}
async function getValues(range){const r=await getSheets().spreadsheets.values.get({spreadsheetId:sheetId(),range});return r.data.values||[];}
async function appendValues(range,values){await getSheets().spreadsheets.values.append({spreadsheetId:sheetId(),range,valueInputOption:'USER_ENTERED',insertDataOption:'INSERT_ROWS',requestBody:{values:[values]}});}
module.exports={getValues,appendValues};
