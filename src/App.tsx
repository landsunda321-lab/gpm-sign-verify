import React, { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { UploadCloud, Stamp, Download, Move, ZoomIn, ZoomOut, FileText, RotateCcw } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

type RenderedPage = { number: number; width: number; height: number; dataUrl: string };

export default function App() {
  const [fileName, setFileName] = useState('');
  const [sourceBytes, setSourceBytes] = useState<ArrayBuffer | null>(null);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [stampPosition, setStampPosition] = useState({ x: 0.68, y: 0.68 });
  const [stampSize, setStampSize] = useState(0.19);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Unggah dokumen PDF untuk mulai menempelkan stempel.');
  const [dragging, setDragging] = useState(false);
  const firstPageRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!sourceBytes) return;
    let cancelled = false;
    const render = async () => {
      setBusy(true);
      try {
        const pdf = await pdfjsLib.getDocument({ data: sourceBytes.slice(0) }).promise;
        const rendered: RenderedPage[] = [];
        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
          const page = await pdf.getPage(pageNo);
          const viewport = page.getViewport({ scale: 1.25 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvasContext: context, viewport }).promise;
          rendered.push({ number: pageNo, width: canvas.width, height: canvas.height, dataUrl: canvas.toDataURL('image/png') });
        }
        if (!cancelled) {
          setPages(rendered);
          setMessage('Atur posisi dan ukuran stempel, lalu unduh PDF hasilnya.');
        }
      } catch (error) {
        if (!cancelled) setMessage('PDF tidak dapat dibaca. Pastikan berkas tidak rusak atau terkunci.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    render();
    return () => { cancelled = true; };
  }, [sourceBytes]);

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setMessage('Pilih berkas dengan format PDF.');
      return;
    }
    setFileName(file.name);
    setPages([]);
    setSourceBytes(await file.arrayBuffer());
    setMessage('Membaca dokumen PDF...');
  };

  const moveStamp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !firstPageRef.current) return;
    const rect = firstPageRef.current.getBoundingClientRect();
    const x = Math.min(0.98, Math.max(0.02, (event.clientX - rect.left - dragOffset.current.x) / rect.width));
    const y = Math.min(0.98, Math.max(0.02, (event.clientY - rect.top - dragOffset.current.y) / rect.height));
    setStampPosition({ x, y });
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const stampRect = event.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: event.clientX - stampRect.left, y: event.clientY - stampRect.top };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const finishDrag = () => setDragging(false);

  const exportPdf = async () => {
    if (!sourceBytes || !pages.length) return;
    setBusy(true);
    setMessage('Menanamkan stempel ke seluruh halaman PDF...');
    try {
      const pdf = await PDFDocument.load(sourceBytes);
      const response = await fetch('/stamp-gpm.png', { cache: 'no-store' });
      if (!response.ok) throw new Error('Aset stempel tidak ditemukan pada /public/stamp-gpm.png');
      const stampBytes = await response.arrayBuffer();
      const stampImage = await pdf.embedPng(stampBytes);
      const pageList = pdf.getPages();
      pageList.forEach((page, index) => {
        const preview = pages[index];
        if (!preview) return;
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();
        const width = pageWidth * stampSize;
        const height = width * (stampImage.height / stampImage.width);
        const centerX = stampPosition.x * pageWidth;
        const centerYFromTop = stampPosition.y * pageHeight;
        page.drawImage(stampImage, {
          x: centerX - width / 2,
          y: pageHeight - centerYFromTop - height / 2,
          width,
          height,
          opacity: 1
        });
      });
      const output = await pdf.save();
      const blob = new Blob([output], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName.replace(/\.pdf$/i, '') + '-berstempel.pdf';
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Berhasil. Stempel asli sudah ditanamkan ke setiap halaman PDF.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal membuat PDF hasil stempel.');
    } finally {
      setBusy(false);
    }
  };

  const stampUrl = '/stamp-gpm.png';

  return (
    <main style={{ minHeight: '100vh', background: '#f3f6fb', color: '#172b4d', fontFamily: 'Inter, Arial, sans-serif', padding: '32px 18px' }}>
      <style>{`
        * { box-sizing: border-box; }
        button, input { font: inherit; }
        .gpm-shell { max-width: 1120px; margin: 0 auto; }
        .gpm-panel { background: white; border: 1px solid #dce5f0; border-radius: 18px; padding: 22px; box-shadow: 0 8px 28px rgba(20,45,80,.06); }
        .gpm-button { border: 0; border-radius: 10px; padding: 12px 17px; background: #123b70; color: white; font-weight: 650; cursor: pointer; display: inline-flex; align-items: center; gap: 9px; }
        .gpm-button:disabled { opacity: .5; cursor: not-allowed; }
        .gpm-secondary { background: #eaf1f9; color: #173d6b; }
        .gpm-page { position: relative; width: min(100%, 760px); margin: 18px auto; border: 1px solid #d6deea; background: white; box-shadow: 0 5px 18px rgba(20,40,70,.12); touch-action: none; }
        .gpm-page img.paper { width: 100%; display: block; }
        .gpm-stamp { position: absolute; transform: translate(-50%,-50%); cursor: move; touch-action: none; user-select: none; filter: none; }
        .gpm-controls { display: grid; grid-template-columns: repeat(auto-fit,minmax(210px,1fr)); gap: 18px; align-items: center; }
        .gpm-note { background: #edf5ff; border: 1px solid #d3e5fa; border-radius: 10px; padding: 12px 14px; color: #244c78; }
        @media(max-width:600px){ .gpm-panel{padding:15px} }
      `}</style>
      <div className="gpm-shell">
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#123b70', color: 'white', display: 'grid', placeItems: 'center' }}><Stamp size={25}/></div>
          <div><div style={{ fontSize: 12, letterSpacing: 1.5, color: '#66809f', fontWeight: 700 }}>GRIYA PUSTAKA MANDIRI</div><h1 style={{ margin: '3px 0 0', fontSize: 25 }}>Penempelan Stempel Dokumen</h1></div>
        </header>
        <section className="gpm-panel" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <label className="gpm-button" style={{ cursor: 'pointer' }}><UploadCloud size={18}/> Pilih PDF<input type="file" accept="application/pdf,.pdf" onChange={onUpload} style={{ display: 'none' }}/></label>
            <div style={{ color: '#647b98', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}><FileText size={16}/>{fileName || 'Belum ada dokumen dipilih'}</div>
          </div>
          <p style={{ margin: '16px 0 0', color: '#5d718b', fontSize: 14 }}>{message}</p>
        </section>
        {pages.length > 0 && <>
          <section className="gpm-panel" style={{ marginBottom: 18 }}>
            <h2 style={{ margin: '0 0 18px', fontSize: 17 }}>Pengaturan Stempel Resmi</h2>
            <div className="gpm-controls">
              <div><label style={{ display: 'block', fontSize: 13, fontWeight: 650, marginBottom: 8 }}>Ukuran stempel: {Math.round(stampSize*100)}% lebar halaman</label><input type="range" min="0.08" max="0.32" step="0.01" value={stampSize} onChange={e=>setStampSize(Number(e.target.value))} style={{ width: '100%' }}/></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><img src={stampUrl} alt="Stempel resmi Griya Pustaka Mandiri" style={{ width: 68, height: 68, objectFit: 'contain' }}/><span style={{ fontSize: 13, color: '#5d718b' }}>Aset asli PNG dengan transparansi</span></div>
            </div>
            <div className="gpm-note" style={{ marginTop: 16, fontSize: 13 }}>Geser stempel pada halaman pertama. Posisi yang dipilih akan diterapkan konsisten pada seluruh halaman dokumen.</div>
          </section>
          {pages.map((page,index)=><section key={page.number} className="gpm-panel" style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Halaman {page.number}</div>
            <div ref={index===0?firstPageRef:undefined} className="gpm-page" onPointerMove={index===0?moveStamp:undefined} onPointerUp={index===0?finishDrag:undefined} onPointerCancel={index===0?finishDrag:undefined}>
              <img className="paper" src={page.dataUrl} alt={'Pratinjau halaman '+page.number}/>
              <img className="gpm-stamp" src={stampUrl} alt="Stempel GPM" draggable={false} onPointerDown={index===0?beginDrag:undefined} style={{ left: (stampPosition.x*100)+'%', top: (stampPosition.y*100)+'%', width: (stampSize*100)+'%' }}/>
            </div>
          </section>)}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 40 }}>
            <button className="gpm-button gpm-secondary" onClick={()=>{setStampPosition({x:.68,y:.68});setStampSize(.19)}}><RotateCcw size={17}/> Atur ulang</button>
            <button className="gpm-button" onClick={exportPdf} disabled={busy}><Download size={18}/>{busy?'Memproses...':'Unduh PDF Final'}</button>
          </div>
        </>}
        <footer style={{ textAlign: 'center', color: '#8293a9', fontSize: 12, padding: 12 }}>Stempel resmi Griya Pustaka Mandiri · Dokumen diproses di peramban</footer>
      </div>
    </main>
  );
}
