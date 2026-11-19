const express = require("express");
const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth");
const requireAdmin = require("../../middleware/admin");
const router = express.Router();
router.use(authenticateToken, requireAdmin);
function wrap(handler){return(req,res)=>Promise.resolve(handler(req,res)).catch(error=>{console.error("Fee settings error:",error);if(!res.headersSent)res.status(500).json({success:false,message:"Unable to save payment settings"});});}
function safeSettings(settings){return settings?{enabled:settings.enabled,merchantName:settings.merchantName,merchantPhone:settings.merchantPhone,bankName:settings.bankName,bankAccountName:settings.bankAccountName,bankAccountNumber:settings.bankAccountNumber,khaltiConfigured:Boolean(settings.khaltiSecretEncrypted)}:{enabled:false,merchantName:"",merchantPhone:"",bankName:"",bankAccountName:"",bankAccountNumber:"",khaltiConfigured:false};}
router.get("/",wrap(async(req,res)=>{const settings=await prisma.institutionFeeSettings.findUnique({where:{institutionId:req.user.institutionId}});res.json({success:true,data:safeSettings(settings)});}));
router.put("/",wrap(async(req,res)=>{
 const merchantName=String(req.body.merchantName||"").trim();const merchantPhone=String(req.body.merchantPhone||"").trim();const bankName=String(req.body.bankName||"").trim();const bankAccountName=String(req.body.bankAccountName||"").trim();const bankAccountNumber=String(req.body.bankAccountNumber||"").trim();const secret=String(req.body.khaltiSecretKey||"").trim();const clearSecret=req.body.clearKhaltiSecret===true;
 if(merchantName.length>150||merchantPhone.length>50||bankName.length>150||bankAccountName.length>150||bankAccountNumber.length>80||secret.length>500)return res.status(400).json({success:false,message:"Payment setting values exceed allowed lengths"});
 const current=await prisma.institutionFeeSettings.findUnique({where:{institutionId:req.user.institutionId}});
 if(secret && !process.env.FEE_SETTINGS_ENCRYPTION_KEY)return res.status(503).json({success:false,message:"Per-institution Khalti keys require FEE_SETTINGS_ENCRYPTION_KEY to be configured by the server administrator"});
 const encryptionKey=process.env.FEE_SETTINGS_ENCRYPTION_KEY?Buffer.from(process.env.FEE_SETTINGS_ENCRYPTION_KEY,"hex"):null;
 if(secret && encryptionKey && encryptionKey.length!==32)return res.status(503).json({success:false,message:"Server payment encryption key is invalid"});
 let secretEncrypted=clearSecret?null:current?.khaltiSecretEncrypted||null;
 if(secret){const iv=require("crypto").randomBytes(12);const cipher=require("crypto").createCipheriv("aes-256-gcm",encryptionKey,iv);const encrypted=Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]);secretEncrypted=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString("base64");}
 const settings=await prisma.institutionFeeSettings.upsert({where:{institutionId:req.user.institutionId},create:{institutionId:req.user.institutionId,merchantName,merchantPhone,bankName,bankAccountName,bankAccountNumber,khaltiSecretEncrypted:secretEncrypted,enabled:req.body.enabled===true},update:{merchantName,merchantPhone,bankName,bankAccountName,bankAccountNumber,khaltiSecretEncrypted:secretEncrypted,enabled:req.body.enabled===true}});
 res.json({success:true,message:"Institution payment settings saved",data:safeSettings(settings)});
}));
module.exports=router;
