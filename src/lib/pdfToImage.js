// Převede první stranu PDF na PNG soubor (v prohlížeči), aby šla poslat do stejného
// OCR toku jako běžná fotka — Supabase Edge Function OCR neumí PDF, jen obrázky.
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc

export async function pdfFirstPageToImageFile(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Převod PDF na obrázek se nezdařil.'))), 'image/png')
  )

  return new File([blob], file.name.replace(/\.pdf$/i, '.png'), { type: 'image/png' })
}
