import { Component, useState, useEffect, useRef } from 'react';
import { BookOpen, ShieldCheck, LockKeyhole, LogOut, Settings, Files, FileCheck2, Activity, Archive, Users, LayoutDashboard, Eye, EyeOff, ChevronRight, Menu, X, UploadCloud, Search, UserCog, ClipboardList, PenTool, FileText, Check, Clock, AlertCircle, Plus, Trash2, Download, QrCode, Stamp, Type, CalendarDays, ArrowLeft, ZoomIn, ZoomOut, RotateCcw, Save, Send, CheckCircle2, FolderOpen, History, Filter } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
import QRCode from 'qrcode';

type Screen='login'|'dashboard'|'documents'|'booking'|'certificates'|'users'|'audit'|'archive'|'settings'|'change'|'workspace'|'verify';
type DocStatus='Draft'|'Preparing'|'Waiting Review'|'Waiting Signature'|'Completed'|'Revision'|'Archived';
type ElementType='qr'|'signature'|'paraf'|'text'|'date'|'stamp';
type PlacedElement={id:string;type:ElementType;x:number;y:number;width:number;height:number;label?:string};
type DocRecord={id:string;name:string;number:string;subject:string;sifat:string;tanggalSurat:string;signerName:string;signerTitle:string;created:string;status:DocStatus;size:number;activity:string;elements:PlacedElement[];fileName:string};
const menuItems:{id:Screen;label:string;icon:any}[]=[{id:'dashboard',label:'Dashboard',icon:LayoutDashboard},{id:'documents',label:'Dokumen',icon:Files},{id:'booking',label:'Booking Nomor',icon:ClipboardList},{id:'certificates',label:'Sertifikat & Validasi',icon:FileCheck2},{id:'users',label:'Pengguna',icon:Users},{id:'audit',label:'Audit Log',icon:Activity},{id:'archive',label:'Arsip',icon:Archive},{id:'settings',label:'Pengaturan',icon:Settings}];
const statusLabel:Record<DocStatus,string>={Draft:'Draft',Preparing:'Persiapan', 'Waiting Review':'Menunggu Pemeriksaan','Waiting Signature':'Menunggu Tanda Tangan',Completed:'Selesai',Revision:'Revisi',Archived:'Diarsipkan'};
function normalizeDateInput(value:any):string{if(!value)return '';const s=String(value).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const iso=s.match(/^(\d{4}-\d{2}-\d{2})/);if(iso)return iso[1];const dmy=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(dmy)return dmy[3]+'-'+dmy[2].padStart(2,'0')+'-'+dmy[1].padStart(2,'0');return '';}
const readDocs=():DocRecord[]=>{try{return JSON.parse(localStorage.getItem('gpm_documents')||'[]')}catch{return []}};
function formatVerifyDate(value:any){if(!value)return '-';const s=String(value).trim();let parts:string[]=[];if(s.includes('-')){parts=s.split('-');if(parts.length>=3&&parts[0].length===4){const y=Number(parts[0]),m=Number(parts[1]),d=Number(parts[2].slice(0,2));if(y&& m&& d)return new Date(y,m-1,d).toLocaleDateString('id-ID');}}if(s.includes('/')){parts=s.split('/');if(parts.length===3){const d=Number(parts[0]),m=Number(parts[1]),y=Number(parts[2]);if(y&&m&&d)return new Date(y,m-1,d).toLocaleDateString('id-ID');}}const dt=new Date(s);return Number.isNaN(dt.getTime())?'-':dt.toLocaleDateString('id-ID');}
