const {CHECKLISTS}=require('../lib/checklists');
export default async function handler(req,res){const type=String(req.query.type||'รถยนต์');res.status(200).json({success:true,items:CHECKLISTS[type]||CHECKLISTS['รถยนต์']});}
