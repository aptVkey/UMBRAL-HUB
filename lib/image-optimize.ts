import {PHOTO_THUMB,PHOTO_VIEW,PHOTO_WIDTHS} from './property';
/** Lado maior máximo e qualidade das fotos enviadas: suficiente para fichas e anúncios, e muito mais leve que o original da câmara. */
export const PHOTO_MAX_EDGE=2560;
const PHOTO_QUALITY=0.86;
const VARIANT_QUALITY:Record<number,number>={[PHOTO_THUMB]:0.72,[PHOTO_VIEW]:0.8};
/** Abaixo disto a foto já é leve: segue como está, sem recomprimir. */
const SKIP_BELOW=1024*1024;
function encode(bitmap:ImageBitmap,scale:number,quality:number){
 const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)return Promise.resolve(null);
 ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,width,height);
 return new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
}
/**
 * Prepara uma foto no browser antes do envio, sem custos de servidor: reduz o original (uma foto de telemóvel pode ter
 * 5–10 MB) e gera as versões da grelha e do ecrã inteiro. Mantém a original se não houver ganho e, se o browser não a
 * conseguir descodificar, segue sem versões. As zonas transparentes passam a fundo branco.
 */
export async function preparePhoto(file:File):Promise<{file:File,variants:{width:number,blob:Blob}[]}>{
 if(typeof createImageBitmap!=='function')return {file,variants:[]};
 let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(file)}catch{return {file,variants:[]}}
 try{
  let out=file;
  if(file.size>SKIP_BELOW){
   const blob=await encode(bitmap,Math.min(1,PHOTO_MAX_EDGE/Math.max(bitmap.width,bitmap.height)),PHOTO_QUALITY);
   if(blob&&blob.size<file.size)out=new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified});
  }
  const variants:{width:number,blob:Blob}[]=[];
  for(const width of PHOTO_WIDTHS){const blob=await encode(bitmap,Math.min(1,width/bitmap.width),VARIANT_QUALITY[width]);if(blob)variants.push({width,blob})}
  return {file:out,variants};
 }catch{return {file,variants:[]}}finally{bitmap.close()}
}
