/** Corre `task` sobre todos os itens, no máximo `limit` de cada vez. Se uma tarefa falhar, não começa mais nenhuma e a falha é propagada. */
export async function inParallel<T>(items:T[],limit:number,task:(item:T,index:number)=>Promise<void>){
 let next=0;
 const worker=async()=>{while(next<items.length){const i=next++;try{await task(items[i],i)}catch(e){next=items.length;throw e}}};
 await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
}
