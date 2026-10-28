/** Lado maior máximo e qualidade das fotos enviadas: suficiente para fichas e anúncios, e muito mais leve que o original da câmara. */
export const PHOTO_MAX_EDGE=2560;
const PHOTO_QUALITY=0.86;
/** Abaixo disto a foto já é leve: segue como está, sem recomprimir. */
const SKIP_BELOW=1024*1024;
/**
 * Reduz uma foto no browser antes do envio (uma foto de telemóvel pode ter 5–10 MB). Mantém a original se não
 * houver ganho ou se o browser não conseguir descodificá-la. As cores com transparência passam a fundo branco.
 */
export async function optimizePhoto(file:File):Promise<File>{
 if(file.size<=SKIP_BELOW||typeof createImageBitmap!=='function')return file;
 try{
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,PHOTO_MAX_EDGE/Math.max(bitmap.width,bitmap.height));
  const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();return file}
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,width,height);bitmap.close();
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',PHOTO_QUALITY));
  canvas.width=canvas.height=0;
  if(!blob||blob.size>=file.size)return file;
  return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified});
 }catch{return file}
}
