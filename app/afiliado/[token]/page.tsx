import type {Metadata} from "next";
import AffiliateReport from "@/components/affiliate-report";
export const metadata:Metadata={title:"Resultados do afiliado · Umbral",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <AffiliateReport token={token}/>}
