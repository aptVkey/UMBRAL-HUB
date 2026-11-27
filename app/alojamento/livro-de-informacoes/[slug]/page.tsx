import type {Metadata} from "next";
import PropertyBrochure from "@/components/property-brochure";
export const metadata:Metadata={title:"Livro de informações · Umbral",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <PropertyBrochure slug={decodeURIComponent(slug)}/>}
